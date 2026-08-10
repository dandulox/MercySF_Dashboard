const fs = require('fs');
const path = require('path');
const credentialStore = require('./credentialStore');

// Minimale Profil-Ablage auf dem Node selbst. Das Dashboard ist die "Quelle der Wahrheit" für
// Spitznamen etc. — hier wird nur gespeichert, was der Node zum Starten der CLI braucht
// (Username/Server/Charaktername), unter derselben Profil-ID wie im Dashboard, damit Requests
// 1:1 durchgereicht werden können, ohne dass der Node eigene IDs vergibt.
const FILE_PATH = path.join(__dirname, '..', 'data', 'profiles.json');

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeAll(map) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(map, null, 2));
}

function list() {
  return Object.values(readAll());
}

function get(id) {
  return readAll()[id] || null;
}

// Legt das Profil an oder aktualisiert es (idempotent) — das Dashboard ruft das bei jeder
// Zuweisung/Änderung eines Accounts auf diesem Node erneut auf. Das Passwort läuft NICHT über
// diese Datei, sondern separat verschlüsselt in credentialStore.
function upsert({ id, username, server, characterName, nickname, password }) {
  if (!id || !username) throw new Error('id und username sind erforderlich');
  const all = readAll();
  all[id] = {
    id,
    username: String(username).slice(0, 100),
    server: server ? String(server).slice(0, 100) : null,
    characterName: characterName ? String(characterName).slice(0, 100) : null,
    nickname: nickname ? String(nickname).slice(0, 60) : (characterName || username),
    running: all[id]?.running || false,
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  if (password) credentialStore.setPassword(id, password);
  return all[id];
}

// Merkt sich, ob ein Profil zuletzt bewusst gestartet (und nicht wieder gestoppt) wurde — nicht
// vom tatsächlichen PTY-Lauf abhängig, der bei jedem Node-Agent-Neustart (Update, Reboot, Absturz)
// ohnehin verloren geht. server.js nutzt das beim Hochfahren, um zuletzt laufende Charaktere
// automatisch wieder zu starten (gleiches Muster wie restoreAutoStartedProfiles im Dashboard).
function setRunning(id, running) {
  const all = readAll();
  if (!all[id]) return null;
  all[id].running = !!running;
  writeAll(all);
  return all[id];
}

function remove(id) {
  const all = readAll();
  if (!all[id]) return false;
  delete all[id];
  writeAll(all);
  credentialStore.deletePassword(id);
  return true;
}

module.exports = { list, get, upsert, setRunning, remove };
