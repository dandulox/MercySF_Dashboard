const fs = require('fs');
const path = require('path');

// Verwaltung gepairter Node-Agents (entfernte Server, die eigene Accounts hosten). Gleiches
// Muster wie accountsRegistry.js/sessionStore.js: flache JSON-Datei mit restriktiven Rechten.
// Der Token IST das Geheimnis (wie bei Session-Tokens) — die Datei selbst ist nicht zusätzlich
// verschlüsselt, das schützt (wie beim Rest des Projekts) vor versehentlichem Kopieren/Git, nicht
// vor jemandem mit vollem Server-Zugriff.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'nodes.json');

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function list() {
  return readAll();
}

function get(id) {
  return readAll().find(n => n.id === id) || null;
}

// id = die vom Node-Agent selbst vergebene, stabile nodeId (lib/identity.js dort) — kein eigenes
// ID-Schema im Dashboard nötig, und ein erneutes Pairing desselben Node aktualisiert automatisch
// den bestehenden Eintrag statt einen Duplikat-Datensatz anzulegen.
function upsert({ id, name, host, port, useTls, token, cliVersion }) {
  if (!id || !host || !port || !token) throw new Error('id, host, port und token sind erforderlich');
  const all = readAll();
  const existing = all.find(n => n.id === id);
  const entry = {
    id,
    name: String(name || existing?.name || id).slice(0, 60),
    host: String(host).slice(0, 255),
    port: Number(port),
    useTls: !!useTls,
    token,
    cliVersion: cliVersion || null,
    pairedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    lastStatus: 'online',
  };
  if (existing) {
    Object.assign(existing, entry);
  } else {
    all.push(entry);
  }
  writeAll(all);
  return existing || entry;
}

function rename(id, name) {
  const all = readAll();
  const node = all.find(n => n.id === id);
  if (!node) return null;
  node.name = String(name).slice(0, 60);
  writeAll(all);
  return node;
}

function markSeen(id, status) {
  const all = readAll();
  const node = all.find(n => n.id === id);
  if (!node) return null;
  node.lastSeen = new Date().toISOString();
  node.lastStatus = status;
  writeAll(all);
  return node;
}

function remove(id) {
  const all = readAll();
  const filtered = all.filter(n => n.id !== id);
  writeAll(filtered);
  return filtered.length !== all.length;
}

module.exports = { list, get, upsert, rename, markSeen, remove };
