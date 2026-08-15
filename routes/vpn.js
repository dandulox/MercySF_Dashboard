const express = require('express');
const vpnProfiles = require('../lib/vpnProfiles');
const vpnConfigStore = require('../lib/vpnConfigStore');
const vpnManager = require('../lib/vpnManager');
const vpnTargets = require('../lib/vpnTargets');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');

const router = express.Router();

router.get('/profiles', (req, res) => {
  res.json(vpnProfiles.list());
});

router.post('/profiles', express.json({ limit: '256kb' }), (req, res) => {
  try {
    const profile = vpnProfiles.add(req.body || {});
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/profiles/:id', (req, res) => {
  const inUse = vpnTargets.list().find(t => t.vpnProfileId === req.params.id && t.lastStatus.connected);
  if (inUse) {
    return res.status(409).json({ error: `Profil ist aktuell mit Ziel "${inUse.targetId}" verbunden — erst trennen` });
  }
  const removed = vpnProfiles.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Profil nicht gefunden' });
  res.json({ ok: true });
});

function targetLabel(targetId) {
  if (targetId === 'local') return 'Lokal (dieser Server)';
  const node = nodeRegistry.get(targetId);
  return node ? node.name : targetId;
}

// Zielliste = "local" + jeder bekannte Node, auch wenn für ihn noch keine VPN-Config gesetzt
// wurde (vpnTargets.list() erzeugt "local" automatisch, Nodes werden hier ergänzt).
function allTargetIds() {
  const known = new Set(vpnTargets.list().map(t => t.targetId));
  const nodeIds = nodeRegistry.list().map(n => n.id);
  return [...new Set(['local', ...known, ...nodeIds])];
}

router.get('/targets', (req, res) => {
  const configs = new Map(vpnTargets.list().map(t => [t.targetId, t]));
  const result = allTargetIds().map(id => {
    const cfg = configs.get(id) || { targetId: id, vpnProfileId: null, gate: 'off', lastStatus: { connected: false, interfaceName: null, updatedAt: null } };
    return { ...cfg, label: targetLabel(id) };
  });
  res.json(result);
});

function remoteNodeFor(targetId) {
  if (targetId === 'local') return null;
  const node = nodeRegistry.get(targetId);
  if (!node) throw Object.assign(new Error('Node nicht gefunden'), { status: 404 });
  return node;
}

router.post('/targets/:targetId/config', express.json(), async (req, res) => {
  const { vpnProfileId, gate } = req.body || {};
  try {
    const node = remoteNodeFor(req.params.targetId);
    if (node) {
      const profile = vpnProfileId ? vpnProfiles.list().find(p => p.id === vpnProfileId) : null;
      if (vpnProfileId && !profile) return res.status(400).json({ error: 'VPN-Profil nicht gefunden' });
      const configContent = profile ? vpnConfigStore.getConfig(profile.id) : null;
      await nodeClient.call(node, '/vpn/config', {
        method: 'POST',
        body: { vpnProfileId: profile?.id || null, interfaceName: profile?.interfaceName || null, configContent, gate },
      });
    }
    const target = vpnTargets.setConfig(req.params.targetId, { vpnProfileId, gate });
    res.json({ ...target, label: targetLabel(req.params.targetId) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/targets/:targetId/connect', async (req, res) => {
  try {
    const target = vpnTargets.get(req.params.targetId);
    if (!target || !target.vpnProfileId) return res.status(400).json({ error: 'Kein VPN-Profil für dieses Ziel zugewiesen' });
    const node = remoteNodeFor(req.params.targetId);
    let status;
    if (node) {
      status = await nodeClient.call(node, '/vpn/connect', { method: 'POST', timeoutMs: 20000 });
    } else {
      const profile = vpnProfiles.list().find(p => p.id === target.vpnProfileId);
      if (!profile) return res.status(400).json({ error: 'Zugewiesenes VPN-Profil existiert nicht mehr' });
      const configContent = vpnConfigStore.getConfig(profile.id);
      await vpnManager.connect(profile.interfaceName, configContent);
      status = await vpnManager.status();
    }
    vpnTargets.setLastStatus(req.params.targetId, status);
    res.json(status);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

router.post('/targets/:targetId/disconnect', async (req, res) => {
  try {
    const target = vpnTargets.get(req.params.targetId);
    const node = remoteNodeFor(req.params.targetId);
    let status;
    if (node) {
      status = await nodeClient.call(node, '/vpn/disconnect', { method: 'POST', timeoutMs: 15000 });
    } else {
      if (target?.lastStatus?.interfaceName) await vpnManager.disconnect(target.lastStatus.interfaceName);
      status = await vpnManager.status();
    }
    vpnTargets.setLastStatus(req.params.targetId, status);
    res.json(status);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

router.get('/targets/:targetId/status', async (req, res) => {
  try {
    const node = remoteNodeFor(req.params.targetId);
    const status = node
      ? await nodeClient.call(node, '/vpn/status', { timeoutMs: 8000 })
      : await vpnManager.status();
    vpnTargets.setLastStatus(req.params.targetId, status);
    res.json(status);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

router.get('/targets/:targetId/public-ip', async (req, res) => {
  try {
    const node = remoteNodeFor(req.params.targetId);
    const result = node
      ? await nodeClient.call(node, '/vpn/public-ip', { timeoutMs: 10000 })
      : { ip: await vpnManager.publicIp() };
    res.json(result);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

module.exports = router;
