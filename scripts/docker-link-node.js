#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { createClient } = require('./lib/dashboardClient');
const { buildNodeAgentRunArgs, parsePairingJson, pollUntil } = require('./lib/dockerNode');

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].replace(/^--/, '');
    flags[key] = rest[i + 1];
  }
  return { command, flags };
}

function requireFlags(flags, names) {
  for (const n of names) {
    if (!flags[n]) throw new Error(`Missing argument: --${n}`);
  }
}

function dockerExec(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function cmdSetup(flags) {
  requireFlags(flags, ['url', 'user', 'password']);
  const client = createClient(flags.url);
  const result = await client.setup(flags.user, flags.password);
  console.log('Dashboard account set up.');
  console.log(`AES key (encrypts stored bot credentials): ${result.aesKey}`);
  console.log(`Recovery phrase (resets the password without email — write this down): ${result.recoveryPhrase}`);
}

async function cmdCreate(flags) {
  requireFlags(flags, ['url', 'user', 'password', 'name', 'network', 'image', 'volume', 'cli-volume']);
  console.log(`Starting node container '${flags.name}' ...`);
  dockerExec(buildNodeAgentRunArgs({ name: flags.name, network: flags.network, image: flags.image, volumeName: flags.volume, cliVolumeName: flags['cli-volume'] }));

  console.log('Waiting for pairing code ...');
  const pairing = await pollUntil(() => {
    try {
      const raw = dockerExec(['exec', flags.name, 'cat', '/app/data/pairing.json']);
      return parsePairingJson(raw);
    } catch (e) {
      return null; // file not there yet / container not ready yet — keep polling
    }
  }, { intervalMs: 1000, timeoutMs: 30000 });

  const client = createClient(flags.url);
  await client.login(flags.user, flags.password);
  await client.pairNode({ name: flags.name, host: flags.name, port: 8090, code: pairing.code });
  console.log(`Node '${flags.name}' linked successfully.`);
}

async function cmdRemove(flags) {
  requireFlags(flags, ['url', 'user', 'password', 'name']);
  const client = createClient(flags.url);
  await client.login(flags.user, flags.password);
  const nodes = await client.listNodes();
  const match = nodes.find(n => n.host === flags.name || n.name === flags.name);
  if (match) {
    await client.deleteNode(match.id);
    console.log(`Node '${flags.name}' unregistered from the dashboard.`);
  } else {
    console.log(`No dashboard entry found for '${flags.name}' — removing the container anyway.`);
  }
  dockerExec(['rm', '-f', flags.name]);
  if (flags.volume) dockerExec(['volume', 'rm', flags.volume]);
  if (flags['cli-volume']) dockerExec(['volume', 'rm', flags['cli-volume']]);
  console.log(`Container '${flags.name}' removed.`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const handlers = { setup: cmdSetup, create: cmdCreate, remove: cmdRemove };
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}. Expected: setup | create | remove`);
    process.exit(1);
  }
  try {
    await handler(flags);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
