const fs = require('fs');
const path = require('path');
const vpnConfigStore = require('./vpnConfigStore');

// Ein "VPN-Profil" ist eine hochgeladene WireGuard-Config (= ein bestimmter ProtonVPN-
// Account+Standort). interfaceName wird fortlaufend vergeben (wg0, wg1, ...) statt aus dem
// Label abgeleitet, weil Linux-Interface-Namen auf 15 Zeichen begrenzt sind.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'vpn-profiles.json');

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

// Profile, die vor Einführung der Endpoint-Extraktion angelegt wurden, haben noch kein
// endpointHost-Feld — beim Auflisten einmalig aus der bereits gespeicherten Config nachtragen,
// statt den Nutzer zum erneuten Hochladen zu zwingen.
function list() {
  const all = readAll();
  let changed = false;
  for (const profile of all) {
    if (profile.endpointHost === undefined) {
      const configContent = vpnConfigStore.getConfig(profile.id);
      profile.endpointHost = configContent ? parseEndpointHost(configContent) : null;
      changed = true;
    }
  }
  if (changed) writeAll(all);
  return all;
}

function nextInterfaceName(all) {
  let n = 0;
  const used = new Set(all.map(p => p.interfaceName));
  while (used.has(`wg${n}`)) n++;
  return `wg${n}`;
}

function looksLikeWireGuardConfig(content) {
  return /\[Interface\]/.test(content) && /\[Peer\]/.test(content);
}

// Die Endpoint-IP aus der Config ist die tatsächliche VPN-Server-IP, mit der der Tunnel
// verbunden wird — wird nur zur Anzeige ("mit welcher IP bin ich verbunden") extrahiert, kein
// zusätzlicher externer Aufruf nötig. Kommentierte Zeilen (z. B. die IPv6-Alternative bei
// ProtonVPN-Configs) beginnen nach optionalem Whitespace mit "#", nicht mit "Endpoint" — der
// Regex-Anker ^\s*Endpoint verlangt daher automatisch eine nicht auskommentierte Zeile.
function parseEndpointHost(content) {
  const match = content.match(/^\s*Endpoint\s*=\s*(\[[^\]]+\]|[^:\s]+):\d+/mi);
  if (!match) return null;
  return match[1].replace(/^\[|\]$/g, '');
}

function add({ label, configContent }) {
  if (!label || !configContent) throw new Error('label und configContent sind erforderlich');
  if (!looksLikeWireGuardConfig(configContent)) {
    throw new Error('Das sieht nicht nach einer gültigen WireGuard-Config aus (fehlende [Interface]/[Peer]-Sektion)');
  }
  const all = readAll();
  const interfaceName = nextInterfaceName(all);
  const profile = {
    id: interfaceName,
    label: String(label).slice(0, 80),
    interfaceName,
    endpointHost: parseEndpointHost(configContent),
    createdAt: new Date().toISOString(),
  };
  all.push(profile);
  writeAll(all);
  vpnConfigStore.setConfig(profile.id, configContent);
  return profile;
}

function rename(id, label) {
  if (!label) throw new Error('label ist erforderlich');
  const all = readAll();
  const profile = all.find(p => p.id === id);
  if (!profile) return null;
  profile.label = String(label).slice(0, 80);
  writeAll(all);
  return profile;
}

function remove(id) {
  const all = readAll();
  const filtered = all.filter(p => p.id !== id);
  writeAll(filtered);
  vpnConfigStore.deleteConfig(id);
  return filtered.length !== all.length;
}

module.exports = { list, add, rename, remove };
