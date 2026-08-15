const { findDataDir, latestSnapshot, findProfileByAccountId } = require('./data');
const credentialStore = require('./credentialStore');
const cli = require('./cliExec');
const nodeRegistry = require('./nodeRegistry');
const nodeClient = require('./nodeClient');

function remoteNodeFor(profile) {
  if (!profile || !profile.nodeId) return null;
  return nodeRegistry.get(profile.nodeId);
}

async function fetchBattles(accountId, profile) {
  const node = remoteNodeFor(profile);
  if (node) {
    try {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/history?limit=200`, { timeoutMs: 15000 });
      return result.battles || [];
    } catch (e) {
      return [];
    }
  }
  const password = profile && credentialStore.getPassword(profile.username);
  if (!profile || !password) return [];
  try {
    const result = await cli.runCli(cli.buildArgs(profile, ['--history', '--limit', '200']), { password });
    return result.battles || [];
  } catch (e) {
    return [];
  }
}

function arenaWinRateFromBattles(battles) {
  const arenaBattles = battles.filter(b => b.kind === 'arena');
  if (!arenaBattles.length) return null;
  const wins = arenaBattles.filter(b => b.won).length;
  return Math.round((wins / arenaBattles.length) * 1000) / 10;
}

async function computeStatsFor(accountId) {
  const dataDir = findDataDir();
  if (!dataDir) return null;
  const snapshot = latestSnapshot(dataDir, accountId);
  if (!snapshot) return null;

  const profile = findProfileByAccountId(accountId);
  const battles = await fetchBattles(accountId, profile);

  return {
    level: snapshot.level ?? null,
    silver: snapshot.silver ?? null,
    honor: snapshot.honor ?? null,
    arenaWinRate: arenaWinRateFromBattles(battles),
  };
}

module.exports = { computeStatsFor };
