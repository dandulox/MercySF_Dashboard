const fs = require('fs');
const path = require('path');
const accountsRegistry = require('./accountsRegistry');
const { rngFor, rand, randInt, randomWeights } = require('./randomizerRng');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'randomizer.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'randomizer-settings.json');
const TICK_INTERVAL_MS = 60 * 1000;

const DEFAULT_SETTINGS = {
  minHours: 2, maxHours: 14,
  dayStart: '06:00', dayEnd: '18:00',
  minStaggerMinutes: 10,
  minBlockMinutes: 20,
  blockGapMinutes: [15, 90],
  stadtwacheDurationMin: 3,
  stadtwacheCutoff: '22:00',
};

const DEFAULT_CONFIG = {
  enabled: false,
  mode: 'manual', // 'manual' | 'willkuer'
  hoursPerDay: 6,
  blockCount: 2,
  stadtwacheCount: 2,
};

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  try { fs.chmodSync(filePath, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_PATH, {}) };
}

function setSettings(partial) {
  const merged = { ...getSettings(), ...partial };
  writeJson(SETTINGS_PATH, merged);
  return merged;
}

function getAllConfigs() {
  return readJson(CONFIG_PATH, {});
}

function getConfig(profileId) {
  return { ...DEFAULT_CONFIG, ...(getAllConfigs()[profileId] || {}) };
}

function setConfig(profileId, partial) {
  const all = getAllConfigs();
  const merged = { ...DEFAULT_CONFIG, ...(all[profileId] || {}), ...partial };
  all[profileId] = merged;
  writeJson(CONFIG_PATH, all);
  return merged;
}

function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Verteilt totalMinutes zufällig auf blockCount Blöcke, hebt Blöcke unter minBlockMinutes an
// (auf Kosten der Blöcke, die noch darüber liegen) statt sie einfach abzuschneiden.
function distributeBlockMinutes(rng, totalMinutes, blockCount, minBlockMinutes) {
  const weights = randomWeights(rng, blockCount);
  const minutes = weights.map(w => w * totalMinutes);
  for (let i = 0; i < minutes.length; i++) {
    if (minutes[i] >= minBlockMinutes) continue;
    const deficit = minBlockMinutes - minutes[i];
    minutes[i] = minBlockMinutes;
    const donors = minutes.map((_, idx) => idx).filter(idx => idx !== i && minutes[idx] > minBlockMinutes);
    const donorSum = donors.reduce((sum, idx) => sum + minutes[idx], 0);
    if (donorSum > 0) {
      donors.forEach(idx => { minutes[idx] -= deficit * (minutes[idx] / donorSum); });
    }
  }
  return minutes.map(m => Math.max(minBlockMinutes, Math.round(m)));
}

function placeBlocks(rng, blockMinutes, settings) {
  const dayStartMin = parseHHMM(settings.dayStart);
  const dayEndMin = parseHHMM(settings.dayEnd);
  let cursor = Math.round(rand(rng, dayStartMin, dayEndMin));
  const blocks = [];
  for (let i = 0; i < blockMinutes.length; i++) {
    const start = cursor;
    const end = start + blockMinutes[i];
    blocks.push({ start, end });
    const gap = Math.round(rand(rng, settings.blockGapMinutes[0], settings.blockGapMinutes[1]));
    cursor = end + gap;
  }
  return blocks;
}

// Stadtwache-Pulse landen nie innerhalb eines Blocks (der Bot läuft dort schon), sondern in den
// Lücken zwischen Blöcken sowie nach dem letzten Block bis zum Cutoff.
function placeStadtwache(rng, blocks, stadtwacheCount, settings) {
  const cutoffMin = parseHHMM(settings.stadtwacheCutoff);
  const buffer = settings.stadtwacheDurationMin;
  const intervals = [];
  for (let i = 0; i < blocks.length - 1; i++) {
    intervals.push([blocks[i].end, blocks[i + 1].start]);
  }
  if (blocks.length) {
    const lastEnd = blocks[blocks.length - 1].end;
    if (cutoffMin > lastEnd) intervals.push([lastEnd, cutoffMin]);
  }
  const usable = intervals.filter(([start, end]) => end - start > buffer * 2);
  if (!usable.length) return [];

  const totalSpan = usable.reduce((sum, [start, end]) => sum + (end - start), 0);
  const pulses = [];
  for (let i = 0; i < stadtwacheCount; i++) {
    let pick = rand(rng, 0, totalSpan);
    let chosen = usable[usable.length - 1];
    for (const interval of usable) {
      const span = interval[1] - interval[0];
      if (pick < span) { chosen = interval; break; }
      pick -= span;
    }
    const at = Math.round(rand(rng, chosen[0] + buffer, chosen[1] - buffer));
    pulses.push({ at });
  }
  return pulses.sort((a, b) => a.at - b.at);
}

function generateDayPlan(profileId, dateStr, config, settings) {
  const rng = rngFor(profileId, dateStr);
  const isWillkur = config.mode === 'willkuer';
  const totalHours = isWillkur ? rand(rng, settings.minHours, settings.maxHours) : config.hoursPerDay;
  const blockCount = isWillkur ? randInt(rng, 1, 4) : config.blockCount;
  const stadtwacheCount = isWillkur ? randInt(rng, 1, 5) : config.stadtwacheCount;

  const blockMinutes = distributeBlockMinutes(rng, totalHours * 60, blockCount, settings.minBlockMinutes);
  const blocks = placeBlocks(rng, blockMinutes, settings);
  const stadtwache = placeStadtwache(rng, blocks, stadtwacheCount, settings);

  return { date: dateStr, blocks, stadtwache };
}

// Kein Account darf zur exakt gleichen Zeit starten wie ein anderer — nach Startzeit sortieren
// und bei Unterschreitung des Mindestabstands den gesamten Plan (Blöcke + Stadtwache) des
// späteren Accounts nach hinten schieben. Ein Schieben über Mitternacht hinaus wird gekappt.
function applyStagger(plansByProfile, settings) {
  const entries = Object.entries(plansByProfile).filter(([, plan]) => plan.blocks.length);
  entries.sort((a, b) => a[1].blocks[0].start - b[1].blocks[0].start);

  let prevStart = -Infinity;
  for (const [, plan] of entries) {
    const start = plan.blocks[0].start;
    let shift = start - prevStart < settings.minStaggerMinutes
      ? (prevStart + settings.minStaggerMinutes) - start
      : 0;
    if (shift > 0) {
      const lastEvent = Math.max(
        plan.blocks[plan.blocks.length - 1].end,
        ...plan.stadtwache.map(s => s.at),
        0
      );
      shift = Math.min(shift, Math.max(0, 1439 - lastEvent));
    }
    if (shift > 0) {
      plan.blocks = plan.blocks.map(b => ({ start: b.start + shift, end: b.end + shift }));
      plan.stadtwache = plan.stadtwache.map(s => ({ at: s.at + shift }));
    }
    prevStart = plan.blocks[0].start;
  }
  return plansByProfile;
}

function buildPlansForDate(dateStr) {
  const settings = getSettings();
  const configs = getAllConfigs();
  const raw = {};
  for (const [profileId, config] of Object.entries(configs)) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    if (!merged.enabled) continue;
    raw[profileId] = generateDayPlan(profileId, dateStr, merged, settings);
  }
  return applyStagger(raw, settings);
}

let cachedDate = null;
let cachedPlans = {};

function plansForToday() {
  const today = todayDateStr();
  if (cachedDate !== today) {
    cachedPlans = buildPlansForDate(today);
    cachedDate = today;
  }
  return cachedPlans;
}

function getTodayPlan(profileId) {
  return plansForToday()[profileId] || null;
}

function desiredStateAt(plan, nowMinutes, settings) {
  for (const b of plan.blocks) {
    if (nowMinutes >= b.start && nowMinutes < b.end) return 'block';
  }
  for (const s of plan.stadtwache) {
    if (nowMinutes >= s.at && nowMinutes < s.at + settings.stadtwacheDurationMin) return 'stadtwache';
  }
  return 'idle';
}

const lastDesiredState = new Map(); // profileId -> 'block' | 'stadtwache' | 'idle'

async function tick() {
  const settings = getSettings();
  const plans = plansForToday();
  const nowMinutes = currentMinutes();
  const { startProfileById, stopProfileById } = require('../routes/profiles');

  for (const [profileId, plan] of Object.entries(plans)) {
    const profile = accountsRegistry.list().find(p => p.id === profileId);
    if (!profile) continue;
    const desired = desiredStateAt(plan, nowMinutes, settings);
    const prev = lastDesiredState.get(profileId) || 'idle';
    if (desired === prev) continue;
    lastDesiredState.set(profileId, desired);
    try {
      if (desired === 'idle') await stopProfileById(profileId);
      else await startProfileById(profileId);
    } catch (e) {
      // Best-effort: ein einzelner fehlgeschlagener Übergang darf den Tick für alle anderen
      // Accounts nicht blockieren.
    }
  }

  // Für Accounts, die zwischenzeitlich deaktiviert wurden, den Tracking-State aufräumen.
  for (const profileId of [...lastDesiredState.keys()]) {
    if (!plans[profileId]) lastDesiredState.delete(profileId);
  }
}

setInterval(() => { tick().catch(() => {}); }, TICK_INTERVAL_MS);

module.exports = {
  getSettings, setSettings,
  getAllConfigs, getConfig, setConfig,
  getTodayPlan,
  // für Tests:
  generateDayPlan, applyStagger, distributeBlockMinutes, placeBlocks, placeStadtwache, desiredStateAt,
};
