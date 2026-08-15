const express = require('express');
const os = require('os');
const { spawn } = require('child_process');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');
const accountsRegistry = require('../lib/accountsRegistry');
const ptyManager = require('../lib/ptyManager');
const cliUpdate = require('../lib/cliUpdate');
const dashboardUpdate = require('../lib/dashboardUpdate');

const router = express.Router();

// Der Dashboard-Server selbst taucht als besonderer, fest-ID'ter Eintrag in der Node-Liste auf —
// dieselbe Schnellsteuerung/Auslastungsanzeige/Update-UI wie bei echten Nodes funktioniert damit
// auch für "diesen Server" ohne Sonderfälle im Frontend (nur hier im Backend gibt es die
// LOCAL_ID-Weiche). Ein Node-Agent vergibt seine eigene ID als zufälligen Hex-String (siehe
// node-agent/lib/identity.js), eine Kollision mit dem Literal "local" ist praktisch ausgeschlossen.
const LOCAL_ID = 'local';

// Der Token ist das Geheimnis, mit dem das Dashboard sich gegenüber dem Node ausweist — darf den
// Browser nie erreichen (anders als z. B. Session-Cookies, die der Browser selbst braucht).
function sanitize(node) {
  const { token, ...rest } = node;
  return rest;
}

function countAssigned(nodeId) {
  return accountsRegistry.list().filter(p => (p.nodeId || null) === nodeId).length;
}

function localNodeEntry() {
  return {
    id: LOCAL_ID,
    // Kein sprachabhängiger Text im Namen — der "(dieses Dashboard)"-Zusatz wird im Frontend
    // lokalisiert angehängt (siehe public/pages/nodes.js, isLocal-Fall), da diese API-Antwort
    // sprachneutral bleiben soll.
    name: os.hostname(),
    host: 'localhost',
    port: null,
    useTls: null,
    cliVersion: null,
    pairedAt: null,
    lastSeen: new Date().toISOString(),
    lastStatus: 'online',
    accountCount: countAssigned(null),
    isLocal: true,
  };
}

router.get('/', (req, res) => {
  const remote = nodeRegistry.list().map(n => ({ ...sanitize(n), accountCount: countAssigned(n.id), isLocal: false }));
  res.json([localNodeEntry(), ...remote]);
});

// Reiner Erreichbarkeits-Check, bevor der Nutzer Host/Port/Code überhaupt abschickt — nutzt noch
// keinen gespeicherten Node-Datensatz.
router.post('/probe', express.json(), async (req, res) => {
  const { host, port } = req.body || {};
  if (!host || !port) return res.status(400).json({ error: 'host und port sind erforderlich' });
  try {
    const result = await nodeClient.health(host, Number(port));
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `Node nicht erreichbar: ${err.message}` });
  }
});

router.post('/pair', express.json(), async (req, res) => {
  const { name, host, port, code } = req.body || {};
  if (!host || !port || !code) {
    return res.status(400).json({ error: 'host, port und code sind erforderlich' });
  }
  try {
    const result = await nodeClient.pairNode({ host, port: Number(port), code });
    const node = nodeRegistry.upsert({
      id: result.nodeId,
      name: name || result.name,
      host,
      port: Number(port),
      useTls: result.useTls,
      token: result.token,
      cliVersion: result.version,
    });
    res.status(201).json(sanitize(node));
  } catch (err) {
    res.status(err.status === 401 ? 401 : 502).json({ error: err.message });
  }
});

router.post('/:id/rename', express.json(), (req, res) => {
  if (req.params.id === LOCAL_ID) return res.status(400).json({ error: 'Der lokale Eintrag kann nicht umbenannt werden' });
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name ist erforderlich' });
  const node = nodeRegistry.rename(req.params.id, name);
  if (!node) return res.status(404).json({ error: 'Node nicht gefunden' });
  res.json(sanitize(node));
});

function nodeOr404(id, res) {
  const node = nodeRegistry.get(id);
  if (!node) res.status(404).json({ error: 'Node nicht gefunden' });
  return node;
}

// Update-Proxy-Endpunkte: für echte Nodes reine Weiterleitung an die gleichnamigen Endpunkte des
// Node-Agents (node-agent/lib/cliUpdate.js + selfUpdate.js); für den lokalen Eintrag direkt die
// bereits vorhandenen Dashboard-eigenen Module (lib/cliUpdate.js + lib/dashboardUpdate.js,
// dieselben, die auch die BOT-ENGINE-Box in der Sidebar speist) — gleiche Antwortform auf beiden
// Wegen, das Frontend muss also nicht wissen, ob es gerade mit einem echten Node oder "sich
// selbst" spricht.
router.get('/:id/cli/status', async (req, res) => {
  if (req.params.id === LOCAL_ID) return res.json(cliUpdate.state);
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/cli/status', { timeoutMs: 5000 }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/:id/cli/check', async (req, res) => {
  if (req.params.id === LOCAL_ID) return res.json(await cliUpdate.checkForUpdate());
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/cli/check', { method: 'POST', timeoutMs: 30000 }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/:id/cli/apply', async (req, res) => {
  if (req.params.id === LOCAL_ID) {
    if (cliUpdate.state.applying) return res.status(409).json({ error: 'Update läuft bereits' });
    if (!cliUpdate.state.updateAvailable) return res.status(400).json({ error: 'Kein Update verfügbar' });
    try {
      const currentHash = await cliUpdate.applyUpdate();
      return res.json({ ok: true, currentHash });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/cli/apply', { method: 'POST', timeoutMs: 60000 }));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

router.get('/:id/self-update/status', async (req, res) => {
  if (req.params.id === LOCAL_ID) return res.json(dashboardUpdate.state);
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/self-update/status', { timeoutMs: 5000 }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/:id/self-update/check', async (req, res) => {
  if (req.params.id === LOCAL_ID) return res.json(await dashboardUpdate.checkForUpdate());
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/self-update/check', { method: 'POST', timeoutMs: 15000 }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/:id/self-update/apply', async (req, res) => {
  if (req.params.id === LOCAL_ID) {
    if (dashboardUpdate.state.applying) return res.status(409).json({ error: 'Update läuft bereits' });
    if (!dashboardUpdate.state.updateAvailable) return res.status(400).json({ error: 'Kein Update verfügbar' });
    try {
      await dashboardUpdate.applyUpdate();
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/self-update/apply', { method: 'POST', timeoutMs: 60000 }));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

// --- Schnellsteuerung für den Fall, dass Bot oder Node/Dashboard-Server sich mal aufgehängt haben ---

router.post('/:id/bots/restart', async (req, res) => {
  if (req.params.id === LOCAL_ID) {
    const ids = ptyManager.listActiveIds();
    ids.forEach(id => ptyManager.restartPty(id));
    return res.json({ ok: true, restarted: ids.length });
  }
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/bots/restart', { method: 'POST', timeoutMs: 10000 }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/:id/service/restart', async (req, res) => {
  if (req.params.id === LOCAL_ID) {
    res.json({ ok: true });
    spawn('bash', ['-c', 'sleep 1 && systemctl restart mercy-dashboard mercy-sfapi-bridge'], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/service/restart', { method: 'POST', timeoutMs: 8000 }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/:id/system/reboot', async (req, res) => {
  if (req.params.id === LOCAL_ID) {
    res.json({ ok: true });
    spawn('bash', ['-c', 'sleep 1 && systemctl reboot'], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/system/reboot', { method: 'POST', timeoutMs: 8000 }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/:id/system/stats', async (req, res) => {
  if (req.params.id === LOCAL_ID) {
    const total = os.totalmem();
    const free = os.freemem();
    return res.json({
      loadAvg: os.loadavg(),
      cpuCount: os.cpus().length,
      memTotalBytes: total,
      memFreeBytes: free,
      memUsedPercent: Math.round(((total - free) / total) * 1000) / 10,
      uptimeSec: Math.floor(os.uptime()),
    });
  }
  const node = nodeOr404(req.params.id, res);
  if (!node) return;
  try {
    res.json(await nodeClient.call(node, '/system/stats', { timeoutMs: 5000 }));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/:id/ping', async (req, res) => {
  if (req.params.id === LOCAL_ID) {
    return res.json({ online: true, ok: true, uptimeSec: Math.floor(process.uptime()) });
  }
  const node = nodeRegistry.get(req.params.id);
  if (!node) return res.status(404).json({ error: 'Node nicht gefunden' });
  try {
    const health = await nodeClient.call(node, '/health', { timeoutMs: 5000 });
    nodeRegistry.markSeen(node.id, 'online');
    res.json({ online: true, ...health });
  } catch (err) {
    nodeRegistry.markSeen(node.id, 'offline');
    res.json({ online: false, error: err.message });
  }
});

// Entfernt den Node aus dem Dashboard. Best-effort-Unpair beim Node selbst (informiert ihn, damit
// er einen neuen Pairing-Code generiert) — schlägt das fehl (Node offline/schon weg), wird der
// Eintrag trotzdem lokal entfernt, sonst käme man an einen dauerhaft toten Node nicht mehr heran.
// Accounts, die diesem Node zugewiesen waren, fallen zurück auf "lokal" statt zu verwaisen.
router.delete('/:id', async (req, res) => {
  if (req.params.id === LOCAL_ID) return res.status(400).json({ error: 'Der lokale Eintrag kann nicht entfernt werden' });
  const node = nodeRegistry.get(req.params.id);
  if (!node) return res.status(404).json({ error: 'Node nicht gefunden' });
  try {
    await nodeClient.call(node, '/unpair', { method: 'POST', timeoutMs: 5000 });
  } catch (err) { /* Node evtl. offline — trotzdem lokal entfernen */ }
  accountsRegistry.list().filter(p => p.nodeId === node.id).forEach(p => accountsRegistry.setNode(p.id, null));
  nodeRegistry.remove(node.id);
  res.json({ ok: true });
});

module.exports = router;
