const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const accountsRegistry = require('./accountsRegistry');
const nodeRegistry = require('./nodeRegistry');
const nodeClient = require('./nodeClient');

function accountIdFor(server, characterName) {
  return `https___${server.replace(/\./g, '_')}__${characterName}`;
}

const CANDIDATES = [
  process.env.MERCY_DATA_DIR,
  path.join(os.homedir(), '.local', 'share', 'mercy-sf'),
  path.join(os.homedir(), '.config', 'mercy-sf'),
  path.join(os.homedir(), '.mercy-sf'),
  '/opt/mercy/data',
  '/root/.local/share/mercy-sf',
  '/root/.config/mercy-sf',
].filter(Boolean);

function findDataDir() {
  for (const c of CANDIDATES) {
    if (fs.existsSync(path.join(c, 'analytics')) || fs.existsSync(path.join(c, 'credentials.json'))) {
      return c;
    }
  }
  return null;
}

// Zeigt NUR Charaktere, für die aktuell ein Account-Profil existiert (Account-Verwaltung ist
// die alleinige Quelle der Wahrheit für "sichtbare" Accounts). Wird ein Profil gelöscht,
// verschwindet der Charakter damit auch aus Sidebar/Übersicht/Dropdown — die zugrunde
// liegenden Rohdaten (analytics/, battle_history/ etc.) bleiben dabei unangetastet.
function listAccounts(dataDir) {
  const analyticsDir = path.join(dataDir, 'analytics');
  return accountsRegistry.list()
    .filter(p => p.server && p.characterName)
    .map(p => ({
      id: accountIdFor(p.server, p.characterName),
      charName: p.characterName,
      server: p.server,
      profileId: p.id,
      nickname: p.nickname,
    }))
    .filter(acc => fs.existsSync(path.join(analyticsDir, `${acc.id}.json`)));
}

// Gegenstück zu listAccounts() für Accounts, die auf einem gepairten Node laufen — die CLI
// schreibt deren Analytics-Dateien auf der Platte des Nodes, nicht lokal, also einmal pro
// betroffenem Node abfragen (GET /profiles liefert dort pro Profil bereits den neuesten
// Snapshot mit, siehe node-agent/server.js) statt pro Account einzeln nachzufragen. Wie bei
// listAccounts() erscheint ein Account erst, sobald überhaupt ein Snapshot existiert (CLI lief
// dort mindestens einmal) — ein frisch zugewiesener, noch nie gestarteter Account bleibt unsichtbar.
async function listRemoteAccounts() {
  const remoteProfiles = accountsRegistry.list().filter(p => p.nodeId && p.server && p.characterName);
  if (!remoteProfiles.length) return [];
  const nodeIds = [...new Set(remoteProfiles.map(p => p.nodeId))];
  const byNode = new Map();
  await Promise.all(nodeIds.map(async id => {
    const node = nodeRegistry.get(id);
    if (!node) return;
    try {
      const list = await nodeClient.call(node, '/profiles', { timeoutMs: 8000 });
      byNode.set(id, new Map(list.map(p => [p.id, p])));
      nodeRegistry.markSeen(id, 'online');
    } catch (err) {
      nodeRegistry.markSeen(id, 'offline');
    }
  }));
  const result = [];
  for (const profile of remoteProfiles) {
    const remote = byNode.get(profile.nodeId) && byNode.get(profile.nodeId).get(profile.id);
    if (!remote || !remote.snapshot) continue;
    result.push({
      id: accountIdFor(profile.server, profile.characterName),
      charName: profile.characterName,
      server: profile.server,
      profileId: profile.id,
      nickname: profile.nickname,
      nodeId: profile.nodeId,
      stats: remote.snapshot,
      currentActivity: null,
    });
  }
  return result;
}

// Reverse-Lookup: die im Frontend/Overview verwendete "accountId" ist accountIdFor(server,
// characterName), nicht die Profil-ID aus accountsRegistry (die für PTY/Start/Stop genutzt
// wird) — Endpunkte, die einen vollständigen Profil-Datensatz brauchen (z. B. für CLI-Aufrufe
// mit Username/Passwort), müssen also erst zum Profil zurückfinden.
function findProfileByAccountId(accountId) {
  return accountsRegistry.list().find(p =>
    p.server && p.characterName && accountIdFor(p.server, p.characterName) === accountId);
}

function latestSnapshot(dataDir, id) {
  const p = path.join(dataDir, 'analytics', `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const snaps = data.snapshots || [];
    if (!snaps.length) return null;
    return snaps[snaps.length - 1];
  } catch (e) {
    return null;
  }
}

function recentLogLines(dataDir, charName, limit = 25) {
  const logsDir = path.join(dataDir, 'logs');
  if (!fs.existsSync(logsDir)) return [];
  const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log')).sort().reverse();
  if (!files.length) return [];
  const content = fs.readFileSync(path.join(logsDir, files[0]), 'utf8');
  const lines = content.split('\n').filter(l => l.includes(`[${charName}]`));
  return lines.slice(-limit).reverse();
}

function isProcessRunning() {
  try {
    const out = execSync("pgrep -f mercy-cli-linux-x64 || true").toString().trim();
    return out.length > 0;
  } catch (e) {
    return false;
  }
}

module.exports = { findDataDir, listAccounts, listRemoteAccounts, latestSnapshot, recentLogLines, isProcessRunning, accountIdFor, findProfileByAccountId };
