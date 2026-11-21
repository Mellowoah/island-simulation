// Island: what is in the small world besides plants and water: animals, stone, wood, grass and fire, and the
// physical laws that decide what happens when someone acts on them. Nothing here is a recipe and nothing here says
// who does what. A result comes from the properties of the things involved; people find out what works by trying.
//
// Robert, 17 Nov: "within the confines of physics and laws and nature … some sort of chemistry to it all … genuine,
// real and falsifiable."
//
// Sources and checks (falsifiable: tests/nature.test.mjs):
//   Animals    densities from field counts (impala 12-29 per km² in Laikipia; Augustine 2010), growth rates from
//              body size (r_max ~ M^-0.26, Fenchel 1974); groups met by the standard random-search encounter rate
//              (sightings per km = 2 x sighting distance x group density; Stephens and Krebs 1986).
//   Hunting    the hunter must get within reach before the animal flees, hit it, and do enough damage (kinetic
//              energy of the blow or throw, more with a point, against the animal's mass). Check: Hadza men take a
//              large animal on about 1 hunter-day in 30 (Hawkes et al. 1991), or as few as about 1 in 100 (Wood and
//              Marlowe 2013), with bows and poison; spear and stone should do no better.
//   Scavenging animals die; carcasses lie for about a day. Check: about 20% of Hadza medium and large carcasses
//              came from scavenging (O'Connell et al. 1988).
//   Stone      flint and chert break with conchoidal fracture into sharp flakes when struck by a stone at least about
//              as hard and heavy enough; tough basalt cobbles crush into rough edges at best.
//   Fire       friction makes an ember only with dry wood (about 10% water); a few minutes of skilled effort; the
//              ember needs dry tinder. Lightning lights the dry-season grass, burning a given patch every few years
//              (savanna fire return 2-6 years). Fire burns its fuel and dies unless fed.
//   Cooking    raises the energy people get from starchy tubers and from meat (Carmody, Weintraub and Wrangham
//              2011). The paper gives the direction, not a percentage, so the gains are ranges to sweep.

import { noise2, seedKey, STREAMS } from './sim.js';
import { SALTS } from './streams.js';
import { woodMoisture, rainYearRatio, soilMoisture, rainLastDays, spoilFactor } from './weather.js';
import { R, clockOf, hourOf } from './clock.js';
import * as T from './terrain.js';
import { LAYERS } from './layers.js';
import { plantYearRatio } from './plants.js';
import {
  intakeKgDay,
  grazeDay,
  starveDeaths,
  PREDATORS,
  killsPerDay,
  predatorChange,
  startPredators,
  RANGE,
  placeRanges,
  energyRatio,
  conditionDay,
} from './fauna.js';

const K = STREAMS.world[0];
const SALT = SALTS; // named once in streams.js
const draw = (s, id, salt, t = s.tick) => noise2(seedKey(s.seed), t, id, salt);

// ---------- animals ----------
// mass kg; density per km² of suitable land; herd = usual group; see = km a person spots the group; flee = m at which
// it runs; speed m/s; danger = chance a failed close attempt hurts the hunter; habitat weights by region.
export const SPECIES = {
  hare: {
    label: 'hare',
    mass: 2.5,
    density: 12,
    herd: 1,
    see: 0.02,
    flee: 8,
    speed: 15,
    danger: 0,
    habitat: { grass: 1, woodland: 0.6, shore: 0.3 },
    src: 'scrub hare (assumption)',
  },
  hyrax: {
    label: 'hyrax',
    mass: 3,
    density: 60,
    herd: 8,
    see: 0.05,
    flee: 12,
    speed: 5,
    danger: 0,
    habitat: { rock: 1 },
    src: 'rock hyrax colonies (assumption)',
  },
  dikdik: {
    label: 'dik-dik',
    mass: 5,
    density: 20,
    herd: 2,
    see: 0.05,
    flee: 20,
    speed: 12,
    danger: 0,
    habitat: { woodland: 1, river: 0.6 },
    src: "Kirk's dik-dik (Augustine 2010: high densities in bush)",
  },
  impala: {
    label: 'impala',
    mass: 50,
    density: 15,
    herd: 15,
    see: 0.3,
    flee: 60,
    speed: 20,
    danger: 0,
    habitat: { woodland: 1, grass: 0.6, river: 0.8 },
    src: 'impala 12-29/km² (Augustine 2010)',
  },
  zebra: {
    label: 'zebra',
    mass: 250,
    density: 3,
    herd: 10,
    see: 0.5,
    flee: 80,
    speed: 18,
    danger: 0.03,
    habitat: { grass: 1, woodland: 0.3 },
    src: 'plains zebra (assumption)',
  },
  buffalo: {
    label: 'buffalo',
    mass: 500,
    density: 1,
    herd: 20,
    see: 0.3,
    flee: 50,
    speed: 15,
    danger: 0.12,
    habitat: { woodland: 0.8, river: 1, grass: 0.4 },
    src: 'buffalo (assumption)',
  },
};
export const MEAT = { edible: 0.55, kcalPerKg: 1500 }; // share of live mass eaten; kcal per kg of wild carcass meat (approx.)
export const LARGE = 40; // kg: what counts as a large animal in the checks
const rMax = m => 1.1 * m ** -0.26; // per year (Fenchel 1974 slope)
const CELL = 8;
export const CW = Math.ceil(T.TW / CELL),
  CH = Math.ceil(T.TH / CELL);
export const cellOf = (x, y) => Math.floor(y / CELL) * CW + Math.floor(x / CELL);
let HAB = null; // per cell: km² of each region
function habitat() {
  if (HAB) return HAB;
  HAB = Array.from({ length: CW * CH }, () => ({}));
  for (let y = 0; y < T.TH; y++)
    for (let x = 0; x < T.TW; x++) {
      if (!T.isWalkable(x, y)) continue;
      const h = HAB[cellOf(x, y)],
        r = T.regionAt(x, y);
      h[r] = (h[r] ?? 0) + T.TILE_KM ** 2;
    }
  return HAB;
}
const capacity = (sp, c) => {
  const h = habitat()[c];
  let k = 0;
  for (const [r, w] of Object.entries(sp.habitat)) k += (h[r] ?? 0) * w;
  return k * sp.density;
};
export function makeAnimals() {
  const out = {};
  for (const [id, sp] of Object.entries(SPECIES))
    out[id] = Float64Array.from({ length: CW * CH }, (_, c) => capacity(sp, c));
  return out;
}
// Logistic growth per cell, daily; natural deaths leave carcasses some of the time (most go to predators unseen).
// With the real animals (Layer 5, fauna.js) the herds graze the plants layer's grass, and the land carries them
// in proportion to the year's grass growth; short of grass, they starve.
const animalsReal = s => (s.config?.layers?.animals ?? LAYERS.animals.status) === 'real';
export function animalDay(s) {
  const real = animalsReal(s),
    met = real ? grazing(s) : 1;
  // with weather, the land carries more herbivores after a wet year and fewer in drought (stand-in: forage follows
  // rain with exponent 0.7, approx.; real: the plants' own year)
  const grown = real ? plantYearRatio(s) : null,
    kf = s.weather ? Math.max(0.3, Math.min(1.4, grown ?? rainYearRatio(s) ** 0.7)) : 1;
  // with predators, the large herds (20 kg and up, the prey of lions and hyenas) are held by grass and predators;
  // small animals keep their field-count levels, which carry the small predators not modelled (jackals, caracals,
  // eagles, pythons): left to grass alone, hares and hyraxes overran the island (20-21 Nov 2026)
  const byGrass = s.config?.predators === true;
  for (const [id, sp] of Object.entries(SPECIES))
    (byGrass && sp.mass >= 20 ? grassHerdDay : speciesDay)(s, id, sp, kf, met);
  if (byGrass) predatorDay(s);
  dropCarcasses(s);
}
// Lions and hyenas (fauna.js): prides and clans, each on its own home range, hunt the herds in it; herds drift
// between neighbouring cells, so land no group holds is a refuge
function predatorDay(s) {
  s.predators ??= startGroups(s);
  driftHerds(s);
  for (const [id, P] of Object.entries(PREDATORS)) for (const g of s.predators[id].groups) huntDay(s, g, P);
  s.carrion?.fill(0); // what no scavenger ate in a day goes to vultures, jackals and rot
}
const CELL_KM2 = (CELL * T.TILE_KM) ** 2;
const habitatCells = () => habitat().flatMap((h, c) => ((h.grass ?? 0) + (h.woodland ?? 0) > 0 ? [c] : []));
const herdKg = (s, sp) => s.animals[sp].reduce((t, n) => t + n, 0) * SPECIES[sp].mass;
const preyKgOf = (s, P) => P.prey.reduce((t, sp) => t + herdKg(s, sp), 0);
// Ranges placed on the habitat; the starting numbers (Carbone and Gittleman's ratio) shared among the groups
function startGroups(s) {
  const out = {};
  for (const [id, P] of Object.entries(PREDATORS)) {
    const ranges = placeRanges(habitatCells(), R(RANGE[id]), CELL_KM2, CW, CH),
      each = startPredators(preyKgOf(s, P), P.mass) / Math.max(1, ranges.length);
    out[id] = { groups: ranges.map(cells => ({ cells, n: each, fed: 1, killedKg: 0 })) };
  }
  return out;
}
function huntDay(s, g, P) {
  const km2 = g.cells.length * CELL_KM2,
    herds = P.prey.map(sp => g.cells.reduce((t, c) => t + s.animals[sp][c], 0) / SPECIES[sp].herd / km2),
    kills = killsPerDay(P, herds, g.n);
  let meat = 0;
  P.prey.forEach((sp, k) => {
    const kg = g.n * kills[k] * SPECIES[sp].mass;
    meat += takePreyIn(s, sp, kg, g.cells) * MEAT.edible;
  });
  g.killedKg += meat / MEAT.edible;
  if (P.scavenges) meat += scavenge(s, g.cells, Math.max(0, g.n * P.needKg - meat));
  const ratio = g.n ? meat / (g.n * P.needKg) : 0;
  g.fed = Math.min(1, ratio);
  g.n = Math.max(0, g.n + predatorChange(g.n, g.fed, P.mass) / 365 - hungerDeaths(g, ratio));
}
// Body reserves, in days of need (full at predatorStarveDays): they fill when a group eats more than it needs and
// drain when it eats less; once empty, the hungry die as herbivores do (fauna.js starveDeaths)
function hungerDeaths(g, ratio) {
  const most = R('predatorStarveDays');
  g.reserve = Math.min(most, (g.reserve ?? most) + ratio - 1);
  if (g.reserve > 0) return 0;
  g.reserve = 0;
  return (g.n * (1 - Math.min(1, ratio))) / most;
}
// Meat (kg) a scavenging group finds today in its range from animals that died of other causes, up to what it needs
function scavenge(s, cells, wantKg) {
  let got = 0;
  for (const c of cells) {
    if (!s.carrion || got >= wantKg) break;
    const take = Math.min(s.carrion[c], wantKg - got);
    s.carrion[c] -= take;
    got += take;
  }
  return got;
}
// A kill of up to kg live mass from a herd, from the given cells in proportion to their animals; returns kg taken
function takePreyIn(s, sp, kg, cells) {
  const N = s.animals[sp],
    total = cells.reduce((t, c) => t + N[c], 0);
  if (!total || kg <= 0) return 0;
  const f = Math.min(1, kg / SPECIES[sp].mass / total);
  for (const c of cells) N[c] *= 1 - f;
  return f * total * SPECIES[sp].mass;
}
// Each day a share of every large herd moves to the neighbouring cells it can live in
function driftHerds(s) {
  const m = R('herdDriftPerDay');
  for (const [id, sp] of Object.entries(SPECIES)) {
    if (sp.mass < 20) continue;
    const N = s.animals[id],
      next = N.slice();
    for (let c = 0; c < N.length; c++) {
      const to = [c - 1, c + 1, c - CW, c + CW].filter(
        k => k >= 0 && k < N.length && Math.abs((k % CW) - (c % CW)) <= 1 && capacity(sp, k) > 0,
      );
      if (!to.length || !N[c]) continue;
      next[c] -= m * N[c];
      for (const k of to) next[k] += (m * N[c]) / to.length;
    }
    s.animals[id] = next;
  }
}
// The herds' need for the day, met from the herb layer (share met)
function grazing(s) {
  let demand = 0;
  for (const [id, sp] of Object.entries(SPECIES))
    demand += s.animals[id].reduce((t, n) => t + n, 0) * intakeKgDay(sp.mass);
  s.grazed = (s.grazed ?? 0) + demand;
  return grazeDay(s.plants, demand, landKm2());
}
let LAND_KM2 = null;
const landKm2 = () => (LAND_KM2 ??= habitat().reduce((t, h) => t + Object.values(h).reduce((a, b) => a + b, 0), 0));
function speciesDay(s, id, sp, kf, met) {
  const N = s.animals[id],
    r = rMax(sp.mass),
    dt = 1 / 365,
    day = animalsReal(s) ? herdCondition(s, id, met) : { breed: 1, starve: 0 };
  for (let c = 0; c < N.length; c++) {
    const K = capacity(sp, c) * kf;
    if (K <= 0) continue;
    const n = N[c],
      births = r * n * dt * day.breed,
      deaths = ((r * n * n) / K) * dt + n * day.starve;
    N[c] = Math.max(0, n + births - deaths);
    maybeCarcass(s, c, id, sp, deaths);
  }
}
// The energy law (fauna.js) for a herd today: its diet's energy against its need moves its body reserves; it breeds
// while they last and starves once they are gone. With the real animals this holds for every herd, field-count or not.
function herdCondition(s, id, met) {
  const cond = (s.condition ??= {}),
    day = conditionDay(cond[id] ?? R('herdStarveDays'), energyRatio(s.plants?.greenShare ?? 1, met));
  cond[id] = day.reserve;
  return day;
}
// A herd limited by its food, not by a field count: births at up to the most a mammal of its mass can grow (Fenchel
// 1974) in proportion to how much of its need it met today; background deaths (herbivoreDeathRate) and hunger deaths;
// predators take their share in predatorDay. Animals live only where their habitat is.
function grassHerdDay(s, id, sp, kf, met) {
  const N = s.animals[id],
    d = R('herbivoreDeathRate'),
    r = rMax(sp.mass),
    dt = 1 / 365;
  const day = herdCondition(s, id, met);
  for (let c = 0; c < N.length; c++) {
    if (capacity(sp, c) <= 0) continue;
    const n = N[c],
      deaths = d * n * dt + n * day.starve;
    N[c] = Math.max(0, n + (r + d) * day.breed * n * dt - deaths);
    (s.carrion ??= new Float64Array(N.length))[c] += deaths * sp.mass * MEAT.edible; // for scavengers today
    maybeCarcass(s, c, id, sp, deaths);
  }
}
// a carcass a person could find: most natural deaths are kills that lions and hyenas finish; a small share
// (register: carcassFound) lies with meat on it for about a day
function maybeCarcass(s, c, id, sp, deaths) {
  if (sp.mass < 20) return;
  if (draw(s, c * 7 + Object.keys(SPECIES).indexOf(id), SALT.carcass) >= Math.min(1, deaths * R('carcassFound')))
    return;
  const tiles = [];
  for (let k = 0; k < 6; k++) {
    const x = (c % CW) * CELL + Math.floor(draw(s, c, SALT.carcassX, s.tick * 6 + k) * CELL),
      y = Math.floor(c / CW) * CELL + Math.floor(draw(s, c, SALT.carcassY, s.tick * 6 + k) * CELL);
    if (T.isWalkable(x, y)) {
      tiles.push([x, y]);
      break;
    }
  }
  if (tiles.length) placeCarcass(s, id, sp, tiles[0]);
}
function placeCarcass(s, id, sp, [x, y]) {
  const kcal = sp.mass * MEAT.edible * MEAT.kcalPerKg * 0.5;
  s.carcasses.push({
    id: s.nextId++,
    species: id,
    x,
    y,
    kcal,
    kcal0: kcal,
    taken: 0,
    until: s.tick + Math.round(clockOf(s).day / spoilFactor(s)),
    natural: true,
    roasted: false,
  });
  book(s, 'made', kcal);
}
// carcasses that rot or are eaten by scavengers leave the world (booked)
export function dropCarcasses(s) {
  s.carcasses = s.carcasses.filter(k => {
    const keep = k.until > s.tick && k.kcal > 100;
    if (!keep) book(s, 'rotted', k.kcal);
    return keep;
  });
}
export const book = (s, k, kcal) => {
  const L = (s.ledger.carcass ??= { made: 0, taken: 0, rotted: 0 });
  L[k] += kcal;
};
// Groups met while walking `km` in a cell: Poisson mean = km x 2 x sighting distance x group density.
export function sightings(s, p, km) {
  const c = cellOf(p.x, p.y),
    h = habitat()[c],
    area = Object.values(h).reduce((a, b) => a + b, 0) || 1,
    out = [];
  for (const [id, sp] of Object.entries(SPECIES)) {
    const groups = s.animals[id][c] / sp.herd / area,
      mean = km * 2 * sp.see * groups;
    if (mean > 0 && draw(s, p.id * 13 + Object.keys(SPECIES).indexOf(id), SALT.encounter) < 1 - Math.exp(-mean))
      out.push(id);
  }
  return out;
}

// ---------- materials ----------
// What a tile offers to be picked up. hardness (Mohs), mass kg, fracture (conchoidal, tough, none), moisture by season.
export const MATERIAL = {
  flint: { label: 'flint', hard: 7, mass: 1, fracture: 'conchoidal', where: { rock: 0.35, river: 0.12 } },
  cobble: { label: 'cobble', hard: 6, mass: 0.8, fracture: 'tough', where: { river: 0.6, shore: 0.4, rock: 0.3 } },
  stick: {
    label: 'dead stick',
    hard: 1,
    mass: 0.6,
    fracture: 'none',
    wood: true,
    where: { woodland: 0.9, river: 0.6, grass: 0.15 },
  },
  tinder: {
    label: 'dry grass',
    hard: 0,
    mass: 0.05,
    fracture: 'none',
    tinder: true,
    where: { grass: 0.9, shore: 0.3 },
  },
};
const hash = (x, y, k) => noise2(0x5eed1234, x, y, k);
export function materialsAt(x, y) {
  const r = T.regionAt(x, y),
    out = [];
  for (const [k, m] of Object.entries(MATERIAL)) {
    const p = m.where[r] ?? 0;
    if (p > 0 && hash(x, y, Object.keys(MATERIAL).indexOf(k) + 1) < p) out.push(k);
  }
  return out;
}
// Wood and grass are dry in the dry season (about 10% water) and wet in the rains.
export const moisture = (s, tick = s.tick) => {
  if (s.weather && tick === s.tick) return woodMoisture(s);
  const C = clockOf(s),
    f = (((tick % C.year) + C.year) % C.year) / C.year;
  return f < 7 / 12 ? 0.3 : 0.1;
};

// ---------- the laws: what an action on two things does ----------
// Each returns { made, note } or null (nothing happened). `skill` is the doer's 0-1 practice at this action.
// The chance that a first, unpractised try works (a blank slate: someone who has never seen it done). Approx.; to
// sweep. A novice striking flint mostly crushes or misses it; a useful sharp flake on a first strike is uncommon;
// a fire drill takes most people many failed tries before an ember (experimental archaeology, qualitative).
export const FIRST = {
  get flake() {
    return R('firstFlake');
  },
  get chopper() {
    return R('firstChopper');
  },
  get spear() {
    return R('firstSpear');
  },
  get ember() {
    return R('firstEmber');
  },
}; // read from the register
export const ITEM = {
  flake: { label: 'sharp flake', sharp: 0.9, hard: 7, mass: 0.05 },
  chopper: { label: 'rough-edged stone', sharp: 0.4, hard: 6, mass: 0.6 },
  spear: { label: 'pointed stick', point: true, mass: 1, reach: 2, throwRange: 10 },
  brand: { label: 'burning stick', burning: true, mass: 0.6 },
};
export const hardnessOf = k => MATERIAL[k]?.hard ?? ITEM[k]?.hard ?? 0;
export const massOf = k => MATERIAL[k]?.mass ?? ITEM[k]?.mass ?? 0;
export function law(s, verb, a, b, skill, r) {
  const A = MATERIAL[a] ?? ITEM[a],
    B = MATERIAL[b] ?? ITEM[b];
  if (!A || !B) return null;
  if (verb === 'strike') return strike(A, B, a, b, skill, r);
  if (verb === 'cut') return cut(a, b, skill, r);
  if (verb === 'rub') return rub(s, a, b, skill, r);
  return null;
}
// a hard, heavy enough stone breaks a conchoidal stone into a sharp flake; two tough stones give a rough edge
function strike(A, B, a, b, skill, r) {
  for (const [h] of [
    [A, B],
    [B, A],
  ]) {
    const hk = h === A ? a : b,
      tk = h === A ? b : a;
    if (
      MATERIAL[tk]?.fracture === 'conchoidal' &&
      hardnessOf(hk) >= hardnessOf(tk) - 1 &&
      massOf(hk) >= 0.3 &&
      r < FIRST.flake + (0.9 - FIRST.flake) * skill
    )
      return { made: 'flake', note: 'struck a flake off the flint' };
  }
  if (
    MATERIAL[a]?.fracture === 'tough' &&
    MATERIAL[b]?.fracture === 'tough' &&
    r < FIRST.chopper + (0.4 - FIRST.chopper) * skill
  )
    return { made: 'chopper', note: 'broke a rough edge on a cobble' };
  return null;
}
// an edge harder than the thing, and sharp enough, shapes wood into a point
function cut(a, b, skill, r) {
  for (const [e, w] of [
    [a, b],
    [b, a],
  ])
    if ((ITEM[e]?.sharp ?? 0) >= 0.35 && MATERIAL[w]?.wood && r < FIRST.spear + (0.9 - FIRST.spear) * skill)
      return { made: 'spear', note: 'cut a stick to a point' };
  return null;
}
// friction between two pieces of dry wood can make an ember; dry grass catches it
function rub(s, a, b, skill, r) {
  if (!(MATERIAL[a]?.wood && MATERIAL[b]?.wood)) return null;
  if (moisture(s) > 0.15) return null; // wet wood: the heat goes into the water (no ember)
  if (r < FIRST.ember + (0.55 - FIRST.ember) * skill)
    return { made: 'ember', note: 'twirled one dry stick against another until it smoked and glowed' };
  return null;
}
export const VERBS = ['strike', 'cut', 'rub'];

// ---------- fire ----------
export const FIRE = { burnKgH: 1.0, fuelPerStick: 0.6, startFuel: 1.5, rainOut: 0.005 }; // approx.; a small cooking fire
export const COOK = { tubers: 1.3, meat: 1.15, fish: 1.1, shellfish: 1.05, nuts: 1.1 }; // energy gain from cooking (assumption; Carmody et al. 2011 give direction only)
// Lightning: in the dry season, about one fire per 1,000 km² a day lights the grass of one cell for a day, so a given
// patch of grass burns every few years (approx.; savanna fire return 2-6 years).
export function wildfireDay(s) {
  const C = clockOf(s),
    f = (((s.tick % C.year) + C.year) % C.year) / C.year;
  // with weather: grass burns when it has cured (dry soil, no rain for three days), and more often when last year's
  // rain grew more grass to burn (fuel); without weather, the dry season by the calendar
  const odds = s.weather ? (soilMoisture(s) < 0.3 && rainLastDays(s, 3) < 1 ? fuelOdds(s) : 0) : f < 7 / 12 ? 0 : 1;
  if (!odds) return;
  if (draw(s, 1, SALT.fire) < (odds * T.LAND_KM2) / 1000) {
    const c = Math.floor(draw(s, 2, SALT.fire) * CW * CH),
      h = habitat()[c];
    if ((h.grass ?? 0) + (h.woodland ?? 0) < 2) return;
    const x = ((c % CW) * CELL + CELL / 2) | 0,
      y = (Math.floor(c / CW) * CELL + CELL / 2) | 0;
    s.wildfires.push({ x, y, cell: c, until: s.tick + C.day });
    burnFuel(s, h);
    roastedByFire(s, x, y, C);
  }
  s.wildfires = s.wildfires.filter(w => w.until > s.tick);
}
// How readily grass fire runs. With the real plants: in proportion to the cured grass standing (fires in savanna
// are limited by fuel, not by sparks: Archibald et al. 2010; fuel follows the past years' rain: Govender et al.
// 2006), against its usual level on days fire is possible (fuelRefGm2); no dead grass, no fire. Before that, the
// rain-year shortcut.
function fuelOdds(s) {
  if (s.plants && (s.config?.layers?.plants ?? LAYERS.plants.status) === 'real')
    return Math.min(1.6, s.plants.dead / R('fuelRefGm2'));
  return Math.max(0.3, Math.min(1.6, rainYearRatio(s)));
}
// The fire burns the cured grass on its ground: the island's dead grass falls by the burnt share of the land (only
// grass not eaten is fuel, and what burns is no longer there to burn or eat)
function burnFuel(s, h) {
  const P = s.plants;
  if (!P || (s.config?.layers?.plants ?? LAYERS.plants.status) !== 'real') return;
  const burnt = (P.dead * ((h.grass ?? 0) + (h.woodland ?? 0))) / T.LAND_KM2;
  P.dead -= burnt;
  P.burnedTotal = (P.burnedTotal ?? 0) + burnt;
}
// small animals caught by the fire: roasted carcasses for anyone who comes
function roastedByFire(s, x, y, C) {
  for (let k = 0; k < 2; k++) {
    if (!T.isWalkable(x + k, y)) continue;
    const kcal = 2.5 * MEAT.edible * MEAT.kcalPerKg;
    s.carcasses.push({
      id: s.nextId++,
      species: 'hare',
      x: x + k,
      y,
      kcal,
      kcal0: kcal,
      taken: 0,
      until: s.tick + 2 * C.day,
      natural: true,
      roasted: true,
    });
    book(s, 'made', kcal);
  }
}

// ---------- taking an animal ----------
// The hunter must get within reach before the group flees, hit, and disable: damage = kinetic energy x 3 with a point,
// against k x mass. Weapons: hands (1 m, ~50 J), thrown stone (8 m, ~45 J), stick (1.5 m, ~60 J), pointed stick
// thrust (2 m, ~80 J) or thrown (10 m, ~110 J). k is set so that a thrown point kills a struck impala about two times
// in five; the large-game check against Hadza rates (above) tests it.
export const WEAPON = {
  hands: { reach: 1, joule: 50, point: false },
  stone: { reach: 8, joule: 45, point: false },
  stick: { reach: 1.5, joule: 60, point: false },
  spear: { reach: 10, joule: 110, point: true },
};
const KILL_K = 15.6;
export function attempt(s, p, species, weapon, skill, stealth, fleeMult = 1) {
  const sp = SPECIES[species],
    w = WEAPON[weapon],
    key = [SALT.attempt, SALT.attemptHit, SALT.attemptDisable, SALT.attemptHurt],
    r = i => draw(s, p.id, key[i]);
  const close = Math.min(1, w.reach / (sp.flee * fleeMult)) * stealth; // getting within reach before it bolts: harder the further it flees (and wary herds flee further)
  if (r(0) > close) return { got: false, why: 'it ran before I was close' };
  if (r(1) > 0.4 + 0.4 * skill) return { got: false, why: 'I missed', hurt: r(3) < sp.danger };
  const dmg = w.joule * (w.point ? 3 : 1),
    disable = 1 - Math.exp(-dmg / (KILL_K * sp.mass));
  if (r(2) > disable) return { got: false, why: 'I hit it but it got away', hurt: r(3) < sp.danger };
  return { got: true };
}
export const carcassKcal = species => SPECIES[species].mass * MEAT.edible * MEAT.kcalPerKg;
// How much of a carcass a person can get at: soft parts by hand, more by smashing bones for marrow, most with an edge.
export const access = (hasEdge, hasStone) => (hasEdge ? 0.9 : hasStone ? 0.4 : 0.3);
export { hourOf };
