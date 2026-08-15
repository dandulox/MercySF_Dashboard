const express = require('express');
const marketplaceLinks = require('../lib/marketplaceLinks');
const marketplaceStats = require('../lib/marketplaceStats');
const ownerTokens = require('../lib/marketplaceOwnerTokens');
const templates = require('../lib/settingsTemplates');
const crypto = require('crypto');
const { getOrCreateInstanceId } = require('../lib/telemetry');

const MARKETPLACE_URL = 'https://data.poslab.cc/api/marketplace';

const router = express.Router();

router.post('/', express.json(), async (req, res) => {
  const { marketplaceId, localTemplateId, accountId } = req.body || {};
  if (!marketplaceId || !localTemplateId || !accountId) {
    return res.status(400).json({ error: 'marketplaceId, localTemplateId und accountId erforderlich' });
  }
  const ownerToken = ownerTokens.getToken(marketplaceId);
  if (!ownerToken) return res.status(404).json({ error: 'Kein lokal gespeicherter Owner-Token für diese Vorlage' });
  const template = templates.get(localTemplateId);
  if (!template) return res.status(404).json({ error: 'Lokale Vorlage nicht gefunden' });

  marketplaceLinks.add(marketplaceId, localTemplateId, accountId);

  const stats = await marketplaceStats.computeStatsFor(accountId);
  if (stats) {
    const accountHash = crypto.createHash('sha256').update(`${getOrCreateInstanceId()}:${accountId}`).digest('hex');
    try {
      await fetch(`${MARKETPLACE_URL}/templates/${encodeURIComponent(marketplaceId)}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerToken, accountHash, settings: template.settings,
          level: stats.level, silver: stats.silver, honor: stats.honor, arenaWinRate: stats.arenaWinRate,
        }),
      });
    } catch (e) { /* best-effort, wird beim nächsten täglichen Sync nachgeholt */ }
  }

  res.json({ ok: true });
});

module.exports = router;
