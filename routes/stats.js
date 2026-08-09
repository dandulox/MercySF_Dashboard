const express = require('express');
const { findProfileByAccountId } = require('../lib/data');
const statsDb = require('../lib/statsDb');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');

const router = express.Router();

function remoteNodeFor(accountId) {
  const profile = findProfileByAccountId(accountId);
  if (!profile || !profile.nodeId) return { profile, node: null };
  return { profile, node: nodeRegistry.get(profile.nodeId) };
}

router.get('/:accountId/daily', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 14, 90);
  const { profile, node } = remoteNodeFor(req.params.accountId);
  if (node) {
    try {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/stats/daily?days=${days}`, { timeoutMs: 8000 });
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message });
    }
  }
  res.json(statsDb.getDailyStats(req.params.accountId, days));
});

router.get('/:accountId/actions', async (req, res) => {
  const profile = findProfileByAccountId(req.params.accountId);
  if (!profile) return res.status(404).json({ error: 'Account nicht gefunden' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  if (profile.nodeId) {
    const node = nodeRegistry.get(profile.nodeId);
    if (!node) return res.status(409).json({ error: 'Der zugewiesene Node existiert nicht mehr' });
    try {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/stats/actions?limit=${limit}`, { timeoutMs: 8000 });
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message });
    }
  }
  res.json(statsDb.getRecentActionWindows(req.params.accountId, profile.characterName, limit));
});

module.exports = router;
