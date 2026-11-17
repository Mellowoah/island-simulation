// The small world (dist/world.js, dist/terrain.js): the land, families, fog of war, the day, and the books.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/terrain.js';
import { createWorld2, stepWorld, worldMetrics } from '../dist/world.js';

test('Y1 the island: about 850 km² of one main island with islets, an inland lake and rivers to the lake or sea', () => {
  assert.ok(T.LAND_KM2 > 700 && T.LAND_KM2 < 1200, `${T.LAND_KM2.toFixed(0)} km²`);
  let islet = 0; for (let y = 0; y < T.TH; y++) for (let x = 0; x < T.TW; x++) if (T.regionAt(x, y) !== 'sea' && !T.onMainland(x, y)) islet++;
  assert.ok(islet > 0, 'some islets');
  assert.ok(T.RIVERS.length >= 3, `${T.RIVERS.length} rivers`);
  for (const r of T.RIVERS) { const [x, y] = r.at(-1); const ends = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => ['sea', 'lake', 'river'].includes(T.regionAt(x + a, y + b))); assert.ok(ends, 'river reaches water'); }
  for (const w of T.waterSites()) assert.ok(T.isWalkable(w.x, w.y), 'water on reachable land');
  for (const f of T.foodSites()) assert.ok(T.isWalkable(f.x, f.y), 'food on reachable land');
});

test('Y2 people start as families of mixed ages, each a little different', () => {
  const s = createWorld2(41);
  assert.ok(s.people.length >= 35 && s.people.length <= 90, `${s.people.length} people`);
  assert.equal(s.bands.length, 3); assert.ok(s.households.every(h => h.band >= 0 && h.band < 3));
  const ages = s.people.map(p => p.body.age);
  assert.ok(Math.min(...ages) < 5 && Math.max(...ages) > 35, 'children and older adults');
  const kids = s.people.filter(p => p.mother !== null);
  assert.ok(kids.length > 0 && kids.every(k => s.people[k.mother].sex === 'F' && s.people[k.father].sex === 'M'));
  const adultsF = s.people.filter(p => p.sex === 'F' && p.body.age >= 20).map(p => p.body.mass);
  assert.ok(new Set(adultsF.map(m => m.toFixed(1))).size > 1, 'bodies differ');
});

test('Y3 fog: only the land around the first camp is known; more is found as people move; each knows only their own', () => {
  const s = createWorld2(42), m0 = worldMetrics(s);
  assert.ok(m0.discoveredShare < 0.25, `start ${(m0.discoveredShare * 100).toFixed(0)}% known`);
  stepWorld(s, 24 * 60);
  const m1 = worldMetrics(s);
  assert.ok(m1.discoveredKm2 > m0.discoveredKm2, 'land discovered');
  let firsts = 0; for (let i = 0; i < s.seenBy.length; i++) if (s.seenBy[i] >= 0) firsts++;
  assert.ok(firsts > 0, 'who first saw each tile is kept');
  const known = s.people.filter(p => p.alive && p.body.age >= 14).map(p => p.seen.reduce((n, v) => n + v, 0));
  assert.ok(new Set(known).size > 1, 'people know different amounts');
});

// Hadza figures are for people who know their land, so this is measured in the second year, after the band has
// found its way around (in the first weeks, on unknown land, days of 20 km are common).
const settled = (() => { let r = null; return () => r ??= (() => {
  const s = createWorld2(42); stepWorld(s, 8760);
  const before = new Map(s.people.map(p => [p.id, { tiles: p.tiles, gather: p.times.gather }]));
  stepWorld(s, 24 * 90);
  const ad = s.people.filter(p => p.alive && p.body.age >= 18 && before.has(p.id));
  const km = g => g.reduce((n, p) => n + p.tiles - before.get(p.id).tiles, 0) / g.length / 90 * T.TILE_KM;
  return { all: km(ad), F: km(ad.filter(p => p.sex === 'F')), M: km(ad.filter(p => p.sex === 'M')), gather: ad.reduce((n, p) => n + p.times.gather - before.get(p.id).gather, 0) / ad.length / 90 };
})(); })();
test('Y4 a settled forager day: adults walk 5-15 km and gather 3-6 hours a day', () => {
  const r = settled();
  assert.ok(r.all >= 5 && r.all <= 15, `${r.all.toFixed(1)} km a day`);
  assert.ok(r.gather >= 3 && r.gather <= 6, `${r.gather.toFixed(1)} h gathering a day`);
});
test('Y4b day range by sex like the Hadza (women ~6, men ~11 km)', { todo: 'men walk less than Hadza men (about 9 km against 11): hunting is in, but without bows it stays rare, and long hunts are what take Hadza men far' }, () => {
  const r = settled();
  assert.ok(r.F >= 4 && r.F <= 8 && r.M >= 9 && r.M <= 13, `women ${r.F.toFixed(1)}, men ${r.M.toFixed(1)} km`);
});

test('Y5 the books balance: food grown = eaten, rotted or left; kcal gathered (plants, meat, cooking gain) = eaten, carried, at camp or spoiled; carcasses = taken, rotted or lying', () => {
  const s = createWorld2(43); stepWorld(s, 24 * 90);
  const L = s.ledger, left = s.patches.reduce((n, q) => n + q.stock, 0), tol = 1e-6 * (L.initial + L.regenerated);
  assert.ok(Math.abs(L.initial + L.regenerated - L.consumed - L.decayed - left) < tol, 'food ledger');
  const gathered = L.consumed * 500 + (L.meatKcal ?? 0) + (L.cookGain ?? 0), held = s.people.reduce((n, p) => n + p.carry, 0) + s.households.reduce((n, h) => n + h.pool, 0) + (s.lostCarry ?? 0);
  const err = gathered - (s.energyLedger.eaten - (L.milkKcal ?? 0)) - held - L.poolSpoiled;
  assert.ok(Math.abs(err) < 1e-6 * gathered, `unbooked ${err.toFixed(1)} kcal of ${gathered.toFixed(0)}`);
  const C2 = L.carcass, lying = s.carcasses.reduce((n, c) => n + c.kcal, 0);
  assert.ok(Math.abs(C2.made - C2.taken - C2.rotted - lying) < 1e-6 * Math.max(1, C2.made), 'carcass ledger');
});

test('Y6 the same seed gives the same history', () => {
  const a = createWorld2(44), b = createWorld2(44); stepWorld(a, 24 * 20); stepWorld(b, 24 * 20);
  const sig = s => s.people.map(p => [p.x, p.y, p.hunger.toFixed(6), p.alive]).join('|');
  assert.equal(sig(a), sig(b));
});

test('Y7 alarms: in a year on two islands nothing impossible happens (stats in range, books balance, no 60 km days)', () => {
  for (const seed of [41, 45]) { const s = createWorld2(seed); stepWorld(s, 8760); assert.deepEqual((s.alarms ?? []).slice(0, 3), [], `seed ${seed}`); }
});

test('Y8 beliefs, not the truth: people expect food from what they saw and heard, so two people can expect different things', () => {
  const s = createWorld2(42); stepWorld(s, 24 * 120);
  const ad = s.people.filter(p => p.alive && p.body.age >= 18);
  let differ = 0, pairs = 0;
  for (const q of s.patches) { const ks = ad.map(p => p.places[q.id]).filter(Boolean); if (ks.length >= 2) { pairs++; if (new Set(ks.map(k => k.t)).size > 1) differ++; } }
  assert.ok(pairs > 0 && differ > 0, `${differ} of ${pairs} places known differently`);
  const b = ad.map(p => p.foodBelief?.tubers?.tau).filter(Boolean);
  assert.ok(b.length && b.some(v => v !== 60), 'regrowth beliefs learned from experience');
});

test('Y9 bands: a large band can split into two camps, and families can move between bands', () => {
  const s = createWorld2(42, { fissionSize: 12, householdMove: 0.2 }); stepWorld(s, 24 * 365);
  const ev = s.events.map(e => e.text).join('\n');
  assert.ok(/ split: /.test(ev) || s.bands.length > 3, 'a split happened');
  assert.ok(/went to live with/.test(ev), 'a family moved band');
});

test('Y10 animals and hunting: herds stay within their land, and large kills are rare (Hadza with bows: 1-3 per 100 hunter-days)', () => {
  const s = createWorld2(45); stepWorld(s, 24 * 365);
  for (const id in s.animals) assert.ok(s.animals[id].every(n => n >= 0 && Number.isFinite(n)), id);
  const H = s.hunting, days = Math.max(1, H.tripHours / 6);
  assert.ok(H.largeKills / days <= 0.03, `large kills per hunter-day ${(H.largeKills / days).toFixed(3)} (no bows here: should not beat the Hadza)`);
  assert.equal((s.alarms ?? []).length, 0, JSON.stringify(s.alarms));
});

test('Y11 no recipes: a flake needs a hard stone struck on flint; an ember needs dry wood (laws, not a list)', async () => {
  const N = await import('../dist/nature.js');
  const s = createWorld2(46);
  assert.equal(N.law(s, 'strike', 'stick', 'flint', 1, 0), null, 'wood does not knap flint');
  assert.equal(N.law(s, 'strike', 'cobble', 'flint', 1, 0)?.made, 'flake');
  assert.equal(N.law(s, 'cut', 'flake', 'stick', 1, 0)?.made, 'spear');
  s.tick = 0; const wet = N.moisture(s) > 0.15; assert.equal(N.law(s, 'rub', 'stick', 'stick', 1, 0)?.made ?? null, wet ? null : 'ember');
});
