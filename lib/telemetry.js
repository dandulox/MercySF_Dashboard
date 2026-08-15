const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ID_PATH = path.join(DATA_DIR, 'telemetry-id.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'telemetry-settings.json');

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

function isEnabled() {
  const settings = readJson(SETTINGS_PATH, { enabled: true });
  return settings.enabled !== false;
}

function setEnabled(enabled) {
  writeJson(SETTINGS_PATH, { enabled: !!enabled });
}

module.exports = { getOrCreateInstanceId, isEnabled, setEnabled };
