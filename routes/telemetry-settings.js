const express = require('express');
const { isEnabled, setEnabled } = require('../lib/telemetry');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ enabled: isEnabled() });
});

router.post('/', express.json(), (req, res) => {
  setEnabled(!!req.body.enabled);
  res.json({ enabled: isEnabled() });
});

module.exports = router;
