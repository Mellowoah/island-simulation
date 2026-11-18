// Island: the small world (Robert, 17 Nov: "a small little operable world that's similar to ours", "the size to be
// comparable to how people lived", "land that's discoverable that's blacked out until it's discovered").
//
// One world, made of the parts already tested: the real clock and the rate register (clock.js), one law of energy
// for every body (energy.js), the land with its seasons, rain, foods and waters (terrain.js, savanna.js).
// What is new here:
//   - People start as families of mixed ages, and each person is a little different (body, sleep, temperament),
//     drawn around the measured values. Children take after their parents, with variation.
//   - They choose by real trade-offs: food per hour of the trip after the cost of walking, what their household is
//     short of, how thirsty they and their young are, how tired, the hour of the day, and their own temperament.
//     Choices are probabilistic (bounded rationality), so no fixed script decides.
//   - A camp: food is carried home, shared within the household first and then with others in need, favouring
//     kin (Hamilton's rule, r x benefit > cost). In the evening people tell each other about places.
//   - The land is unknown until someone sees it. Each person knows only what they have seen or been told; the
//     world records who first saw each tile, and when.
//   - Deaths come from the body (starving, thirst, injury and illness from deprivation) and, for illness and old age
//     that the sim does not model in detail, from the measured hunter-gatherer age pattern (Siler model, Hadza fit,
//     Gurven and Kaplan 2007), at the share of deaths those causes make up (about 79%). Birth carries a 1.2% risk
//     to the mother (pre-industrial average).
// Nothing here is God, Eden or the deceiver. Those come later as layers on this same world.

import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { R, clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';

export const WORLD_VERSION = 1;
export const WORLD_DEFAULTS = {
  bands: 3,                 // neighbouring bands on the island, so there are others to marry and to join (foragers live in regional networks)
  families: 4,              // families per band at the start: about 20 people a camp (Hadza camps average about 30; Marlowe 2010)
  fissionSize: 50,          // a band this large may split (group sizes nest by about x3: families ~5, bands ~15-50, communities ~150; Hamilton et al. 2007)
  fusionSize: 8,            // a band this small may join another
  householdMove: 0.03,
  startKnowledge: 'none',   // 'none': a blank slate, nothing known about tools or fire; 'basic': like people landing on an island, some grown-ups know how to knap flint, point a stick, make fire and cook
  years: 0,                 // run length for the page (0 = until stopped)      // chance a month that a family moves to another band where it has kin (camp membership is fluid among foragers; approx.)
  clockMinutes: 60,
  density: 0.24,            // people per km² the land feeds in an ordinary year (Hadza, Marlowe)
  choiceTemperature: 0.05,  // bounded rationality: how often a person picks something other than the best-looking option
  menarche: 16, firstPair: { F: 16, M: 18 }, menopause: 45, // forager menarche ~16, last births around 40 (Hadza)
  fecundability: 0.2, gestation: 0.75, maleRatio: 0.512, heritability: 0.4,
  birthRisk: 0.012,         // death of the mother per birth before modern medicine (Cambridge Group summary)
  illnessShare: 0.79,       // share of hunter-gatherer deaths from illness (~70%) and degenerative causes (~9%) (Gurven and Kaplan 2007)
  siler: { a1: 0.351, b1: 0.895, a2: 0.011, a3: 6.7e-6, b3: 0.125 }, // Hadza Siler fit (Gurven and Kaplan 2007, table 2; e0 = 34)
  campRadiusKm: 4,          // what the first band knows around its camp at the start
  poolHalfLifeDays: 3,      // food kept at camp spoils
  populationCap: 400,       // technical limit only
};

const K = STREAMS.world[0];
const SALT = SALTS; // every chance key is named once in streams.js (checked when imported)
const draw = (s, id, salt, t = s.tick) => noise2(seedKey(s.seed), t, id, salt);
const gauss = (s, id, salt, t) => { let z = 0; for (let i = 0; i < 4; i++) z += draw(s, id, salt + 0, t * 4 + i + 1); return (z - 2) * Math.sqrt(3); }; // approx. N(0,1)
const SYL = ['ka', 'lo', 'mi', 'ne', 'ra', 'su', 'te', 'vi', 'ze', 'do', 'an', 'el', 'or', 'ul', 'ya', 'be', 'ha', 'ji', 'mu', 'si'];
const nameOf = (s, id) => { const r = i => SYL[Math.floor(draw(s, id, SALT.newbornAlt, 7 + i) * SYL.length)]; return (r(0) + r(1) + (draw(s, id, SALT.newbornAlt, 9) < 0.4 ? r(2) : '')).replace(/^./, x => x.toUpperCase()); };
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export const ageOf = (s, p) => (s.tick - p.born) / clockOf(s).year;
// The living and the households with someone alive, cached until a birth or a death (long runs keep everyone who
// ever lived, so loops must not walk the dead).
const LIVE = new WeakMap(), HOMES = new WeakMap();
export const living = s => { let l = LIVE.get(s); if (!l) { l = s.people.filter(p => p.alive); LIVE.set(s, l); } return l; };
const homes = s => { let h = HOMES.get(s); if (!h) { h = s.households.filter(x => x.members.some(i => s.people[i].alive)); HOMES.set(s, h); } return h; };
const changed = s => { LIVE.delete(s); HOMES.delete(s); };
// Bands: each family belongs to one; each band has its own camp.
export const bandOf = (s, p) => s.bands[s.households[p.household]?.band ?? 0];
export const campOf = (s, p) => bandOf(s, p).camp;
export const bandMembers = (s, b) => living(s).filter(p => (s.households[p.household]?.band ?? 0) === b.id);
const W = T.TW, H = T.TH;

// ---------- the land's food and water ----------
const FOOD_BY_REGION = { shore: ['shellfish', 'fish', 'berries'], river: ['fish', 'berries'], woodland: ['berries', 'nuts', 'honey', 'tubers', 'baobab'], grass: ['tubers', 'baobab'], rock: ['honey'] };
function makeFood(s) {
  const C = clockOf(s), B = body(s), carrying = s.config.density * T.LAND_KM2, yearUnits = carrying * 2250 * 365 / B.unitKcal;
  const sites = T.foodSites().filter(site => FOOD_BY_REGION[site.region]);
  const chosen = sites.map(site => {
    let opts = FOOD_BY_REGION[site.region];
    if (site.region === 'shore') { const lake = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([a, b]) => T.regionAt(site.x + a, site.y + b) === 'lake'); opts = lake ? ['fish', 'berries'] : ['shellfish']; }
    const tot = opts.reduce((n, f) => n + FOODS[f].share, 0); let r = site.r * tot, food = opts[0];
    for (const f of opts) { r -= FOODS[f].share; if (r <= 0) { food = f; break; } }
    return { ...site, food };
  });
  const count = {}; for (const c of chosen) count[c.food] = (count[c.food] ?? 0) + 1;
  return chosen.map((c, i) => {
    const F = FOODS[c.food], annual = yearUnits * F.share / count[c.food];
    const regen = annual / C.year, decay = Math.LN2 / (F.realHalfLifeDays * C.day), cap = regen / decay;
    return { id: 'p' + i, name: F.label, food: c.food, x: c.x, y: c.y, stock: cap * 0.6, capacity: cap, regen, decay, gift: false };
  });
}

// ---------- seeing ----------
const SIGHT = { rock: 9, grass: 6, shore: 6, river: 4, woodland: 3 }; // tiles; open ground and high ground see far (approx.)
function look(s, p) {
  const r0 = SIGHT[T.regionAt(p.x, p.y)] ?? 4, r = isNight(clockOf(s), s.tick) ? 1 : r0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > r) continue;
    const x = p.x + dx, y = p.y + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (!p.seen[i]) p.seen[i] = 1;
    if (s.seenAt[i] < 0) { s.seenAt[i] = s.tick; s.seenBy[i] = p.id; s.discovered++; }
  }
  for (const q of s.patchIndex(p.x, p.y, r)) {
    const near = dist(q, p) <= 2, prev = p.places[q.id];
    if (!prev) note(s, p, `Found ${q.name.toLowerCase()} (${placeName(q)}).`);
    if (near) observe(s, p, q, q.stock);                                  // a close look
    else if (!prev) p.places[q.id] = { exp: q.stock * 0.5, t: s.tick, u: 0, n: 0 }; // seen from afar: it is there, how much is a guess
  }
  for (const w of s.waters) if (dist(w, p) <= r) {
    if (!p.waters[w.id]) note(s, p, `Found water: ${w.name.toLowerCase()}.`);
    const was = p.waters[w.id];
    p.waters[w.id] = { active: w.active, t: s.tick, dryOk: (was?.dryOk ?? false) || (w.active && realFrac(s) >= 7 / 12) }; // seen with water in the dry season: it lasts
  }
}
const placeName = q => `${Math.round(q.x * T.TILE_KM)} km east, ${Math.round(q.y * T.TILE_KM)} km south`;
function note(s, p, text) { p.memories.push({ t: s.tick, text }); if (p.memories.length > 60) p.memories.shift(); }
function event(s, text) { s.events.push({ t: s.tick, text }); if (s.events.length > 300) s.events.shift(); }

// ---------- bodies ----------
function setBody(s, p) {
  const C = clockOf(s), B = body(s), a = Math.max(0, ageOf(s, p)), f = p.f;
  const m = EN.massOf(a, p.sex) * f.mass, base = EN.baseKcalDay(a, p.sex, m) * f.bmr, hpk = 100 / (base * B.hungerFullDays);
  if (p.body && p.body.hpk !== hpk) { const store = (100 - p.hunger) / p.body.hpk, h = 100 - store * hpk; if (h < 0) { p.reserve += -h / hpk; p.hunger = 0; } else p.hunger = Math.min(100, h); }
  const st = lifeStage(a);
  p.body = { age: a, mass: m, base, baseTick: base / 24 * C.hours, hpk, fatMax: m * EN.fatShare(a, p.sex) * f.fat * EN.LAW.fatKcalPerKg,
    cotTile: EN.cotPerKg(m) * T.TILE_KM, tilesTick: EN.speedKmH(m) * f.speed / T.TILE_KM * C.hours,
    kmh: EN.speedKmH(m) * f.speed, sleepH: a >= 18 ? f.sleep : st.sleepHours, waterAt: B.thirstAtShare * m * 1000, waterDeath: B.dehydrationDeathShare * m * 1000,
    carryKcal: Math.max(0, 4000 * Math.min(1, m / 46)) };
  if (p.reserve === undefined) p.reserve = p.body.fatMax * 0.8;
  // a growing or ageing body whose fat store gets smaller burns the difference (booked as burned)
  if (p.reserve > p.body.fatMax) { const ex = p.reserve - p.body.fatMax; p.reserve = p.body.fatMax; (s.energyLedger ??= { eaten: 0, burned: 0, heat: 0, unabsorbed: 0 }).burned += ex; }
}
const loseWater = (s, p, kcal) => { p.deficit += kcal * body(s).waterMlPerKcal; p.thirst = Math.min(100, p.deficit / p.body.waterAt * 100); };
const drink = p => { p.deficit = 0; p.thirst = 0; };

// The person a young child goes with: mother, else father, else an adult of its household.
function carerOf(s, p) {
  if (p.body.age >= 5) return null;
  const m = s.people[p.mother], f = s.people[p.father];
  if (m?.alive) return m; if (f?.alive) return f;
  const h = s.households[p.household]; return h ? h.members.map(i => s.people[i]).find(q => q.alive && q.body.age >= 14) ?? null : null;
}
// 0 while body fat is above 40% of its most, rising to 1 as it runs out (for oneself or a child in one's care)
function survivalDrive(p, young = []) {
  const F = R('survivalFat'), d = q => Math.max(0, Math.min(1, (F - (q.reserve ?? 0) / q.body.fatMax) / F));
  return young.reduce((m, k) => Math.max(m, d(k)), d(p));
}
// the young a person is looking after now: their own, or a child of kin whose parents have died
const youngOf = (s, p) => (s.youngBy?.get(p.id) ?? []).filter(k => k.alive && s.carer.get(k.id) === p);

function liveTick(s, p, mother) {
  const C = clockOf(s), B = body(s), b = p.body;
  let kcal = b.baseTick;
  if (p.pregnant) { const g = s.config.gestation * C.year, tri = Math.floor((1 - (p.pregnant.due - s.tick) / g) * 3); kcal += EN.pregnancyKcal(tri) / 24 * C.hours; }
  let own = kcal;
  if (mother && !(mother.hunger >= 100 && mother.reserve <= 0)) {
    const milk = EN.milkShare(b.age);
    if (milk > 0) {
      const room = Math.max(0, b.fatMax - p.reserve) / B.fatStoreEff, extra = Math.min(room, kcal * 0.25) * milk;
      burnKcal(s, mother, (kcal * milk + extra) / EN.LAW.milkEfficiency); loseWater(s, mother, kcal * milk + extra);
      if (extra > 0) { eatKcal(s, p, extra); s.ledger.milkKcal = (s.ledger.milkKcal ?? 0) + extra; } // eaten as milk, not from the land
      own = kcal * (1 - milk);
    }
  }
  burnKcal(s, p, own); loseWater(s, p, own);
  const asleep = p.step?.k === 'sleep' || p.step?.k === 'rest';
  if (asleep) p.energy = clamp(p.energy + B.restGainTick);
  else if (!s.carer.get(p.id)) p.energy = clamp(p.energy - B.wakeDrainTick(b.sleepH));
  // health: deprivation harms, rest and ordinary life heal (clock.js PAIR health)
  if (p.hunger >= 80 || p.thirst >= 80) p.health = clamp(p.health - B.illnessTick);
  else p.health = clamp(p.health + (asleep ? B.restHealTick : B.baseHealTick));
}

// ---------- people and families at the start ----------
function newPerson(s, { sex, born, mother = null, father = null, household = null, f, mind }) {
  const id = s.people.length;
  const gen = mother === null ? 0 : 1 + Math.max(s.people[mother]?.gen ?? 0, s.people[father]?.gen ?? 0);
  const p = { id, name: nameOf(s, id), gen, sex, born, mother, father, partner: null, household, alive: true, death: null,
    x: 0, y: 0, hunger: 20, reserve: undefined, energy: 80, health: 100, deficit: 0, thirst: 0,
    f, mind, skills: {}, places: {}, waters: {}, seen: new Uint8Array(W * H), plan: [], step: null, carry: 0, items: [], hunt: { kcal: 0, hours: 0 }, carcasses: {},
    times: { sleep: 0, rest: 0, walk: 0, gather: 0, explore: 0, camp: 0, drink: 0, hunt: 0 }, tiles: 0,
    pregnant: null, births: [], young: [], memories: [] };
  s.people.push(p); changed(s); setBody(s, p);
  if (household !== null) s.households[household].members.push(id);
  return p;
}
const MIND_KEYS = ['curiosity', 'caution', 'care', 'social', 'ambition']; // ambition: the wish to do well in others' eyes (success)
function drawFactors(s, id, parents = null) {
  const g = (k, sd) => gauss(s, id, SALT.setupWho, k) * sd;
  const h = s.config.heritability, mix = (k, own) => parents ? 1 + h * ((parents[0].f[k] + parents[1].f[k]) / 2 - 1) + own * Math.sqrt(1 - h * h) : 1 + own;
  const f = { mass: mix('mass', g(1, 0.08)), fat: mix('fat', g(2, 0.2)), bmr: mix('bmr', g(3, 0.05)), speed: mix('speed', g(4, 0.07)), sleep: 5.7 + 1.4 * draw(s, id, SALT.setupWhere, 5) };
  const mind = {};
  MIND_KEYS.forEach((k, i) => { const own = 0.5 + 0.18 * gauss(s, id, SALT.setupMind, 10 + i); mind[k] = clamp(parents ? 0.5 + h * ((parents[0].mind[k] + parents[1].mind[k]) / 2 - 0.5) + (own - 0.5) * Math.sqrt(1 - h * h) : own, 0.05, 0.95); });
  return { f, mind };
}

export function createWorld2(seed = 41, opts = {}) {
  const cfg = { ...WORLD_DEFAULTS, ...opts };
  const s = { kind: 'world', mode: 'world', version: WORLD_VERSION, seed: seed >>> 0, rng: 2, tick: 0, clock: { min: cfg.clockMinutes ?? REAL_MINUTES }, map: { id: 'island' }, config: cfg,
    people: [], households: [], events: [], births: 0, deaths: {}, discovered: 0, ledger: { initial: 0, regenerated: 0, consumed: 0, decayed: 0, gifted: 0, withdrawn: 0, poolSpoiled: 0 } };
  const C = clockOf(s);
  s.patches = makeFood(s); s.ledger.initial = s.patches.reduce((n, p) => n + p.stock, 0);
  s.waters = T.waterSites().map(w => ({ ...w, active: true }));
  s.animals = N.makeAnimals(); s.carcasses = []; s.wildfires = []; s.nextId = 1; s.ledger.meatKcal = 0; s.ledger.cookGain = 0; s.ledger.carcass = { made: 0, taken: 0, rotted: 0 };
  s.made = {}; s.firsts = {};
  s.hunting = { trips: 0, tripHours: 0, attempts: 0, kills: {}, largeKills: 0, largeScavenged: 0, hurt: 0, byAge: {} };
  s.seenAt = new Int32Array(W * H).fill(-1); s.seenBy = new Int32Array(W * H).fill(-1); // person ids pass 32,767 in long runs
  attachIndex(s);
  // The camps: the first at the lake if there is one (it never dries); the others at lasting water as far as can be
  // from the camps already chosen (each band has its own country, as among foragers).
  const lasting = s.waters.filter(w => w.kind === 'lake' || w.kind === 'spring');
  s.bands = [];
  for (let bi = 0; bi < cfg.bands; bi++) {
    let w;
    if (!bi) { const lake = lasting.filter(x => x.kind === 'lake'), pick = lake.length ? lake : lasting; w = pick[Math.floor(draw(s, 0, SALT.setupCamp, 0) * pick.length)]; }
    else w = lasting.map(x => ({ x, d: Math.min(...s.bands.map(b => Math.abs(b.camp.x - x.x) + Math.abs(b.camp.y - x.y))) + draw(s, bi, SALT.setupCamp, x.x * 999 + x.y) * 4 })).sort((a2, b2) => b2.d - a2.d)[0].x;
    s.bands.push({ id: bi, camp: { x: w.x, y: w.y, water: w.id, since: 0 } });
  }
  // Families: a couple each (mother 18-40, father 0-8 years older), with the children she would have had at about
  // 3.4-year spacing from about 19, each surviving with the real odds to their age; some have a grandparent.
  const year = C.year; let gid = 1000;
  for (let bi = 0; bi < cfg.bands; bi++) for (let f = 0; f < cfg.families; f++) {
    const h = bi * cfg.families + f;
    const hh = { id: s.households.length, members: [], pool: 0, band: bi }; s.households.push(hh);
    const u = k => draw(s, h, SALT.setupKid, k);
    const ma = 18 + 22 * u(1), fa = ma + 8 * u(2);
    const mom = newPerson(s, { sex: 'F', born: -ma * year, household: hh.id, ...drawFactors(s, gid++) });
    const dad = newPerson(s, { sex: 'M', born: -fa * year, household: hh.id, ...drawFactors(s, gid++) });
    mom.partner = dad.id; dad.partner = mom.id;
    for (let k = 0, at = 19 + 2 * u(3); at < ma - 0.3; at += 3.4 * (0.85 + 0.3 * u(10 + k)), k++) {
      const age = ma - at, surv = Math.exp(-silerCum(cfg.siler, age) * cfg.illnessShare);
      if (u(30 + k) > surv) continue;
      const kid = newPerson(s, { sex: u(50 + k) < cfg.maleRatio ? 'M' : 'F', born: -age * year, mother: mom.id, father: dad.id, household: hh.id, ...drawFactors(s, gid++, [mom, dad]) });
      mom.births.push(kid.born); mom.young.push(kid.id); dad.young.push(kid.id);
    }
    if (u(70) < 0.35) newPerson(s, { sex: u(71) < 0.6 ? 'F' : 'M', born: -(ma + 22 + 8 * u(72)) * year, household: hh.id, ...drawFactors(s, gid++) });
  }
  // Each band knows the land and the places within a few km of its own camp, and that its camp's water lasts.
  const kr = cfg.campRadiusKm / T.TILE_KM;
  for (const p of s.people) {
    const c = campOf(s, p); p.x = c.x; p.y = c.y;
    for (let y = Math.max(0, Math.floor(c.y - kr)); y <= Math.min(H - 1, Math.ceil(c.y + kr)); y++) for (let x = Math.max(0, Math.floor(c.x - kr)); x <= Math.min(W - 1, Math.ceil(c.x + kr)); x++) if (Math.hypot(x - c.x, y - c.y) <= kr) { const i = y * W + x; p.seen[i] = 1; if (s.seenAt[i] < 0) { s.seenAt[i] = 0; s.seenBy[i] = -1; s.discovered++; } }
    for (const q of s.patches) if (Math.hypot(q.x - c.x, q.y - c.y) <= kr) p.places[q.id] = { exp: q.stock, t: 0, u: q.stock, n: 1 };
    for (const w of s.waters) if (Math.hypot(w.x - c.x, w.y - c.y) <= kr) p.waters[w.id] = { active: w.active, t: 0, dryOk: w.id === c.water };
  }
  // Arriving with know-how: about half the grown-ups of 25 and over know how to knap flint, point a stick, make fire
  // and cook (practised skill), and carry a flake, a stick and dry grass; some a spear. Children learn by being shown.
  if (cfg.startKnowledge === 'basic') for (const p of s.people) if (p.body.age >= 25 && draw(s, p.id, SALT.setupKnow, 0) < 0.5) {
    for (const k of ['make:strike:cobble+flint', 'make:cut:flake+stick', 'make:rub:stick+stick', 'cook']) practise(s, p, k, 40);
    p.items = ['flake', 'stick', 'tinder', ...(draw(s, p.id, SALT.setupSpear, 0) < 0.5 ? ['spear'] : [])];
  }
  refreshCarers(s);
  event(s, `The island begins. ${s.people.length} people in ${cfg.bands} bands of ${cfg.families} families, each camped at its own water. Everything beyond a few km of each camp is unknown.`);
  return s;
}
// Spatial index of food patches (not saved).
function attachIndex(s) {
  const cell = 8, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), grid = Array.from({ length: cols * rows }, () => []);
  for (const q of s.patches) grid[Math.floor(q.y / cell) * cols + Math.floor(q.x / cell)].push(q);
  Object.defineProperty(s, 'patchIndex', { enumerable: false, configurable: true, value: (x, y, r) => {
    const out = [];
    for (let cy = Math.max(0, Math.floor((y - r) / cell)); cy <= Math.min(rows - 1, Math.floor((y + r) / cell)); cy++)
      for (let cx = Math.max(0, Math.floor((x - r) / cell)); cx <= Math.min(cols - 1, Math.floor((x + r) / cell)); cx++)
        for (const q of grid[cy * cols + cx]) if (Math.abs(q.x - x) + Math.abs(q.y - y) <= r) out.push(q);
    return out;
  } });
  Object.defineProperty(s, 'carer', { enumerable: false, configurable: true, writable: true, value: new Map() });
}
function refreshCarers(s) { s.carer = new Map(); s.youngBy = new Map(); for (const p of living(s)) { const c = carerOf(s, p); if (c) { s.carer.set(p.id, c); if (!s.youngBy.has(c.id)) s.youngBy.set(c.id, []); s.youngBy.get(c.id).push(p); } } }

// Siler hazard (per year) and its integral from 0 to x.
export const siler = (S, x) => S.a1 * Math.exp(-S.b1 * x) + S.a2 + S.a3 * Math.exp(S.b3 * x);
const silerCum = (S, x) => S.a1 / S.b1 * (1 - Math.exp(-S.b1 * x)) + S.a2 * x + S.a3 / S.b3 * (Math.exp(S.b3 * x) - 1);

// What a person expects to find at a place: what they last saw, recovering toward its usual level since then at the
// rate such food comes back (people learn how fast things regrow by living with them).
// The usual level follows the season of that food (people know when baobab or berries are in).
// People do not know a place's true size, season or regrowth. They hold beliefs built from what they have seen:
//   u      the place's usual stock: the average of what they found there on close looks
//   n      how many close looks (their certainty)
//   tau    for each kind of food, how many days it takes to come back, learned from going back to the same place
//          (prior 60 days, weight 1, updated in log space), and
//   month  for each kind, how full places of that kind were in each month compared with their usual (prior 1).
const MONTH = s => Math.floor(realFrac(s) * 12);
function beliefOf(p, food) { return (p.foodBelief ??= {})[food] ??= { tau: 60, w: 1, month: Array(12).fill(1) }; }
function observe(s, p, q, stock) {
  const k = p.places[q.id], b = beliefOf(p, q.food), C = clockOf(s);
  if (k && k.n > 0 && k.u > 0) {
    // regrowth: what was left, what is there now, against the usual level -> an implied recovery time
    const days = (s.tick - k.t) * C.hours / 24, f = (k.u - stock) / (k.u - k.exp);
    if (days > 1 && k.u > k.exp && f > 0.05 && f < 0.95) { const tauObs = Math.min(2000, Math.max(1, days / -Math.log(f))), lw = Math.log(b.tau) * b.w + Math.log(tauObs); b.w = Math.min(20, b.w + 1); b.tau = Math.exp(lw / b.w); }
    const m = MONTH(s); b.month[m] += (stock / Math.max(1e-9, k.u) - b.month[m]) * 0.2;
  }
  const n = (k?.n ?? 0) + 1, u = k?.u ? k.u + (stock - k.u) / Math.min(n, 10) : stock;
  p.places[q.id] = { exp: stock, t: s.tick, u, n };
}
function expected(s, p, q, k) {
  const b = beliefOf(p, q.food), usual = (k.u ?? k.exp) * b.month[MONTH(s)], days = (s.tick - k.t) * clockOf(s).hours / 24;
  return Math.max(0, usual - (usual - k.exp) * Math.exp(-days / b.tau));
}

// ---------- choosing ----------
// What the household is short of, in kcal: each member's empty short-term store and half a day ahead, less food at camp.
function householdShort(s, p) {
  const h = s.households[p.household]; if (!h) return p.hunger / p.body.hpk;
  let k = 0, coming = 0;
  for (const i of h.members) {
    const q = s.people[i]; if (!q.alive) continue;
    k += q.hunger / q.body.hpk + q.body.base / 2;
    if (q !== p) coming += q.carry + [q.step, ...q.plan].reduce((n, x) => n + (x?.k === 'gather' ? x.want : 0), 0); // food already on its way home
  }
  return Math.max(0, k - h.pool - coming);
}
const householdDay = (s, p) => { const h = s.households[p.household]; return h ? h.members.reduce((n, i) => n + (s.people[i].alive ? s.people[i].body.base : 0), 0) : p.body.base; };
const atCamp = (s, p) => { const c = campOf(s, p); return Math.abs(p.x - c.x) + Math.abs(p.y - c.y) <= 1; };
const maxTripKm = a => a < 5 ? 0 : a < 10 ? 2 : a < 14 ? 5 : 15; // how far children range from camp (Hadza children forage near camp)
const hoursTo = (s, p, x, y) => { const d = fieldDist(p.x, p.y, x, y, false, mapOf(s)); return d < 0 ? Infinity : d / p.body.tilesTick * clockOf(s).hours; };

function options(s, p) {
  const C = clockOf(s), a = p.body.age, hour = hourOf(C, s.tick), night = sleepTime(C, s.tick), opts = [];
  const young = youngOf(s, p), thirst = young.reduce((m, k) => Math.max(m, k.thirst), p.thirst) / 100;
  const tired = (100 - p.energy) / 100, home = atCamp(s, p), camp = campOf(s, p), band = bandOf(s, p);
  const homeH = home ? 0 : hoursTo(s, p, camp.x, camp.y);
  // the drive to stay alive: as body fat runs low (one's own, or a child's one is looking after) getting food
  // overrides tiredness and comfort, and people look further afield for it (survival before pleasure)
  const drive = survivalDrive(p, young);
  // how far one has already walked today: a new trip that would take the day past about 35 km is not set out on
  // (forager day ranges rarely pass 30 km; going home or to water is always possible)
  const kmLeft = R('dayKmMax') - (p.tiles - (p.tilesAtDay ?? p.tiles)) * T.TILE_KM;
  // sleep
  if (night) opts.push({ k: 'sleep', u: 2.5 + tired, why: 'night' });
  else opts.push({ k: 'rest', u: tired * tired * 3 - 0.2 - (p.energy > 15 ? R('wRestDrive') * drive : 0), why: `tired ${Math.round(tired * 100)}` });
  // water
  let best = null, bm = Infinity;
  for (const id in p.waters) { if (!p.waters[id].active) continue; const wt = s.waterById.get(id), md = Math.abs(wt.x - p.x) + Math.abs(wt.y - p.y); if (md < bm) { bm = md; best = wt; } } // nearest by straight-line first
  if (best) best = { w: best, hrs: hoursTo(s, p, best.x, best.y) };
  if (best && !night) opts.push({ k: 'drink', w: best.w, u: 3 * thirst ** 1.5 - best.hrs * 0.15, why: `thirst ${Math.round(thirst * 100)}, ${best.w.name.toLowerCase()} ${best.hrs.toFixed(1)} h away` });
  // food: net kcal per hour of the whole trip, against what the household is short of
  if (!night && a >= 5) {
    const short = a < 14 ? p.hunger / p.body.hpk : householdShort(s, p), day = a < 14 ? p.body.base : householdDay(s, p);
    const urgency = Math.min(2, short / Math.max(1, day)) + R('forageBase'); // foragers go out most days even when not short
    const range = maxTripKm(a) / T.TILE_KM;
    // the places worth thinking about today: refreshed once a day or when camp moves (people do not weigh every
    // place they have ever heard of before each step)
    const dayNo = Math.floor(s.tick / clockOf(s).day);
    if (!p.cand || p.cand.day !== dayNo || p.cand.camp !== camp.water) {
      const list = [];
      for (const id in p.places) { const q = s.patchById.get(id), md = Math.abs(q.x - camp.x) + Math.abs(q.y - camp.y); if (md > range * 1.05) continue; const e = expected(s, p, q, p.places[id]); if (e * 500 >= 1000) list.push({ id, v: e / (1 + md) }); }
      list.sort((x, y) => y.v - x.v); p.cand = { day: dayNo, camp: camp.water, ids: list.slice(0, 15).map(x => x.id) };
    }
    for (const id of p.cand.ids) {
      const k0 = p.places[id], q = s.patchById.get(id); if (!k0) continue;
      const k = { exp: expected(s, p, q, k0) };
      if (k.exp * 500 < 1000) continue; // exp is in food units (500 kcal)
      const out = hoursTo(s, p, q.x, q.y), back = fieldDist(q.x, q.y, camp.x, camp.y, false, mapOf(s)) / p.body.tilesTick * C.hours;
      if (!isFinite(out) || (out + back) * p.body.kmh / 2 > maxTripKm(a) || (out + back) * p.body.kmh > kmLeft) continue;
      // central-place foraging: an adult who goes out brings back a full load if the patch has it (load-size theory,
      // Orians and Pearson 1979); a child gathers for itself
      const rate = returnRate(q.food, a, p.skills[q.id] ?? 0), want = Math.min(a < 14 ? Math.max(500, short) : p.body.carryKcal, k.exp * 500);
      const hrs = out + want / rate + back, walk = (out + back) * p.body.tilesTick / C.hours * p.body.cotTile * p.body.mass;
      const net = (want - walk) / hrs, late = hour + hrs > 19 ? (hour + hrs - 19) * 0.25 : 0;
      opts.push({ k: 'forage', q, want, u: urgency * net / 1000 + (net > 0 ? R('wDrive') * drive : 0) - late - p.mind.caution * Math.max(0, out - 3) * 0.05, why: `${q.name.toLowerCase()} ${out.toFixed(1)} h away, about ${Math.round(net)} kcal an hour after walking` });
    }
  }
  // meat: going after animals, and carcasses one knows of (one's own kill, one seen from the vultures, or told)
  if (!night && a >= 14) {
    const short = householdShort(s, p), day = householdDay(s, p), urgency = Math.min(2, short / Math.max(1, day)) + R('forageBase');
    const walkH = p.body.cotTile * p.body.mass * p.body.kmh * R('stalkPace') / T.TILE_KM; // kcal an hour stalking
    if (hour < 12 && kmLeft > 20) {
      const rate = huntRate(p), net = rate - walkH;
      // motives: survival (the drive), success (ambition: meat is shared and brings standing, as Hawkes argues for Hadza
      // men), and caution against the risk of the chase. Weights approx.; what hunting returns is learned, not given.
      opts.push({ k: 'hunt', u: urgency * net / 1000 + (net > 0 ? R('wDrive') * drive : 0) + R('wAmbition') * p.mind.ambition - R('wCaution') * p.mind.caution, why: `hunting: I expect about ${Math.round(net)} kcal an hour${p.hunt.hours < 1 ? ' (never tried)' : ''}` });
    }
    for (const id in p.carcasses) {
      const c = s.carcasses.find(k => k.id === +id); if (!c) continue;
      const out = hoursTo(s, p, c.x, c.y), back = fieldDist(c.x, c.y, camp.x, camp.y, false, mapOf(s)) / p.body.tilesTick * C.hours;
      if (!isFinite(out) || s.tick + out * C.perHour > c.until || (out + back) * p.body.kmh / 2 > maxTripKm(a) || (out + back) * p.body.kmh > kmLeft) continue; // within a day's reach, before it rots
      const want = Math.min(meatAvail(p, c), meatCarry(p)); if (want < 300) continue;
      const hrs = out + 0.5 + back, net = (want - (out + back) * p.body.kmh / T.TILE_KM * p.body.cotTile * p.body.mass) / hrs;
      opts.push({ k: 'fetch', c, u: urgency * net / 1000 + (net > 0 ? R('wDrive') * drive : 0) + 0.2 - 0.5 * R('wCaution') * p.mind.caution, why: `meat: a ${N.SPECIES[c.species].label} carcass ${out.toFixed(1)} h away` });
    }
  }
  // explore: curiosity, more when what is known is poor
  if (!night && a >= 12 && hour < 15 && kmLeft > 15) {
    const bestFood = opts.filter(o => o.k === 'forage').reduce((m, o) => Math.max(m, o.u), 0);
    // worth more when what they know is poor or far: long days of walking, or little worth going for
    // (how far the food trips have to go, not how far people walk in all, or exploring would feed on itself)
    const far = Math.min(1, Math.max(0, ((band.tripKm ?? 3) - 4) / 4));
    const seek = bestFood < 0.5 ? R('wSeek') * drive : 0; // nothing worth going for nearby and going hungry: look for new sources
    opts.push({ k: 'explore', u: p.mind.curiosity * (p.energy / 100) * (0.3 + 0.4 * Math.max(0, 0.5 - bestFood) + 0.6 * far) + seek, why: seek > 0.3 ? 'hungry, looking for new food' : `curiosity ${Math.round(p.mind.curiosity * 100)}${far > 0.2 ? ', the known places are far' : ''}` });
  }
  // camp: being with others, caring for the young, going home in the evening
  // trying things with what one has picked up: curiosity, when well fed and with time on one's hands (a full belly
  // leaves room for play; hunger narrows the mind to food). What works is found by trying, by chance.
  if (home && !night && a >= 8 && p.items.length) opts.push({ k: 'tinker', u: (R('tinkerBase') + R('tinkerCurious') * p.mind.curiosity) * (1 - drive) * (p.energy / 100) + (knownRecipes(p).some(k => !p.items.includes(productOf(k))) ? 0.2 : 0), why: knownRecipes(p).length ? `making things: I know how to ${knownRecipes(p).map(recipeName).join(', ')}` : 'trying things with what I have picked up' });
  if (home) opts.push({ k: 'camp', u: 0.25 + 0.25 * p.mind.social + (young.length ? 0.15 * p.mind.care : 0), why: 'at camp with the others' });
  else { const cw = s.waterById.get(camp.water), water = cw.active ? 3 * thirst ** 1.5 : 0; // camp has water: thirst draws people home too
    opts.push({ k: 'home', u: (hour >= 17 ? 1.5 : 0.2) + (p.carry > 0 ? 0.6 : 0) + water - homeH * 0.05, why: `camp ${homeH.toFixed(1)} h away${water > 0.5 ? ', and there is water there' : ''}` }); }
  return opts;
}

// The inner voice: the motives behind a choice, in words (what the numbers in options() stand for). Survival first
// when the body runs thin or thirst is high; pleasure (rest, company, play) when fed; success (standing) in the
// ambitious; risk taken more readily when hungry (the energy-budget rule) and by the less cautious.
function innerVoice(s, p, o) {
  const young = youngOf(s, p), drive = survivalDrive(p, young), thirst = young.reduce((m, k) => Math.max(m, k.thirst), p.thirst), out = [];
  if (drive > 0.5) out.push(young.some(k => survivalDrive(k) > 0.5) ? 'The child is getting thin; food comes before anything.' : 'I am getting thin; food comes before anything.');
  else if (drive > 0) out.push('Thinner than I would like.');
  if (thirst >= 60) out.push('Thirsty.');
  const bold = (1 - p.mind.caution) + drive;
  const why = {
    hunt: `${drive > 0.3 ? 'Meat would fill us. ' : ''}${p.mind.ambition > 0.6 ? 'A kill is shared and talked about. ' : ''}${bold > 0.8 ? 'Worth the risk.' : 'Risky, but worth a try.'}`,
    fetch: 'There is meat lying out there; better us than the hyenas.',
    forage: drive > 0 ? 'Go where food is surest.' : 'Bring in a load for the household.',
    explore: drive > 0.3 ? 'What we know is not enough; look further.' : 'I want to see what is out there.',
    tinker: 'Fed and rested: time to try things.',
    rest: drive > 0 ? 'Too worn out to go on.' : 'Rest while I can.',
    camp: 'Stay with the others.', sleep: 'Night.', drink: 'Water first.', home: 'Time to go back to camp.',
  }[o.k];
  if (why) out.push(why);
  return out.join(' ');
}
function decide(s, p) {
  const opts = options(s, p), T0 = s.config.choiceTemperature, mx = Math.max(...opts.map(o => o.u));
  const w = opts.map(o => Math.exp((o.u - mx) / T0)), tot = w.reduce((a, b) => a + b, 0);
  let r = draw(s, p.id, SALT.choice) * tot, o = opts[opts.length - 1];
  for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) { o = opts[i]; break; } }
  p.decision = { t: s.tick, chose: o.k, why: o.why, thought: innerVoice(s, p, o), options: opts.map(x => ({ k: x.k, u: Math.round(x.u * 100) / 100, why: x.why })).sort((a, b) => b.u - a.u).slice(0, 6) };
  const C = clockOf(s), cp = campOf(s, p), camp = [cp.x, cp.y], band = bandOf(s, p);
  if (o.k === 'sleep') { if (!atCamp(s, p) && hoursTo(s, p, ...camp) <= 1.5) p.plan = [{ k: 'walk', to: camp }, { k: 'sleep' }]; else p.plan = [{ k: 'sleep' }]; }
  else if (o.k === 'rest') p.plan = [{ k: 'rest', left: C.perHour }];
  else if (o.k === 'drink') p.plan = [{ k: 'walk', to: [o.w.x, o.w.y] }, { k: 'drink', w: o.w, left: 0.25 * C.perHour }];
  else if (o.k === 'forage') {
    const d = fieldDist(o.q.x, o.q.y, cp.x, cp.y, false, mapOf(s)) * T.TILE_KM; if (d >= 0) band.tripKm = band.tripKm === undefined ? d : band.tripKm + (d - band.tripKm) / 30; // how far food trips go (a running average)
    p.plan = [{ k: 'walk', to: [o.q.x, o.q.y] }, { k: 'gather', q: o.q, want: o.want }, { k: 'walk', to: camp }, { k: 'unload' }];
  }
  else if (o.k === 'explore') { const t = exploreTarget(s, p); p.plan = t ? [{ k: 'walk', to: t, explore: true }, { k: 'walk', to: camp }] : [{ k: 'camp', left: C.perHour }]; }
  else if (o.k === 'home') p.plan = [{ k: 'walk', to: camp }, { k: 'unload' }];
  else if (o.k === 'hunt') { const t = huntTarget(s, p); s.hunting.trips++; p.plan = [...(t ? [{ k: 'walk', to: t }] : []), { k: 'hunt', left: Math.min(R('huntHoursMax'), Math.max(1, 16 - hourOf(C, s.tick))) * C.perHour, kcal0: 0 }, { k: 'walk', to: camp }, { k: 'unload' }]; }
  else if (o.k === 'tinker') p.plan = [{ k: 'tinker', left: C.perHour }];
  else if (o.k === 'fetch') p.plan = [{ k: 'walk', to: [o.c.x, o.c.y] }, { k: 'butcher', c: o.c.id, left: 0.5 * C.perHour }, { k: 'walk', to: camp }, { k: 'unload' }];
  else p.plan = [{ k: 'camp', left: 2 * C.perHour }];
  p.step = null;
}
function exploreTarget(s, p) {
  const C = clockOf(s), reach = Math.min(maxTripKm(p.body.age), 3 * EN.speedKmH(p.body.mass)) / T.TILE_KM / 2; // out and back within the day
  let best = null, bs = -Infinity;
  for (let i = 0; i < 16; i++) {
    const ang = draw(s, p.id, SALT.explore, s.tick * 16 + i) * Math.PI * 2, rr = reach * (0.4 + 0.6 * draw(s, p.id, SALT.exploreAlt, s.tick * 16 + i));
    const c = campOf(s, p), x = Math.round(c.x + Math.cos(ang) * rr), y = Math.round(c.y + Math.sin(ang) * rr);
    if (!T.isWalkable(x, y)) continue;
    let unseen = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && !p.seen[yy * W + xx]) unseen++; }
    if (unseen > bs) { bs = unseen; best = [x, y]; }
  }
  return best && bs > 0 ? best : null;
}

// ---------- acting: each hour is spent in full (as in eden.js actReal) ----------
function act(s, p) {
  const C = clockOf(s); let budget = 1;
  for (let guard = 0; budget > 1e-9 && p.alive && guard < 12; guard++) {
    if (!p.step) { if (!p.plan.length) decide(s, p); p.step = p.plan.shift(); if (!p.step) break; }
    const st = p.step;
    if (st.k === 'walk') { budget = walk(s, p, st, budget); if (!st.route?.length && st.arrived) p.step = null; continue; }
    if (st.k === 'sleep') { const u = budget; p.times.sleep += u; budget = 0; if (!sleepTime(C, s.tick + 1)) p.step = null; continue; }
    if (st.k === 'unload') { unload(s, p); p.step = null; continue; }
    if (st.k === 'hunt') { const u = Math.min(budget, Math.max(0, st.left)); budget -= u; st.left -= u; st.spent = (st.spent ?? 0) + u * clockOf(s).hours; p.hunt.hours += u * clockOf(s).hours; s.hunting.tripHours += u * clockOf(s).hours; p.times.hunt += u; huntHour(s, p, st, u); if (st.left <= 1e-9 || st.done) { huntEnd(s, p, st); p.step = null; } continue; }
    if (st.k === 'tinker') { const u = Math.min(budget, Math.max(0, st.left)); budget -= u; st.left -= u; p.times.camp += u; if (st.left <= 1e-9) { tinker(s, p); p.step = null; } continue; }
    if (st.k === 'butcher') { const u = Math.min(budget, Math.max(0, st.left)); budget -= u; st.left -= u; p.times.gather += u; if (st.left <= 1e-9) { butcher(s, p, s.carcasses.find(k => k.id === st.c)); p.step = null; } continue; }
    if (st.k === 'gather' && st.left === undefined) {
      const rate = returnRate(st.q.food, p.body.age, p.skills[st.q.id] ?? 0);
      st.left = Math.max(0.25 * C.perHour, st.want / rate * C.perHour); st.hours = st.left * C.hours;
    }
    const u = Math.min(budget, Math.max(0, st.left)); budget -= u; st.left -= u;
    p.times[st.k === 'gather' ? 'gather' : st.k === 'drink' ? 'drink' : st.k === 'rest' ? 'rest' : 'camp'] += u;
    if (st.k === 'camp') campTime(s, p);
    if (st.left <= 1e-9) { if (st.k === 'gather') gatherDone(s, p, st); if (st.k === 'drink') { drink(p); for (const k of youngOf(s, p)) drink(k); note(s, p, `Drank at ${st.w.name.toLowerCase()}.`); } p.step = null; }
  }
}
// ---------- meat ----------
// What a person expects hunting to return (kcal an hour): their own record, what they have heard, and a modest
// guess for the untried (approx.). It is learned, so who hunts, and how much, comes from what happens.
const huntRate = p => { const h = p.hunt, hd = p.huntHeard ?? { kcal: 0, hours: 0 }; return (h.kcal + 0.3 * hd.kcal + R('huntPriorKcal')) / (h.hours + 0.3 * hd.hours + R('huntPriorHours')); };
const meatCarry = p => Math.min(R('meatLoadKg'), (p.body.age >= 14 ? 0.3 : 0.15) * p.body.mass) * N.MEAT.kcalPerKg; // a load of meat: up to about 25 kg
const hasEdge = p => p.items.some(i => i === 'flake' || i === 'chopper'), hasStone = p => p.items.some(i => i === 'cobble' || i === 'flint');
const meatAvail = (p, c) => Math.max(0, Math.min(c.kcal, c.kcal0 * N.access(hasEdge(p), hasStone(p)) - c.taken));
const weaponOf = p => p.items.includes('spear') ? 'spear' : p.items.includes('stick') ? 'stick' : hasStone(p) ? 'stone' : 'hands';
// where to look for game: a place they have seen, in bush or grass, within half a day's walk (a chance pick)
function huntTarget(s, p) {
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
function huntHour(s, p, st, u) {
  const C = clockOf(s), B = body(s), young = youngOf(s, p), load = young.filter(k => EN.carried(k.body.age)).reduce((n, k) => n + k.body.mass, 0) + p.carry / 2000;
  const tiles = Math.max(1, Math.round(p.body.kmh * R('stalkPace') * u * C.hours / T.TILE_KM)); // stalking: slow, with long pauses (approx. 1-1.5 km an hour)
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
  const kcal = N.carcassKcal(best.id), c = { id: s.nextId++, species: best.id, x: p.x, y: p.y, kcal, kcal0: kcal, taken: 0, until: s.tick + C.day, natural: false, roasted: false, by: p.id };
  s.carcasses.push(c); N.book(s, 'made', kcal); p.carcasses[c.id] = 1;
  s.hunting.kills[best.id] = (s.hunting.kills[best.id] ?? 0) + 1; if (sp.mass >= N.LARGE) s.hunting.largeKills++;
  const ag = p.body.age < 20 ? '14-19' : p.body.age < 40 ? '20-39' : '40+'; (s.hunting.byAge[p.sex + ag] ??= { kills: 0, kcal: 0 }).kills++;
  event(s, `${p.name} killed a ${sp.label}.`); note(s, p, `Killed a ${sp.label} with ${weaponOf(p) === 'hands' ? 'bare hands' : 'a ' + weaponOf(p)}.`);
  const before = p.carry, ate = s.energyLedger?.eaten ?? 0; butcher(s, p, c); const got = p.carry - before + (s.energyLedger.eaten - ate); st.kcal0 += got; p.hunt.kcal += got; st.done = true;
}
function huntEnd(s, p, st) {
  if (!(st.kcal0 > 0)) note(s, p, 'Came back from hunting with nothing.');
}
// ---------- things, know-how, fire ----------
// Picking up what lies to hand: a stick, a stone, dry grass. A chance, more for the curious; at most four things.
function pickUp(s, p, base = R('pickupBase')) {
  if (p.body.age < 5 || p.items.length >= 4) return;
  for (const m of N.materialsAt(p.x, p.y)) { if (p.items.includes(m)) continue; if (draw(s, p.id, SALT.pickup, s.tick) < base * (0.5 + p.mind.curiosity)) { p.items.push(m); note(s, p, `Picked up ${N.MATERIAL[m].label === 'dry grass' ? 'some dry grass' : 'a ' + N.MATERIAL[m].label}.`); } return; }
}
// A recipe is what someone has found works: an action on two things (strike flint with cobble). It is known while its
// skill lasts (unused skills fade), passed on by showing, and lost when no one who knows it is left.
const recipeKey = (verb, a, b) => `make:${verb}:${[a, b].sort().join('+')}`;
const knownRecipes = p => Object.keys(p.skills).filter(k => k.startsWith('make:') && p.skills[k] >= 0.03);
const productOf = k => ({ 'make:strike:cobble+flint': 'flake', 'make:strike:flint+flint': 'flake', 'make:strike:cobble+cobble': 'chopper' }[k] ?? (k.startsWith('make:cut:') ? 'spear' : k.startsWith('make:rub:') ? 'fire' : '?')); // what a known recipe gives (for wanting it)
const recipeName = k => { const [, v, ab] = k.split(':'); return `${v} ${ab.replace('+', ' with ')}`; };
// An hour of trying: mostly the things one knows work, otherwise two things at random with a random action. The result
// comes from the laws of the materials (nature.js), not from a list of inventions.
function tinker(s, p) {
  const r = i => draw(s, p.id, SALT.tinker, s.tick * 8 + i), known = knownRecipes(p).filter(k => { const [, , ab] = k.split(':'); return ab.split('+').every(x => p.items.includes(x)); });
  let verb, a, b;
  if (known.length && r(0) < 0.8) { const k = known[Math.floor(r(1) * known.length)], [, v, ab] = k.split(':'); verb = v; [a, b] = ab.split('+'); }
  else { if (p.items.length < 2) return; verb = N.VERBS[Math.floor(r(2) * N.VERBS.length)]; const i = Math.floor(r(3) * p.items.length); let j = Math.floor(r(4) * (p.items.length - 1)); if (j >= i) j++; a = p.items[i]; b = p.items[j]; }
  const key = recipeKey(verb, a, b), skill = p.skills[key] ?? 0, res = N.law(s, verb, a, b, skill, r(5));
  if (!res) { if (skill > 0) practise(s, p, key, 0.25); return; }
  practise(s, p, key, 1);
  const first = !s.firsts[res.made]; if (first) { s.firsts[res.made] = { t: s.tick, by: p.name }; event(s, `${p.name} ${res.note} (the first time anyone has).`); }
  note(s, p, `${res.note[0].toUpperCase()}${res.note.slice(1)}.`);
  if (res.made === 'ember') {
    const b0 = bandOf(s, p);
    if (p.items.includes('tinder')) { p.items.splice(p.items.indexOf('tinder'), 1); lightFire(s, b0, p); }
    else note(s, p, 'The ember died: nothing dry to catch it.');
    return;
  }
  if (res.made === 'spear') p.items.splice(p.items.indexOf('stick'), 1);
  if (!p.items.includes(res.made)) { s.made[res.made] = (s.made[res.made] ?? 0) + 1; if (p.items.length >= 4) p.items.shift(); p.items.push(res.made); }
}
function lightFire(s, b, p) {
  const was = b.fire?.fuel > 0; b.fire = { fuel: Math.max(b.fire?.fuel ?? 0, N.FIRE.startFuel), lit: s.tick };
  if (!was) { event(s, `${bandName(s, b)} has a fire at camp, lit by ${p.name}.`); s.made.fire = (s.made.fire ?? 0) + 1; }
}
// Each hour a camp fire burns its fuel; people at camp put on wood when there is wood near (a chance each hour, more
// from the careful); rain in the wet season can put it out.
function fireHour(s) {
  const C = clockOf(s);
  for (const b of s.bands) {
    if (b.ended || !(b.fire?.fuel > 0)) continue;
    b.fire.fuel -= (sleepTime(C, s.tick) ? R('fireBanked') : 1) * R('fireBurnKgH') * C.hours; // banked at night it smoulders (approx.)
    b.fire.hours = (b.fire.hours ?? 0) + C.hours;
    const near = b.fire.near ??= (() => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (T.isWalkable(b.camp.x + dx, b.camp.y + dy) && N.materialsAt(b.camp.x + dx, b.camp.y + dy).includes('stick')) return true; return false; })(); // dead wood within about a kilometre
    const tenders = bandMembers(s, b).filter(q => q.body.age >= 8 && atCamp(s, q) && q.step?.k !== 'sleep');
    for (const q of tenders) if (near && draw(s, q.id, SALT.fireTend, s.tick) < R('fireTend') * (0.5 + q.mind.care)) { b.fire.fuel += N.FIRE.fuelPerStick; if (b.fire.fuel > 4) break; }
    // finding out about cooking: food dropped by the fire comes out softer; someone may notice (a chance an hour)
    for (const q of tenders) if (!(q.skills.cook >= 0.03) && draw(s, q.id, SALT.cookFind, s.tick) < R('cookFindHour') * q.mind.curiosity) { practise(s, q, 'cook', 1); if (!s.firsts.cook) { s.firsts.cook = { t: s.tick, by: q.name }; event(s, `${q.name} found that food put by the fire is softer and goes further.`); } }
    if (N.moisture(s) > 0.15 && draw(s, b.id, SALT.fireRain, s.tick) < R('fireRainOut')) b.fire.fuel = 0;
    if (b.fire.fuel <= 0) { b.fire = null; event(s, `The fire at ${bandName(s, b)}'s camp went out.`); }
  }
}
// Food at camp with a fire: someone who knows to put it by the fire gets more from it (cooking; gain approx.).
function cooked(s, h, q, g) {
  const b = s.bands[h.band]; if (!(b?.fire?.fuel > 0) || g <= 0) return;
  if (!h.members.some(i => s.people[i].alive && (s.people[i].skills.cook ?? 0) >= 0.03)) return;
  const extra = g * R('cookGain'); eatKcal(s, q, extra); s.ledger.cookGain += extra;
}
// Cooks keep their skill by using it each day there is a fire at camp.
function fireDay(s) {
  for (const q of living(s)) if (q.skills.cook >= 0.03 && atCamp(s, q) && bandOf(s, q).fire?.fuel > 0) practise(s, q, 'cook', 0.5);
}
// Taking meat from a carcass: eat what one is short of, feed the young along, carry a load home.
function butcher(s, p, c) {
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
function spotCarcasses(s, p) {
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
function believedPath(s, p, tx, ty) {
  const N = W * H, prev = new Int32Array(N).fill(-2), q = new Int32Array(N), start = p.y * W + p.x, end = ty * W + tx;
  const ok = i => { const x = i % W, y = (i / W) | 0; return p.seen[i] ? T.isWalkable(x, y) : true; };
  let h = 0, n = 0; q[n++] = start; prev[start] = -1;
  while (h < n) { const i = q[h++]; if (i === end) break; const x = i % W, y = (i / W) | 0;
    // neighbours ordered toward the target so ties run straight at it
    const nb = [[x + Math.sign(tx - x), y], [x, y + Math.sign(ty - y)], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [a, b] of nb) { if (a < 0 || b < 0 || a >= W || b >= H) continue; const j = b * W + a; if (prev[j] !== -2 || !ok(j)) continue; prev[j] = i; q[n++] = j; } }
  if (prev[end] === -2) return null;
  const out = []; for (let i = end; prev[i] !== -1; i = prev[i]) out.push([i % W, (i / W) | 0]); return out.reverse();
}
function walk(s, p, st, budget) {
  const m = mapOf(s);
  if (!st.route) { st.route = st.explore ? path(p.x, p.y, st.to[0], st.to[1], false, m) : fieldPath(p.x, p.y, st.to[0], st.to[1], false, m); if (st.route.some(([x, y]) => !p.seen[y * W + x])) { st.route = believedPath(s, p, st.to[0], st.to[1]) ?? st.route; st.guess = true; } if (s.diag) { let u = 0; for (const [x, y] of st.route) if (!p.seen[y * W + x]) u++; s.diag.routes.push({ id: p.id, day: Math.floor(s.tick / clockOf(s).day), k: p.decision?.chose ?? st.k, explore: !!st.explore, len: st.route.length, unseen: u }); } if (!st.route.length) { st.arrived = true; return budget; } }
  const C = clockOf(s), B = body(s), v = p.body.tilesTick * (isNight(C, s.tick) ? B.nightPace : 1);
  const young = youngOf(s, p), load = young.filter(k => EN.carried(k.body.age)).reduce((n, k) => n + k.body.mass, 0) + p.carry / 2000, walkers = young.filter(k => !EN.carried(k.body.age));
  p.stride = (p.stride ?? 0) + v * budget; let moved = 0;
  while (p.stride >= 1 && st.route.length) {
    if (st.guess && !T.isWalkable(st.route[0][0], st.route[0][1])) { // the way they guessed is blocked: they see it now and pick another way
      st.replans = (st.replans ?? 0) + 1; p.seen[st.route[0][1] * W + st.route[0][0]] = 1;
      st.route = (st.replans < 60 && believedPath(s, p, st.to[0], st.to[1])) || fieldPath(p.x, p.y, st.to[0], st.to[1], false, m);
      if (st.replans === 1) note(s, p, 'The way was blocked; looked for another.');
      if (!st.route.length) break; continue;
    }
    p.stride -= 1; moved++; [p.x, p.y] = st.route.shift(); p.tiles++; if (s.diag) { const k = (st.explore ? 'explore' : p.decision?.chose) ?? '?'; (p.dayK ??= {})[k] = (p.dayK[k] ?? 0) + 1; }
    const kc = p.body.cotTile * (p.body.mass + load); burnKcal(s, p, kc); loseWater(s, p, kc);
    for (const k of walkers) { const kk = k.body.cotTile * k.body.mass; burnKcal(s, k, kk); loseWater(s, k, kk); }
    p.energy = clamp(p.energy - B.walkFatigueTile * (1 + load / p.body.mass));
    look(s, p);
  }
  for (const k of young) { k.x = p.x; k.y = p.y; for (const i of [p.y * W + p.x]) k.seen[i] = 1; }
  if (moved) { spotCarcasses(s, p); pickUp(s, p); }
  if (moved && draw(s, p.id, SALT.injury) < 1 - (1 - B.injuryPerTile * (isNight(C, s.tick) ? B.nightInjury : 1)) ** moved) { p.health = clamp(p.health - B.injuryDamage); note(s, p, 'Fell and was hurt.'); }
  const used = st.route.length ? budget : Math.min(budget, moved / v);
  p.times[st.explore ? 'explore' : 'walk'] += used;
  if (st.route.length) return 0;
  p.stride = 0; st.arrived = true; return budget - used;
}
// Gathering cut short (thirst, nightfall, the camp moving): what was gathered in the hours spent is kept.
// Food comes in as the hours pass, not only at the end of a trip.
function stopGather(s, p) {
  const st = p.step; if (!st || st.k !== 'gather' || st.left === undefined || !(st.hours > 0)) return;
  const done = 1 - Math.max(0, st.left) / (st.hours / clockOf(s).hours); if (done <= 0.01) return;
  gatherDone(s, p, { ...st, want: st.want * Math.min(1, done), hours: st.hours * done });
}
function gatherDone(s, p, st) {
  const q = st.q, B = body(s), takeUnits = Math.min(q.stock, st.want / B.unitKcal);
  q.stock -= takeUnits; s.ledger.consumed += takeUnits; p.gotKcal = (p.gotKcal ?? 0) + takeUnits * B.unitKcal;
  let kcal = takeUnits * B.unitKcal;
  // eat what you are short of on the spot, feed the young with you, carry the rest home
  for (const k of youngOf(s, p)) { const g = Math.min(kcal, k.hunger / k.body.hpk + Math.max(0, k.body.fatMax - k.reserve) / B.fatStoreEff); if (g > 0) { eatKcal(s, k, g); kcal -= g; } }
  const own = Math.min(kcal, p.hunger / p.body.hpk); eatKcal(s, p, own); kcal -= own;
  p.carry += kcal;
  if (takeUnits > 0) practise(s, p, q.id, st.hours ?? 1);
  observe(s, p, q, q.stock + takeUnits); p.places[q.id].exp = q.stock; // saw it before taking; left what remains
  note(s, p, takeUnits > 0.05 ? `Gathered ${Math.round(takeUnits * B.unitKcal)} kcal of ${q.name.toLowerCase()}.` : `Found the ${q.name.toLowerCase()} picked clean.`);
}
function unload(s, p) {
  if (p.brand && atCamp(s, p)) { p.brand = null; lightFire(s, bandOf(s, p), p); }
  if (p.carry <= 0) return;
  const h = s.households[p.household];
  if (h && atCamp(s, p)) { h.pool += p.carry; p.carry = 0; }
  else { eatKcal(s, p, p.carry); p.carry = 0; }
}
// At camp: anyone hungry eats from the household's food; the young are fed first (and get their growth).
function campTime(s, p) { const h = s.households[p.household]; if (h && h.pool > 0) feedFromPool(s, h); }
function feedFromPool(s, h) {
  const B = body(s), mem = h.members.map(i => s.people[i]).filter(q => q.alive && atCamp(s, q)).sort((a, b) => a.body.age - b.body.age);
  for (const q of mem) {
    // the young eat for growth too; adults eat when hungry and, when there is food, put fat back on (people fatten
    // in good times and lose it in lean ones)
    const room = Math.max(0, q.body.fatMax - q.reserve) / B.fatStoreEff;
    const want = q.body.age < 14 ? q.hunger / q.body.hpk + room : q.hunger > 25 ? q.hunger / q.body.hpk + Math.min(room, q.body.base * 0.5) : 0;
    let g = Math.min(h.pool, want); if (g > 0) { eatKcal(s, q, g); h.pool -= g; cooked(s, h, q, g); }
    // demand sharing (as among the Hadza): someone still hungry at camp asks other families of the same camp, kin
    // first. Each ask is a chance: a family gives what it does not need to eat now, more readily to kin, from a
    // caring giver, to a family that gave to it before, and less readily when the giver is hungry itself.
    if (want - g > 50 && (q.hunger > 50 || q.body.age < 14 || survivalDrive(q) > 0)) {
      const b = h.band, others = homes(s).filter(o => o !== h && o.band === b && o.pool > 0).map(o => ({ o, r: kinTo(s, q, o) })).sort((a, b2) => b2.r - a.r);
      let left = want - g;
      for (const { o, r } of others) {
        const keep = o.members.reduce((n, i) => { const m = s.people[i]; return n + (m.alive ? m.hunger / m.body.hpk : 0); }, 0), spare = Math.max(0, o.pool - keep);
        if (spare <= 0) continue;
        if (draw(s, q.id * 31 + o.id, SALT.share) > giveChance(s, o, h, r, survivalDrive(q))) { note(s, q, `Asked ${familyName(s, o)} for food and was refused.`); continue; }
        const take = Math.min(spare, left);
        eatKcal(s, q, take); o.pool -= take; left -= take; s.shared = (s.shared ?? 0) + take; gave(s, o, h, take); if (left <= 50) break;
      }
    }
  }
}
// Who gives: kinship (Hamilton's rule), the giver family's care, whether it has been given to by the asker's family
// (reciprocity), and how hungry the giver is. A chance between 2% and 98%.
const kinTo = (s, q, o) => Math.max(0, ...o.members.filter(i => s.people[i].alive).map(i => related(s, q, s.people[i])));
const familyName = (s, o) => { const a = o.members.map(i => s.people[i]).find(m => m.alive && m.body.age >= 16); return a ? `${a.name}'s family` : 'another family'; };
function giveChance(s, giverH, takerH, r, starving = 0) {
  const ad = giverH.members.map(i => s.people[i]).filter(m => m.alive && m.body.age >= 14);
  const care = ad.length ? ad.reduce((n, m) => n + m.mind.care, 0) / ad.length : 0.5, hunger = ad.length ? ad.reduce((n, m) => n + m.hunger, 0) / ad.length / 100 : 0;
  const RR = s.recip ??= {}, got = RR[`${takerH.id}>${giverH.id}`] ?? 0, given = RR[`${giverH.id}>${takerH.id}`] ?? 0, recip = Math.min(1, got / (given + 2000));
  return Math.min(0.98, Math.max(0.02, R('give0') + R('giveKin') * r + R('giveCare') * care + R('giveRecip') * recip - R('giveHunger') * hunger + R('giveStarving') * starving)); // a visibly starving asker is rarely refused (weights approx.)
}
const gave = (s, from, to, kcal) => { const RR = s.recip ??= {}; RR[`${from.id}>${to.id}`] = (RR[`${from.id}>${to.id}`] ?? 0) + kcal; };

// ---------- the evening at camp: sharing food and news ----------
// Relatedness r through recorded parents (two generations): parent-child and full siblings 1/2, grandparent and
// aunt or uncle 1/4, first cousins 1/8; partners count as 1/2 (shared children).
function related(s, a, b) {
  if (a === b) return 1; if (a.partner === b.id) return 0.5;
  const anc = (p, d) => { const out = new Map([[p.id, 1]]); let gen = [p]; for (let g = 0; g < d; g++) { const nx = []; for (const q of gen) for (const id of [q.mother, q.father]) if (id !== null && id !== undefined) { out.set(id, (out.get(id) ?? 0) + 0.5 ** (g + 1)); nx.push(s.people[id]); } gen = nx; } return out; };
  const A = anc(a, 2), Bm = anc(b, 2); let r = 0;
  for (const [id, wa] of A) if (Bm.has(id)) r += wa * Bm.get(id) * (id === a.id || id === b.id ? 1 : 0.5);
  return Math.min(0.5, r);
}
// Food at camp is shared (demand sharing, as among the Hadza): a household keeps what its members need to eat now;
// the rest goes to households whose members are hungry or thin, kin first, by Hamilton's rule: give while
// r x benefit to them > cost to you, with benefit and cost measured by how short each side is (with a floor of 1/4
// on r, since unrelated campmates also share).
function share(s) {
  const B = body(s), hs = homes(s);
  const keep = h => h.members.reduce((n, i) => { const q = s.people[i]; return n + (q.alive ? q.hunger / q.body.hpk : 0); }, 0);
  const short = h => h.members.reduce((n, i) => { const q = s.people[i]; return n + (q.alive ? q.hunger / q.body.hpk + Math.max(0, q.body.fatMax * 0.6 - q.reserve) / B.fatStoreEff : 0); }, 0);
  for (const g of hs) {
    let spare = g.pool - keep(g); if (spare <= 0) continue;
    const giver = s.people[g.members.find(i => s.people[i].alive)];
    const takers = hs.filter(h => h !== g && h.band === g.band).map(h => { const sh = Math.max(0, short(h) - h.pool), r = kinTo(s, giver, h); return { h, sh, r, w: sh * Math.max(0.25, r) }; }).filter(x => x.sh > 0).sort((a, b) => b.w - a.w);
    for (const t2 of takers) {
      if (spare <= 0) break;
      if (draw(s, g.id * 977 + t2.h.id, SALT.shareOffer) > giveChance(s, g, t2.h, t2.r)) continue; // offered or not: a chance
      const gv = Math.min(spare, t2.sh); t2.h.pool += gv; g.pool -= gv; spare -= gv; s.shared = (s.shared ?? 0) + gv; gave(s, g, t2.h, gv);
    }
  }
}
function evening(s) {
  const hs = homes(s);
  share(s);
  // news: people at the same camp tell what they know. A household member hears it more often than not (70% plus
  // the teller's sociability, a chance); up to three others hear it as often as the teller is sociable.
  const here = living(s).filter(p => atCamp(s, p) && p.body.age >= 5);
  const tell = (a, b) => {
    for (const id in a.places) { const k = a.places[id], kb = b.places[id]; if (!kb || kb.t < k.t) { if (!kb) note(s, b, `Heard from ${a.name} about ${s.patchById.get(id).name.toLowerCase()}.`); b.places[id] = { exp: k.exp, t: k.t, u: kb?.u || k.u, n: kb?.n ?? 0 }; } } // news, not their own looks
    for (const id in a.waters) { const k = a.waters[id], kb = b.waters[id]; if (!kb || kb.t < k.t) b.waters[id] = { active: k.active, t: k.t, dryOk: (kb?.dryOk ?? false) || !!k.dryOk }; }
    for (const id in a.carcasses) if (b.body.age >= 14 && !b.carcasses[id] && s.carcasses.some(c => c.id === +id)) b.carcasses[id] = 1; // where the meat is
    for (const k of [...knownRecipes(a), ...(a.skills.cook >= 0.03 ? ['cook'] : [])]) if (!((b.skills[k] ?? 0) >= 0.03) && b.body.age >= 5 && draw(s, a.id * 101 + b.id, SALT.showHow, s.tick) < R('showChance') + 0.2 * a.skills[k]) { practise(s, b, k, 1); note(s, b, `${a.name} showed how to ${k === 'cook' ? 'cook food by the fire' : recipeName(k)}.`); }
    if (a.hunt.hours > (b.huntHeard?.hours ?? 0)) b.huntHeard = { kcal: a.hunt.kcal, hours: a.hunt.hours }; // how hunting has gone for them
  };
  for (const a of here) {
    const b0 = bandOf(s, a);
    for (const b of here) if (b !== a && b.household === a.household && draw(s, a.id * 7 + b.id, SALT.talkHome) < 0.7 + 0.3 * a.mind.social) tell(a, b);
    const mates = here.filter(b => bandOf(s, b) === b0);
    for (let i = 0; i < 3; i++) { if (draw(s, a.id, SALT.talk, s.tick * 3 + i) > a.mind.social) continue; const b = mates[Math.floor(draw(s, a.id + 7919, SALT.talk, s.tick * 3 + i) * mates.length)]; if (b && b !== a) tell(a, b); }
  }
  for (const h of hs) { const keep = h.pool * Math.exp(-Math.LN2 / s.config.poolHalfLifeDays); s.ledger.poolSpoiled += h.pool - keep; h.pool = keep; } // camp food spoils (booked, kcal)
}

// ---------- moving camp ----------
// Once a month the band weighs its camp against the waters its members know: the food they know of within a
// day's reach (expected kcal, nearer counts more), with water that will last. It moves when another place is
// clearly better (Hadza camps move several times a year as food near camp runs down).
function campValue(s, w, knowledge) {
  let v = 0;
  for (const [id, exp] of knowledge) { const q = s.patchById.get(id), d = fieldDist(q.x, q.y, w.x, w.y, false, mapOf(s)); if (d >= 0 && d * T.TILE_KM <= 8) v += exp / (1 + d * T.TILE_KM / 3); }
  return v;
}
// A band is going hungry when a quarter of its grown members are getting thin.
const bandThin = (s, b) => { const a = bandMembers(s, b).filter(p => p.body.age >= 14); return a.length && a.filter(p => p.reserve / p.body.fatMax < 0.4).length >= a.length / 4; };
// Water the band can count on: someone has seen it with water in the dry season, or it is where they live now.
function maybeMoveCamp(s, b, urgent = false) {
  const alive = bandMembers(s, b).filter(p => p.body.age >= 14); if (!alive.length) return;
  const know = new Map(), waters = new Map();
  for (const p of alive) { for (const [id, k] of Object.entries(p.places)) know.set(id, Math.max(know.get(id) ?? 0, expected(s, p, s.patchById.get(id), k))); for (const [id, w] of Object.entries(p.waters)) if (w.active) waters.set(id, (waters.get(id) ?? false) || !!w.dryOk); }
  const here = s.waterById.get(b.camp.water), now = here.active ? campValue(s, here, know) : -1; // a camp whose water has failed must move
  const others = s.bands.filter(o => o !== b && !o.ended).map(o => o.camp);
  let best = null, bv = Math.max(0, now);
  for (const [id, lasts] of waters) {
    const w = s.waterById.get(id); if (!lasts || id === here.id) continue;
    if (others.some(c => Math.abs(c.x - w.x) + Math.abs(c.y - w.y) < 6)) continue; // not on top of another band
    const v = campValue(s, w, know); if (v > bv) { bv = v; best = w; }
  }
  if (!best) return;
  // the band talks it over: the clearer the gain, the likelier it goes (a chance, not a rule)
  const gain = now > 0 ? bv / now - 1 : 1, P = 1 - Math.exp(-gain / (urgent ? 0.1 : 0.3));
  if (draw(s, b.id, SALT.move) > P) return;
  b.camp = { x: best.x, y: best.y, water: best.id, since: s.tick };
  for (const p of bandMembers(s, b)) { p.waters[best.id] = { ...(p.waters[best.id] ?? {}), active: best.active, t: s.tick, dryOk: true }; if (!s.carer.get(p.id)) { stopGather(s, p); p.plan = []; p.step = null; } }
  event(s, `${bandName(s, b)} moved camp to ${best.name.toLowerCase()}, where more food is known nearby.`);
}
export const bandName = (s, b) => `Band ${b.id + 1}`;
// Bands split when they grow large and join others when they dwindle; families drift between bands where they have kin.
function bandLife(s) {
  const cfg = s.config;
  for (const b of s.bands) {
    if (b.ended) continue;
    const mem = bandMembers(s, b);
    if (!mem.length) { b.ended = s.tick; event(s, `${bandName(s, b)} is gone: no one is left.`); continue; }
    if (mem.length > cfg.fissionSize && draw(s, b.id, SALT.band) < 0.3) split(s, b);
    else if (mem.length < cfg.fusionSize && draw(s, b.id, SALT.bandJoin) < 0.5) {
      const others = s.bands.filter(o => o !== b && !o.ended && bandMembers(s, o).length); if (!others.length) continue;
      const to = others.sort((x, y) => (Math.abs(x.camp.x - b.camp.x) + Math.abs(x.camp.y - b.camp.y)) - (Math.abs(y.camp.x - b.camp.x) + Math.abs(y.camp.y - b.camp.y)))[0];
      joinBand(s, homes(s).filter(h => h.band === b.id), to); b.ended = s.tick; event(s, `${bandName(s, b)}, down to ${mem.length}, joined ${bandName(s, to)}.`);
    }
  }
  for (const h of homes(s)) {
    const r0 = draw(s, h.id, SALT.bandHousehold); if (r0 > cfg.householdMove) continue;
    const others = s.bands.filter(o => o.id !== h.band && !o.ended && bandMembers(s, o).length); if (!others.length) continue;
    const lead = h.members.map(i => s.people[i]).find(m => m.alive); if (!lead) continue;
    const kin = others.map(o => ({ o, r: Math.max(0, ...bandMembers(s, o).map(m => related(s, lead, m))) })).sort((a, b2) => b2.r - a.r)[0];
    if (kin.r < 0.125 && r0 > cfg.householdMove * 0.2) continue; // mostly to where they have close kin; to strangers a fifth as often
    joinBand(s, [h], kin.o); event(s, `${familyName(s, h)} went to live with ${bandName(s, kin.o)}.`);
  }
}
function joinBand(s, hs, b) {
  for (const h of hs) { h.band = b.id; for (const i of h.members) { const p = s.people[i]; if (!p.alive) continue; p.waters[b.camp.water] = { ...(p.waters[b.camp.water] ?? {}), active: true, t: s.tick, dryOk: true }; if (!s.carer.get(p.id)) { stopGather(s, p); p.plan = []; p.step = null; } } }
  changed(s);
}
function split(s, b) {
  const hs = homes(s).filter(h => h.band === b.id); if (hs.length < 4) return;
  // the families closest in kin to one family go with it, about half the band
  const seed = hs[Math.floor(draw(s, b.id, SALT.bandSplit) * hs.length)], lead = s.people[seed.members.find(i => s.people[i].alive)];
  const go = hs.map(h => ({ h, r: h === seed ? 9 : kinTo(s, lead, h) })).sort((a, b2) => b2.r - a.r).slice(0, Math.floor(hs.length / 2)).map(x => x.h);
  const goers = go.flatMap(h => h.members.map(i => s.people[i]).filter(p => p.alive && p.body.age >= 14));
  // a new camp at lasting water they know, at least 8 km away from every other camp
  const waters = new Map(); for (const p of goers) for (const [id, w] of Object.entries(p.waters)) if (w.active && w.dryOk) waters.set(id, true);
  const know = new Map(); for (const p of goers) for (const [id, k] of Object.entries(p.places)) know.set(id, Math.max(know.get(id) ?? 0, expected(s, p, s.patchById.get(id), k)));
  let best = null, bv = 0;
  for (const id of waters.keys()) { const w = s.waterById.get(id); if (s.bands.some(o => !o.ended && Math.abs(o.camp.x - w.x) + Math.abs(o.camp.y - w.y) < 8 / T.TILE_KM)) continue; const v = campValue(s, w, know); if (v > bv) { bv = v; best = w; } }
  if (!best) return; // nowhere they know to go: they stay together for now
  const nb = { id: s.bands.length, camp: { x: best.x, y: best.y, water: best.id, since: s.tick } };
  s.bands.push(nb); joinBand(s, go, nb);
  event(s, `${bandName(s, b)} split: ${go.length} families left to camp at ${best.name.toLowerCase()} as ${bandName(s, nb)}.`);
}

// ---------- once a month: pairing, conceiving, illness and old age ----------
function monthly(s) {
  const C = clockOf(s), cfg = s.config, alive = [...living(s)];
  for (const b of s.bands) if (!b.ended) maybeMoveCamp(s, b);
  bandLife(s);
  // pairing: unpartnered adults pair with an unrelated unpartnered adult of the other sex, closest in age
  for (const p of alive) {
    if (p.partner !== null && s.people[p.partner]?.alive) continue;
    if (p.sex !== 'F' || p.body.age < cfg.firstPair.F || p.body.age > 45) continue;
    if (draw(s, p.id, SALT.pairing) > 0.15) continue;
    const m = alive.filter(q => q.sex === 'M' && q.body.age >= cfg.firstPair.M && (q.partner === null || !s.people[q.partner]?.alive) && related(s, p, q) < 0.125)
      .sort((a, b) => Math.abs(a.body.age - p.body.age - 4) - Math.abs(b.body.age - p.body.age - 4))[0];
    if (!m) continue;
    p.partner = m.id; m.partner = p.id;
    // they live with her band more often than his (approx.; Hadza couples often begin near the wife's mother)
    const band = draw(s, p.id, SALT.pairBand) < 0.6 ? (s.households[p.household]?.band ?? 0) : (s.households[m.household]?.band ?? 0);
    const hh = { id: s.households.length, members: [], pool: 0, band }; s.households.push(hh);
    for (const q of [p, m]) { const old = s.households[q.household]; if (old) old.members = old.members.filter(i => i !== q.id); q.household = hh.id; hh.members.push(q.id); }
    for (const k of p.young.map(i => s.people[i]).filter(k => k.alive && k.body.age < 14 && k.household !== hh.id)) { const old = s.households[k.household]; if (old) old.members = old.members.filter(i => i !== k.id); k.household = hh.id; hh.members.push(k.id); }
    changed(s); event(s, `${p.name} and ${m.name} made a home together.`);
  }
  // conception: a fed woman with a partner, past the nursing of her last child; fertility falls with her fat
  for (const p of alive) {
    if (p.sex !== 'F' || p.pregnant || p.body.age < cfg.menarche || p.body.age >= cfg.menopause) continue;
    if (living(s).length >= cfg.populationCap) { s.capReached = (s.capReached ?? 0) + 1; continue; } // technical limit, counted and reported
    const m = s.people[p.partner]; if (!m?.alive) continue;
    const last = p.births.at(-1); if (last !== undefined && (s.tick - last) / C.year < EN.LAW.weanYears * 0.9) continue;
    const fed = Math.min(1, (p.reserve / p.body.fatMax) / 0.6);
    if (draw(s, p.id, SALT.conceive) < cfg.fecundability * fed) p.pregnant = { due: s.tick + Math.round(cfg.gestation * C.year), father: m.id };
  }
  // illness and old age: the measured age pattern of death, at the share the sim does not model itself
  for (const p of alive) {
    const mu = siler(cfg.siler, p.body.age) * cfg.illnessShare;
    if (draw(s, p.id, SALT.illness) < 1 - Math.exp(-mu / 12)) die(s, p, p.body.age >= 60 ? 'Old age' : 'Illness');
  }
}
function births(s) {
  const C = clockOf(s), cfg = s.config;
  for (const p of [...living(s)]) if (p.alive && p.pregnant && s.tick >= p.pregnant.due) {
    const dad = s.people[p.pregnant.father]; p.pregnant = null;
    const { f, mind } = drawFactors(s, s.people.length + 5000, [p, dad]);
    const kid = newPerson(s, { sex: draw(s, s.people.length, SALT.newborn) < cfg.maleRatio ? 'M' : 'F', born: s.tick, mother: p.id, father: dad.id, household: p.household, f, mind });
    kid.x = p.x; kid.y = p.y; kid.reserve = kid.body.fatMax * 0.8; kid.seen.set(p.seen);
    p.births.push(s.tick); p.young.push(kid.id); dad.young.push(kid.id); s.births++;
    event(s, `${p.name} gave birth to ${kid.name}.`); note(s, p, `Gave birth to ${kid.name}.`);
    if (draw(s, p.id, SALT.birth) < cfg.birthRisk) die(s, p, 'Childbirth');
    refreshCarers(s);
  }
}
function die(s, p, cause) {
  if (!p.alive) return;
  if (s.diag?.deaths) { const C = clockOf(s), h = s.households[p.household], cp = campOf(s, p), w = s.waterById.get(cp.water), bm = bandMembers(s, bandOf(s, p)), ad = bm.filter(q => q.body.age >= 16);
    s.diag.deaths.push({ cause, age: p.body.age, month: dateOf(C, s.tick).month, year: Math.floor(s.tick / C.year), campWater: !!w?.active, distCamp: Math.hypot(p.x - cp.x, p.y - cp.y) * T.TILE_KM, pool: h?.pool ?? 0,
      adultsHome: (h?.members ?? []).filter(i => s.people[i].alive && s.people[i].body.age >= 16 && i !== p.id).length, band: bm.length, bandFat: ad.reduce((n, q) => n + q.reserve / q.body.fatMax, 0) / Math.max(1, ad.length),
      step: p.step?.k, chose: p.decision?.chose, young: youngOf(s, p).length, reserve: p.reserve / p.body.fatMax, thirst: p.thirst, hunger: p.hunger, mother: !!s.people[p.mother]?.alive, health: p.health, energy: p.energy, opts: p.decision?.options, sex: p.sex, pregnant: !!p.pregnant, ate: p.lastAte ?? null, tick: s.tick, carers: (p.carers ?? []).filter(i => s.people[i]?.alive).length, knownWaters: Object.keys(p.waters ?? {}).length, rain: s.rainNow ?? null }); }
  p.alive = false; p.death = { t: s.tick, cause, age: p.body.age }; s.deaths[cause] = (s.deaths[cause] ?? 0) + 1; changed(s);
  if (p.carry > 0) { s.lostCarry = (s.lostCarry ?? 0) + p.carry; p.carry = 0; } // food on a body that dies is lost (booked)
  p.seenCount = p.seen.reduce((n, v) => n + v, 0); p.seen = null; p.places = {}; p.waters = {}; p.carcasses = {}; p.plan = []; p.step = null; // the dead keep their story, not their maps (memory in long runs)
  event(s, `${p.name} died (${cause.toLowerCase()}, age ${Math.floor(p.body.age)}).`);
  adoptOrphans(s);
  refreshCarers(s);
}
// Children left in a home with no grown-up go to their closest kin who has one (grandparents, aunts and uncles,
// older siblings), or else to any family: among foragers orphans are taken in.
function adoptOrphans(s) {
  for (const h of homes(s)) {
    const alive = h.members.map(i => s.people[i]).filter(q => q.alive);
    if (alive.some(q => q.body.age >= 16)) continue;
    for (const k of alive) {
      const fams = homes(s).filter(o => o !== h && o.members.some(i => s.people[i].alive && s.people[i].body.age >= 16));
      if (!fams.length) break;
      const best = fams.map(o => ({ o, r: Math.max(0, ...o.members.filter(i => s.people[i].alive).map(i => related(s, k, s.people[i]))) })).sort((a, b) => b.r - a.r || a.o.id - b.o.id)[0].o;
      // taken in as a chance each day: likelier from a caring family and close kin (an orphan may wait, or not be taken)
      const ad = best.members.map(i => s.people[i]).filter(m => m.alive && m.body.age >= 16), care = ad.reduce((n, m) => n + m.mind.care, 0) / ad.length;
      if (draw(s, k.id, SALT.adopt) > 0.2 + 0.5 * care + 0.5 * kinTo(s, k, best)) continue;
      h.members = h.members.filter(i => i !== k.id); best.members.push(k.id); k.household = best.id;
      note(s, k, `Taken in by ${s.people[best.members.find(i => s.people[i].alive && s.people[i].body.age >= 16)].name}'s family.`);
    }
    changed(s); refreshCarers(s);
  }
}

// ---------- the step ----------
export function stepWorld(s, n = 1) {
  const C = clockOf(s), day = Math.round(C.day), month = Math.round(C.month);
  if (!s.patchIndex) attachIndex(s);
  if (!s.patchById) { Object.defineProperty(s, 'patchById', { enumerable: false, configurable: true, value: new Map(s.patches.map(q => [q.id, q])) }); Object.defineProperty(s, 'waterById', { enumerable: false, configurable: true, value: new Map(s.waters.map(w => [w.id, w])) }); refreshCarers(s); }
  for (let z = 0; z < n; z++) {
    s.tick++;
    landStep(s, 1);
    if (s.tick % day === 0) { for (const p of living(s)) { setBody(s, p); forget(s, p); } refreshCarers(s); N.animalDay(s); N.wildfireDay(s); fireDay(s); const ids = new Set(s.carcasses.map(c => c.id)); for (const p of living(s)) for (const id in p.carcasses) if (!ids.has(+id)) delete p.carcasses[id]; }
    const alive = [...living(s)];
    for (const p of alive) {
      const carer = s.carer.get(p.id);
      liveTick(s, p, carer && carer.id === p.mother ? carer : null);
      if (carer) { p.x = carer.x; p.y = carer.y; p.step = null; p.plan = []; continue; }
      // interruptions: thirst that has become urgent, or night falling far from camp
      const young = youngOf(s, p), felt = young.reduce((m, k) => Math.max(m, k.thirst), p.thirst);
      if (felt >= 70 && p.step?.k !== 'drink' && !p.plan.some(x => x.k === 'drink')) { stopGather(s, p); p.plan = []; p.step = null; }
      if (sleepTime(C, s.tick) && p.step && !['sleep', 'walk', 'unload'].includes(p.step.k)) { stopGather(s, p); p.plan = []; p.step = null; }
      act(s, p);
      if (atCamp(s, p)) { if (p.carry > 0) unload(s, p); const h = s.households[p.household]; if (h && (p.hunger > 25 || young.length)) feedFromPool(s, h); }
      const w = s.waterById.get(campOf(s, p).water); if (atCamp(s, p) && w.active && p.thirst > 15) { drink(p); for (const k of young) drink(k); }
    }
    for (const p of alive) {
      if (!p.alive) continue;
      if (p.hunger >= 100 && p.reserve <= 0) die(s, p, 'Starvation');
      else if (p.deficit >= p.body.waterDeath) die(s, p, 'Thirst');
      else if (p.health <= 0) die(s, p, 'Injury and illness');
    }
    fireHour(s);
    { const hr = hourOf(C, s.tick); if (hr === 19) evening(s); else if (hr === 10 || hr === 13 || hr === 16) share(s); }
    if (s.tick % day === 0) {
      // how far grown people have had to walk lately (a ten-day average): long days mean the food near camp is used up
      for (const b of s.bands) {
        if (b.ended) continue;
        const ad = bandMembers(s, b).filter(p => p.body.age >= 18);
        const km = ad.reduce((n, p) => n + p.tiles - (p.tilesAtDay ?? p.tiles), 0) / Math.max(1, ad.length) * T.TILE_KM; // each person's own walking since yesterday
        b.dayKm = b.dayKm === undefined ? km : b.dayKm + (km - b.dayKm) / 10;
        if (!s.waterById.get(b.camp.water).active || (s.tick % (7 * day) === 0 && (bandThin(s, b) || (b.tripKm ?? 0) > 6))) maybeMoveCamp(s, b, true);
      }
      sanity(s);
      for (const p of living(s)) { p.tilesAtDay = p.tiles; p.dayK = null; }
      if (s.diag?.track) for (const p of living(s)) { const tr = (s.diag.track[p.id] ??= []); tr.push({ r: +(p.reserve / p.body.fatMax).toFixed(2), got: Math.round(p.gotKcal ?? 0), g: +p.times.gather.toFixed(1), c: +p.times.camp.toFixed(1), w: +p.times.walk.toFixed(1), h: Math.round(p.health), y: youngOf(s, p).length, ch: p.decision?.chose, pool: Math.round(s.households[p.household]?.pool ?? 0), hh: (s.households[p.household]?.members ?? []).filter(i => s.people[i].alive).map(i => Math.round(s.people[i].body.age)).join("/") }); if (tr.length > 40) tr.shift(); }
      adoptOrphans(s);
    }
    if (s.tick % month === 0) monthly(s);
    births(s);
  }
  return s;
}

// ---------- alarms: things that must never happen ----------
// Checked once a day. A tripped alarm is recorded (it never changes the world); tests require none.
function sanity(s) {
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
