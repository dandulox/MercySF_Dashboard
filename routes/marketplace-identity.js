const express = require('express');
const { getOrCreateInstanceId } = require('../lib/telemetry');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ instanceId: getOrCreateInstanceId() });
});

module.exports = router;
