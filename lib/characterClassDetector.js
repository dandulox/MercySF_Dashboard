const registry = require('./accountsRegistry');

const BRIDGE_URL = 'http://127.0.0.1:4001/state';

// Ruft die sf-api-Bridge einmalig auf, um die Spielklasse eines frisch angelegten Charakters zu
// ermitteln, und speichert sie dauerhaft im Profil — die Klasse ändert sich im Spiel nie wieder,
// ein erneuter Login dafür ist nach dem ersten Erfolg also nie wieder nötig. Wird beim Anlegen
// eines Profils aufgerufen (routes/profiles.js, routes/logins.js), nicht wiederkehrend im
// Hintergrund — ein früherer Frontend-Loop, der das bei jedem Laden der Account-Verwaltung erneut
// versucht hat, führte zu ständigen echten Spiele-Logins und unkontrollierten Neu-Renderings
// (u. a. sich sofort schließende Konsolen). Best-effort und nicht blockierend für den Aufrufer:
// Fehler (Bridge offline, Login schlägt fehl) werden verschluckt — die Klasse bleibt dann leer,
// der manuelle "🔄 Klasse"-Button in der Account-Verwaltung bleibt als Fallback.
async function detectAndStoreCharacterClass(profile, password) {
  if (!profile || !profile.server || !profile.characterName || profile.characterClass || !password) return;
  try {
    const res = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: profile.username, password, server: profile.server }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.characterClass) registry.setCharacterClass(profile.id, data.characterClass);
  } catch (err) { /* Bridge offline oder Login fehlgeschlagen — Fallback-Button bleibt */ }
}

module.exports = { detectAndStoreCharacterClass, BRIDGE_URL };
