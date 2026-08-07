const express = require('express');
const registry = require('../lib/accountsRegistry');
const credentialStore = require('../lib/credentialStore');
const panelSettings = require('../lib/panelSettings');

const router = express.Router();
const BRIDGE_URL = 'http://127.0.0.1:4001/state';
const cache = new Map();

router.get('/:profileId', async (req, res) => {
  const profile = registry.list().find(p => p.id === req.params.profileId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.server || !profile.characterName) {
    return res.status(400).json({ error: 'Noch kein Charakter für dieses Profil bekannt' });
  }

  const cached = cache.get(profile.id);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }
  const cacheTtlMs = panelSettings.getIntervalMs();

  const password = credentialStore.getPassword(profile.username);
  if (!password) {
    return res.status(400).json({ error: 'Kein gespeichertes Passwort für diesen Login gefunden' });
  }

  let bridgeRes;
  try {
    bridgeRes = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: profile.username, password, server: profile.server }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'sf-api-Bridge nicht erreichbar: ' + err.message });
  }

  const data = await bridgeRes.json();
  if (!bridgeRes.ok) {
    return res.status(502).json({ error: data.error || 'sf-api-Bridge-Fehler' });
  }

  cache.set(profile.id, { data, expiresAt: Date.now() + cacheTtlMs });
  res.json(data);
});

module.exports = router;
