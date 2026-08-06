const fs = require('fs');
const path = require('path');

// Speichert Metadaten (Username, Spitzname, Server, Charaktername) pro Charakter. Ein Login
// (Username) kann mehrere Charaktere auf verschiedenen Servern haben — jeder bekommt ein
// eigenes Profil. Das Passwort steht NIE in dieser Datei, sondern verschlüsselt separat in
// credentialStore.js.
const FILE_PATH = path.join(__dirname, '..', 'data', 'account-profiles.json');

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2));
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'account';
}

function list() {
  return readAll();
}

// Ein Profil = genau ein Charakter (Username + Server + Charaktername). Duplikat-Prüfung
// läuft über die Kombination aus Username+Charaktername, nicht über den Username allein —
// sonst könnte man einem Login mit mehreren Charakteren nur einen davon zuordnen.
function add({ username, server, characterName, nickname }) {
  if (!username || !server || !characterName) {
    throw new Error('username, server und characterName sind erforderlich');
  }
  const all = readAll();
  const dupe = all.some(p =>
    p.username.toLowerCase() === String(username).toLowerCase() && p.characterName === characterName);
  if (dupe) {
    throw new Error(`Charakter "${characterName}" für "${username}" ist bereits angelegt`);
  }
  const base = slugify(`${username}-${characterName}`);
  let id = base;
  let suffix = 2;
  while (all.some(p => p.id === id)) {
    id = `${base}-${suffix++}`;
  }
  const profile = {
    id,
    nickname: String(nickname || characterName).slice(0, 60),
    username: String(username).slice(0, 100),
    server: String(server).slice(0, 100),
    characterName: String(characterName).slice(0, 100),
    pausedKeys: [],
    createdAt: new Date().toISOString(),
  };
  all.push(profile);
  writeAll(all);
  return profile;
}

function rename(id, nickname) {
  if (!nickname) throw new Error('nickname ist erforderlich');
  const all = readAll();
  const profile = all.find(p => p.id === id);
  if (!profile) return null;
  profile.nickname = String(nickname).slice(0, 60);
  writeAll(all);
  return profile;
}

function setPausedKeys(id, pausedKeys) {
  const all = readAll();
  const profile = all.find(p => p.id === id);
  if (!profile) return null;
  profile.pausedKeys = pausedKeys;
  writeAll(all);
  return profile;
}

function remove(id) {
  const all = readAll();
  const filtered = all.filter(p => p.id !== id);
  writeAll(filtered);
  return filtered.length !== all.length;
}

module.exports = { list, add, rename, setPausedKeys, remove };
