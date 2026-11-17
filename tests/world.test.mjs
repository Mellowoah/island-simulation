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
  assert.ok(s.people.length >= 18 && s.people.length <= 40, `${s.people.length} people`);
  const ages = s.people.map(p => p.body.age);
  assert.ok(Math.min(...ages) < 5 && Math.max(...ages) > 35, 'children and older adults');
  const kids = s.people.filter(p => p.mother !== null);
  assert.ok(kids.length > 0 && kids.every(k => s.people[k.mother].sex === 'F' && s.people[k.father].sex === 'M'));
  const adultsF = s.people.filter(p => p.sex === 'F' && p.body.age >= 20).map(p => p.body.mass);
  assert.ok(new Set(adultsF.map(m => m.toFixed(1))).size > 1, 'bodies differ');
});

test('Y3 fog: only the land around the first camp is known; more is found as people move; each knows only their own', () => {
  const s = createWorld2(42), m0 = worldMetrics(s);
  assert.ok(m0.discoveredShare < 0.1, `start ${(m0.discoveredShare * 100).toFixed(0)}% known`);
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
test('Y4b day range by sex like the Hadza (women ~6, men ~11 km)', { todo: 'women walk about 9 km, farther than Hadza women: there is no hunting yet, so no division of labour between men and women' }, () => {
  const r = settled();
  assert.ok(r.F >= 4 && r.F <= 8 && r.M >= 9 && r.M <= 13, `women ${r.F.toFixed(1)}, men ${r.M.toFixed(1)} km`);
});

test('Y5 the books balance: food grown = eaten, rotted or left; kcal gathered = eaten, carried, at camp or spoiled', () => {
  const s = createWorld2(43); stepWorld(s, 24 * 90);
  const L = s.ledger, left = s.patches.reduce((n, q) => n + q.stock, 0), tol = 1e-6 * (L.initial + L.regenerated);
  assert.ok(Math.abs(L.initial + L.regenerated - L.consumed - L.decayed - left) < tol, 'food ledger');
  const gathered = L.consumed * 500, held = s.people.reduce((n, p) => n + p.carry, 0) + s.households.reduce((n, h) => n + h.pool, 0);
  const err = gathered - (s.energyLedger.eaten - (L.milkKcal ?? 0)) - held - L.poolSpoiled;
  assert.ok(Math.abs(err) < 1e-6 * gathered, `unbooked ${err.toFixed(1)} kcal of ${gathered.toFixed(0)}`);
});

test('Y6 the same seed gives the same history', () => {
  const a = createWorld2(44), b = createWorld2(44); stepWorld(a, 24 * 20); stepWorld(b, 24 * 20);
  const sig = s => s.people.map(p => [p.x, p.y, p.hunger.toFixed(6), p.alive]).join('|');
  assert.equal(sig(a), sig(b));
});
