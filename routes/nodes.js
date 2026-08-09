const express = require('express');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');
const accountsRegistry = require('../lib/accountsRegistry');

const router = express.Router();

// Der Token ist das Geheimnis, mit dem das Dashboard sich gegenüber dem Node ausweist — darf den
// Browser nie erreichen (anders als z. B. Session-Cookies, die der Browser selbst braucht).
function sanitize(node) {
  const { token, ...rest } = node;
  return rest;
}

function countAssigned(nodeId) {
  return accountsRegistry.list().filter(p => p.nodeId === nodeId).length;
}

router.get('/', (req, res) => {
  res.json(nodeRegistry.list().map(n => ({ ...sanitize(n), accountCount: countAssigned(n.id) })));
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
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name ist erforderlich' });
  const node = nodeRegistry.rename(req.params.id, name);
  if (!node) return res.status(404).json({ error: 'Node nicht gefunden' });
  res.json(sanitize(node));
});

router.post('/:id/ping', async (req, res) => {
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
