const express = require('express');
const { state, checkForUpdate, applyUpdate } = require('../lib/cliUpdate');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json(state);
});

router.post('/check', async (req, res) => {
  await checkForUpdate();
  res.json(state);
});

router.post('/apply', async (req, res) => {
  if (state.applying) return res.status(409).json({ error: 'Update läuft bereits' });
  if (!state.updateAvailable) return res.status(400).json({ error: 'Kein Update verfügbar' });
  try {
    const currentHash = await applyUpdate();
    res.json({ ok: true, currentHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
