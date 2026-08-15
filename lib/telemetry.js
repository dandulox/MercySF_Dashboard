const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodeRegistry = require('./nodeRegistry');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ID_PATH = path.join(DATA_DIR, 'telemetry-id.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'telemetry-settings.json');
const COLLECTOR_URL = 'https://data.poslab.cc/ingest';
const PING_INTERVAL_MS = 15 * 60 * 1000;

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

function getOrCreateInstanceId() {
  const existing = readJson(ID_PATH, null);
  if (existing && existing.id) return existing.id;
  const id = crypto.randomUUID();
  writeJson(ID_PATH, { id });
  return id;
}

// Steuert NUR, ob Versions-Infos (Dashboard- und Node-Versionen) mitgesendet werden. Instanz-ID,
// Laufzeit und Anzahl verbundener Nodes gelten als notwendige Daten für die Installationsstatistik
// und werden unabhängig von dieser Einstellung immer gesendet.
function isVersionReportingEnabled() {
  const settings = readJson(SETTINGS_PATH, { enabled: true });
  return settings.enabled !== false;
}

function setVersionReportingEnabled(enabled) {
  writeJson(SETTINGS_PATH, { enabled: !!enabled });
}

let lastPing = null;

function getLastPing() {
  return lastPing;
}

function buildPayload() {
  const onlineNodes = nodeRegistry.list().filter(n => n.lastStatus === 'online');
  const payload = {
    instanceId: getOrCreateInstanceId(),
    uptimeSec: Math.floor(process.uptime()),
    connectedNodes: onlineNodes.length,
  };
  if (isVersionReportingEnabled()) {
    payload.dashboardVersion = require('../package.json').version;
    payload.nodeVersions = onlineNodes.map(n => n.cliVersion || 'unknown');
  }
  return payload;
}

async function sendPing() {
  const payload = buildPayload();
  const body = JSON.stringify(payload);
  let ok = true;
  let error = null;
  try {
    const res = await fetch(COLLECTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    ok = res.ok;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    // Best-effort: Telemetrie darf den laufenden Betrieb nie beeinträchtigen.
    ok = false;
    error = e.message;
  }
  lastPing = { sentAt: new Date().toISOString(), ok, error, payload };
}

sendPing();
setInterval(sendPing, PING_INTERVAL_MS);

module.exports = {
  getOrCreateInstanceId,
  isEnabled: isVersionReportingEnabled,
  setEnabled: setVersionReportingEnabled,
  sendPing,
  getLastPing,
};
