// Island: the register of chance keys for the small world. Every chance draw is a hash of (island seed, hour, who,
// key), so two draws are independent only if their keys differ. Every key used by world.js and nature.js is named
// here, once; importing this file checks that no two names share a number and that every number lies in a block
// declared in sim.js STREAMS. (Change 1 of the build plan; the drift check also scans the code for bare offsets.)
import { STREAMS } from './sim.js';
const K = STREAMS.world[0], X = STREAMS.worldMore[0];
export const SALTS = {
  // world.js (people, choices, social life)
  setup: K, setupWho: K + 1, setupWhere: K + 2, setupMind: K + 3, setupCamp: K + 4, setupKid: K + 5, setupKnow: K + 9,
  choice: K + 10, explore: K + 11, exploreAlt: K + 12, conceive: K + 13, pairMate: K + 14, newborn: K + 15, newbornAlt: K + 20,
  illness: K + 21, injury: K + 22, birth: K + 23, pairing: K + 24, talk: K + 25, share: K + 26, band: K + 27, adopt: K + 28, move: K + 29,
  hunt: K + 36, tryKill: K + 37, pickup: K + 38, tinker: K + 39,
  setupSpear: X, shareOffer: X + 1, bandJoin: X + 2, bandHousehold: X + 3, bandSplit: X + 4, talkHome: X + 5, pairBand: X + 6,
  fireTend: X + 7, fireRain: X + 8, cookFind: X + 9, showHow: X + 10, wildBrand: X + 11, huntDirection: X + 12, newsBlur: X + 18, newsBlur2: X + 19, newsFlip: X + 20,
  // nature.js (animals, materials, fire)
  animals: K + 30, encounter: K + 31, attempt: K + 32, fire: K + 33, material: K + 34, carcass: K + 35,
  attemptHit: X + 13, attemptDisable: X + 14, attemptHurt: X + 15, carcassX: X + 16, carcassY: X + 17,
};
const used = new Map();
for (const [name, v] of Object.entries(SALTS)) {
  if (used.has(v)) throw new Error(`chance key ${v} used by both ${used.get(v)} and ${name}`);
  if (!Object.values(STREAMS).some(([a, b]) => v >= a && v <= b) || !((v >= K && v <= STREAMS.world[1]) || (v >= X && v <= STREAMS.worldMore[1]))) throw new Error(`chance key ${name}=${v} is outside the world blocks`);
  used.set(v, name);
}
