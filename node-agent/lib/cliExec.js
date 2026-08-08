const { spawn } = require('child_process');

// Gleiches Muster wie MercySF_Dashboard/lib/cliExec.js — nicht-interaktiver JSON-Modus der CLI.
// CLI_PATH per Env überschreibbar, weil ein Node-Only-Install nicht zwingend unter /opt/mercy
// liegen muss (Standard-Installer legt es aber genau dort ab, siehe install.sh --node).
const CLI_PATH = process.env.MERCY_CLI_PATH || '/opt/mercy/mercy-cli-linux-x64';
const CWD = process.env.MERCY_CLI_CWD || '/opt/mercy';

function buildArgs(profile, extra) {
  return ['--user', profile.username, '--character', profile.characterName, ...extra];
}

function runCli(args, { password, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLI_PATH, [...args, '--password-stdin'], { cwd: CWD });
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
