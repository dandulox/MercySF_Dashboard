function buildNodeAgentRunArgs({ name, network, image, volumeName }) {
  return [
    'run', '-d',
    '--name', name,
    '--network', network,
    '--cap-add', 'NET_ADMIN',
    '--device', '/dev/net/tun',
    '-v', `${volumeName}:/app/data`,
    image,
  ];
}

function parsePairingJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('Ungültige Pairing-Datei: kein valides JSON');
  }
  if (!parsed || typeof parsed.code !== 'string' || !parsed.code) {
    throw new Error('Ungültige Pairing-Datei: kein code-Feld');
  }
  return { code: parsed.code, expiresAt: parsed.expiresAt || null };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollUntil(fn, { intervalMs = 1000, timeoutMs = 30000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() >= deadline) throw new Error('Timeout beim Warten auf Bereitschaft');
    await sleep(intervalMs);
  }
}

module.exports = { buildNodeAgentRunArgs, parsePairingJson, pollUntil };
