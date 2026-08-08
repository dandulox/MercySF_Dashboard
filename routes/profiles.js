const express = require('express');
const fs = require('fs');
const path = require('path');
const registry = require('../lib/accountsRegistry');
const ptyManager = require('../lib/ptyManager');
const credentialStore = require('../lib/credentialStore');
const discoveryLogin = require('../lib/discoveryLogin');
const { findDataDir } = require('../lib/data');
const logBuffer = require('../lib/logBuffer');
const cli = require('../lib/cliExec');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');

const router = express.Router();

function accountIdFor(server, characterName) {
  return `https___${server.replace(/\./g, '_')}__${characterName}`;
}

function serverFromUrl(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

// Ein Profil mit gesetzter nodeId läuft nicht lokal — Start/Stop/Status/Settings/etc. müssen an
// den zuständigen Node-Agent weitergereicht werden statt ptyManager/cliExec direkt zu benutzen.
// Fehlt der Node (gelöscht, aber Profil noch nicht aktualisiert) oder ist er nicht erreichbar,
// bekommt der Aufrufer einen klaren Fehler statt eines stillen Fallbacks auf "lokal".
function remoteNodeFor(profile) {
  if (!profile.nodeId) return null;
  const node = nodeRegistry.get(profile.nodeId);
  if (!node) throw Object.assign(new Error('Der zugewiesene Node existiert nicht mehr'), { status: 409 });
  return node;
}

async function fetchRemoteStatuses(nodeId) {
  const node = nodeRegistry.get(nodeId);
  if (!node) return new Map();
  try {
    const list = await nodeClient.call(node, '/profiles', { timeoutMs: 6000 });
    nodeRegistry.markSeen(node.id, 'online');
    return new Map(list.map(p => [p.id, p.status]));
  } catch (err) {
    nodeRegistry.markSeen(node.id, 'offline');
    return new Map();
  }
}

const OFFLINE_UNREACHABLE = { running: false, botState: 'offline', lastExitInfo: { reason: 'node_unreachable' }, startedAt: null, commandsSent: 0, errorsSeen: 0 };

router.get('/', async (req, res) => {
  const all = registry.list();
  const remoteNodeIds = [...new Set(all.filter(p => p.nodeId).map(p => p.nodeId))];
  const statusMaps = new Map();
  await Promise.all(remoteNodeIds.map(async id => statusMaps.set(id, await fetchRemoteStatuses(id))));

  const profiles = all.map(p => {
    if (p.nodeId) {
      const status = statusMaps.get(p.nodeId)?.get(p.id) || OFFLINE_UNREACHABLE;
      return { ...p, status, hasPassword: credentialStore.hasPassword(p.username), currentActivity: null, activityHistory: [], scoutedPlayers: [] };
    }
    return {
      ...p,
      status: ptyManager.getStatus(p.id),
      hasPassword: credentialStore.hasPassword(p.username),
      currentActivity: p.characterName ? logBuffer.getLastActivity(p.characterName) : null,
      activityHistory: p.characterName ? logBuffer.getActivityHistory(p.characterName) : [],
      scoutedPlayers: p.characterName ? logBuffer.getScoutedPlayers(p.characterName) : [],
    };
  });
  res.json(profiles);
});

// Loggt einmalig testweise ein, um alle Charaktere für diesen Login zu finden, speichert das
// Passwort verschlüsselt und legt für JEDEN gefundenen Charakter direkt ein fertiges,
// voll automatisierbares Profil an. Das Passwort verlässt diese Anfrage an keiner anderen
// Stelle als hier (kein Logging, keine Rückgabe an den Client). Optional: nodeId weist alle neu
// gefundenen Charaktere direkt einem entfernten Node zu, statt lokal zu laufen.
router.post('/', express.json(), async (req, res) => {
  const { username, password, nodeId } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username und password sind erforderlich' });
  }
  let node = null;
  if (nodeId) {
    node = nodeRegistry.get(nodeId);
    if (!node) return res.status(400).json({ error: 'Node nicht gefunden' });
  }
  let characters;
  try {
    characters = await discoveryLogin.runDiscoveryLogin(username, password);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!characters.length) {
    return res.status(400).json({ error: 'Keine Charaktere für diesen Login gefunden.' });
  }

  credentialStore.setPassword(username, password);

  const created = [];
  const skipped = [];
  for (const c of characters) {
    try {
      const profile = registry.add({
        username,
        server: serverFromUrl(c.url),
        characterName: c.name,
        nickname: c.name,
        nodeId: node ? node.id : null,
      });
      if (node) {
        try {
          await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}`, {
            method: 'PUT',
            body: { username: profile.username, server: profile.server, characterName: profile.characterName, nickname: profile.nickname, password },
          });
        } catch (err) {
          skipped.push({ characterName: c.name, reason: `Auf Node "${node.name}" nicht anlegbar: ${err.message}` });
          registry.remove(profile.id);
          continue;
        }
      }
      created.push(profile);
    } catch (err) {
      skipped.push({ characterName: c.name, reason: err.message });
    }
  }
  res.status(201).json({ created, skipped, totalFound: characters.length });
});

router.post('/:id/nickname', express.json(), (req, res) => {
  const { nickname } = req.body || {};
  try {
    const profile = registry.rename(req.params.id, nickname);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
    res.json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Weist ein bestehendes Profil (nachträglich) einem Node zu oder holt es zurück auf "lokal"
// (nodeId: null). Beim Zuweisen wird das gespeicherte Passwort mitgeschickt, damit der Node die
// CLI sofort automatisiert starten kann; beim Zurückholen wird das Profil auf dem alten Node
// best-effort gelöscht.
router.post('/:id/node', express.json(), async (req, res) => {
  const { nodeId } = req.body || {};
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const oldNode = profile.nodeId ? nodeRegistry.get(profile.nodeId) : null;
  if (oldNode) {
    ptyManager.killPty(profile.id); // no-op falls eh nicht lokal lief
    try { await nodeClient.call(oldNode, `/profiles/${encodeURIComponent(profile.id)}`, { method: 'DELETE' }); } catch (err) { /* alter Node evtl. offline */ }
  } else {
    ptyManager.killPty(profile.id);
  }

  if (!nodeId) {
    const updated = registry.setNode(profile.id, null);
    return res.json(updated);
  }

  const node = nodeRegistry.get(nodeId);
  if (!node) return res.status(400).json({ error: 'Node nicht gefunden' });
  const password = credentialStore.getPassword(profile.username);
  try {
    await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}`, {
      method: 'PUT',
      body: { username: profile.username, server: profile.server, characterName: profile.characterName, nickname: profile.nickname, password },
    });
  } catch (err) {
    return res.status(502).json({ error: `Node "${node.name}" nicht erreichbar: ${err.message}` });
  }
  const updated = registry.setNode(profile.id, node.id);
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  const node = profile.nodeId ? nodeRegistry.get(profile.nodeId) : null;
  if (node) {
    try { await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}`, { method: 'DELETE' }); } catch (err) { /* Node evtl. offline — lokalen Eintrag trotzdem entfernen */ }
  } else {
    ptyManager.killPty(req.params.id);
  }
  const removed = registry.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Profil nicht gefunden' });
  res.json({ ok: true });
});

router.post('/:id/start', async (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  try {
    const node = remoteNodeFor(profile);
    if (node) {
      const status = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/start`, { method: 'POST' });
      registry.setAutoStart(profile.id, true);
      return res.json(status);
    }
    ptyManager.ensurePty(profile.id);
    registry.setAutoStart(profile.id, true);
    res.json(ptyManager.getStatus(profile.id));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  try {
    const node = remoteNodeFor(profile);
    if (node) {
      const status = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/stop`, { method: 'POST' });
      registry.setAutoStart(profile.id, false);
      return res.json(status);
    }
    ptyManager.killPty(profile.id);
    registry.setAutoStart(profile.id, false);
    res.json(ptyManager.getStatus(profile.id));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

router.get('/:id/status', async (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  try {
    const node = remoteNodeFor(profile);
    if (node) {
      const status = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/status`, { timeoutMs: 5000 });
      return res.json(status);
    }
    res.json(ptyManager.getStatus(profile.id));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

// Kalender, Tagesaufgaben, ausstehende Freischaltungen einmalig abholen — nutzt den
// nicht-interaktiven CLI-Modus (--claim), unabhängig davon, ob der Bot gerade über die PTY läuft.
router.post('/:id/claim', async (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.server || !profile.characterName) {
    return res.status(400).json({ error: 'Noch kein Charakter für dieses Profil bekannt' });
  }
  try {
    const node = remoteNodeFor(profile);
    if (node) {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/claim`, { method: 'POST' });
      return res.json(result);
    }
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
  const password = credentialStore.getPassword(profile.username);
  if (!password) return res.status(400).json({ error: 'Kein gespeichertes Passwort für diesen Account' });
  try {
    const result = await cli.runCli(cli.buildArgs(profile, ['--claim']), { password });
    res.json({ ok: true, claimed: !!result.claimed });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

function loadCharacterSettings(profile) {
  if (!profile.server || !profile.characterName) {
    throw Object.assign(new Error('Noch kein Charakter für dieses Profil bekannt — erst einloggen und auswählen.'), { status: 400 });
  }
  const dataDir = findDataDir();
  if (!dataDir) throw Object.assign(new Error('Kein Datenverzeichnis gefunden'), { status: 404 });
  const filePath = path.join(dataDir, 'characters', `${accountIdFor(profile.server, profile.characterName)}.json`);
  if (!fs.existsSync(filePath)) throw Object.assign(new Error('Keine Einstellungen für diesen Account gefunden'), { status: 404 });
  return { filePath, settings: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
}

// "Pause": schaltet alle aktuell aktiven auto_*-Schalter aus und merkt sich genau diese,
// damit "Fortsetzen" nur sie wieder anschaltet. Unklar/ungetestet: ob das eine bereits
// laufende Bot-Schleife sofort beeinflusst oder erst beim nächsten Start greift — die CLI hat
// keinen bekannten nativen Pause-Befehl, das ist der bestmögliche Ersatz über die Bot-Config.
router.post('/:id/pause', async (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  try {
    const node = remoteNodeFor(profile);
    if (node) {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/pause`, { method: 'POST' });
      registry.setPausedKeys(profile.id, result.pausedKeys || []);
      return res.json(result);
    }
    const { filePath, settings } = loadCharacterSettings(profile);
    const changed = [];
    for (const key of Object.keys(settings)) {
      if (key.startsWith('auto_') && settings[key] === true) {
        settings[key] = false;
        changed.push(key);
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
    registry.setPausedKeys(profile.id, changed);
    res.json({ ok: true, pausedKeys: changed });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/resume', async (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  try {
    const node = remoteNodeFor(profile);
    if (node) {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/resume`, { method: 'POST', body: { pausedKeys: profile.pausedKeys || [] } });
      registry.setPausedKeys(profile.id, []);
      return res.json(result);
    }
    const { filePath, settings } = loadCharacterSettings(profile);
    const keys = profile.pausedKeys || [];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) settings[key] = true;
    }
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
    registry.setPausedKeys(profile.id, []);
    res.json({ ok: true, resumedKeys: keys });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
