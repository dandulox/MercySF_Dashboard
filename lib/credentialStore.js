const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Verschlüsselte Passwort-Ablage (AES-256-GCM). Der Schlüssel liegt in einer separaten Datei
// mit restriktiven Rechten (0600). Das schützt vor Klartext-Zugriff auf die Store-Datei selbst
// (Backups, versehentliches Kopieren, Git etc.) — schützt NICHT vor jemandem, der bereits vollen
// Zugriff auf den Server hat (der käme so oder so an den Schlüssel).
const DATA_DIR = path.join(__dirname, '..', 'data');
const KEY_PATH = path.join(DATA_DIR, '.credential-key');
const STORE_PATH = path.join(DATA_DIR, 'credentials.enc.json');

function getOrCreateKey() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(KEY_PATH)) {
    return Buffer.from(fs.readFileSync(KEY_PATH, 'utf8'), 'base64');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, key.toString('base64'), { mode: 0o600 });
  try { fs.chmodSync(KEY_PATH, 0o600); } catch (e) { /* Windows-Entwicklungsumgebung ignoriert das */ }
  return key;
}

const KEY = getOrCreateKey();

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
}

function decrypt(entry) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(entry.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(entry.data, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

function readStore() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
  try { fs.chmodSync(STORE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function key(username) {
  return String(username).toLowerCase();
}

function setPassword(username, password) {
  const store = readStore();
  store[key(username)] = encrypt(password);
  writeStore(store);
}

function getPassword(username) {
  const store = readStore();
  const entry = store[key(username)];
  if (!entry) return null;
  try {
    return decrypt(entry);
  } catch (e) {
    return null;
  }
}

function hasPassword(username) {
  return !!readStore()[key(username)];
}

function deletePassword(username) {
  const store = readStore();
  delete store[key(username)];
  writeStore(store);
}

module.exports = { setPassword, getPassword, hasPassword, deletePassword };
