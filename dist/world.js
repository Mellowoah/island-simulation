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
import { clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';

export const WORLD_VERSION = 1;
export const WORLD_DEFAULTS = {
  families: 6,              // a camp of about 30 people (Hadza camps average about 30; Marlowe 2010)
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
const SALT = { setup: K, choice: K + 10, explore: K + 11, conceive: K + 13, pairMate: K + 14, newborn: K + 15, illness: K + 21, injury: K + 22, birth: K + 23, pairing: K + 24, talk: K + 25 };
const draw = (s, id, salt, t = s.tick) => noise2(seedKey(s.seed), t, id, salt);
const gauss = (s, id, salt, t) => { let z = 0; for (let i = 0; i < 4; i++) z += draw(s, id, salt + 0, t * 4 + i + 1); return (z - 2) * Math.sqrt(3); }; // approx. N(0,1)
const SYL = ['ka', 'lo', 'mi', 'ne', 'ra', 'su', 'te', 'vi', 'ze', 'do', 'an', 'el', 'or', 'ul', 'ya', 'be', 'ha', 'ji', 'mu', 'si'];
const nameOf = (s, id) => { const r = i => SYL[Math.floor(draw(s, id, SALT.newborn + 5, 7 + i) * SYL.length)]; return (r(0) + r(1) + (draw(s, id, SALT.newborn + 5, 9) < 0.4 ? r(2) : '')).replace(/^./, x => x.toUpperCase()); };
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export const ageOf = (s, p) => (s.tick - p.born) / clockOf(s).year;
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
    p.places[q.id] = { exp: near ? q.stock : (prev ? prev.exp : q.stock * 0.5), t: s.tick };
  }
  for (const w of s.waters) if (dist(w, p) <= r) {
    if (!p.waters[w.id]) note(s, p, `Found water: ${w.name.toLowerCase()}.`);
    p.waters[w.id] = { active: w.active, t: s.tick };
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
const youngOf = (s, p) => p.young.map(i => s.people[i]).filter(k => k.alive && s.carer.get(k.id) === p);

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
  const p = { id, name: nameOf(s, id), sex, born, mother, father, partner: null, household, alive: true, death: null,
    x: s.camp.x, y: s.camp.y, hunger: 20, reserve: undefined, energy: 80, health: 100, deficit: 0, thirst: 0,
    f, mind, skills: {}, places: {}, waters: {}, seen: new Uint8Array(W * H), plan: [], step: null, carry: 0,
    times: { sleep: 0, rest: 0, walk: 0, gather: 0, explore: 0, camp: 0, drink: 0 }, tiles: 0,
    pregnant: null, births: [], young: [], memories: [] };
  s.people.push(p); setBody(s, p);
  if (household !== null) s.households[household].members.push(id);
  return p;
}
const MIND_KEYS = ['curiosity', 'caution', 'care', 'social'];
function drawFactors(s, id, parents = null) {
  const g = (k, sd) => gauss(s, id, SALT.setup + 1, k) * sd;
  const h = s.config.heritability, mix = (k, own) => parents ? 1 + h * ((parents[0].f[k] + parents[1].f[k]) / 2 - 1) + own * Math.sqrt(1 - h * h) : 1 + own;
  const f = { mass: mix('mass', g(1, 0.08)), fat: mix('fat', g(2, 0.2)), bmr: mix('bmr', g(3, 0.05)), speed: mix('speed', g(4, 0.07)), sleep: 5.7 + 1.4 * draw(s, id, SALT.setup + 2, 5) };
  const mind = {};
  MIND_KEYS.forEach((k, i) => { const own = 0.5 + 0.18 * gauss(s, id, SALT.setup + 3, 10 + i); mind[k] = clamp(parents ? 0.5 + h * ((parents[0].mind[k] + parents[1].mind[k]) / 2 - 0.5) + (own - 0.5) * Math.sqrt(1 - h * h) : own, 0.05, 0.95); });
  return { f, mind };
}

export function createWorld2(seed = 41, opts = {}) {
  const cfg = { ...WORLD_DEFAULTS, ...opts };
  const s = { kind: 'world', mode: 'world', version: WORLD_VERSION, seed: seed >>> 0, rng: 2, tick: 0, clock: { min: cfg.clockMinutes ?? REAL_MINUTES }, map: { id: 'island' }, config: cfg,
    people: [], households: [], events: [], births: 0, deaths: {}, discovered: 0, ledger: { initial: 0, regenerated: 0, consumed: 0, decayed: 0, gifted: 0, withdrawn: 0, poolSpoiled: 0 } };
  const C = clockOf(s);
  s.patches = makeFood(s); s.ledger.initial = s.patches.reduce((n, p) => n + p.stock, 0);
  s.waters = T.waterSites().map(w => ({ ...w, active: true }));
  s.seenAt = new Int32Array(W * H).fill(-1); s.seenBy = new Int16Array(W * H).fill(-1);
  attachIndex(s);
  // The first camp: at the lake if there is one (it never dries), on its shore.
  const lake = s.waters.filter(w => w.kind === 'lake'), pick = lake.length ? lake : s.waters.filter(w => w.kind === 'spring');
  const cw = pick[Math.floor(draw(s, 0, SALT.setup + 4, 0) * pick.length)];
  s.camp = { x: cw.x, y: cw.y, water: cw.id, since: 0 };
  // Families: a couple each (mother 18-40, father 0-8 years older), with the children she would have had at about
  // 3.4-year spacing from about 19, each surviving with the real odds to their age; some have a grandparent.
  const year = C.year; let gid = 1000;
  for (let h = 0; h < cfg.families; h++) {
    const hh = { id: s.households.length, members: [], pool: 0 }; s.households.push(hh);
    const u = k => draw(s, h, SALT.setup + 5, k);
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
  // Everyone knows the land and the places within a few km of camp; nobody knows beyond.
  const kr = cfg.campRadiusKm / T.TILE_KM;
  for (const p of s.people) {
    p.x = s.camp.x; p.y = s.camp.y;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - s.camp.x, y - s.camp.y) <= kr) { const i = y * W + x; p.seen[i] = 1; if (s.seenAt[i] < 0) { s.seenAt[i] = 0; s.seenBy[i] = -1; s.discovered++; } }
    for (const q of s.patches) if (Math.hypot(q.x - s.camp.x, q.y - s.camp.y) <= kr) p.places[q.id] = { exp: q.stock, t: 0 };
    for (const w of s.waters) if (Math.hypot(w.x - s.camp.x, w.y - s.camp.y) <= kr) p.waters[w.id] = { active: w.active, t: 0 };
  }
  refreshCarers(s);
  event(s, `The island begins. ${s.people.length} people in ${cfg.families} families camp by ${s.waters.find(w => w.id === s.camp.water).name.toLowerCase()}. Everything beyond a few km is unknown to them.`);
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
function refreshCarers(s) { s.carer = new Map(); for (const p of s.people) if (p.alive) { const c = carerOf(s, p); if (c) s.carer.set(p.id, c); } }

// Siler hazard (per year) and its integral from 0 to x.
export const siler = (S, x) => S.a1 * Math.exp(-S.b1 * x) + S.a2 + S.a3 * Math.exp(S.b3 * x);
const silerCum = (S, x) => S.a1 / S.b1 * (1 - Math.exp(-S.b1 * x)) + S.a2 * x + S.a3 / S.b3 * (Math.exp(S.b3 * x) - 1);

// What a person expects to find at a place: what they last saw, recovering toward its usual level since then at the
// rate such food comes back (people learn how fast things regrow by living with them).
// The usual level follows the season of that food (people know when baobab or berries are in).
function expected(s, q, k) { const F = FOODS[q.food], usual = q.capacity * 0.6 * F.season(realFrac(s)) * F.norm, f = Math.exp(-q.decay * (s.tick - k.t)); return Math.max(0, usual - (usual - k.exp) * f); }

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
const atCamp = (s, p) => Math.abs(p.x - s.camp.x) + Math.abs(p.y - s.camp.y) <= 1;
const maxTripKm = a => a < 5 ? 0 : a < 10 ? 2 : a < 14 ? 5 : 15; // how far children range from camp (Hadza children forage near camp)
const hoursTo = (s, p, x, y) => { const d = fieldDist(p.x, p.y, x, y, false, mapOf(s)); return d < 0 ? Infinity : d / p.body.tilesTick * clockOf(s).hours; };

function options(s, p) {
  const C = clockOf(s), a = p.body.age, hour = hourOf(C, s.tick), night = sleepTime(C, s.tick), opts = [];
  const young = youngOf(s, p), thirst = young.reduce((m, k) => Math.max(m, k.thirst), p.thirst) / 100;
  const tired = (100 - p.energy) / 100, home = atCamp(s, p);
  const homeH = home ? 0 : hoursTo(s, p, s.camp.x, s.camp.y);
  // sleep
  if (night) opts.push({ k: 'sleep', u: 2.5 + tired, why: 'night' });
  else opts.push({ k: 'rest', u: tired * tired * 3 - 0.2, why: `tired ${Math.round(tired * 100)}` });
  // water
  let best = null, bm = Infinity;
  for (const id in p.waters) { if (!p.waters[id].active) continue; const wt = s.waterById.get(id), md = Math.abs(wt.x - p.x) + Math.abs(wt.y - p.y); if (md < bm) { bm = md; best = wt; } } // nearest by straight-line first
  if (best) best = { w: best, hrs: hoursTo(s, p, best.x, best.y) };
  if (best && !night) opts.push({ k: 'drink', w: best.w, u: 3 * thirst ** 1.5 - best.hrs * 0.15, why: `thirst ${Math.round(thirst * 100)}, ${best.w.name.toLowerCase()} ${best.hrs.toFixed(1)} h away` });
  // food: net kcal per hour of the whole trip, against what the household is short of
  if (!night && a >= 5) {
    const short = a < 14 ? p.hunger / p.body.hpk : householdShort(s, p), day = a < 14 ? p.body.base : householdDay(s, p);
    const urgency = Math.min(2, short / Math.max(1, day)) + 0.12; // foragers go out most days even when not short
    const range = maxTripKm(a) / T.TILE_KM;
    for (const id in p.places) {
      const k0 = p.places[id], q = s.patchById.get(id);
      if (Math.abs(q.x - s.camp.x) + Math.abs(q.y - s.camp.y) > range * 1.05 && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > range) continue; // cheap bound first
      const k = { exp: expected(s, q, k0) };
      if (k.exp * 500 < 1000) continue; // exp is in food units (500 kcal)
      const out = hoursTo(s, p, q.x, q.y), back = fieldDist(q.x, q.y, s.camp.x, s.camp.y, false, mapOf(s)) / p.body.tilesTick * C.hours;
      if (!isFinite(out) || (out + back) * p.body.kmh / 2 > maxTripKm(a)) continue;
      // central-place foraging: an adult who goes out brings back a full load if the patch has it (load-size theory,
      // Orians and Pearson 1979); a child gathers for itself
      const rate = returnRate(q.food, a, p.skills[q.id] ?? 0), want = Math.min(a < 14 ? Math.max(500, short) : p.body.carryKcal, k.exp * 500);
      const hrs = out + want / rate + back, walk = (out + back) * p.body.tilesTick / C.hours * p.body.cotTile * p.body.mass;
      const net = (want - walk) / hrs, late = hour + hrs > 19 ? (hour + hrs - 19) * 0.25 : 0;
      opts.push({ k: 'forage', q, want, u: urgency * net / 1000 - late - p.mind.caution * Math.max(0, out - 3) * 0.05, why: `${q.name.toLowerCase()} ${out.toFixed(1)} h away, about ${Math.round(net)} kcal an hour after walking` });
    }
  }
  // explore: curiosity, more when what is known is poor
  if (!night && a >= 12 && hour < 15) {
    const bestFood = opts.filter(o => o.k === 'forage').reduce((m, o) => Math.max(m, o.u), 0);
    // worth more when what they know is poor or far: long days of walking, or little worth going for
    const far = Math.min(1, Math.max(0, ((s.dayKm ?? 8) - 7) / 6));
    opts.push({ k: 'explore', u: p.mind.curiosity * (0.3 + 0.4 * Math.max(0, 0.5 - bestFood) + 0.6 * far), why: `curiosity ${Math.round(p.mind.curiosity * 100)}${far > 0.2 ? ', the known places are far' : ''}` });
  }
  // camp: being with others, caring for the young, going home in the evening
  if (home) opts.push({ k: 'camp', u: 0.25 + 0.25 * p.mind.social + (young.length ? 0.15 * p.mind.care : 0), why: 'at camp with the others' });
  else opts.push({ k: 'home', u: (hour >= 17 ? 1.5 : 0.2) + (p.carry > 0 ? 0.6 : 0) - homeH * 0.05, why: `camp ${homeH.toFixed(1)} h away` });
  return opts;
}

function decide(s, p) {
  const opts = options(s, p), T0 = s.config.choiceTemperature, mx = Math.max(...opts.map(o => o.u));
  const w = opts.map(o => Math.exp((o.u - mx) / T0)), tot = w.reduce((a, b) => a + b, 0);
  let r = draw(s, p.id, SALT.choice) * tot, o = opts[opts.length - 1];
  for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) { o = opts[i]; break; } }
  p.decision = { t: s.tick, chose: o.k, why: o.why, options: opts.map(x => ({ k: x.k, u: Math.round(x.u * 100) / 100, why: x.why })).sort((a, b) => b.u - a.u).slice(0, 6) };
  const C = clockOf(s), camp = [s.camp.x, s.camp.y];
  if (o.k === 'sleep') { if (!atCamp(s, p) && hoursTo(s, p, ...camp) <= 1.5) p.plan = [{ k: 'walk', to: camp }, { k: 'sleep' }]; else p.plan = [{ k: 'sleep' }]; }
  else if (o.k === 'rest') p.plan = [{ k: 'rest', left: C.perHour }];
  else if (o.k === 'drink') p.plan = [{ k: 'walk', to: [o.w.x, o.w.y] }, { k: 'drink', w: o.w, left: 0.25 * C.perHour }];
  else if (o.k === 'forage') p.plan = [{ k: 'walk', to: [o.q.x, o.q.y] }, { k: 'gather', q: o.q, want: o.want }, { k: 'walk', to: camp }, { k: 'unload' }];
  else if (o.k === 'explore') { const t = exploreTarget(s, p); p.plan = t ? [{ k: 'walk', to: t, explore: true }, { k: 'walk', to: camp }] : [{ k: 'camp', left: C.perHour }]; }
  else if (o.k === 'home') p.plan = [{ k: 'walk', to: camp }, { k: 'unload' }];
  else p.plan = [{ k: 'camp', left: 2 * C.perHour }];
  p.step = null;
}
function exploreTarget(s, p) {
  const C = clockOf(s), reach = Math.min(maxTripKm(p.body.age), 3 * EN.speedKmH(p.body.mass)) / T.TILE_KM / 2; // out and back within the day
  let best = null, bs = -Infinity;
  for (let i = 0; i < 16; i++) {
    const ang = draw(s, p.id, SALT.explore, s.tick * 16 + i) * Math.PI * 2, rr = reach * (0.4 + 0.6 * draw(s, p.id, SALT.explore + 1, s.tick * 16 + i));
    const x = Math.round(s.camp.x + Math.cos(ang) * rr), y = Math.round(s.camp.y + Math.sin(ang) * rr);
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
function walk(s, p, st, budget) {
  const m = mapOf(s);
  if (!st.route) { st.route = st.explore ? path(p.x, p.y, st.to[0], st.to[1], false, m) : fieldPath(p.x, p.y, st.to[0], st.to[1], false, m); if (!st.route.length) { st.arrived = true; return budget; } }
  const C = clockOf(s), B = body(s), v = p.body.tilesTick * (isNight(C, s.tick) ? B.nightPace : 1);
  const young = youngOf(s, p), load = young.filter(k => EN.carried(k.body.age)).reduce((n, k) => n + k.body.mass, 0) + p.carry / 2000, walkers = young.filter(k => !EN.carried(k.body.age));
  p.stride = (p.stride ?? 0) + v * budget; let moved = 0;
  while (p.stride >= 1 && st.route.length) {
    p.stride -= 1; moved++; [p.x, p.y] = st.route.shift(); p.tiles++;
    const kc = p.body.cotTile * (p.body.mass + load); burnKcal(s, p, kc); loseWater(s, p, kc);
    for (const k of walkers) { const kk = k.body.cotTile * k.body.mass; burnKcal(s, k, kk); loseWater(s, k, kk); }
    p.energy = clamp(p.energy - B.walkFatigueTile * (1 + load / p.body.mass));
    look(s, p);
  }
  for (const k of young) { k.x = p.x; k.y = p.y; for (const i of [p.y * W + p.x]) k.seen[i] = 1; }
  if (moved && draw(s, p.id, SALT.injury) < 1 - (1 - B.injuryPerTile * (isNight(C, s.tick) ? B.nightInjury : 1)) ** moved) { p.health = clamp(p.health - B.injuryDamage); note(s, p, 'Fell and was hurt.'); }
  const used = st.route.length ? budget : Math.min(budget, moved / v);
  p.times[st.explore ? 'explore' : 'walk'] += used;
  if (st.route.length) return 0;
  p.stride = 0; st.arrived = true; return budget - used;
}
function gatherDone(s, p, st) {
  const q = st.q, B = body(s), takeUnits = Math.min(q.stock, st.want / B.unitKcal);
  q.stock -= takeUnits; s.ledger.consumed += takeUnits;
  let kcal = takeUnits * B.unitKcal;
  // eat what you are short of on the spot, feed the young with you, carry the rest home
  for (const k of youngOf(s, p)) { const g = Math.min(kcal, k.hunger / k.body.hpk + Math.max(0, k.body.fatMax - k.reserve) / B.fatStoreEff); if (g > 0) { eatKcal(s, k, g); kcal -= g; } }
  const own = Math.min(kcal, p.hunger / p.body.hpk); eatKcal(s, p, own); kcal -= own;
  p.carry += kcal;
  if (takeUnits > 0) practise(s, p, q.id, st.hours ?? 1);
  p.places[q.id] = { exp: q.stock, t: s.tick };
  note(s, p, takeUnits > 0.05 ? `Gathered ${Math.round(takeUnits * B.unitKcal)} kcal of ${q.name.toLowerCase()}.` : `Found the ${q.name.toLowerCase()} picked clean.`);
}
function unload(s, p) {
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
    if (h.pool <= 0) break;
    // the young eat for growth too; adults eat when hungry and, when there is food, put fat back on (people fatten
    // in good times and lose it in lean ones)
    const room = Math.max(0, q.body.fatMax - q.reserve) / B.fatStoreEff;
    const want = q.body.age < 14 ? q.hunger / q.body.hpk + room : q.hunger > 25 ? q.hunger / q.body.hpk + Math.min(room, q.body.base * 0.5) : 0;
    const g = Math.min(h.pool, want); if (g > 0) { eatKcal(s, q, g); h.pool -= g; }
  }
}

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
  const B = body(s), hs = s.households.filter(h => h.members.some(i => s.people[i].alive));
  const keep = h => h.members.reduce((n, i) => { const q = s.people[i]; return n + (q.alive ? q.hunger / q.body.hpk : 0); }, 0);
  const short = h => h.members.reduce((n, i) => { const q = s.people[i]; return n + (q.alive ? q.hunger / q.body.hpk + Math.max(0, q.body.fatMax * 0.6 - q.reserve) / B.fatStoreEff : 0); }, 0);
  for (const g of hs) {
    let spare = g.pool - keep(g); if (spare <= 0) continue;
    const giver = s.people[g.members.find(i => s.people[i].alive)];
    const takers = hs.filter(h => h !== g).map(h => { const sh = Math.max(0, short(h) - h.pool), r = Math.max(...h.members.filter(i => s.people[i].alive).map(i => related(s, giver, s.people[i])), 0); return { h, sh, w: sh * Math.max(0.25, r) }; }).filter(x => x.sh > 0).sort((a, b) => b.w - a.w);
    for (const t of takers) { if (spare <= 0) break; const gv = Math.min(spare, t.sh); t.h.pool += gv; g.pool -= gv; spare -= gv; s.shared = (s.shared ?? 0) + gv; }
  }
}
function evening(s) {
  const hs = s.households.filter(h => h.members.some(i => s.people[i].alive));
  share(s);
  // news: people at camp tell what they know. Household members hear everything; others as sociable as the teller.
  // Everyone talks with their own household, and with up to three others around the fire, more if sociable.
  const here = s.people.filter(p => p.alive && atCamp(s, p) && p.body.age >= 5);
  const tell = (a, b) => {
    for (const id in a.places) { const k = a.places[id], kb = b.places[id]; if (!kb || kb.t < k.t) { if (!kb) note(s, b, `Heard from ${a.name} about ${s.patchById.get(id).name.toLowerCase()}.`); b.places[id] = { exp: k.exp, t: k.t }; } }
    for (const id in a.waters) { const k = a.waters[id], kb = b.waters[id]; if (!kb || kb.t < k.t) b.waters[id] = { active: k.active, t: k.t }; }
  };
  for (const a of here) {
    for (const b of here) if (b !== a && b.household === a.household) tell(a, b);
    for (let i = 0; i < 3; i++) { if (draw(s, a.id, SALT.talk, s.tick * 3 + i) > a.mind.social) continue; const b = here[Math.floor(draw(s, a.id + 7919, SALT.talk, s.tick * 3 + i) * here.length)]; if (b && b !== a) tell(a, b); }
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
// The band is going hungry when a quarter of its grown members are getting thin.
const bandThin = s => { const a = s.people.filter(p => p.alive && p.body.age >= 14); return a.length && a.filter(p => p.reserve / p.body.fatMax < 0.4).length >= a.length / 4; };
function maybeMoveCamp(s, urgent = false) {
  const alive = s.people.filter(p => p.alive && p.body.age >= 14); if (!alive.length) return;
  const know = new Map(), waters = new Set();
  for (const p of alive) { for (const [id, k] of Object.entries(p.places)) know.set(id, Math.max(know.get(id) ?? 0, expected(s, s.patchById.get(id), k))); for (const [id, w] of Object.entries(p.waters)) if (w.active) waters.add(id); }
  const lasting = w => w.kind === 'lake' || w.kind === 'spring'; // only water that does not fail in the dry season
  const here = s.waterById.get(s.camp.water), now = here.active ? campValue(s, here, know) : -1; // a camp whose water has failed must move
  let best = null, bv = now * (urgent ? 1.05 : 1.3); // a hungry band moves for less
  for (const id of waters) { const w = s.waterById.get(id); if (!lasting(w) || id === here.id) continue; const v = campValue(s, w, know); if (v > bv) { bv = v; best = w; } }
  if (!best) return;
  s.camp = { x: best.x, y: best.y, water: best.id, since: s.tick };
  for (const p of s.people) if (p.alive && !s.carer.get(p.id)) { p.plan = []; p.step = null; }
  event(s, `The band moved camp to ${best.name.toLowerCase()}, where more food is known nearby.`);
}

// ---------- once a month: pairing, conceiving, illness and old age ----------
function monthly(s) {
  const C = clockOf(s), cfg = s.config, alive = s.people.filter(p => p.alive);
  maybeMoveCamp(s);
  // pairing: unpartnered adults pair with an unrelated unpartnered adult of the other sex, closest in age
  for (const p of alive) {
    if (p.partner !== null && s.people[p.partner]?.alive) continue;
    if (p.sex !== 'F' || p.body.age < cfg.firstPair.F || p.body.age > 45) continue;
    if (draw(s, p.id, SALT.pairing) > 0.15) continue;
    const m = alive.filter(q => q.sex === 'M' && q.body.age >= cfg.firstPair.M && (q.partner === null || !s.people[q.partner]?.alive) && related(s, p, q) < 0.125)
      .sort((a, b) => Math.abs(a.body.age - p.body.age - 4) - Math.abs(b.body.age - p.body.age - 4))[0];
    if (!m) continue;
    p.partner = m.id; m.partner = p.id;
    const hh = { id: s.households.length, members: [], pool: 0 }; s.households.push(hh);
    for (const q of [p, m]) { const old = s.households[q.household]; if (old) old.members = old.members.filter(i => i !== q.id); q.household = hh.id; hh.members.push(q.id); }
    for (const k of p.young.map(i => s.people[i]).filter(k => k.alive && k.body.age < 14 && k.household !== hh.id)) { const old = s.households[k.household]; if (old) old.members = old.members.filter(i => i !== k.id); k.household = hh.id; hh.members.push(k.id); }
    event(s, `${p.name} and ${m.name} made a home together.`);
  }
  // conception: a fed woman with a partner, past the nursing of her last child; fertility falls with her fat
  for (const p of alive) {
    if (p.sex !== 'F' || p.pregnant || p.body.age < cfg.menarche || p.body.age >= cfg.menopause) continue;
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
  for (const p of s.people) if (p.alive && p.pregnant && s.tick >= p.pregnant.due) {
    const dad = s.people[p.pregnant.father]; p.pregnant = null;
    const { f, mind } = drawFactors(s, s.people.length + 5000, [p, dad]);
    const kid = newPerson(s, { sex: draw(s, s.people.length, SALT.newborn) < cfg.maleRatio ? 'M' : 'F', born: s.tick, mother: p.id, father: dad.id, household: p.household, f, mind });
    kid.x = p.x; kid.y = p.y; kid.reserve = kid.body.fatMax * 0.8; kid.seen.set(p.seen);
    p.births.push(s.tick); p.young.push(kid.id); dad.young.push(kid.id); s.births++;
    event(s, `${p.name} gave birth to ${kid.name}.`); note(s, p, `Gave birth to ${kid.name}.`);
    if (draw(s, p.id, SALT.birth) < cfg.birthRisk) die(s, p, 'Childbirth');
  }
}
function die(s, p, cause) {
  if (!p.alive) return;
  p.alive = false; p.death = { t: s.tick, cause, age: p.body.age }; s.deaths[cause] = (s.deaths[cause] ?? 0) + 1;
  event(s, `${p.name} died (${cause.toLowerCase()}, age ${Math.floor(p.body.age)}).`);
  refreshCarers(s);
}

// ---------- the step ----------
export function stepWorld(s, n = 1) {
  const C = clockOf(s), day = Math.round(C.day), month = Math.round(C.month);
  if (!s.patchIndex) attachIndex(s);
  if (!s.patchById) { Object.defineProperty(s, 'patchById', { enumerable: false, configurable: true, value: new Map(s.patches.map(q => [q.id, q])) }); Object.defineProperty(s, 'waterById', { enumerable: false, configurable: true, value: new Map(s.waters.map(w => [w.id, w])) }); refreshCarers(s); }
  for (let z = 0; z < n; z++) {
    s.tick++;
    landStep(s, 1);
    if (s.tick % day === 0) { for (const p of s.people) if (p.alive) { setBody(s, p); forget(s, p); } refreshCarers(s); }
    const alive = s.people.filter(p => p.alive);
    for (const p of alive) {
      const carer = s.carer.get(p.id);
      liveTick(s, p, carer && carer.id === p.mother ? carer : null);
      if (carer) { p.x = carer.x; p.y = carer.y; p.step = null; p.plan = []; continue; }
      // interruptions: thirst that has become urgent, or night falling far from camp
      const young = youngOf(s, p), felt = young.reduce((m, k) => Math.max(m, k.thirst), p.thirst);
      if (felt >= 70 && p.step?.k !== 'drink' && !p.plan.some(x => x.k === 'drink')) { p.plan = []; p.step = null; }
      if (sleepTime(C, s.tick) && p.step && !['sleep', 'walk', 'unload'].includes(p.step.k)) { p.plan = []; p.step = null; }
      act(s, p);
      if (atCamp(s, p)) { if (p.carry > 0) unload(s, p); const h = s.households[p.household]; if (h?.pool > 0 && (p.hunger > 25 || young.length)) feedFromPool(s, h); }
      const w = s.waterById.get(s.camp.water); if (atCamp(s, p) && w.active && p.thirst > 15) { drink(p); for (const k of young) drink(k); }
    }
    for (const p of alive) {
      if (!p.alive) continue;
      if (p.hunger >= 100 && p.reserve <= 0) die(s, p, 'Starvation');
      else if (p.deficit >= p.body.waterDeath) die(s, p, 'Thirst');
      else if (p.health <= 0) die(s, p, 'Injury and illness');
    }
    { const hr = hourOf(C, s.tick); if (hr === 19) evening(s); else if (hr === 10 || hr === 13 || hr === 16) share(s); }
    if (s.tick % day === 0) {
      // how far grown people have had to walk lately (a ten-day average): long days mean the food near camp is used up
      const ad = s.people.filter(p => p.alive && p.body.age >= 18), tiles = ad.reduce((n, p) => n + p.tiles, 0);
      const km = s.lastTiles === undefined ? 0 : (tiles - s.lastTiles) / Math.max(1, ad.length) * T.TILE_KM; s.lastTiles = tiles;
      s.dayKm = s.dayKm === undefined ? km : s.dayKm + (km - s.dayKm) / 10;
      if (!s.waterById.get(s.camp.water).active || (s.tick % (7 * day) === 0 && (bandThin(s) || s.dayKm > 12))) maybeMoveCamp(s, true);
    }
    if (s.tick % month === 0) monthly(s);
    births(s);
  }
  return s;
}

// ---------- measures (never change the world) ----------
export function worldMetrics(s) {
  const C = clockOf(s), alive = s.people.filter(p => p.alive), adults = alive.filter(p => p.body.age >= 18);
  const landTiles = T.MAIN_TILES, seenLand = (() => { let n = 0; for (let i = 0; i < W * H; i++) if (s.seenAt[i] >= 0 && T.isWalkable(i % W, (i / W) | 0)) n++; return n; })();
  return { tick: s.tick, date: dateOf(C, s.tick).label, population: alive.length, adults: adults.length, children: alive.filter(p => p.body.age < 14).length,
    births: s.births, deaths: { ...s.deaths }, households: s.households.filter(h => h.members.some(i => s.people[i].alive)).length,
    discoveredKm2: seenLand * T.TILE_KM ** 2, landKm2: T.LAND_KM2, discoveredShare: seenLand / landTiles,
    meanFat: adults.length ? adults.reduce((n, p) => n + p.reserve / p.body.fatMax, 0) / adults.length : 0,
    food: s.patches.reduce((n, q) => n + q.stock, 0), shared: s.shared ?? 0, camp: { ...s.camp } };
}
