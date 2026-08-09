const actionLog = require('./actionLog');

// Angepasste Kopie von MercySF_Dashboard/lib/logBuffer.js — ein globaler Zeilenpuffer über alle
// PTY-Sessions dieses Nodes hinweg (die CLI taggt jede Zeile selbst mit "[Charaktername]", daher
// reicht Filtern per String statt eine separate Struktur pro Session zu pflegen). Ohne die dortige
// notifications-Anbindung (der Node hat kein eigenes Benachrichtigungs-Feed) — actionLog bleibt
// erhalten, damit die Statistik-Fenster (routes /profiles/:id/stats/actions) weiter funktionieren.
const MAX_LINES = 2000;
const lines = [];

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function pushChunk(chunk) {
  const clean = chunk.replace(ANSI_RE, '');
  for (const line of clean.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    lines.push(trimmed);
    if (lines.length > MAX_LINES) lines.shift();
    actionLog.maybeRecordAction(trimmed);
  }
}

// Menschenlesbare Labels für CLI-Befehlsnamen, wie sie in "Sending command: X" auftauchen —
// identische Liste wie im Dashboard, damit "Letzte Aktionen" auf beiden Seiten gleich aussieht.
const ACTIVITY_LABELS = {
  StartWork: 'Stadtwache',
  ToiletFlush: 'Toilette',
  RollDice: 'Würfelspiel',
  FightPortal: 'Gildenportal-Kampf',
  FortressGemStoneSearch: 'Festung: Edelstein-Suche',
  GuildJoinDefense: 'Gildenverteidigung',
  GuildJoinAttack: 'Gildenangriff',
  UpgradeSkill: 'Attribute verteilen',
  Blacksmith: 'Schmied',
  UpdateDungeons: 'Verlies-Abfrage',
  SSOLogin: 'Login',
  StartQuest: 'Quest',
  FinishQuest: 'Quest abschließen',
  StartExpedition: 'Expedition',
  FinishExpedition: 'Expedition abschließen',
  ArenaFight: 'Arena-Kampf',
  ArenaEnemies: 'Arena-Gegner suchen',
  DungeonFight: 'Verlies-Kampf',
  PetsDungeonFight: 'Haustier-Verlies',
  PetsArenaFight: 'Haustier-Arena',
  UnderworldFight: 'Unterwelt-Kampf',
  BuyShop: 'Shop-Einkauf',
  CollectCalendar: 'Kalender abholen',
  ClaimReward: 'Belohnung abholen',
  ViewPlayer: 'Spieler ausspähen',
  HallOfFamePage: 'Ruhmeshalle ansehen',
};

const ACTIVITY_RE = /Sending command:\s+(\w+)/;

function getLastActivity(charName) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.includes(`[${charName}]`)) continue;
    const m = line.match(ACTIVITY_RE);
    if (!m) continue;
    const cmd = m[1];
    if (cmd === 'Update') continue;
    return ACTIVITY_LABELS[cmd] || cmd;
  }
  return null;
}

const TIMESTAMP_RE = /^\[?(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/;

function extractTimestamp(line) {
  const m = line.match(TIMESTAMP_RE);
  return m ? m[1] : null;
}

function getActivityHistory(charName, limit = 8) {
  const result = [];
  let lastCmd = null;
  for (let i = lines.length - 1; i >= 0 && result.length < limit; i--) {
    const line = lines[i];
    if (!line.includes(`[${charName}]`)) continue;
    const m = line.match(ACTIVITY_RE);
    if (!m) continue;
    const cmd = m[1];
    if (cmd === 'Update') continue;
    if (cmd !== lastCmd) {
      result.push({ label: ACTIVITY_LABELS[cmd] || cmd, at: extractTimestamp(line) });
    }
    lastCmd = cmd;
  }
  return result;
}

const VIEWPLAYER_RE = /Sending command:\s+ViewPlayer\s*\{\s*ident:\s*"([^"]+)"/;

function getScoutedPlayers(charName, limit = 8) {
  const seen = new Set();
  const result = [];
  for (let i = lines.length - 1; i >= 0 && result.length < limit; i--) {
    const line = lines[i];
    if (!line.includes(`[${charName}]`)) continue;
    const m = line.match(VIEWPLAYER_RE);
    if (!m) continue;
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    result.push({ name, at: extractTimestamp(line) });
  }
  return result;
}

function getRecentLines(charName, limit = 25) {
  const filtered = lines.filter(l => l.includes(`[${charName}]`));
  return filtered.slice(-limit).reverse();
}

module.exports = { pushChunk, getLastActivity, getActivityHistory, getScoutedPlayers, getRecentLines };
