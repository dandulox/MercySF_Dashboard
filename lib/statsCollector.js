const registry = require('./accountsRegistry');
const { findDataDir, latestSnapshot, accountIdFor } = require('./data');
const statsDb = require('./statsDb');

function collectOnce() {
  const dataDir = findDataDir();
  if (!dataDir) return;
  for (const profile of registry.list()) {
    if (!profile.server || !profile.characterName) continue;
    const accountId = accountIdFor(profile.server, profile.characterName);
    const snapshot = latestSnapshot(dataDir, accountId);
    if (!snapshot) continue;
    try {
      statsDb.insertSnapshot(accountId, snapshot);
    } catch (err) {
      console.error('[statsCollector] Snapshot konnte nicht gespeichert werden:', err.message);
    }
  }
}

collectOnce();
setInterval(collectOnce, 60 * 1000);

module.exports = { collectOnce };
