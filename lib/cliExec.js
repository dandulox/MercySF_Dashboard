const { spawn } = require('child_process');

const CLI_PATH = '/opt/mercy/mercy-cli-linux-x64';

// Führt die CLI im nicht-interaktiven JSON-Modus aus (--user/--character/... + --password-stdin)
// statt sie wie ptyManager als interaktives Menü zu bedienen. Kein --server-Flag — für die bisher
// getesteten (SSO-)Accounts löst die CLI den Server über --user/--character selbst auf; ein
// explizites --server hat bei einem Testaccount sogar zu "player not found" geführt.
function buildArgs(profile, extra) {
  return ['--user', profile.username, '--character', profile.characterName, ...extra];
}

// Läuft normalerweise wenige Sekunden (ein Login-Roundtrip), 30s Timeout ist großzügig genug für
// einen hängenden/nicht erreichbaren Spieleserver, ohne Anfragen unbegrenzt offen zu lassen.
function runCli(args, { password, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLI_PATH, [...args, '--password-stdin'], { cwd: '/opt/mercy' });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      reject(new Error('CLI-Aufruf hat zu lange gedauert (Timeout)'));
    }, timeoutMs);

    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 2) {
        return reject(new Error(`Ungültiger CLI-Aufruf: ${stderr.trim() || 'unbekannter Syntaxfehler'}`));
      }
      let parsed;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch (e) {
        return reject(new Error(`Unerwartete CLI-Ausgabe: ${stdout.slice(0, 300) || stderr.slice(0, 300)}`));
      }
      if (parsed.ok === false) {
        return reject(new Error(parsed.error || 'CLI meldete einen Fehler'));
      }
      resolve(parsed);
    });

    proc.stdin.write(password + '\n');
    proc.stdin.end();
  });
}

module.exports = { runCli, buildArgs, CLI_PATH };
