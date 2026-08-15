const express = require('express');
const nodeRegistry = require('../lib/nodeRegistry');
const { getOrCreateInstanceId } = require('../lib/telemetry');

const COLLECTOR_URL = 'https://data.poslab.cc/api/bugreports';
const SEVERITIES = ['low', 'medium', 'high'];

const router = express.Router();

function buildSnapshot() {
  return {
    instanceId: getOrCreateInstanceId(),
    dashboardVersion: require('../package.json').version,
    uptimeSec: Math.floor(process.uptime()),
    nodes: nodeRegistry.list().map(n => ({
      name: n.name,
      host: n.host,
      cliVersion: n.cliVersion || null,
      lastSeen: n.lastSeen || null,
      lastStatus: n.lastStatus || null,
    })),
  };
}

router.post('/', express.json(), async (req, res) => {
  const { title, description, severity } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Titel erforderlich' });
  if (typeof description !== 'string' || !description.trim()) return res.status(400).json({ error: 'Beschreibung erforderlich' });
  if (!SEVERITIES.includes(severity)) return res.status(400).json({ error: 'Ungültiger Schweregrad' });

  const snapshot = buildSnapshot();
  let response;
  try {
    response = await fetch(COLLECTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: snapshot.instanceId,
        title: title.trim(),
        description: description.trim(),
        severity,
        snapshot,
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Collector nicht erreichbar' });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return res.status(response.status).json({ error: body.error || 'Melden fehlgeschlagen' });
  }
  const { id } = await response.json();
  res.status(201).json({ id });
});

module.exports = router;
