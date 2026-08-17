// Reine Hilfsfunktionen für den nodeStats-Teil des Telemetrie-Payloads (siehe telemetry.js).
// Bewusst ohne top-level require von ptyManager/nodeClient (beides würde native Module wie
// node-pty laden) — Abhängigkeiten werden per Default-Parameter injiziert, damit summarize()/
// localNodeStats()/remoteNodeStats() auch ohne installierte native Module testbar bleiben.

function summarize(profiles) {
  const usernames = new Set(profiles.map(p => p.username));
  return { activeAccounts: usernames.size, characterCount: profiles.length };
}

function localNodeStats({ registry = require('./accountsRegistry'), ptyManager = require('./ptyManager') } = {}) {
  const running = registry.list()
    .filter(p => !p.nodeId)
    .filter(p => ptyManager.getStatus(p.id).running);
  return { nodeId: null, ...summarize(running) };
}

// Fragt die laufenden Profile eines einzelnen Nodes ab. Schlägt der Call fehl (Timeout/offline),
// wird der Node mit 0/0 gemeldet statt den gesamten Ping zu blockieren — Telemetrie darf den
// laufenden Betrieb nie beeinträchtigen (gleiches Prinzip wie der Rest von telemetry.js).
async function remoteNodeStats(node, { nodeClient = require('./nodeClient') } = {}) {
  try {
    const list = await nodeClient.call(node, '/profiles', { timeoutMs: 6000 });
    const running = list.filter(p => p.status && p.status.running);
    return { nodeId: node.id, ...summarize(running) };
  } catch (e) {
    return { nodeId: node.id, activeAccounts: 0, characterCount: 0 };
  }
}

async function buildNodeStats(onlineNodes, deps = {}) {
  const local = localNodeStats(deps);
  const remotes = await Promise.all(onlineNodes.map(n => remoteNodeStats(n, deps)));
  return [local, ...remotes];
}

module.exports = { summarize, localNodeStats, remoteNodeStats, buildNodeStats };
