const fs = require('fs');
const path = require('path');
const os = require('os');

// Gleiche Kandidatenliste/Erkennung wie MercySF_Dashboard/lib/data.js — die CLI schreibt ihre
// Charakter-Config immer unter denselben Pfaden, unabhängig davon, ob sie vom Dashboard direkt
// oder von einem Node-Agent gestartet wird.
const CANDIDATES = [
  process.env.MERCY_DATA_DIR,
  path.join(os.homedir(), '.local', 'share', 'mercy-sf'),
  path.join(os.homedir(), '.config', 'mercy-sf'),
  path.join(os.homedir(), '.mercy-sf'),
  '/opt/mercy/data',
  '/root/.local/share/mercy-sf',
  '/root/.config/mercy-sf',
].filter(Boolean);

function findDataDir() {
  for (const c of CANDIDATES) {
    if (fs.existsSync(path.join(c, 'analytics')) || fs.existsSync(path.join(c, 'credentials.json'))) {
      return c;
    }
  }
  return null;
}

function accountIdFor(server, characterName) {
  return `https___${server.replace(/\./g, '_')}__${characterName}`;
}

module.exports = { findDataDir, accountIdFor };
