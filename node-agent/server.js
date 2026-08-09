const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { WebSocketServer } = require('ws');

const identity = require('./lib/identity');
const pairing = require('./lib/pairing');
const profileStore = require('./lib/profileStore');
const credentialStore = require('./lib/credentialStore');
const ptyManager = require('./lib/ptyManager');
const cli = require('./lib/cliExec');
const { findDataDir, accountIdFor, latestSnapshot } = require('./lib/dataDir');
const { requireToken, readBearer } = require('./lib/auth');
const pairingLib = require('./lib/pairing');
const cliUpdate = require('./lib/cliUpdate');
const selfUpdate = require('./lib/selfUpdate');
const statsDb = require('./lib/statsDb');
require('./lib/statsCollector');

const app = express();
const PORT = process.env.PORT || process.env.NODE_AGENT_PORT || 8090;
const dashboardVersion = require('./package.json').version;

app.use(express.json());

// --- Öffentlich, kein Token nötig: Erreichbarkeits-Check + Pairing selbst ---

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    nodeId: identity.get().nodeId,
    name: identity.get().name,
    version: dashboardVersion,
    paired: pairing.isPaired(),
    uptimeSec: Math.floor(process.uptime()),
  });
});

app.post('/pair', (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code ist erforderlich' });
  try {
    const token = pairing.pair(code);
    res.json({ token, nodeId: identity.get().nodeId, name: identity.get().name, version: dashboardVersion });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// --- Ab hier: gültiger Bearer-Token des gepairten Dashboards erforderlich ---

app.use(requireToken);

app.post('/unpair', (req, res) => {
  ptyManager.listActiveIds().forEach(id => ptyManager.killPty(id));
  pairing.unpair();
  res.json({ ok: true });
});

app.post('/identity/rename', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name ist erforderlich' });
  res.json(identity.rename(name));
});

app.get('/cli/status', (req, res) => res.json(cliUpdate.state));
app.post('/cli/check', async (req, res) => res.json(await cliUpdate.checkForUpdate()));
app.post('/cli/apply', async (req, res) => {
  if (cliUpdate.state.applying) return res.status(409).json({ error: 'Update läuft bereits' });
  if (!cliUpdate.state.updateAvailable) return res.status(400).json({ error: 'Kein Update verfügbar' });
  try {
    const currentHash = await cliUpdate.applyUpdate();
    res.json({ ok: true, currentHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/self-update/status', (req, res) => res.json(selfUpdate.state));
app.post('/self-update/check', async (req, res) => res.json(await selfUpdate.checkForUpdate()));
app.post('/self-update/apply', async (req, res) => {
  if (selfUpdate.state.applying) return res.status(409).json({ error: 'Update läuft bereits' });
  if (!selfUpdate.state.updateAvailable) return res.status(400).json({ error: 'Kein Update verfügbar' });
  try {
    await selfUpdate.applyUpdate();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/profiles', (req, res) => {
  const dataDir = findDataDir();
  res.json(profileStore.list().map(p => ({
    ...p,
    status: ptyManager.getStatus(p.id),
    snapshot: (dataDir && p.server && p.characterName) ? latestSnapshot(dataDir, accountIdFor(p.server, p.characterName)) : null,
  })));
});

// Idempotentes Anlegen/Aktualisieren — das Dashboard ruft das bei jeder Zuweisung eines Accounts
// an diesen Node auf. Ein mitgeschicktes Passwort überschreibt das gespeicherte, fehlt es, bleibt
// das zuletzt gespeicherte (falls vorhanden) unverändert.
app.put('/profiles/:id', (req, res) => {
  const { username, server, characterName, nickname, password } = req.body || {};
  try {
    const profile = profileStore.upsert({ id: req.params.id, username, server, characterName, nickname, password });
    res.json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/profiles/:id', (req, res) => {
  ptyManager.killPty(req.params.id);
  const removed = profileStore.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Profil nicht gefunden' });
  res.json({ ok: true });
});

app.post('/profiles/:id/start', (req, res) => {
  if (!profileStore.get(req.params.id)) return res.status(404).json({ error: 'Profil nicht gefunden' });
  ptyManager.ensurePty(req.params.id);
  res.json(ptyManager.getStatus(req.params.id));
});

app.post('/profiles/:id/stop', (req, res) => {
  ptyManager.killPty(req.params.id);
  res.json(ptyManager.getStatus(req.params.id));
});

app.get('/profiles/:id/status', (req, res) => {
  res.json(ptyManager.getStatus(req.params.id));
});

app.post('/profiles/:id/claim', async (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.server || !profile.characterName) {
    return res.status(400).json({ error: 'Noch kein Charakter für dieses Profil bekannt' });
  }
  const password = credentialStore.getPassword(profile.id);
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
    throw Object.assign(new Error('Noch kein Charakter für dieses Profil bekannt'), { status: 400 });
  }
  const dataDir = findDataDir();
  if (!dataDir) throw Object.assign(new Error('Kein Datenverzeichnis gefunden'), { status: 404 });
  const filePath = path.join(dataDir, 'characters', `${accountIdFor(profile.server, profile.characterName)}.json`);
  if (!fs.existsSync(filePath)) throw Object.assign(new Error('Keine Einstellungen für diesen Account gefunden'), { status: 404 });
  return { filePath, settings: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
}

app.post('/profiles/:id/pause', (req, res) => {
  const profile = profileStore.get(req.params.id);
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
    res.json({ ok: true, pausedKeys: changed });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/profiles/:id/resume', (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  const keys = (req.body && req.body.pausedKeys) || [];
  try {
    const { filePath, settings } = loadCharacterSettings(profile);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) settings[key] = true;
    }
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
    res.json({ ok: true, resumedKeys: keys });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Settings: bevorzugt der nicht-interaktive CLI-JSON-Modus (--config), Fallback ist direkter
// Datei-Zugriff — identisches Verhalten zu routes/settings.js im Dashboard.
app.get('/profiles/:id/settings', async (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  const password = credentialStore.getPassword(profile.id);
  if (profile.server && profile.characterName && password) {
    try {
      const result = await cli.runCli(cli.buildArgs(profile, ['--config']), { password });
      return res.json(result);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }
  try {
    const { settings } = loadCharacterSettings(profile);
    res.json({ config: settings, settable: [] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.put('/profiles/:id/settings', async (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  const updates = req.body || {};
  const password = credentialStore.getPassword(profile.id);

  if (profile.server && profile.characterName && password) {
    try {
      const current = await cli.runCli(cli.buildArgs(profile, ['--config']), { password });
      const config = current.config;
      const settable = new Set(current.settable || []);
      const allowedKeys = new Set(Object.keys(config));
      const rejected = [];
      const settableUpdates = {};
      const fileUpdates = {};
      for (const key of Object.keys(updates)) {
        if (!allowedKeys.has(key)) { rejected.push(key); continue; }
        if (typeof config[key] !== typeof updates[key]) { rejected.push(key); continue; }
        if (settable.has(key) && typeof updates[key] === 'boolean') settableUpdates[key] = updates[key];
        else fileUpdates[key] = updates[key];
      }
      if (rejected.length) {
        return res.status(400).json({ error: `Unbekannte oder typinkompatible Felder: ${rejected.join(', ')}` });
      }
      const merged = { ...config };
      if (Object.keys(settableUpdates).length) {
        const setArgs = [];
        for (const [key, value] of Object.entries(settableUpdates)) setArgs.push('--set', `${key}=${value}`);
        const result = await cli.runCli(cli.buildArgs(profile, ['--config', ...setArgs]), { password });
        for (const change of result.changed || []) merged[change.key] = change.to;
      }
      if (Object.keys(fileUpdates).length) {
        const { filePath, settings: onDisk } = loadCharacterSettings(profile);
        Object.assign(onDisk, fileUpdates);
        fs.writeFileSync(filePath, JSON.stringify(onDisk, null, 2));
        Object.assign(merged, fileUpdates);
      }
      return res.json(merged);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message });
    }
  }

  try {
    const { filePath, settings: current } = loadCharacterSettings(profile);
    const allowedKeys = new Set(Object.keys(current));
    const rejected = [];
    for (const key of Object.keys(updates)) {
      if (!allowedKeys.has(key)) { rejected.push(key); continue; }
      if (typeof current[key] !== typeof updates[key]) { rejected.push(key); continue; }
      current[key] = updates[key];
    }
    if (rejected.length) {
      return res.status(400).json({ error: `Unbekannte oder typinkompatible Felder: ${rejected.join(', ')}` });
    }
    fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
    res.json(current);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/profiles/:id/history', async (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  const password = credentialStore.getPassword(profile.id);
  if (!password) return res.status(400).json({ error: 'Kein gespeichertes Passwort für diesen Account' });
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 30));
  try {
    const result = await cli.runCli(cli.buildArgs(profile, ['--history', '--limit', String(limit)]), { password });
    res.json({ battles: result.battles || [], total: result.total ?? 0, returned: result.returned ?? 0 });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const ANALYTICS_FIELDS = ['level', 'experience', 'silver', 'mushrooms', 'honor', 'rank', 'armor'];
const ANALYTICS_BUCKET_MS = 5 * 60 * 1000;
const ANALYTICS_MAX_BUCKETS = 288;

// Gleiche Bucket-Logik wie routes/analytics.js im Dashboard — liest die rohen, von der lokal
// laufenden CLI geschriebenen Snapshots direkt von der Platte, kein Zwischenspeicher nötig.
app.get('/profiles/:id/analytics', (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.server || !profile.characterName) return res.status(400).json({ error: 'Noch kein Charakter für dieses Profil bekannt' });
  const dataDir = findDataDir();
  if (!dataDir) return res.status(404).json({ error: 'Kein Datenverzeichnis gefunden' });
  const filePath = path.join(dataDir, 'analytics', `${accountIdFor(profile.server, profile.characterName)}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Keine Analysedaten für diesen Account' });
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Analysedaten konnten nicht gelesen werden' });
  }
  const snapshots = data.snapshots || [];
  const buckets = new Map();
  for (const snap of snapshots) {
    const ms = Date.parse(snap.timestamp);
    if (Number.isNaN(ms)) continue;
    const bucketKey = Math.floor(ms / ANALYTICS_BUCKET_MS) * ANALYTICS_BUCKET_MS;
    buckets.set(bucketKey, snap);
  }
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b).slice(-ANALYTICS_MAX_BUCKETS);
  const series = {};
  for (const field of ANALYTICS_FIELDS) {
    series[field] = bucketKeys.map(key => ({ t: new Date(key).toISOString(), v: buckets.get(key)[field] }));
  }
  res.json({ fields: ANALYTICS_FIELDS, series });
});

app.get('/profiles/:id/stats/daily', (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.server || !profile.characterName) return res.json([]);
  const days = Math.min(parseInt(req.query.days, 10) || 14, 90);
  res.json(statsDb.getDailyStats(accountIdFor(profile.server, profile.characterName), days));
});

app.get('/profiles/:id/stats/actions', (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.server || !profile.characterName) return res.json([]);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  res.json(statsDb.getRecentActionWindows(accountIdFor(profile.server, profile.characterName), profile.characterName, limit));
});

app.use((err, req, res, next) => {
  console.error('[server] unerwarteter Fehler:', err);
  res.status(500).json({ error: 'Interner Fehler' });
});

const certPath = process.env.SSL_CERT || '/opt/mercy/certs/cert.pem';
const keyPath = process.env.SSL_KEY || '/opt/mercy/certs/key.pem';
const useTls = fs.existsSync(certPath) && fs.existsSync(keyPath);

const httpServer = useTls
  ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
  : http.createServer(app);

// Konsolen-WebSocket: gleiches Nachrichtenprotokoll wie routes/console.js im Dashboard
// ({type:'data'|'status'|'input'|'resize'|'restart'}), aber Auth über den Bearer-Token statt
// einer Session-Cookie, weil hier ein Server (das Dashboard) verbindet, kein Browser.
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/console/ws') return;
  const token = readBearer(req) || url.searchParams.get('token');
  if (!pairingLib.verifyToken(token)) {
    socket.destroy();
    return;
  }
  const id = url.searchParams.get('profile');
  if (!id) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    ptyManager.ensurePty(id);
    ptyManager.attachSocket(id, ws);
    const status = ptyManager.getStatus(id);
    ws.send(JSON.stringify({ type: 'status', running: status.running, lastExitInfo: status.lastExitInfo }));
    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
      if (msg.type === 'input') ptyManager.write(id, msg.data);
      if (msg.type === 'resize') ptyManager.resize(id, msg.cols, msg.rows);
      if (msg.type === 'restart') ptyManager.restartPty(id);
    });
  });
});

// Alle 30s prüfen, ob ein noch unbenutzter Pairing-Code abgelaufen ist, und ggf. einen neuen
// erzeugen — sonst wäre ein frisch installierter Node nach 15 Minuten ohne manuellen Eingriff
// dauerhaft unpairbar.
setInterval(() => pairing.ensureFreshCodeIfUnpaired(), 30_000);

httpServer.listen(PORT, '0.0.0.0', () => {
  const id = identity.get();
  console.log(`Mercy Node-Agent (${useTls ? 'HTTPS' : 'HTTP'}) "${id.name}" [${id.nodeId}] listening on :${PORT}`);
  pairing.ensureFreshCodeIfUnpaired();
  if (!pairing.isPaired()) {
    const active = pairing.getActiveCode();
    if (active) console.log(`[pairing] Noch nicht gepairt. Code: ${active.code} (gültig bis ${active.expiresAt})`);
  } else {
    console.log('[pairing] Bereits mit einem Dashboard gepairt.');
  }
});
