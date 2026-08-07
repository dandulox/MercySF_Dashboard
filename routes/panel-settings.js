const express = require('express');
const panelSettings = require('../lib/panelSettings');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    current: panelSettings.getPresetKey(),
    presets: Object.entries(panelSettings.PRESETS).map(([key, p]) => ({ key, label: p.label, ms: p.ms })),
  });
});

router.post('/', express.json(), (req, res) => {
  const { preset } = req.body || {};
  try {
    const applied = panelSettings.setPreset(preset);
    res.json({ ok: true, current: applied });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
