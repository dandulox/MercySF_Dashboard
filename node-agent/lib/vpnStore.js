const fs = require('fs');
const path = require('path');

// Ein Node hat immer nur EIN aktives VPN-Profil zugewiesen (anders als das Dashboard, das
// mehrere Profile für mehrere Ziele verwaltet) — daher ein Single-Record-Store statt einer Liste.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'vpn-assignment.json');

function getAssignment() {
  if (!fs.existsSync(FILE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function setAssignment({ vpnProfileId, interfaceName, gate }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const assignment = { vpnProfileId: vpnProfileId || null, interfaceName: interfaceName || null, gate: gate || 'off' };
  fs.writeFileSync(FILE_PATH, JSON.stringify(assignment, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
  return assignment;
}

module.exports = { getAssignment, setAssignment };
