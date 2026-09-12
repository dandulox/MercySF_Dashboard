const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Identische Kopie von MercySF_Dashboard/lib/statsDb.js — eigene stats.db im lokalen data/-Ordner
// des Node-Agents, damit ein Node auch bei getrenntem Netzwerk seine eigene Historie weiterführt.
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'stats.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    level INTEGER,
    experience INTEGER,
    next_level_xp INTEGER,
    silver INTEGER,
    honor INTEGER,
    rank INTEGER,
    arena_fights_today INTEGER,
    dungeon_fights_today INTEGER,
    UNIQUE(account_id, timestamp)
  );
  CREATE INDEX IF NOT EXISTS idx_snapshots_account_ts ON snapshots(account_id, timestamp);

  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    char_name TEXT NOT NULL,
    command TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_actions_char_ts ON actions(char_name, timestamp);
`);

const insertSnapshotStmt = db.prepare(`
  INSERT OR IGNORE INTO snapshots
    (account_id, timestamp, level, experience, next_level_xp, silver, honor, rank, arena_fights_today, dungeon_fights_today)
  VALUES (@accountId, @timestamp, @level, @experience, @nextLevelXp, @silver, @honor, @rank, @arenaFightsToday, @dungeonFightsToday)
`);

function insertSnapshot(accountId, snapshot) {
  if (!snapshot || !snapshot.timestamp) return;
  insertSnapshotStmt.run({
    accountId,
    timestamp: snapshot.timestamp,
    level: snapshot.level ?? null,
    experience: snapshot.experience ?? null,
    nextLevelXp: snapshot.next_level_xp ?? null,
    silver: snapshot.silver ?? null,
    honor: snapshot.honor ?? null,
    rank: snapshot.rank ?? null,
    arenaFightsToday: snapshot.arena_fights_today ?? null,
    dungeonFightsToday: snapshot.dungeon_fights_today ?? null,
  });
}

const insertActionStmt = db.prepare(`
  INSERT INTO actions (char_name, command, timestamp) VALUES (?, ?, ?)
`);

function insertAction(charName, command, timestamp) {
  insertActionStmt.run(charName, command, timestamp);
}

function expDelta(prev, curr) {
  if (curr.level === prev.level) return curr.experience - prev.experience;
  if (curr.level > prev.level && prev.next_level_xp != null) {
    return (prev.next_level_xp - prev.experience) + curr.experience;
  }
  return curr.experience - prev.experience;
}

function getDailyStats(accountId, days) {
  const rows = db.prepare(`
    SELECT * FROM snapshots
    WHERE account_id = ? AND timestamp >= datetime('now', ?)
    ORDER BY timestamp ASC
  `).all(accountId, `-${days} days`);

  const byDate = new Map();
  for (const row of rows) {
    const date = row.timestamp.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(row);
  }

  const result = [];
  for (const [date, dayRows] of byDate) {
    let expGained = 0;
    let levelsGained = 0;
    for (let i = 1; i < dayRows.length; i++) {
      expGained += expDelta(dayRows[i - 1], dayRows[i]);
      levelsGained += Math.max(0, (dayRows[i].level ?? 0) - (dayRows[i - 1].level ?? 0));
    }
    const first = dayRows[0];
    const last = dayRows[dayRows.length - 1];
    result.push({
      date,
      expGained,
      levelsGained,
      silverGained: (last.silver ?? 0) - (first.silver ?? 0),
      honorGained: (last.honor ?? 0) - (first.honor ?? 0),
      arenaFights: Math.max(0, (last.arena_fights_today ?? 0) - (first.arena_fights_today ?? 0)),
      dungeonFights: Math.max(0, (last.dungeon_fights_today ?? 0) - (first.dungeon_fights_today ?? 0)),
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function getRecentActionWindows(accountId, charName, limit) {
  const rows = db.prepare(`
    SELECT * FROM snapshots WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?
  `).all(accountId, limit * 3 + 10);
  rows.reverse();

  const windows = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    const arenaDelta = (curr.arena_fights_today ?? 0) - (prev.arena_fights_today ?? 0);
    const dungeonDelta = (curr.dungeon_fights_today ?? 0) - (prev.dungeon_fights_today ?? 0);
    if (arenaDelta <= 0 && dungeonDelta <= 0) continue;
    const commands = db.prepare(`
      SELECT command FROM actions WHERE char_name = ? AND timestamp > ? AND timestamp <= ? ORDER BY timestamp ASC
    `).all(charName, prev.timestamp, curr.timestamp).map(r => r.command);
    windows.push({
      windowStart: prev.timestamp,
      windowEnd: curr.timestamp,
      fightType: arenaDelta > 0 ? 'arena' : 'dungeon',
      expDelta: expDelta(prev, curr),
      silverDelta: (curr.silver ?? 0) - (prev.silver ?? 0),
      honorDelta: (curr.honor ?? 0) - (prev.honor ?? 0),
      commands,
    });
  }
  return windows.slice(-limit).reverse();
}

const RETENTION_DAYS = 28;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const deleteOldSnapshotsStmt = db.prepare('DELETE FROM snapshots WHERE timestamp < ?');
const deleteOldActionsStmt = db.prepare('DELETE FROM actions WHERE timestamp < ?');

// Beide Tabellen wuchsen bisher unbegrenzt weiter: statsCollector legt pro Account einen Snapshot
// nach, sobald die CLI einen neuen schreibt, actionLog eine Zeile pro erkanntem Spielbefehl aus
// dem PTY-Strom. Zurückgelesen wird davon ohnehin nur ein Fenster weniger Tage (routes/stats.js),
// alles Ältere lag bloß noch in der Datei.
//
// Der Stichtag wird bewusst in JS als ISO-Zeitstempel gebildet statt per datetime('now', '-28
// days'): beide Tabellen speichern ISO-8601 mit "T" und "Z" (siehe actionLog.js und die
// analytics-Dateien der CLI), SQLites datetime() liefert dagegen "YYYY-MM-DD HH:MM:SS" mit
// Leerzeichen. Im Textvergleich sortiert das "T" hinter dem Leerzeichen — die Grenze wäre am
// Stichtag selbst also unscharf.
function pruneOldRows() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    const removed = db.transaction(() =>
      deleteOldSnapshotsStmt.run(cutoff).changes + deleteOldActionsStmt.run(cutoff).changes
    )();
    if (!removed) return 0;
    // SQLite gibt den Platz gelöschter Zeilen nicht von selbst an das Dateisystem zurück — ohne
    // VACUUM bleibt die Datei so groß wie zu ihrem bisherigen Höchststand. Nur bei tatsächlich
    // gelöschten Zeilen, weil VACUUM die komplette Datei neu schreibt.
    db.exec('VACUUM');
    console.log(`[statsDb] ${removed} Zeile(n) älter als ${RETENTION_DAYS} Tage entfernt`);
    return removed;
  } catch (err) {
    console.error('[statsDb] Alte Statistikdaten konnten nicht entfernt werden:', err.message);
    return 0;
  }
}

pruneOldRows();
setInterval(pruneOldRows, PRUNE_INTERVAL_MS);

module.exports = { insertSnapshot, insertAction, getDailyStats, getRecentActionWindows, pruneOldRows };
