const express = require('express');
const path = require('path');
const fs = require('fs');
const { findDataDir } = require('../lib/data');
const templates = require('../lib/settingsTemplates');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(templates.list());
});

router.post('/', express.json(), (req, res) => {
  const { name, accountId } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  if (!accountId) return res.status(400).json({ error: 'accountId erforderlich' });

  const dataDir = findDataDir();
  if (!dataDir) return res.status(404).json({ error: 'Kein Datenverzeichnis gefunden' });
  const filePath = path.join(dataDir, 'characters', `${accountId}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Für diesen Account gibt es noch keine Einstellungen zum Speichern' });
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Einstellungen konnten nicht gelesen werden' });
  }

  const template = templates.create(name.trim(), settings);
  res.json(template);
});

router.delete('/:id', (req, res) => {
  const removed = templates.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
  res.json({ ok: true });
});

// Wendet die Vorlage auf alle angegebenen Accounts an — legt die characters/<id>.json dabei
// auch neu an, falls der Account noch nie gestartet wurde und daher noch keine eigene
// Einstellungsdatei hat (das ist der Hauptzweck: neue/unkonfigurierte Charaktere per Vorlage
// direkt einsatzbereit machen, statt sie erst manuell einmal durchzuklicken).
router.post('/:id/apply', express.json(), (req, res) => {
  const { accountIds } = req.body || {};
  if (!Array.isArray(accountIds) || !accountIds.length) {
    return res.status(400).json({ error: 'accountIds erforderlich' });
  }
  const template = templates.get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Vorlage nicht gefunden' });

  const dataDir = findDataDir();
  if (!dataDir) return res.status(404).json({ error: 'Kein Datenverzeichnis gefunden' });
  const charactersDir = path.join(dataDir, 'characters');
  fs.mkdirSync(charactersDir, { recursive: true });

  const applied = [];
  for (const accountId of accountIds) {
    const filePath = path.join(charactersDir, `${accountId}.json`);
    let current = {};
    if (fs.existsSync(filePath)) {
      try { current = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { current = {}; }
    }
    const merged = { ...current, ...template.settings };
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
    applied.push(accountId);
  }
  res.json({ applied });
});

module.exports = router;
