const express = require('express');
const registry = require('../lib/accountsRegistry');
const { accountIdFor } = require('../lib/data');
const { getAccountSeries, ALLOWED_FIELDS } = require('../lib/analyticsService');

const router = express.Router();

// 24h nutzt dieselben 5-Minuten-Buckets wie die bestehende Einzel-Account-Analysen-Seite;
// 7d/30d nutzen Tages-Buckets über dieselbe Bucket-Funktion (siehe lib/analyticsService.js) —
// bewusst NICHT über statsDb (dort fehlen mushrooms/armor, siehe lib/statsDb.js Schema),
// sondern über dieselben rohen analytics/*.json-Snapshots wie die 24h-Ansicht, nur mit größeren
// Buckets und einem höheren maxBuckets-Limit.
const RANGE_CONFIG = {
  '24h': { bucketMs: 5 * 60 * 1000, maxBuckets: 288 },
  '7d': { bucketMs: 24 * 60 * 60 * 1000, maxBuckets: 7 },
  '30d': { bucketMs: 24 * 60 * 60 * 1000, maxBuckets: 30 },
};

function toGoldIfSilver(field, v) {
  if (field !== 'silver' || typeof v !== 'number') return v;
  return Math.round(v / 100);
}

// Holt die Zeitreihe eines einzelnen Accounts für ein Feld — best-effort: ein einzelner
// nicht erreichbarer Account (z. B. Node offline) soll nicht die gesamte Vergleichsanfrage
// scheitern lassen, insbesondere bei Klassen-Summen über mehrere Accounts.
async function seriesForAccount(accountId, field, bucketCfg) {
  try {
    const data = await getAccountSeries(accountId, bucketCfg);
    if (!data || !data.series || !data.series[field]) return [];
    return data.series[field].map(p => ({ t: p.t, v: toGoldIfSilver(field, p.v) }));
  } catch (err) {
    return [];
  }
}

router.post('/', express.json(), async (req, res) => {
  const { range, series } = req.body || {};
  const bucketCfg = RANGE_CONFIG[range];
  if (!bucketCfg) return res.status(400).json({ error: 'Ungültiger Zeitraum (erlaubt: 24h, 7d, 30d)' });
  if (!Array.isArray(series) || !series.length) {
    return res.status(400).json({ error: 'Mindestens eine Serie erforderlich' });
  }
  for (const s of series) {
    if (!s || (s.type !== 'account' && s.type !== 'class') || !s.id || !ALLOWED_FIELDS.includes(s.field)) {
      return res.status(400).json({ error: 'Ungültige Serien-Definition' });
    }
  }

  const allProfiles = registry.list();
  const bucketKeySet = new Set();
  const perSeries = [];

  for (const s of series) {
    let points;
    let targetLabel;
    if (s.type === 'account') {
      const profile = allProfiles.find(p => p.server && p.characterName && accountIdFor(p.server, p.characterName) === s.id);
      targetLabel = profile ? profile.nickname : s.id;
      points = await seriesForAccount(s.id, s.field, bucketCfg);
    } else {
      const members = allProfiles.filter(p => p.characterClass === s.id && p.server && p.characterName);
      targetLabel = s.id;
      const memberSeriesList = await Promise.all(
        members.map(p => seriesForAccount(accountIdFor(p.server, p.characterName), s.field, bucketCfg)),
      );
      const sums = new Map();
      for (const memberPoints of memberSeriesList) {
        for (const p of memberPoints) {
          if (typeof p.v !== 'number') continue;
          const key = Date.parse(p.t);
          sums.set(key, (sums.get(key) || 0) + p.v);
        }
      }
      points = [...sums.entries()].sort((a, b) => a[0] - b[0]).map(([ms, v]) => ({ t: new Date(ms).toISOString(), v }));
    }
    points.forEach(p => bucketKeySet.add(Date.parse(p.t)));
    perSeries.push({ type: s.type, targetLabel, field: s.field, points });
  }

  const bucketKeys = [...bucketKeySet].sort((a, b) => a - b);
  const buckets = bucketKeys.map(ms => new Date(ms).toISOString());
  const resultSeries = perSeries.map(({ type, targetLabel, field, points }) => {
    const byKey = new Map(points.map(p => [Date.parse(p.t), p.v]));
    return {
      type,
      targetLabel,
      field,
      values: bucketKeys.map(k => (byKey.has(k) ? byKey.get(k) : null)),
    };
  });

  res.json({ buckets, series: resultSeries });
});

module.exports = router;
