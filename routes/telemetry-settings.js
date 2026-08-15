const express = require('express');
const { isEnabled, setEnabled, getLastPing } = require('../lib/telemetry');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ enabled: isEnabled(), lastPing: getLastPing() });
});

router.post('/', express.json(), (req, res) => {
  setEnabled(!!req.body.enabled);
  res.json({ enabled: isEnabled() });
});

module.exports = router;
