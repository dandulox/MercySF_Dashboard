const crypto = require('crypto');
const marketplaceLinks = require('./marketplaceLinks');
const marketplaceStats = require('./marketplaceStats');
const ownerTokens = require('./marketplaceOwnerTokens');
const { getOrCreateInstanceId } = require('./telemetry');

const MARKETPLACE_URL = 'https://data.poslab.cc/api/marketplace';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

function accountHashFor(accountId) {
  return crypto.createHash('sha256').update(`${getOrCreateInstanceId()}:${accountId}`).digest('hex');
}

async function syncOne(link) {
  const ownerToken = ownerTokens.getToken(link.marketplaceTemplateId);
  if (!ownerToken) return;
  const stats = await marketplaceStats.computeStatsFor(link.accountId);
  if (!stats) return;

  const templates = require('./settingsTemplates');
  const template = templates.get(link.localTemplateId);
  if (!template) return;

  try {
    await fetch(`${MARKETPLACE_URL}/templates/${encodeURIComponent(link.marketplaceTemplateId)}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerToken,
        accountHash: accountHashFor(link.accountId),
        settings: template.settings,
        level: stats.level,
        silver: stats.silver,
        honor: stats.honor,
        arenaWinRate: stats.arenaWinRate,
      }),
    });
  } catch (e) {
    // Best-effort: ein fehlgeschlagener Sync darf die anderen Verknüpfungen nicht blockieren.
  }
}

async function syncAll() {
  for (const link of marketplaceLinks.list()) {
    await syncOne(link);
  }
}

syncAll();
setInterval(syncAll, SYNC_INTERVAL_MS);

module.exports = { syncAll };
