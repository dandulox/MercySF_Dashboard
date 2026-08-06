const express = require('express');
const registry = require('../lib/accountsRegistry');
const ptyManager = require('../lib/ptyManager');
const credentialStore = require('../lib/credentialStore');
const discoveryLogin = require('../lib/discoveryLogin');

const router = express.Router();

function serverFromUrl(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

// Loggt erneut ein (mit dem gespeicherten Passwort) und legt für neu gefundene Charaktere,
// die noch kein Profil haben, automatisch eins an — z. B. wenn im Spiel seitdem ein neuer
// Charakter erstellt wurde.
router.post('/:username/refresh', async (req, res) => {
  const username = req.params.username;
  const password = credentialStore.getPassword(username);
  if (!password) {
    return res.status(400).json({ error: 'Kein gespeichertes Passwort für diesen Login gefunden.' });
  }
  let characters;
  try {
    characters = await discoveryLogin.runDiscoveryLogin(username, password);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const created = [];
  for (const c of characters) {
    try {
      const profile = registry.add({
        username,
        server: serverFromUrl(c.url),
        characterName: c.name,
        nickname: c.name,
      });
      created.push(profile);
    } catch (err) {
      // Schon vorhanden — kein Fehler, einfach überspringen.
    }
  }
  res.json({ created, totalFound: characters.length });
});

// Entfernt ALLE Profile dieses Logins (stoppt laufende Prozesse) und das gespeicherte
// Passwort. Spieldaten (Statistiken, Kampfhistorie) bleiben unangetastet auf der Platte.
router.delete('/:username', (req, res) => {
  const username = req.params.username;
  const profiles = registry.list().filter(p => p.username.toLowerCase() === username.toLowerCase());
  for (const p of profiles) {
    ptyManager.killPty(p.id);
    registry.remove(p.id);
  }
  credentialStore.deletePassword(username);
  res.json({ ok: true, removed: profiles.length });
});

module.exports = router;
