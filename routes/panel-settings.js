const express = require('express');
const panelSettings = require('../lib/panelSettings');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    current: panelSettings.getPresetKey(),
    presets: Object.entries(panelSettings.PRESETS).map(([key, p]) => ({ key, label: p.label, ms: p.ms })),
    language: panelSettings.getLanguage(),
  });
});

router.post('/', express.json(), (req, res) => {
  const { preset, language } = req.body || {};
  try {
    const result = { ok: true };
    if (preset !== undefined) result.current = panelSettings.setPreset(preset);
    if (language !== undefined) result.language = panelSettings.setLanguage(language);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
