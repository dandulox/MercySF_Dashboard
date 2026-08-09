const fs = require('fs');
const path = require('path');
const { findDataDir, findProfileByAccountId } = require('./data');
const nodeRegistry = require('./nodeRegistry');
const nodeClient = require('./nodeClient');

const ALLOWED_FIELDS = ['level', 'experience', 'silver', 'mushrooms', 'honor', 'rank', 'armor'];
const DEFAULT_BUCKET_MS = 5 * 60 * 1000; // 5-Minuten-Schritte
const DEFAULT_MAX_BUCKETS = 288; // ~24h bei 5-Minuten-Schritten

// In Zeit-Buckets einsortieren, pro Bucket den letzten (aktuellsten) Snapshot behalten — ergibt
// eine gleichmäßige Zeitachse statt unregelmäßig verteilter Rohdatenpunkte. bucketMs/maxBuckets
// sind parametrisiert (statt der früher hartcodierten 5-Minuten/288-Werte), damit derselbe Code
// auch die 7-Tage/30-Tage-Ansicht der Account-Analyse-Seite mit Tages-Buckets bedienen kann.
function readLocalAccountSeries(dataDir, accountId, bucketMs, maxBuckets) {
  const filePath = path.join(dataDir, 'analytics', `${accountId}.json`);
  if (!fs.existsSync(filePath)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
  const snapshots = data.snapshots || [];
  const buckets = new Map();
  for (const snap of snapshots) {
    const ms = Date.parse(snap.timestamp);
    if (Number.isNaN(ms)) continue;
    const bucketKey = Math.floor(ms / bucketMs) * bucketMs;
    buckets.set(bucketKey, snap);
  }
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b).slice(-maxBuckets);
  const series = {};
  for (const field of ALLOWED_FIELDS) {
    series[field] = bucketKeys.map(key => ({ t: new Date(key).toISOString(), v: buckets.get(key)[field] }));
  }
  return { fields: ALLOWED_FIELDS, series };
}

async function getAccountSeries(accountId, { bucketMs = DEFAULT_BUCKET_MS, maxBuckets = DEFAULT_MAX_BUCKETS } = {}) {
  const profile = findProfileByAccountId(accountId);
  const node = profile && profile.nodeId ? nodeRegistry.get(profile.nodeId) : null;
  if (node) {
    return nodeClient.call(
      node,
      `/profiles/${encodeURIComponent(profile.id)}/analytics?bucketMs=${bucketMs}&maxBuckets=${maxBuckets}`,
      { timeoutMs: 10000 },
    );
  }
  const dataDir = findDataDir();
  if (!dataDir) return null;
  return readLocalAccountSeries(dataDir, accountId, bucketMs, maxBuckets);
}

module.exports = { ALLOWED_FIELDS, DEFAULT_BUCKET_MS, DEFAULT_MAX_BUCKETS, getAccountSeries };
