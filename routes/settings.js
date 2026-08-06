const express = require('express');
const path = require('path');
const fs = require('fs');
const { findDataDir } = require('../lib/data');

const router = express.Router();

router.get('/:accountId', (req, res) => {
  const dataDir = findDataDir();
  if (!dataDir) return res.status(404).json({ error: 'Kein Datenverzeichnis gefunden' });
  const filePath = path.join(dataDir, 'characters', `${req.params.accountId}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Keine Einstellungen für diesen Account' });
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Einstellungen konnten nicht gelesen werden' });
  }
  res.json(settings);
});

router.put('/:accountId', express.json(), (req, res) => {
  const dataDir = findDataDir();
  if (!dataDir) return res.status(404).json({ error: 'Kein Datenverzeichnis gefunden' });
  const filePath = path.join(dataDir, 'characters', `${req.params.accountId}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Keine Einstellungen für diesen Account' });
  let current;
  try {
    current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Einstellungen konnten nicht gelesen werden' });
  }
  const updates = req.body || {};
  const allowedKeys = new Set(Object.keys(current));
  const rejected = [];
  for (const key of Object.keys(updates)) {
    if (!allowedKeys.has(key)) { rejected.push(key); continue; }
    if (typeof current[key] !== typeof updates[key]) { rejected.push(key); continue; }
    current[key] = updates[key];
  }
  if (rejected.length) {
    return res.status(400).json({ error: `Unbekannte oder typinkompatible Felder: ${rejected.join(', ')}` });
  }
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
  res.json(current);
});

module.exports = router;
