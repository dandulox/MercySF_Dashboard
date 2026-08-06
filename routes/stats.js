const express = require('express');
const registry = require('../lib/accountsRegistry');
const { accountIdFor } = require('../lib/data');
const statsDb = require('../lib/statsDb');

const router = express.Router();

function findProfile(accountId) {
  return registry.list().find(p =>
    p.server && p.characterName && accountIdFor(p.server, p.characterName) === accountId
  );
}

router.get('/:accountId/daily', (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 14, 90);
  res.json(statsDb.getDailyStats(req.params.accountId, days));
});

router.get('/:accountId/actions', (req, res) => {
  const profile = findProfile(req.params.accountId);
  if (!profile) return res.status(404).json({ error: 'Account nicht gefunden' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  res.json(statsDb.getRecentActionWindows(req.params.accountId, profile.characterName, limit));
});

module.exports = router;
