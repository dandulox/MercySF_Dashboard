const profileStore = require('./profileStore');
const { findDataDir, latestSnapshot, accountIdFor } = require('./dataDir');
const statsDb = require('./statsDb');

// Angepasste Kopie von MercySF_Dashboard/lib/statsCollector.js — läuft über profileStore statt
// accountsRegistry, sonst identisch: schreibt minütlich den aktuellsten Snapshot jedes Profils
// mit bekanntem Server+Charakter in die lokale stats.db.
function collectOnce() {
  const dataDir = findDataDir();
  if (!dataDir) return;
  for (const profile of profileStore.list()) {
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
