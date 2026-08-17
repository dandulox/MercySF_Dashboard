function buildNodeAgentRunArgs({ name, network, image, volumeName, cliVolumeName }) {
  return [
    'run', '-d',
    '--name', name,
    '--network', network,
    '--cap-add', 'NET_ADMIN',
    '--device', '/dev/net/tun',
    // Labeled so `install.sh --uninstall` can find and remove every node container it created,
    // even ones added later via add-node.sh that never went through docker-compose.
    '--label', 'mercy.role=node',
    // Node-agent's own pairing/profile/VPN-config data (node-agent/lib/*.js resolve this
    // relative to __dirname, i.e. /app/data given the image's WORKDIR).
    '-v', `${volumeName}:/app/data`,
    // CLI binary + the CLI's own data (analytics, credentials.json) — node-agent/lib/{cliExec,
    // cliUpdate,ptyManager}.js default to /opt/mercy/mercy-cli-linux-x64 and cwd /opt/mercy
    // unless MERCY_CLI_PATH/MERCY_CLI_CWD override them; the container keeps that default
    // rather than overriding it (see docker/entrypoint-node-agent.sh).
    '-v', `${cliVolumeName}:/opt/mercy`,
    image,
  ];
}

function parsePairingJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('Invalid pairing file: not valid JSON');
  }
  if (!parsed || typeof parsed.code !== 'string' || !parsed.code) {
    throw new Error('Invalid pairing file: missing code field');
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
    if (Date.now() >= deadline) throw new Error('Timeout waiting for readiness');
    await sleep(intervalMs);
  }
}

module.exports = { buildNodeAgentRunArgs, parsePairingJson, pollUntil };
