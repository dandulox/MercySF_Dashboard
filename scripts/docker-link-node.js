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
    if (!flags[n]) throw new Error(`Fehlendes Argument: --${n}`);
  }
}

function dockerExec(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(' ')} fehlgeschlagen: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function cmdSetup(flags) {
  requireFlags(flags, ['url', 'user', 'password']);
  const client = createClient(flags.url);
  const result = await client.setup(flags.user, flags.password);
  console.log('Dashboard-Konto eingerichtet.');
  console.log(`AES-Key (verschlüsselt gespeicherte Bot-Zugangsdaten): ${result.aesKey}`);
  console.log(`Recovery-Phrase (zum Zurücksetzen des Passworts ohne E-Mail, unbedingt notieren): ${result.recoveryPhrase}`);
}

async function cmdCreate(flags) {
  requireFlags(flags, ['url', 'user', 'password', 'name', 'network', 'image', 'volume']);
  console.log(`Starte Node-Container '${flags.name}' ...`);
  dockerExec(buildNodeAgentRunArgs({ name: flags.name, network: flags.network, image: flags.image, volumeName: flags.volume }));

  console.log('Warte auf Pairing-Code ...');
  const pairing = await pollUntil(() => {
    try {
      const raw = dockerExec(['exec', flags.name, 'cat', '/app/data/pairing.json']);
      return parsePairingJson(raw);
    } catch (e) {
      return null; // Datei noch nicht da / Container noch nicht bereit — weiter pollen
    }
  }, { intervalMs: 1000, timeoutMs: 30000 });

  const client = createClient(flags.url);
  await client.login(flags.user, flags.password);
  await client.pairNode({ name: flags.name, host: flags.name, port: 8090, code: pairing.code });
  console.log(`Node '${flags.name}' erfolgreich verlinkt.`);
}

async function cmdRemove(flags) {
  requireFlags(flags, ['url', 'user', 'password', 'name']);
  const client = createClient(flags.url);
  await client.login(flags.user, flags.password);
  const nodes = await client.listNodes();
  const match = nodes.find(n => n.host === flags.name || n.name === flags.name);
  if (match) {
    await client.deleteNode(match.id);
    console.log(`Node '${flags.name}' im Dashboard entfernt.`);
  } else {
    console.log(`Kein Dashboard-Eintrag für '${flags.name}' gefunden — entferne Container trotzdem.`);
  }
  dockerExec(['rm', '-f', flags.name]);
  if (flags.volume) dockerExec(['volume', 'rm', flags.volume]);
  console.log(`Container '${flags.name}' entfernt.`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const handlers = { setup: cmdSetup, create: cmdCreate, remove: cmdRemove };
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unbekanntes Kommando: ${command}. Erwartet: setup | create | remove`);
    process.exit(1);
  }
  try {
    await handler(flags);
  } catch (err) {
    console.error(`Fehler: ${err.message}`);
    process.exit(1);
  }
}

main();
