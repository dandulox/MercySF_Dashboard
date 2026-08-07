const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'data', 'settings-defaults.json');

function read() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function write(defaults) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(defaults, null, 2));
}

function getDefaults() {
  return read();
}

// Es gibt keine separate "CLI-Defaults"-Quelle, die wir abfragen könnten — stattdessen wächst
// diese Referenz opportunistisch aus jedem echten, erfolgreich gelesenen Account-Settings-File.
// Bereits bekannte Schlüssel werden NIE überschrieben, damit ein einzelner ungewöhnlich
// konfigurierter Account die gemeinsame Referenz nicht verfälscht — nur bisher unbekannte
// Schlüssel kommen neu hinzu.
function learnFrom(settings) {
  const defaults = read();
  let changed = false;
  for (const [key, value] of Object.entries(settings)) {
    if (!(key in defaults)) {
      defaults[key] = value;
      changed = true;
    }
  }
  if (changed) write(defaults);
}

module.exports = { getDefaults, learnFrom };
