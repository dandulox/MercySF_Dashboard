const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'marketplace-owner-tokens.json');

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeAll(map) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(map, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function getToken(marketplaceId) {
  return readAll()[marketplaceId] || null;
}

function setToken(marketplaceId, ownerToken) {
  const all = readAll();
  all[marketplaceId] = ownerToken;
  writeAll(all);
}

function removeToken(marketplaceId) {
  const all = readAll();
  delete all[marketplaceId];
  writeAll(all);
}

module.exports = { getToken, setToken, removeToken };
