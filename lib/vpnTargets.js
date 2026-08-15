const fs = require('fs');
const path = require('path');

// Ein "Ziel" ist entweder "local" (dieser Server) oder eine nodeId aus lib/nodeRegistry.js.
// Nicht verschlüsselt — enthält keine Geheimnisse, nur Zuordnung + Cache des letzten Status.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'vpn-targets.json');
const VALID_GATES = ['off', 'block', 'auto-connect'];

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function defaultTarget(targetId) {
  return { targetId, vpnProfileId: null, gate: 'off', lastStatus: { connected: false, interfaceName: null, updatedAt: null } };
}

function list() {
  const all = readAll();
  if (!all.some(t => t.targetId === 'local')) all.push(defaultTarget('local'));
  return all;
}

function get(targetId) {
  return list().find(t => t.targetId === targetId) || null;
}

function upsert(targetId, patch) {
  const all = list();
  let target = all.find(t => t.targetId === targetId);
  if (!target) {
    target = defaultTarget(targetId);
    all.push(target);
  }
  Object.assign(target, patch);
  writeAll(all);
  return target;
}

function setConfig(targetId, { vpnProfileId, gate }) {
  if (gate && !VALID_GATES.includes(gate)) throw new Error(`Ungültiges gate (erlaubt: ${VALID_GATES.join(', ')})`);
  return upsert(targetId, { vpnProfileId: vpnProfileId ?? null, gate: gate || 'off' });
}

function setLastStatus(targetId, { connected, interfaceName }) {
  return upsert(targetId, { lastStatus: { connected: !!connected, interfaceName: interfaceName || null, updatedAt: new Date().toISOString() } });
}

module.exports = { list, get, setConfig, setLastStatus, VALID_GATES };
