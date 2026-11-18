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

const K = STREAMS.world[0];
const SALT = SALTS; // named once in streams.js
const draw = (s, id, salt, t = s.tick) => noise2(seedKey(s.seed), t, id, salt);

// ---------- animals ----------
// mass kg; density per km² of suitable land; herd = usual group; see = km a person spots the group; flee = m at which
// it runs; speed m/s; danger = chance a failed close attempt hurts the hunter; habitat weights by region.
export const SPECIES = {
  hare:    { label: 'hare', mass: 2.5, density: 12, herd: 1, see: 0.02, flee: 8, speed: 15, danger: 0, habitat: { grass: 1, woodland: 0.6, shore: 0.3 }, src: 'scrub hare (assumption)' },
  hyrax:   { label: 'hyrax', mass: 3, density: 60, herd: 8, see: 0.05, flee: 12, speed: 5, danger: 0, habitat: { rock: 1 }, src: 'rock hyrax colonies (assumption)' },
  dikdik:  { label: 'dik-dik', mass: 5, density: 20, herd: 2, see: 0.05, flee: 20, speed: 12, danger: 0, habitat: { woodland: 1, river: 0.6 }, src: 'Kirk\'s dik-dik (Augustine 2010: high densities in bush)' },
  impala:  { label: 'impala', mass: 50, density: 15, herd: 15, see: 0.3, flee: 60, speed: 20, danger: 0, habitat: { woodland: 1, grass: 0.6, river: 0.8 }, src: 'impala 12-29/km² (Augustine 2010)' },
  zebra:   { label: 'zebra', mass: 250, density: 3, herd: 10, see: 0.5, flee: 80, speed: 18, danger: 0.03, habitat: { grass: 1, woodland: 0.3 }, src: 'plains zebra (assumption)' },
  buffalo: { label: 'buffalo', mass: 500, density: 1, herd: 20, see: 0.3, flee: 50, speed: 15, danger: 0.12, habitat: { woodland: 0.8, river: 1, grass: 0.4 }, src: 'buffalo (assumption)' },
};
export const MEAT = { edible: 0.55, kcalPerKg: 1500 }; // share of live mass eaten; kcal per kg of wild carcass meat (approx.)
export const LARGE = 40; // kg: what counts as a large animal in the checks
const rMax = m => 1.1 * m ** -0.26; // per year (Fenchel 1974 slope)
const CELL = 8; export const CW = Math.ceil(T.TW / CELL), CH = Math.ceil(T.TH / CELL);
export const cellOf = (x, y) => Math.floor(y / CELL) * CW + Math.floor(x / CELL);
let HAB = null; // per cell: km² of each region
function habitat() {
  if (HAB) return HAB;
  HAB = Array.from({ length: CW * CH }, () => ({}));
  for (let y = 0; y < T.TH; y++) for (let x = 0; x < T.TW; x++) { if (!T.isWalkable(x, y)) continue; const h = HAB[cellOf(x, y)], r = T.regionAt(x, y); h[r] = (h[r] ?? 0) + T.TILE_KM ** 2; }
  return HAB;
}
const capacity = (sp, c) => { const h = habitat()[c]; let k = 0; for (const [r, w] of Object.entries(sp.habitat)) k += (h[r] ?? 0) * w; return k * sp.density; };
export function makeAnimals() {
  const out = {};
  for (const [id, sp] of Object.entries(SPECIES)) out[id] = Float64Array.from({ length: CW * CH }, (_, c) => capacity(sp, c));
  return out;
}
// Logistic growth per cell, daily; natural deaths leave carcasses some of the time (most go to predators unseen).
export function animalDay(s) {
  const C = clockOf(s), dt = 1 / 365;
  for (const [id, sp] of Object.entries(SPECIES)) {
    // with weather, the land carries more herbivores after a wet year and fewer in drought (forage follows rain;
    // exponent 0.7 so herds respond less than in proportion, approx.)
    const N = s.animals[id], r = rMax(sp.mass), kf = s.weather ? Math.max(0.3, Math.min(1.4, rainYearRatio(s) ** 0.7)) : 1;
    for (let c = 0; c < N.length; c++) {
      const K = capacity(sp, c) * kf; if (K <= 0) continue;
      const n = N[c], births = r * n * dt, deaths = r * n * n / K * dt;
      N[c] = Math.max(0, n + births - deaths);
      // a carcass a person could find: most natural deaths are kills that lions and hyenas finish; a small share
      // (register: carcassFound) lies with meat on it for about a day
      if (sp.mass >= 20 && draw(s, c * 7 + Object.keys(SPECIES).indexOf(id), SALT.carcass) < Math.min(1, deaths * R('carcassFound'))) {
        const tiles = []; for (let k = 0; k < 6; k++) { const x = (c % CW) * CELL + Math.floor(draw(s, c, SALT.carcassX, s.tick * 6 + k) * CELL), y = Math.floor(c / CW) * CELL + Math.floor(draw(s, c, SALT.carcassY, s.tick * 6 + k) * CELL); if (T.isWalkable(x, y)) { tiles.push([x, y]); break; } }
        if (tiles.length) { const kcal = sp.mass * MEAT.edible * MEAT.kcalPerKg * 0.5; s.carcasses.push({ id: s.nextId++, species: id, x: tiles[0][0], y: tiles[0][1], kcal, kcal0: kcal, taken: 0, until: s.tick + Math.round(C.day / spoilFactor(s)), natural: true, roasted: false }); book(s, 'made', kcal); }
      }
    }
  }
  dropCarcasses(s);
}
// carcasses that rot or are eaten by scavengers leave the world (booked)
export function dropCarcasses(s) { s.carcasses = s.carcasses.filter(k => { const keep = k.until > s.tick && k.kcal > 100; if (!keep) book(s, 'rotted', k.kcal); return keep; }); }
export const book = (s, k, kcal) => { const L = (s.ledger.carcass ??= { made: 0, taken: 0, rotted: 0 }); L[k] += kcal; };
// Groups met while walking `km` in a cell: Poisson mean = km x 2 x sighting distance x group density.
export function sightings(s, p, km) {
  const c = cellOf(p.x, p.y), h = habitat()[c], area = Object.values(h).reduce((a, b) => a + b, 0) || 1, out = [];
  for (const [id, sp] of Object.entries(SPECIES)) {
    const groups = s.animals[id][c] / sp.herd / area, mean = km * 2 * sp.see * groups;
    if (mean > 0 && draw(s, p.id * 13 + Object.keys(SPECIES).indexOf(id), SALT.encounter) < 1 - Math.exp(-mean)) out.push(id);
  }
  return out;
}

// ---------- materials ----------
// What a tile offers to be picked up. hardness (Mohs), mass kg, fracture (conchoidal, tough, none), moisture by season.
export const MATERIAL = {
  flint:  { label: 'flint', hard: 7, mass: 1, fracture: 'conchoidal', where: { rock: 0.35, river: 0.12 } },
  cobble: { label: 'cobble', hard: 6, mass: 0.8, fracture: 'tough', where: { river: 0.6, shore: 0.4, rock: 0.3 } },
  stick:  { label: 'dead stick', hard: 1, mass: 0.6, fracture: 'none', wood: true, where: { woodland: 0.9, river: 0.6, grass: 0.15 } },
  tinder: { label: 'dry grass', hard: 0, mass: 0.05, fracture: 'none', tinder: true, where: { grass: 0.9, shore: 0.3 } },
};
const hash = (x, y, k) => noise2(0x5eed1234, x, y, k);
export function materialsAt(x, y) {
  const r = T.regionAt(x, y), out = [];
  for (const [k, m] of Object.entries(MATERIAL)) { const p = m.where[r] ?? 0; if (p > 0 && hash(x, y, Object.keys(MATERIAL).indexOf(k) + 1) < p) out.push(k); }
  return out;
}
// Wood and grass are dry in the dry season (about 10% water) and wet in the rains.
export const moisture = (s, tick = s.tick) => { if (s.weather && tick === s.tick) return woodMoisture(s); const C = clockOf(s), f = (((tick % C.year) + C.year) % C.year) / C.year; return f < 7 / 12 ? 0.3 : 0.1; };

// ---------- the laws: what an action on two things does ----------
// Each returns { made, note } or null (nothing happened). `skill` is the doer's 0-1 practice at this action.
// The chance that a first, unpractised try works (a blank slate: someone who has never seen it done). Approx.; to
// sweep. A novice striking flint mostly crushes or misses it; a useful sharp flake on a first strike is uncommon;
// a fire drill takes most people many failed tries before an ember (experimental archaeology, qualitative).
export const FIRST = { get flake() { return R('firstFlake'); }, get chopper() { return R('firstChopper'); }, get spear() { return R('firstSpear'); }, get ember() { return R('firstEmber'); } }; // read from the register
export const ITEM = {
  flake:   { label: 'sharp flake', sharp: 0.9, hard: 7, mass: 0.05 },
  chopper: { label: 'rough-edged stone', sharp: 0.4, hard: 6, mass: 0.6 },
  spear:   { label: 'pointed stick', point: true, mass: 1, reach: 2, throwRange: 10 },
  brand:   { label: 'burning stick', burning: true, mass: 0.6 },
};
export const hardnessOf = k => MATERIAL[k]?.hard ?? ITEM[k]?.hard ?? 0;
export const massOf = k => MATERIAL[k]?.mass ?? ITEM[k]?.mass ?? 0;
export function law(s, verb, a, b, skill, r) {
  const A = MATERIAL[a] ?? ITEM[a], B = MATERIAL[b] ?? ITEM[b];
  if (!A || !B) return null;
  if (verb === 'strike') {
    // a hard, heavy enough stone breaks a conchoidal stone into a sharp flake; two tough stones give a rough edge
    for (const [h, t] of [[A, B], [B, A]]) {
      const hk = h === A ? a : b, tk = h === A ? b : a;
      if (MATERIAL[tk]?.fracture === 'conchoidal' && hardnessOf(hk) >= hardnessOf(tk) - 1 && massOf(hk) >= 0.3 && r < FIRST.flake + (0.9 - FIRST.flake) * skill) return { made: 'flake', note: 'struck a flake off the flint' };
    }
    if (MATERIAL[a]?.fracture === 'tough' && MATERIAL[b]?.fracture === 'tough' && r < FIRST.chopper + (0.4 - FIRST.chopper) * skill) return { made: 'chopper', note: 'broke a rough edge on a cobble' };
    return null;
  }
  if (verb === 'cut') {
    // an edge harder than the thing, and sharp enough, shapes wood into a point
    for (const [e, w] of [[a, b], [b, a]]) if ((ITEM[e]?.sharp ?? 0) >= 0.35 && MATERIAL[w]?.wood && r < FIRST.spear + (0.9 - FIRST.spear) * skill) return { made: 'spear', note: 'cut a stick to a point' };
    return null;
  }
  if (verb === 'rub') {
    // friction between two pieces of dry wood can make an ember; dry grass catches it
    if (MATERIAL[a]?.wood && MATERIAL[b]?.wood) {
      if (moisture(s) > 0.15) return null; // wet wood: the heat goes into the water (no ember)
      if (r < FIRST.ember + (0.55 - FIRST.ember) * skill) return { made: 'ember', note: 'twirled one dry stick against another until it smoked and glowed' };
    }
    return null;
  }
  return null;
}
export const VERBS = ['strike', 'cut', 'rub'];

// ---------- fire ----------
export const FIRE = { burnKgH: 1.0, fuelPerStick: 0.6, startFuel: 1.5, rainOut: 0.005 }; // approx.; a small cooking fire
export const COOK = { tubers: 1.3, meat: 1.15, fish: 1.1, shellfish: 1.05, nuts: 1.1 }; // energy gain from cooking (assumption; Carmody et al. 2011 give direction only)
// Lightning: in the dry season, about one fire per 1,000 km² a day lights the grass of one cell for a day, so a given
// patch of grass burns every few years (approx.; savanna fire return 2-6 years).
export function wildfireDay(s) {
  const C = clockOf(s), f = (((s.tick % C.year) + C.year) % C.year) / C.year;
  // with weather: grass burns when it has cured (dry soil, no rain for three days), and more often when last year's
  // rain grew more grass to burn (fuel); without weather, the dry season by the calendar
  const odds = s.weather ? (soilMoisture(s) < 0.3 && rainLastDays(s, 3) < 1 ? Math.max(0.3, Math.min(1.6, rainYearRatio(s))) : 0) : (f < 7 / 12 ? 0 : 1);
  if (!odds) return;
  if (draw(s, 1, SALT.fire) < odds * T.LAND_KM2 / 1000) {
    const c = Math.floor(draw(s, 2, SALT.fire) * CW * CH), h = habitat()[c];
    if ((h.grass ?? 0) + (h.woodland ?? 0) < 2) return;
    const x = (c % CW) * CELL + CELL / 2 | 0, y = Math.floor(c / CW) * CELL + CELL / 2 | 0;
    s.wildfires.push({ x, y, cell: c, until: s.tick + C.day });
    // small animals caught by the fire: roasted carcasses for anyone who comes
    for (let k = 0; k < 2; k++) { if (!T.isWalkable(x + k, y)) continue; const kcal = 2.5 * MEAT.edible * MEAT.kcalPerKg; s.carcasses.push({ id: s.nextId++, species: 'hare', x: x + k, y, kcal, kcal0: kcal, taken: 0, until: s.tick + 2 * C.day, natural: true, roasted: true }); book(s, 'made', kcal); }
  }
  s.wildfires = s.wildfires.filter(w => w.until > s.tick);
}

// ---------- taking an animal ----------
// The hunter must get within reach before the group flees, hit, and disable: damage = kinetic energy x 3 with a point,
// against k x mass. Weapons: hands (1 m, ~50 J), thrown stone (8 m, ~45 J), stick (1.5 m, ~60 J), pointed stick
// thrust (2 m, ~80 J) or thrown (10 m, ~110 J). k is set so that a thrown point kills a struck impala about two times
// in five; the large-game check against Hadza rates (above) tests it.
export const WEAPON = { hands: { reach: 1, joule: 50, point: false }, stone: { reach: 8, joule: 45, point: false }, stick: { reach: 1.5, joule: 60, point: false },
  spear: { reach: 10, joule: 110, point: true } };
const KILL_K = 15.6;
export function attempt(s, p, species, weapon, skill, stealth) {
  const sp = SPECIES[species], w = WEAPON[weapon], key = [SALT.attempt, SALT.attemptHit, SALT.attemptDisable, SALT.attemptHurt], r = i => draw(s, p.id, key[i]);
  const close = Math.min(1, w.reach / sp.flee) * stealth; // getting within reach before it bolts: harder the further it flees
  if (r(0) > close) return { got: false, why: 'it ran before I was close' };
  if (r(1) > 0.4 + 0.4 * skill) return { got: false, why: 'I missed', hurt: r(3) < sp.danger };
  const dmg = w.joule * (w.point ? 3 : 1), disable = 1 - Math.exp(-dmg / (KILL_K * sp.mass));
  if (r(2) > disable) return { got: false, why: 'I hit it but it got away', hurt: r(3) < sp.danger };
  return { got: true };
}
export const carcassKcal = species => SPECIES[species].mass * MEAT.edible * MEAT.kcalPerKg;
// How much of a carcass a person can get at: soft parts by hand, more by smashing bones for marrow, most with an edge.
export const access = (hasEdge, hasStone) => hasEdge ? 0.9 : hasStone ? 0.4 : 0.3;
export { hourOf };
