const pty = require('node-pty');

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const CHAR_LIST_RE = /\[(\d+)\]\s+([^\n@]+?)\s+@\s+(\S+)/g;

// Führt einen einmaligen, temporären Login durch, um herauszufinden, welche Charaktere zu
// einem Login gehören — OHNE den Bot für irgendeinen davon zu starten. Passwort existiert nur
// im Speicher dieser Funktion, wird nirgends geloggt oder persistiert (das übernimmt der
// Aufrufer separat und bewusst über credentialStore).
function runDiscoveryLogin(username, password, { timeoutMs = 25000 } = {}) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let stage = 'menu';
    let settled = false;

    const proc = pty.spawn('/opt/mercy/mercy-cli-linux-x64', [], {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: '/opt/mercy',
      env: process.env,
    });

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Zeitüberschreitung beim Login-Test (25s) — unerwartete CLI-Ausgabe oder Server nicht erreichbar.')));
    }, timeoutMs);

    function finish(fn) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { proc.kill(); } catch (e) { /* Prozess evtl. schon weg */ }
      fn();
    }

    proc.onData(data => {
      if (settled) return;
      buffer = (buffer + data.replace(ANSI_RE, '')).slice(-3000);

      if (/Login failed/i.test(buffer)) {
        finish(() => reject(new Error('Login fehlgeschlagen — Username oder Passwort falsch, oder Spieleserver nicht erreichbar.')));
        return;
      }
      if (stage === 'menu' && /Select option:/.test(buffer)) {
        stage = 'username';
        buffer = '';
        proc.write('1\r');
        return;
      }
      if (stage === 'username' && /Username:/i.test(buffer)) {
        stage = 'password';
        buffer = '';
        proc.write(username + '\r');
        return;
      }
      if (stage === 'password' && /Password:\s*$/im.test(buffer.trimEnd())) {
        stage = 'waiting';
        buffer = '';
        proc.write(password + '\r');
        return;
      }
      if (stage === 'waiting' && /Select character index:/i.test(buffer)) {
        const characters = [...buffer.matchAll(CHAR_LIST_RE)].map(m => ({
          index: m[1],
          name: m[2].trim(),
          url: m[3],
        }));
        finish(() => resolve(characters));
        return;
      }
      // Genau ein Charakter: die CLI fragt evtl. gar nicht erst nach, sondern zeigt nur
      // "Found 1 character(s): [0] Name @ url" und startet direkt den Bot-Loop.
      if (stage === 'waiting' && /Found 1 character/i.test(buffer)) {
        const matches = [...buffer.matchAll(CHAR_LIST_RE)];
        if (matches.length) {
          const m = matches[0];
          finish(() => resolve([{ index: m[1], name: m[2].trim(), url: m[3] }]));
        }
      }
    });

    proc.onExit(() => {
      finish(() => reject(new Error('CLI-Prozess wurde unerwartet beendet, bevor der Login abgeschlossen war.')));
    });
  });
}

module.exports = { runDiscoveryLogin };
