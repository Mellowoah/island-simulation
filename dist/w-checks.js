// Island small world: checks.js (split from world.js, build plan change 4; behaviour unchanged).
import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { R, clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';
import { H, W, bandMembers, homes, living } from './w-core.js';
import { births, siler } from './w-people.js';

// ---------- alarms: things that must never happen ----------
// Checked once a day. A tripped alarm is recorded (it never changes the world); tests require none.
export function sanity(s) {
  const A = s.alarms ??= [], add = what => { if (A.length < 200) A.push({ t: s.tick, what }); };
  for (const p of living(s)) {
    for (const k of ['hunger', 'thirst', 'energy', 'health']) if (!(p[k] >= -1e-9 && p[k] <= 100 + 1e-9)) add(`${p.name}: ${k} ${p[k]}`);
    if (!(p.reserve >= -1e-6) || p.reserve > p.body.fatMax * 1.01 + 1) add(`${p.name}: body fat ${p.reserve}`);
    // over 60 km in a day is impossible on foot with a family (an alarm); over 40 is rare but real (counted as unusual)
    const km = (p.tiles - (p.tilesAtDay ?? p.tiles)) * T.TILE_KM; if (km > 60) add(`${p.name} walked ${km.toFixed(0)} km in a day`); else if (km > 40) { s.unusual = (s.unusual ?? 0) + 1; if (s.diag) s.diag.long.push({ id: p.id, day: Math.floor(s.tick / clockOf(s).day), km, age: p.body.age, sex: p.sex, k: p.dayK, hunt: p.times.hunt }); }
  }
  for (const q of s.patches) if (!(q.stock >= -1e-9)) add(`${q.name}: stock ${q.stock}`);
  const L = s.ledger, left = s.patches.reduce((n, q) => n + q.stock, 0);
  if (Math.abs(L.initial + L.regenerated - L.consumed - L.decayed - left) > 1e-6 * (L.initial + L.regenerated)) add('food ledger does not balance');
  const held = living(s).reduce((n, p) => n + p.carry, 0) + s.households.reduce((n, h) => n + h.pool, 0) + (s.lostCarry ?? 0);
  const err = L.consumed * 500 + (L.meatKcal ?? 0) + (L.cookGain ?? 0) - ((s.energyLedger?.eaten ?? 0) - (L.milkKcal ?? 0)) - held - L.poolSpoiled;
  if (L.carcass) { const lying = s.carcasses.reduce((n, c) => n + c.kcal, 0), ce = L.carcass.made - L.carcass.taken - L.carcass.rotted - lying; if (Math.abs(ce) > 1e-6 * Math.max(1, L.carcass.made)) add(`carcass ledger off by ${ce.toFixed(1)}`); }
  for (const id in s.animals ?? {}) if (s.animals[id].some(n => !(n >= 0))) add(`${id}: negative or invalid numbers`);
  if (Math.abs(err) > 1e-6 * Math.max(1, L.consumed * 500)) add(`kcal ledger off by ${err.toFixed(1)}`);
}
// Deaths by age against the measured hunter-gatherer pattern: person-years lived and deaths in each age band, from
// everyone who ever lived (a period life table). Competing risks: the sim's own causes (starving, thirst, injury and
// illness from deprivation, childbirth) plus the background rate for causes it does not model must add up to about
// what was measured; if the total is well above it, the sim is killing people twice. Measure only.
export function lifeTable(s, bands = [0, 1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80]) {
  const C = clockOf(s), rows = bands.slice(0, -1).map((a, i) => ({ from: a, to: bands[i + 1], years: 0, deaths: 0, modelled: 0 }));
  for (const p of s.people) {
    const start = Math.max(0, (0 - p.born) / C.year), end = ((p.alive ? s.tick : p.death.t) - p.born) / C.year;
    for (const r of rows) { const a = Math.max(r.from, start), b = Math.min(r.to, end); if (b > a) r.years += b - a; }
    if (!p.alive && p.death.age >= start) { const r = rows.find(r => p.death.age >= r.from && p.death.age < r.to); if (r) { r.deaths++; if (!['Illness', 'Old age'].includes(p.death.cause)) r.modelled++; } }
  }
  for (const r of rows) { r.rate = r.years ? r.deaths / r.years : null; const mid = (r.from + r.to) / 2; r.siler = siler(s.config.siler, mid); }
  return rows;
}

// ---------- measures (never change the world) ----------
export function worldMetrics(s) {
  const C = clockOf(s), alive = living(s), adults = alive.filter(p => p.body.age >= 18);
  const landTiles = T.MAIN_TILES, seenLand = (() => { let n = 0; for (let i = 0; i < W * H; i++) if (s.seenAt[i] >= 0 && T.isWalkable(i % W, (i / W) | 0)) n++; return n; })();
  return { tick: s.tick, date: dateOf(C, s.tick).label, population: alive.length, adults: adults.length, children: alive.filter(p => p.body.age < 14).length,
    births: s.births, deaths: { ...s.deaths }, households: homes(s).length, generations: alive.reduce((m, p) => Math.max(m, p.gen ?? 0), 0), everLived: s.people.length, capReached: s.capReached ?? 0,
    discoveredKm2: seenLand * T.TILE_KM ** 2, landKm2: T.LAND_KM2, discoveredShare: seenLand / landTiles,
    meanFat: adults.length ? adults.reduce((n, p) => n + p.reserve / p.body.fatMax, 0) / adults.length : 0,
    food: s.patches.reduce((n, q) => n + q.stock, 0), shared: s.shared ?? 0, bands: s.bands.filter(b => !b.ended && bandMembers(s, b).length).map(b => ({ id: b.id, n: bandMembers(s, b).length, camp: { ...b.camp } })), alarms: (s.alarms ?? []).length };
}

