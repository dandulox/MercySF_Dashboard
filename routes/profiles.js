const express = require('express');
const fs = require('fs');
const path = require('path');
const registry = require('../lib/accountsRegistry');
const ptyManager = require('../lib/ptyManager');
const credentialStore = require('../lib/credentialStore');
const discoveryLogin = require('../lib/discoveryLogin');
const { findDataDir } = require('../lib/data');
const logBuffer = require('../lib/logBuffer');

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

router.get('/', (req, res) => {
  const profiles = registry.list().map(p => ({
    ...p,
    status: ptyManager.getStatus(p.id),
    hasPassword: credentialStore.hasPassword(p.username),
    currentActivity: p.characterName ? logBuffer.getLastActivity(p.characterName) : null,
    activityHistory: p.characterName ? logBuffer.getActivityHistory(p.characterName) : [],
    scoutedPlayers: p.characterName ? logBuffer.getScoutedPlayers(p.characterName) : [],
  }));
  res.json(profiles);
});

// Loggt einmalig testweise ein, um alle Charaktere für diesen Login zu finden, speichert das
// Passwort verschlüsselt und legt für JEDEN gefundenen Charakter direkt ein fertiges,
// voll automatisierbares Profil an. Das Passwort verlässt diese Anfrage an keiner anderen
// Stelle als hier (kein Logging, keine Rückgabe an den Client).
router.post('/', express.json(), async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username und password sind erforderlich' });
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
      });
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

router.delete('/:id', (req, res) => {
  ptyManager.killPty(req.params.id);
  const removed = registry.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Profil nicht gefunden' });
  res.json({ ok: true });
});

router.post('/:id/start', (req, res) => {
  ptyManager.ensurePty(req.params.id);
  registry.setAutoStart(req.params.id, true);
  res.json(ptyManager.getStatus(req.params.id));
});

router.post('/:id/stop', (req, res) => {
  ptyManager.killPty(req.params.id);
  registry.setAutoStart(req.params.id, false);
  res.json(ptyManager.getStatus(req.params.id));
});

router.get('/:id/status', (req, res) => {
  res.json(ptyManager.getStatus(req.params.id));
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
router.post('/:id/pause', (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  try {
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

router.post('/:id/resume', (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  try {
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
