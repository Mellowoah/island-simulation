// Island small world: meat.js (split from world.js, build plan change 4; behaviour unchanged).
import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { R, clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { spoilFactor } from './weather.js';
import { SALTS } from './streams.js';
import { H, SALT, W, campOf, clamp, draw, event, note } from './w-core.js';
import { pickUp } from './w-craft.js';
import { look } from './w-food.js';
import { walk } from './w-move.js';
import { loseWater, survivalDrive, youngOf } from './w-people.js';

// ---------- meat ----------
// What a person expects hunting to return (kcal an hour): their own record, what they have heard, and a modest
// guess for the untried (approx.). It is learned, so who hunts, and how much, comes from what happens.
export const huntRate = p => { const h = p.hunt, hd = p.huntHeard ?? { kcal: 0, hours: 0 }; return (h.kcal + 0.3 * hd.kcal + R('huntPriorKcal')) / (h.hours + 0.3 * hd.hours + R('huntPriorHours')); };
export const meatCarry = p => Math.min(R('meatLoadKg'), (p.body.age >= 14 ? 0.3 : 0.15) * p.body.mass) * N.MEAT.kcalPerKg; // a load of meat: up to about 25 kg
export const hasEdge = p => p.items.some(i => i === 'flake' || i === 'chopper'), hasStone = p => p.items.some(i => i === 'cobble' || i === 'flint');
export const meatAvail = (p, c) => Math.max(0, Math.min(c.kcal, c.kcal0 * N.access(hasEdge(p), hasStone(p)) - c.taken));
export const weaponOf = p => p.items.includes('spear') ? 'spear' : p.items.includes('stick') ? 'stick' : hasStone(p) ? 'stone' : 'hands';
// where to look for game: a place they have seen, in bush or grass, within half a day's walk (a chance pick)
export function huntTarget(s, p) {
  const camp = campOf(s, p), RR = Math.round(8 / T.TILE_KM);
  for (let k = 0; k < 20; k++) {
    const x = camp.x + Math.round((draw(s, p.id, SALT.hunt, s.tick * 20 + k) * 2 - 1) * RR), y = camp.y + Math.round((draw(s, p.id + 1, SALT.hunt, s.tick * 20 + k) * 2 - 1) * RR);
    if (x < 0 || y < 0 || x >= W || y >= H || !p.seen[y * W + x] || !T.isWalkable(x, y)) continue;
    const r = T.regionAt(x, y); if (r === 'grass' || r === 'woodland' || r === 'river') return [x, y];
  }
  return null;
}
// An hour of hunting: moving quietly through the bush, picking up a stick or stone that comes to hand, and, when a
// group of animals is seen, deciding whether to try for one (the chance of success they can judge, against the risk).
export function huntHour(s, p, st, u) {
  const C = clockOf(s), B = body(s), young = youngOf(s, p), load = young.filter(k => EN.carried(k.body.age)).reduce((n, k) => n + k.body.mass, 0) + p.carry / 2000;
  // distance stalked builds up over the hour's slices (a bout cut into short slices must not move faster)
  st.stride = (st.stride ?? 0) + p.body.kmh * R('stalkPace') * u * C.hours / T.TILE_KM; const tiles = Math.floor(st.stride); st.stride -= tiles; // stalking: slow, with long pauses (approx. 1-1.5 km an hour)
  const ang = draw(s, p.id, SALT.huntDirection, s.tick) * 2 * Math.PI; let moved = 0;
  for (let i = 0; i < tiles; i++) {
    const x = Math.round(p.x + Math.cos(ang)), y = Math.round(p.y + Math.sin(ang)); if (!T.isWalkable(x, y) || (x === p.x && y === p.y)) break;
    p.x = x; p.y = y; p.tiles++; moved++; const kc = p.body.cotTile * (p.body.mass + load); burnKcal(s, p, kc); loseWater(s, p, kc); look(s, p);
  }
  for (const k of young) { k.x = p.x; k.y = p.y; }
  pickUp(s, p, 0.3);
  spotCarcasses(s, p);
  const seen = N.sightings(s, p, Math.max(moved, 1) * T.TILE_KM); if (!seen.length) return;
  // a child along makes stalking harder; practice makes it easier
  const skill = p.skills.hunt ?? 0, stealth = (0.5 + 0.5 * skill) * (young.some(k => EN.carried(k.body.age)) ? 0.5 : 1), w = N.WEAPON[weaponOf(p)];
  const judge = id => { const sp = N.SPECIES[id], close = Math.min(1, w.reach / sp.flee) * stealth, hit = 0.4 + 0.4 * skill, dis = 1 - Math.exp(-(w.joule * (w.point ? 3 : 1)) / (15.6 * sp.mass)); return { id, pk: close * hit * dis, gain: close * hit * dis * N.carcassKcal(id) * N.access(hasEdge(p), hasStone(p)) - sp.danger * p.mind.caution * 20000 }; };
  const best = seen.map(judge).sort((a, b) => b.gain - a.gain)[0]; if (best.gain <= 0) return;
  const drive = survivalDrive(p, young), tryP = Math.min(0.95, Math.max(0.05, 0.2 + 0.4 * (1 - p.mind.caution) + 0.3 * drive + 0.2 * p.mind.ambition));
  if (draw(s, p.id, SALT.tryKill, s.tick) > tryP) return;
  s.hunting.attempts++; practise(s, p, 'hunt', 0.5);
  const res = N.attempt(s, p, best.id, weaponOf(p), skill, stealth), sp = N.SPECIES[best.id];
  if (res.hurt) { p.health = clamp(p.health - 3 * B.injuryDamage); s.hunting.hurt++; note(s, p, `Hurt by a ${sp.label}.`); }
  if (!res.got) { note(s, p, `Went after a ${sp.label}: ${res.why}.`); return; }
  const cell = N.cellOf(p.x, p.y); s.animals[best.id][cell] = Math.max(0, s.animals[best.id][cell] - 1);
  const kcal = N.carcassKcal(best.id), c = { id: s.nextId++, species: best.id, x: p.x, y: p.y, kcal, kcal0: kcal, taken: 0, until: s.tick + Math.round(C.day / spoilFactor(s)), natural: false, roasted: false, by: p.id };
  s.carcasses.push(c); N.book(s, 'made', kcal); p.carcasses[c.id] = 1;
  s.hunting.kills[best.id] = (s.hunting.kills[best.id] ?? 0) + 1; if (sp.mass >= N.LARGE) s.hunting.largeKills++;
  const ag = p.body.age < 20 ? '14-19' : p.body.age < 40 ? '20-39' : '40+'; (s.hunting.byAge[p.sex + ag] ??= { kills: 0, kcal: 0 }).kills++;
  event(s, `${p.name} killed a ${sp.label}.`); note(s, p, `Killed a ${sp.label} with ${weaponOf(p) === 'hands' ? 'bare hands' : 'a ' + weaponOf(p)}.`);
  const before = p.carry, ate = s.energyLedger?.eaten ?? 0; butcher(s, p, c); const got = p.carry - before + (s.energyLedger.eaten - ate); st.kcal0 += got; p.hunt.kcal += got; st.done = true;
}
export function huntEnd(s, p, st) {
  if (!(st.kcal0 > 0)) note(s, p, 'Came back from hunting with nothing.');
}
export function butcher(s, p, c) {
  if (!c || c.kcal <= 100) { note(s, p, 'The carcass was gone.'); return; }
  const B = body(s); let take = Math.min(meatAvail(p, c), Math.max(0, meatCarry(p) - p.carry) + p.hunger / p.body.hpk); if (take <= 0) return;
  if (c.natural && N.SPECIES[c.species].mass >= N.LARGE && !c.scavenged) { c.scavenged = true; s.hunting.largeScavenged++; }
  if (c.natural && !c.noted) { c.noted = true; note(s, p, `Found a ${N.SPECIES[c.species].label} carcass and took meat.`); }
  c.kcal -= take; c.taken += take; N.book(s, 'taken', take); s.ledger.meatKcal += take;
  for (const k of youngOf(s, p)) { const g = Math.min(take, k.hunger / k.body.hpk); if (g > 0) { eatKcal(s, k, g); take -= g; } }
  const own = Math.min(take, p.hunger / p.body.hpk); eatKcal(s, p, own); take -= own; p.carry += take;
}
// Vultures overhead and the smell: a carcass within about 3 km is noticed; a grown person who notices one drops what
// they are doing to weigh going for it.
export function spotCarcasses(s, p) {
  if (p.body.age < 14) return;
  // a grass fire nearby: someone holding a stick may push it into the flames and carry it off burning (a chance:
  // the curious, the not too cautious). A smouldering brand lasts a few hours.
  for (const w of s.wildfires) if (Math.abs(w.x - p.x) + Math.abs(w.y - p.y) <= 4 && p.items.includes('stick') && !p.brand && draw(s, p.id, SALT.wildBrand, s.tick) < 0.3 * p.mind.curiosity * (1 - 0.5 * p.mind.caution)) {
    p.items.splice(p.items.indexOf('stick'), 1); p.brand = s.tick + 4 * clockOf(s).perHour; note(s, p, 'Lit a stick in the grass fire and carried it off burning.'); }
  if (p.brand && s.tick > p.brand) { p.brand = null; note(s, p, 'The burning stick went out.'); }
  for (const c of s.carcasses) if (!p.carcasses[c.id] && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 9) { p.carcasses[c.id] = 1; if (p.step?.k === 'walk' && !p.plan.some(x => x.k === 'butcher') && !sleepTime(clockOf(s), s.tick)) { p.plan = []; p.step = null; } }
}
// A route as the walker believes it: land they have seen is as it is; land they have not seen is assumed passable.
// They head roughly straight into the unknown and find out on the way (no map of land nobody has seen).
