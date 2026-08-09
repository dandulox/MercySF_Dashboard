const express = require('express');
const { getAccountSeries } = require('../lib/analyticsService');

const router = express.Router();

router.get('/:accountId', async (req, res) => {
  try {
    const result = await getAccountSeries(req.params.accountId);
    if (!result) return res.status(404).json({ error: 'Keine Analysedaten für diesen Account' });
    res.json(result);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

module.exports = router;
