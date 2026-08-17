const { spawn } = require('child_process');
const fs = require('fs');

const WG_QUICK_BIN = process.env.MERCY_WG_QUICK_BIN || 'wg-quick';
const WG_BIN = process.env.MERCY_WG_BIN || 'wg';
const WG_CONF_DIR = process.env.MERCY_WG_CONF_DIR || '/etc/wireguard';
const HANDSHAKE_FRESH_SECS = 180;

// Nie als Shell-String — gleiches Muster wie lib/cliExec.js. Läuft als root (siehe
// systemd/*.service), daher keine sudo-Notwendigkeit für wg-quick/wg.
function run(bin, args, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      reject(new Error(`${bin} ${args.join(' ')} hat zu lange gedauert (Timeout)`));
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
      if (code !== 0) {
        return reject(new Error(`${bin} ${args.join(' ')} fehlgeschlagen (Code ${code}): ${stderr.trim() || stdout.trim()}`));
      }
      resolve(stdout);
    });
  });
}

async function currentActiveInterface() {
  let out;
  try {
    out = await run(WG_BIN, ['show', 'interfaces']);
  } catch (e) {
    return null;
  }
  const names = out.trim().split(/\s+/).filter(Boolean);
  return names[0] || null;
}

async function connect(interfaceName, configContent) {
  const active = await currentActiveInterface();
  if (active && active !== interfaceName) {
    await run(WG_QUICK_BIN, ['down', active]);
  }
  if (active !== interfaceName) {
    const confPath = `${WG_CONF_DIR}/${interfaceName}.conf`;
    fs.mkdirSync(WG_CONF_DIR, { recursive: true });
    fs.writeFileSync(confPath, configContent, { mode: 0o600 });
    try { fs.chmodSync(confPath, 0o600); } catch (e) { /* Windows ignorieren */ }
    await run(WG_QUICK_BIN, ['up', interfaceName]);
  }
}

async function disconnect(interfaceName) {
  // wg-quick down fails loudly ("<iface>.conf does not exist") if the interface was never
  // brought up in the first place — a no-op here rather than a real error, since there's
  // nothing to tear down. Only attempt it when that interface is actually the active one.
  const active = await currentActiveInterface();
  if (active !== interfaceName) return;
  await run(WG_QUICK_BIN, ['down', interfaceName]);
}

async function status() {
  const interfaceName = await currentActiveInterface();
  if (!interfaceName) return { connected: false, interfaceName: null };
  let out;
  try {
    out = await run(WG_BIN, ['show', interfaceName, 'latest-handshakes']);
  } catch (e) {
    return { connected: false, interfaceName };
  }
  // Ausgabe: "<peer-pubkey>\t<unix-timestamp>" — 0 bedeutet "noch nie".
  const match = out.trim().match(/\t(\d+)$/);
  const handshakeAt = match ? parseInt(match[1], 10) : 0;
  const connected = handshakeAt > 0 && (Date.now() / 1000 - handshakeAt) < HANDSHAKE_FRESH_SECS;
  return { connected, interfaceName };
}

// Da AllowedIPs = 0.0.0.0/0, ::/0 gilt, läuft bei aktiver Verbindung der GESAMTE Traffic dieser
// Maschine durch den Tunnel (nicht nur einzelne Prozesse) — die einfachste Verifikation ist
// daher, die tatsächlich nach außen sichtbare IP abzufragen und mit der Endpoint-IP des
// VPN-Profils zu vergleichen, statt CLI-Prozesse einzeln zu prüfen.
async function publicIp({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.ipify.org', { signal: controller.signal });
    if (!res.ok) throw new Error(`ipify antwortete mit Status ${res.status}`);
    return (await res.text()).trim();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { connect, disconnect, status, publicIp };
