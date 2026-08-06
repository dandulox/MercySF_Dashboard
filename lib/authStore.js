const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const wordlist = require('./wordlist');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUTH_PATH = path.join(DATA_DIR, 'auth.json');
const SCRYPT_KEYLEN = 64;

function hashSecret(plain) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

function verifySecret(plain, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function generateRecoveryPhrase() {
  const words = [];
  const used = new Set();
  while (words.length < 12) {
    const idx = crypto.randomInt(wordlist.length);
    if (used.has(idx)) continue;
    used.add(idx);
    words.push(wordlist[idx]);
  }
  return words;
}

function normalizePhrase(phrase) {
  const joined = Array.isArray(phrase) ? phrase.join(' ') : String(phrase || '');
  return joined.trim().toLowerCase().replace(/\s+/g, ' ');
}

function readAuth() {
  if (!fs.existsSync(AUTH_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeAuth(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AUTH_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
  try { fs.chmodSync(AUTH_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function hasAccess() {
  return readAuth() !== null;
}

function createAccess(username, password) {
  if (hasAccess()) throw new Error('Zugang existiert bereits');
  if (!username || !password) throw new Error('Benutzername und Passwort sind erforderlich');
  if (String(password).length < 8) throw new Error('Passwort muss mindestens 8 Zeichen haben');
  const recoveryWords = generateRecoveryPhrase();
  writeAuth({
    username: String(username),
    passwordHash: hashSecret(password),
    recoveryPhraseHash: hashSecret(normalizePhrase(recoveryWords)),
    createdAt: new Date().toISOString(),
  });
  return { recoveryPhrase: recoveryWords };
}

function verifyPassword(username, password) {
  const auth = readAuth();
  if (!auth) return false;
  if (auth.username !== username) return false;
  return verifySecret(password, auth.passwordHash);
}

function changePassword(currentPassword, newPassword) {
  const auth = readAuth();
  if (!auth) throw new Error('Kein Zugang vorhanden');
  if (!verifySecret(currentPassword, auth.passwordHash)) throw new Error('Aktuelles Passwort ist falsch');
  if (!newPassword || String(newPassword).length < 8) throw new Error('Neues Passwort muss mindestens 8 Zeichen haben');
  auth.passwordHash = hashSecret(newPassword);
  writeAuth(auth);
}

function verifyRecoveryPhrase(phrase) {
  const auth = readAuth();
  if (!auth) return false;
  return verifySecret(normalizePhrase(phrase), auth.recoveryPhraseHash);
}

function resetWithRecoveryPhrase(phrase, newPassword) {
  const auth = readAuth();
  if (!auth) throw new Error('Kein Zugang vorhanden');
  if (!verifyRecoveryPhrase(phrase)) throw new Error('Wiederherstellungsschlüssel ungültig');
  if (!newPassword || String(newPassword).length < 8) throw new Error('Neues Passwort muss mindestens 8 Zeichen haben');
  const newRecoveryWords = generateRecoveryPhrase();
  auth.passwordHash = hashSecret(newPassword);
  auth.recoveryPhraseHash = hashSecret(normalizePhrase(newRecoveryWords));
  writeAuth(auth);
  return { recoveryPhrase: newRecoveryWords };
}

module.exports = {
  hasAccess,
  createAccess,
  verifyPassword,
  changePassword,
  verifyRecoveryPhrase,
  resetWithRecoveryPhrase,
};
