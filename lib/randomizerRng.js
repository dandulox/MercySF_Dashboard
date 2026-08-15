const crypto = require('crypto');

// Deterministischer PRNG (mulberry32) statt Math.random() — der Tagesplan eines Accounts muss bei
// einem Dashboard-Neustart identisch neu berechenbar sein (gleicher Seed = gleicher Plan), sonst
// würde ein Neustart mitten am Tag den Plan verwerfen und neu auswürfeln.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(profileId, dateStr) {
  const hash = crypto.createHash('sha256').update(`${profileId}:${dateStr}`).digest();
  return hash.readUInt32BE(0);
}

function rngFor(profileId, dateStr) {
  return mulberry32(seedFor(profileId, dateStr));
}

// [min, max)
function rand(rng, min, max) {
  return min + rng() * (max - min);
}

// [min, max] inklusiv, ganzzahlig
function randInt(rng, min, max) {
  return Math.floor(rand(rng, min, max + 1));
}

// n zufällige, auf 1 normalisierte Gewichte (Summe = 1)
function randomWeights(rng, n) {
  const raw = Array.from({ length: n }, () => rng() + 0.1); // +0.1 verhindert nahezu-0-Gewichte
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

module.exports = { mulberry32, seedFor, rngFor, rand, randInt, randomWeights };
