const express = require('express');
const path = require('path');
const fs = require('fs');
const { findDataDir, findProfileByAccountId } = require('../lib/data');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');

const router = express.Router();

const ALLOWED_FIELDS = ['level', 'experience', 'silver', 'mushrooms', 'honor', 'rank', 'armor'];
const BUCKET_MS = 5 * 60 * 1000; // 5-Minuten-Schritte
const MAX_BUCKETS = 288; // ~24h bei 5-Minuten-Schritten

router.get('/:accountId', async (req, res) => {
  const profile = findProfileByAccountId(req.params.accountId);
  const node = profile && profile.nodeId ? nodeRegistry.get(profile.nodeId) : null;
  if (node) {
    try {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/analytics`, { timeoutMs: 10000 });
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message });
    }
  }

  const dataDir = findDataDir();
  if (!dataDir) return res.status(404).json({ error: 'Kein Datenverzeichnis gefunden' });
  const filePath = path.join(dataDir, 'analytics', `${req.params.accountId}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Keine Analysedaten für diesen Account' });
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Analysedaten konnten nicht gelesen werden' });
  }
  const snapshots = data.snapshots || [];

  // In 5-Minuten-Buckets einsortieren, pro Bucket den letzten (aktuellsten) Snapshot behalten —
  // ergibt eine gleichmäßige Zeitachse statt unregelmäßig verteilter Rohdatenpunkte.
  const buckets = new Map();
  for (const snap of snapshots) {
    const ms = Date.parse(snap.timestamp);
    if (Number.isNaN(ms)) continue;
    const bucketKey = Math.floor(ms / BUCKET_MS) * BUCKET_MS;
    buckets.set(bucketKey, snap);
  }
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b);
  const limitedKeys = bucketKeys.slice(-MAX_BUCKETS);

  const series = {};
  for (const field of ALLOWED_FIELDS) {
    series[field] = limitedKeys.map(key => ({ t: new Date(key).toISOString(), v: buckets.get(key)[field] }));
  }
  res.json({ fields: ALLOWED_FIELDS, series });
});

module.exports = router;
