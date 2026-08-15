const express = require('express');
const templates = require('../lib/settingsTemplates');
const ownerTokens = require('../lib/marketplaceOwnerTokens');
const { getOrCreateInstanceId } = require('../lib/telemetry');

const MARKETPLACE_URL = 'https://data.poslab.cc/api/marketplace';

const router = express.Router();

router.post('/:localTemplateId', express.json(), async (req, res) => {
  const template = templates.get(req.params.localTemplateId);
  if (!template) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
  const { displayName, title, description, tags } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Titel erforderlich' });

  let response;
  try {
    response = await fetch(`${MARKETPLACE_URL}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description || undefined,
        displayName: displayName || undefined,
        characterClass: template.characterClass || undefined,
        tags: Array.isArray(tags) ? tags : undefined,
        settings: template.settings,
        instanceId: getOrCreateInstanceId(),
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Marktplatz nicht erreichbar' });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return res.status(response.status).json({ error: body.error || 'Veröffentlichen fehlgeschlagen' });
  }
  const { id, ownerToken } = await response.json();
  ownerTokens.setToken(id, ownerToken);
  res.json({ marketplaceId: id });
});

router.delete('/:marketplaceId', async (req, res) => {
  const ownerToken = ownerTokens.getToken(req.params.marketplaceId);
  if (!ownerToken) return res.status(404).json({ error: 'Kein lokal gespeicherter Owner-Token für diese Vorlage' });

  let response;
  try {
    response = await fetch(`${MARKETPLACE_URL}/templates/${encodeURIComponent(req.params.marketplaceId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerToken }),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Marktplatz nicht erreichbar' });
  }
  if (!response.ok && response.status !== 404) {
    const body = await response.json().catch(() => ({}));
    return res.status(response.status).json({ error: body.error || 'Löschen fehlgeschlagen' });
  }
  ownerTokens.removeToken(req.params.marketplaceId);
  res.json({ ok: true });
});

module.exports = router;
