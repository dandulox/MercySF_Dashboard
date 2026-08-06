const express = require('express');
const notifications = require('../lib/notifications');

const router = express.Router();

router.get('/', (req, res) => {
  const since = parseInt(req.query.since, 10);
  if (since) return res.json(notifications.getSince(since));
  res.json(notifications.getAll());
});

module.exports = router;
