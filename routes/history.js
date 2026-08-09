const express = require('express');
const { findProfileByAccountId } = require('../lib/data');
const credentialStore = require('../lib/credentialStore');
const cli = require('../lib/cliExec');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');

const router = express.Router();

// Von der CLI selbst lokal aufgezeichnete Kampfhistorie (--history) — ersetzt den früher
// verworfenen Kampfhistorie-Ansatz über battle_history-Dateien, die der Linux-Build nie
// geschrieben hat. Kommt vom laufenden Bot-Prozess dieses Accounts, nicht vom Spieleserver.
router.get('/:accountId', async (req, res) => {
  const profile = findProfileByAccountId(req.params.accountId);
  if (!profile) return res.status(404).json({ error: 'Account nicht gefunden' });

  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 30));

  const node = profile.nodeId ? nodeRegistry.get(profile.nodeId) : null;
  if (node) {
    try {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/history?limit=${limit}`, { timeoutMs: 15000 });
      return res.json(result);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  const password = credentialStore.getPassword(profile.username);
  if (!password) return res.status(400).json({ error: 'Kein gespeichertes Passwort für diesen Account' });
  try {
    const result = await cli.runCli(cli.buildArgs(profile, ['--history', '--limit', String(limit)]), { password });
    res.json({ battles: result.battles || [], total: result.total ?? 0, returned: result.returned ?? 0 });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
