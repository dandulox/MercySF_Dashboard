const express = require('express');
const randomizer = require('../lib/randomizer');
const vpnProfiles = require('../lib/vpnProfiles');

const router = express.Router();

function isValidHHMM(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

router.get('/settings', (req, res) => {
  res.json(randomizer.getSettings());
});

router.post('/settings', express.json(), (req, res) => {
  const {
    minHours, maxHours, dayStart, dayEnd, minBlockMinutes, blockGapMinutes,
    stadtwacheDurationMin, stadtwacheCutoff, reserveNodeId, nodeHandoffMinutes, dayHardEnd, hardEnforce,
  } = req.body || {};
  const patch = {};
  if (minHours !== undefined) patch.minHours = Number(minHours);
  if (maxHours !== undefined) patch.maxHours = Number(maxHours);
  if (dayStart !== undefined) {
    if (!isValidHHMM(dayStart)) return res.status(400).json({ error: 'dayStart muss HH:MM sein' });
    patch.dayStart = dayStart;
  }
  if (dayEnd !== undefined) {
    if (!isValidHHMM(dayEnd)) return res.status(400).json({ error: 'dayEnd muss HH:MM sein' });
    patch.dayEnd = dayEnd;
  }
  if (minBlockMinutes !== undefined) patch.minBlockMinutes = Number(minBlockMinutes);
  if (Array.isArray(blockGapMinutes) && blockGapMinutes.length === 2) patch.blockGapMinutes = blockGapMinutes.map(Number);
  if (stadtwacheDurationMin !== undefined) patch.stadtwacheDurationMin = Number(stadtwacheDurationMin);
  if (stadtwacheCutoff !== undefined) {
    if (!isValidHHMM(stadtwacheCutoff)) return res.status(400).json({ error: 'stadtwacheCutoff muss HH:MM sein' });
    patch.stadtwacheCutoff = stadtwacheCutoff;
  }
  if (reserveNodeId !== undefined) patch.reserveNodeId = reserveNodeId || null;
  if (nodeHandoffMinutes !== undefined) patch.nodeHandoffMinutes = Number(nodeHandoffMinutes);
  if (dayHardEnd !== undefined) {
    if (!isValidHHMM(dayHardEnd)) return res.status(400).json({ error: 'dayHardEnd muss HH:MM sein' });
    patch.dayHardEnd = dayHardEnd;
  }
  if (hardEnforce !== undefined) patch.hardEnforce = !!hardEnforce;
  res.json(randomizer.setSettings(patch));
});

router.get('/configs', (req, res) => {
  res.json(randomizer.getAllConfigs());
});

router.post('/configs/:username', express.json(), (req, res) => {
  const settings = randomizer.getSettings();
  const { enabled, mode, hoursPerDay, blockCount, stadtwacheCount, priority, vpnMode, vpnProfileId } = req.body || {};
  const patch = {};
  if (enabled !== undefined) patch.enabled = !!enabled;
  if (mode !== undefined) {
    if (mode !== 'manual' && mode !== 'willkuer') return res.status(400).json({ error: 'Ungültiger Modus' });
    patch.mode = mode;
  }
  if (hoursPerDay !== undefined) {
    const h = Number(hoursPerDay);
    if (!Number.isFinite(h) || h < settings.minHours || h > settings.maxHours) {
      return res.status(400).json({ error: `Stunden müssen zwischen ${settings.minHours} und ${settings.maxHours} liegen` });
    }
    patch.hoursPerDay = h;
  }
  if (blockCount !== undefined) {
    const b = Number(blockCount);
    if (!Number.isInteger(b) || b < 1 || b > 4) return res.status(400).json({ error: 'Blockanzahl muss 1-4 sein' });
    patch.blockCount = b;
  }
  if (stadtwacheCount !== undefined) {
    const s = Number(stadtwacheCount);
    if (!Number.isInteger(s) || s < 1 || s > 5) return res.status(400).json({ error: 'Stadtwache-Anzahl muss 1-5 sein' });
    patch.stadtwacheCount = s;
  }
  if (priority !== undefined) {
    const p = Number(priority);
    if (!Number.isInteger(p) || p < 1 || p > 100) return res.status(400).json({ error: 'Priorität muss 1-100 sein' });
    patch.priority = p;
  }
  if (vpnMode !== undefined) {
    if (vpnMode !== 'none' && vpnMode !== 'profile') return res.status(400).json({ error: 'Ungültiger VPN-Modus' });
    patch.vpnMode = vpnMode;
  }
  if (vpnProfileId !== undefined) {
    if (vpnProfileId !== null && !vpnProfiles.list().some(p => p.id === vpnProfileId)) {
      return res.status(400).json({ error: 'VPN-Profil nicht gefunden' });
    }
    patch.vpnProfileId = vpnProfileId;
  }
  res.json(randomizer.setConfig(req.params.username, patch));
});

router.get('/plan/:username', (req, res) => {
  res.json({ plan: randomizer.getTodayPlan(req.params.username) });
});

module.exports = router;
