const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'marketplace-links.json');

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(links) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(links, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function list() {
  return readAll();
}

function add(marketplaceTemplateId, localTemplateId, accountId) {
  const links = readAll();
  if (links.some(l => l.marketplaceTemplateId === marketplaceTemplateId && l.accountId === accountId)) return;
  links.push({ marketplaceTemplateId, localTemplateId, accountId });
  writeAll(links);
}

function remove(marketplaceTemplateId, accountId) {
  const links = readAll();
  writeAll(links.filter(l => !(l.marketplaceTemplateId === marketplaceTemplateId && l.accountId === accountId)));
}

module.exports = { list, add, remove };
