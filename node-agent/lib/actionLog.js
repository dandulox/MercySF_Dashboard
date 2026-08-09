const statsDb = require('./statsDb');

// Identische Kopie von MercySF_Dashboard/lib/actionLog.js — wird von ptyManager.js pro PTY-Zeile
// aufgerufen, damit die "Erkannte Aktionen"-Fenster (routes: /profiles/:id/stats/actions) auch
// für auf diesem Node laufende Accounts funktionieren.
const TIMESTAMP_RE = /^\[?(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/;
const CHARNAME_RE = /\[([^\]]+)\]/;
const COMMAND_RE = /Sending command:\s+(\w+)/;

function maybeRecordAction(line) {
  const cmdMatch = line.match(COMMAND_RE);
  if (!cmdMatch) return;
  const command = cmdMatch[1];
  if (command === 'Update') return;
  const charMatch = line.match(CHARNAME_RE);
  if (!charMatch) return;
  const tsMatch = line.match(TIMESTAMP_RE);
  const timestamp = tsMatch ? tsMatch[1] : new Date().toISOString();
  try {
    statsDb.insertAction(charMatch[1], command, timestamp);
  } catch (err) {
    console.error('[actionLog] Aktion konnte nicht gespeichert werden:', err.message);
  }
}

module.exports = { maybeRecordAction };
