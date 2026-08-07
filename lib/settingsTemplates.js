const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE_PATH = path.join(__dirname, '..', 'data', 'settings-templates.json');

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(templates) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(templates, null, 2));
}

function list() {
  return readAll()
    .map(t => ({ id: t.id, name: t.name, createdAt: t.createdAt, fieldCount: Object.keys(t.settings).length }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function get(id) {
  return readAll().find(t => t.id === id) || null;
}

function create(name, settings) {
  const templates = readAll();
  const template = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), settings };
  templates.push(template);
  writeAll(templates);
  return template;
}

function remove(id) {
  const templates = readAll();
  const next = templates.filter(t => t.id !== id);
  writeAll(next);
  return next.length !== templates.length;
}

module.exports = { list, get, create, remove };
