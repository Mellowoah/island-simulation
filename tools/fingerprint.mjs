// A fingerprint of a run: hash of every person's state and the books after N days on given seeds. Two code versions
// that should behave the same must give the same fingerprint (used to prove a refactor changed nothing).
import { createHash } from 'node:crypto';
import { createWorld2, stepWorld } from '../dist/world.js';
const days = +(process.argv[2] ?? 120), seeds = (process.argv[3] ?? '1,2').split(',').map(Number);
const h = createHash('sha256');
for (const seed of seeds) {
  const s = createWorld2(seed); stepWorld(s, 24 * days);
  for (const p of s.people) h.update(JSON.stringify([p.id, p.alive, p.x, p.y, p.hunger, p.thirst, p.reserve, p.energy, p.health, p.carry, p.items, p.skills, p.decision?.chose]));
  h.update(JSON.stringify([s.ledger, s.energyLedger, s.deaths, s.births, s.hunting, s.made, s.carcasses.length, s.bands.map(b => [b.camp.x, b.camp.y, b.fire?.fuel])]));
}
console.log(h.digest('hex').slice(0, 16));
