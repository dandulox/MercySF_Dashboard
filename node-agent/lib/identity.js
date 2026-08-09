const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Jeder Node-Agent bekommt beim allerersten Start eine eigene, stabile ID (unabhängig vom
// Hostnamen, der sich ändern kann) — das Dashboard verwendet diese ID, um ein Profil dauerhaft
// einem Node zuzuordnen, auch wenn der Node später umbenannt wird.
const DATA_DIR = path.join(__dirname, '..', 'data');
const IDENTITY_PATH = path.join(DATA_DIR, 'identity.json');

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(IDENTITY_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8'));
    } catch (e) { /* fällt durch auf Neuanlage */ }
  }
  const identity = {
    nodeId: crypto.randomBytes(8).toString('hex'),
    name: os.hostname(),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2), { mode: 0o600 });
  return identity;
}

let identity = load();

function get() {
  return identity;
}

function rename(name) {
  identity.name = String(name).slice(0, 60) || identity.name;
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2), { mode: 0o600 });
  return identity;
}

module.exports = { get, rename };
