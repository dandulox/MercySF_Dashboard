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
  minBlockMinutes: 20,
  blockGapMinutes: [15, 90],
  stadtwacheDurationMin: 3,
  stadtwacheCutoff: '22:00',
  reserveNodeId: null,       // Node, der ausschließlich Stadtwache-Pulse abarbeitet; null = keine Stadtwache-Planung
  nodeHandoffMinutes: 5,     // Puffer zwischen zwei Accounts auf demselben Node (VPN trennen + neu verbinden)
  dayHardEnd: '23:00',       // ab hier startet nichts Neues mehr auf irgendeinem Node
};

const DEFAULT_CONFIG = {
  enabled: false,
  mode: 'manual', // 'manual' | 'willkuer'
  hoursPerDay: 6,
  blockCount: 2,
  stadtwacheCount: 2,
  priority: 50,          // höher = wird zuerst auf die Nodes eingeplant
  vpnMode: 'none',       // 'none' | 'profile' — explizite Wahl, kein impliziter Fallback
  vpnProfileId: null,    // nur relevant wenn vpnMode='profile'
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

function getConfig(username) {
  return { ...DEFAULT_CONFIG, ...(getAllConfigs()[username] || {}) };
}

function setConfig(username, partial) {
  const all = getAllConfigs();
  const merged = { ...DEFAULT_CONFIG, ...(all[username] || {}), ...partial };
  all[username] = merged;
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

// Nodes = Lokal + alle gepairten Nodes, die zuletzt als online gemeldet wurden (unerreichbare
// Nodes fallen raus, damit nichts auf einen toten Node geplant wird). Der Reserve-Node (falls
// gesetzt und noch vorhanden) wird aus dem Haupt-Pool herausgenommen — er bekommt stattdessen die
// gemeinsame Stadtwache-Warteschlange (siehe fillStadtwacheQueue).
function todayNodePool(settings) {
  const nodeRegistry = require('./nodeRegistry');
  const online = nodeRegistry.list().filter(n => n.lastStatus === 'online');
  const allNodes = [{ id: 'local', name: 'Lokal' }, ...online];
  const reserveNode = allNodes.find(n => n.id === settings.reserveNodeId) || null;
  const poolNodes = allNodes.filter(n => n !== reserveNode);
  return { allNodes, reserveNode, poolNodes };
}

// Aktive Accounts für den Tag, nach Priorität absteigend sortiert. Gleichstand wird über einen
// seed-basierten Zufallswert pro Account+Datum aufgelöst — reproduzierbar (kein Drift bei
// Neustart), aber nicht jeden Tag identisch geordnet.
function priorityQueue(configs, dateStr) {
  const entries = Object.entries(configs)
    .map(([username, config]) => [username, { ...DEFAULT_CONFIG, ...config }])
    .filter(([, config]) => config.enabled);
  const tieKeys = new Map(entries.map(([username]) => [username, rngFor(`${username}:tie`, dateStr)()]));
  entries.sort((a, b) => (b[1].priority - a[1].priority) || (tieKeys.get(a[0]) - tieKeys.get(b[0])));
  return entries;
}

// Kernstück: Accounts werden per Round-Robin auf die Pool-Nodes verteilt und dort NACHEINANDER
// eingeplant (nie überlappend) — ein Node kann zu einem Zeitpunkt nur eine VPN-Identität halten,
// zwei Accounts mit unterschiedlicher VPN-Config dürfen also nie gleichzeitig auf demselben Node
// laufen. Jeder Node führt seine eigene Warteschlange, unabhängig vom Tempo der anderen Nodes.
function fillNodeQueues(queue, poolNodes, settings, dateStr) {
  const plans = {};
  const scheduledMeta = []; // in Prioritätsreihenfolge, für die Stadtwache-Phase
  if (!poolNodes.length) return { plans, scheduledMeta };

  const dayStartMin = parseHHMM(settings.dayStart);
  const dayEndMin = parseHHMM(settings.dayEnd);
  const hardEndMin = parseHHMM(settings.dayHardEnd);

  const nodeState = new Map(poolNodes.map(node => {
    const rng = rngFor(`node:${node.id}`, dateStr);
    return [node.id, { cursor: Math.round(rand(rng, dayStartMin, dayEndMin)), hasAccount: false }];
  }));

  let nodeIndex = 0;
  for (const [username, config] of queue) {
    const node = poolNodes[nodeIndex % poolNodes.length];
    nodeIndex++;
    const state = nodeState.get(node.id);

    const rng = rngFor(username, dateStr);
    const isWillkur = config.mode === 'willkuer';
    const totalHours = isWillkur ? rand(rng, settings.minHours, settings.maxHours) : config.hoursPerDay;
    const blockCount = isWillkur ? randInt(rng, 1, 4) : config.blockCount;
    const stadtwacheCount = isWillkur ? randInt(rng, 1, 5) : config.stadtwacheCount;
    const blockMinutes = distributeBlockMinutes(rng, totalHours * 60, blockCount, settings.minBlockMinutes);

    const start = state.hasAccount ? state.cursor + settings.nodeHandoffMinutes : state.cursor;
    if (start >= hardEndMin) continue; // kein Platz mehr auf diesem Node heute

    let cursor = Math.round(start);
    const blocks = [];
    for (const mins of blockMinutes) {
      const bStart = cursor;
      const bEnd = bStart + mins;
      blocks.push({ start: bStart, end: bEnd });
      const gap = Math.round(rand(rng, settings.blockGapMinutes[0], settings.blockGapMinutes[1]));
      cursor = bEnd + gap;
    }

    plans[username] = {
      date: dateStr, nodeId: node.id, blocks, stadtwache: [],
      vpnMode: config.vpnMode, vpnProfileId: config.vpnProfileId,
    };
    state.cursor = blocks[blocks.length - 1].end;
    state.hasAccount = true;
    scheduledMeta.push({ username, stadtwacheCount });
  }

  return { plans, scheduledMeta };
}

// Alle Stadtwache-Pulse aller eingeplanten Accounts laufen in EINER gemeinsamen Warteschlange auf
// dem Reserve-Node (gleiches Prinzip wie fillNodeQueues, nur ein einziger Node mit vielen kurzen
// statt wenigen langen Slots). scheduledMeta ist bereits in Prioritätsreihenfolge — reicht die
// Zeit nicht für alle Pulse, fallen automatisch zuerst die niedrigst-priorisierten weg.
function fillStadtwacheQueue(plans, scheduledMeta, reserveNode, settings, dateStr) {
  const dayStartMin = parseHHMM(settings.dayStart);
  const cutoffMin = parseHHMM(settings.stadtwacheCutoff);
  const rng = rngFor(`reserve:${reserveNode.id}`, dateStr);
  let cursor = Math.round(rand(rng, dayStartMin, cutoffMin));
  let hasAny = false;

  for (const meta of scheduledMeta) {
    for (let i = 0; i < meta.stadtwacheCount; i++) {
      const start = hasAny ? cursor + settings.nodeHandoffMinutes : cursor;
      const end = start + settings.stadtwacheDurationMin;
      if (end > cutoffMin) return; // ab hier passt nichts mehr rein, Rest entfällt
      plans[meta.username].stadtwache.push({ at: start });
      cursor = end;
      hasAny = true;
    }
  }
}

function buildPlansForDate(dateStr) {
  const settings = getSettings();
  const configs = getAllConfigs();
  const queue = priorityQueue(configs, dateStr);
  if (!queue.length) return {};

  const { poolNodes, reserveNode } = todayNodePool(settings);
  const { plans, scheduledMeta } = fillNodeQueues(queue, poolNodes, settings, dateStr);
  if (reserveNode && scheduledMeta.length) {
    fillStadtwacheQueue(plans, scheduledMeta, reserveNode, settings, dateStr);
  }
  return plans;
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

function getTodayPlan(username) {
  return plansForToday()[username] || null;
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

// Schaltet die VPN-Zuweisung eines Nodes aktiv um, bevor der nächste Account dort startet.
// enforceLocalVpnGate()/das node-agent-Äquivalent prüfen nur "ist überhaupt etwas verbunden",
// nicht "ist das RICHTIGE Profil verbunden" — ohne dieses aktive Trennen+Neuzuweisen würde ein
// Accountwechsel auf demselben Node stillschweigend den alten Tunnel weiterbenutzen.
async function switchNodeVpn(nodeId, vpnMode, vpnProfileId) {
  const vpnProfiles = require('./vpnProfiles');
  const vpnConfigStore = require('./vpnConfigStore');
  const vpnTargets = require('./vpnTargets');
  const vpnManager = require('./vpnManager');
  const nodeRegistry = require('./nodeRegistry');
  const nodeClient = require('./nodeClient');

  const isLocal = nodeId === 'local';
  const node = isLocal ? null : nodeRegistry.get(nodeId);
  if (!isLocal && !node) return;

  try {
    if (isLocal) {
      const currentTarget = vpnTargets.get('local');
      if (currentTarget?.vpnProfileId) {
        const prevProfile = vpnProfiles.list().find(p => p.id === currentTarget.vpnProfileId);
        if (prevProfile) await vpnManager.disconnect(prevProfile.interfaceName);
      }
    } else {
      await nodeClient.call(node, '/vpn/disconnect', { method: 'POST' });
    }
  } catch (e) { /* best effort */ }

  try {
    if (vpnMode === 'profile' && vpnProfileId) {
      const profile = vpnProfiles.list().find(p => p.id === vpnProfileId);
      if (!profile) return;
      if (isLocal) {
        vpnTargets.setConfig('local', { vpnProfileId: profile.id, gate: 'auto-connect' });
      } else {
        const configContent = vpnConfigStore.getConfig(profile.id);
        await nodeClient.call(node, '/vpn/config', {
          method: 'POST',
          body: { vpnProfileId: profile.id, interfaceName: profile.interfaceName, configContent, gate: 'auto-connect' },
        });
      }
    } else if (isLocal) {
      vpnTargets.setConfig('local', { gate: 'off' });
    } else {
      await nodeClient.call(node, '/vpn/config', { method: 'POST', body: { gate: 'off' } });
    }
  } catch (e) { /* best effort */ }
}

const lastDesiredState = new Map(); // username -> 'block' | 'stadtwache' | 'idle'

// "Account" = das Login (username), nicht der einzelne Charakter — alle Charaktere eines Logins
// starten/stoppen gemeinsam und laufen auf demselben, für den Tag zugeteilten Node.
async function tick() {
  const settings = getSettings();
  const plans = plansForToday();
  const nowMinutes = currentMinutes();
  const { startProfileById, stopProfileById } = require('../routes/profiles');

  for (const [username, plan] of Object.entries(plans)) {
    const members = accountsRegistry.list().filter(p => p.username === username);
    if (!members.length) continue;
    const desired = desiredStateAt(plan, nowMinutes, settings);
    const prev = lastDesiredState.get(username) || 'idle';
    if (desired === prev) continue;
    lastDesiredState.set(username, desired);

    if (desired === 'idle') {
      for (const member of members) {
        try { await stopProfileById(member.id); } catch (e) { /* best effort */ }
      }
      continue;
    }

    const nodeId = desired === 'stadtwache' ? settings.reserveNodeId : plan.nodeId;
    if (!nodeId) continue; // z. B. Reserve-Node zwischenzeitlich entfernt

    for (const member of members) {
      try { accountsRegistry.setNode(member.id, nodeId === 'local' ? null : nodeId); } catch (e) { /* best effort */ }
    }
    await switchNodeVpn(nodeId, plan.vpnMode, plan.vpnProfileId);
    for (const member of members) {
      try { await startProfileById(member.id); } catch (e) { /* best effort */ }
    }
  }

  for (const username of [...lastDesiredState.keys()]) {
    if (!plans[username]) lastDesiredState.delete(username);
  }
}

setInterval(() => { tick().catch(() => {}); }, TICK_INTERVAL_MS);

module.exports = {
  getSettings, setSettings,
  getAllConfigs, getConfig, setConfig,
  getTodayPlan,
  // für Tests:
  distributeBlockMinutes, desiredStateAt,
  priorityQueue, todayNodePool, fillNodeQueues, fillStadtwacheQueue, buildPlansForDate,
};
