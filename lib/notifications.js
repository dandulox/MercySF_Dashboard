const MAX_ENTRIES = 200;
const entries = [];
let nextId = 1;

function add(level, message, source) {
  const entry = { id: nextId++, level, message, source: source || null, at: new Date().toISOString() };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  return entry;
}

// Erkennt Fehler/Warnungen aus dem CLI-Log-Output. Zwei Fälle:
// 1) Ein explizites Level-Tag (WARN/ERROR) in der Zeile.
// 2) Die CLI loggt viele echte Fehler (z. B. "Server responded with error: need more gold")
//    trotzdem auf Level INFO — daher zusätzlich Freitext-Erkennung für "error"/"failed"/"fehlgeschlagen".
const LEVEL_RE = /\b(ERROR|WARN)\b/;
const TEXT_HINT_RE = /\b(error|failed|fehlgeschlagen)\b/i;
// CLI-Zeilenformat: "[<zeitstempel> <LEVEL> <modul>] [<Charaktername>] <eigentliche Nachricht>".
// Die erste Klammer ist immer Zeitstempel/Level/Modul (technisches Rauschen, kein Charaktername!)
// — das war der Bug: die alte SOURCE_RE griff die falsche, erste Klammer ab. Jetzt wird die
// erste Klammer verworfen und nur die optionale zweite (der Charaktername) als Quelle übernommen.
const PARSE_RE = /^\[[^\]]*\]\s*(?:\[([^\]]+)\]\s*)?(.*)$/;
const LEADING_TIMESTAMP_RE = /^\[[0-9T:\-.Z]+\]\s*/;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

// Für den Duplikat-Vergleich alle Zahlen entfernen — wiederkehrende Fehler wie
// "need a free slot" haben bei jeder Wiederholung leicht andere Details, sind aber inhaltlich
// dieselbe Meldung und sollen nicht bei jeder Wiederholung neu auftauchen.
function normalizeForDedupe(line) {
  return line.replace(LEADING_TIMESTAMP_RE, '').replace(/\d+/g, '#');
}

function maybeAddFromLogLine(line) {
  const levelMatch = line.match(LEVEL_RE);
  let level = null;
  if (levelMatch) {
    level = levelMatch[1] === 'ERROR' ? 'error' : 'warn';
  } else if (TEXT_HINT_RE.test(line)) {
    level = 'warn';
  }
  if (!level) return null;

  const parsed = line.match(PARSE_RE);
  const source = parsed ? (parsed[1] || null) : null;
  const message = parsed ? parsed[2] : line;

  const now = Date.now();
  const key = normalizeForDedupe(message);
  const recentDuplicate = entries.some(e => normalizeForDedupe(e.message) === key && (now - Date.parse(e.at)) < DEDUPE_WINDOW_MS);
  if (recentDuplicate) return null;

  return add(level, message, source);
}

function getAll(limit = 100) {
  return entries.slice(-limit).reverse();
}

function getSince(sinceId = 0, limit = 100) {
  return entries.filter(e => e.id > sinceId).slice(-limit);
}

module.exports = { add, maybeAddFromLogLine, getAll, getSince };
