// Island: the savanna world, modelled on the East African lake-and-savanna country where early humans lived.
//
// Everything is in real units first, then converted to the sim's units, so the ratios are physical:
//   - One sim year is 1440 ticks, so one tick is 365 x 24 / 1440 = 6.08 hours of life.
//   - The existing body: hunger rises 0.05 a tick, and one food unit lowers it by 4. So an adult needs 18 units a year.
//     At about 2,000 kcal a day (730,000 a year), one food unit is about 40,600 kcal.
//   - A food's return rate (kcal per hour of foraging) sets how many ticks it takes to gather it.
//   - Land: Hadza foragers live at about 0.24 people per km2 (Marlowe's compilation). The island's land area times that
//     density gives the number of people the land can feed in an ordinary year; the plants and fish are set to
//     produce exactly that much food, spread across seasons. More people than that, or a drought, means scarcity.
//   - Rain: 300-600 mm a year, most of it in a 6-7 month wet season (November to May); the rest of the year is dry.
//     Rain varies hard from year to year (droughts every few years, linked to El Nino) and over decades.
//   - Natural decay: ripe fruit rots on the bush, pods and nuts slowly spoil; tubers keep in the ground.
// Figures marked (approx.) are reasonable values not yet pinned to one source; they are listed in THEORY-CHECK.md.

import { registerMap, noise2, seedKey, STREAMS } from './sim.js';
import { clockOf, body, growPatch } from './clock.js';
// On the real clock (clock.js) every food has a half-life, and a patch left alone settles where growth equals decay
// (no capMonths cap); one food unit is 500 kcal and one tick is an hour. Legacy worlds keep the numbers below.

export const YEAR_TICKS = 1440;
export const TICK_HOURS = 365 * 24 / YEAR_TICKS;          // 6.08 h
export const KCAL_PER_UNIT = 730000 / 18;                 // ~40,600 kcal
export const DENSITY = 0.24;                              // people per km2 (Hadza)
export const TILE_KM = 0.35;                              // one tile is 350 m across (0.1225 km2)

// ---------- The land ----------
const W = 80, H = 56;
const LAKE = { x: 24, y: 30, rx: 8, ry: 6 };
const RIVER = [[63, 7], [57, 12], [50, 18], [43, 22], [36, 26], [31, 29]]; // from the north-east hills to the lake
const ROCKS = [[64, 9, 2.6], [59, 43, 2.4], [13, 13, 2.4], [42, 46, 2.2]];
const island = (x, y) => {
  const dx = (x + 0.5 - 40) / 37.5, dy = (y + 0.5 - 28) / 25.5, th = Math.atan2(dy, dx);
  return Math.hypot(dx, dy) <= 1 + 0.05 * Math.sin(3 * th) + 0.035 * Math.cos(5 * th + 1);
};
const lakeE = (x, y) => ((x + 0.5 - LAKE.x) / LAKE.rx) ** 2 + ((y + 0.5 - LAKE.y) / LAKE.ry) ** 2;
function segDist(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}
const riverDist = (x, y) => Math.min(...RIVER.slice(1).map((b, i) => segDist(x + 0.5, y + 0.5, RIVER[i], b)));

// Region of each tile, computed once.
export const REGIONS = ['sea', 'lake', 'river', 'rock', 'shore', 'woodland', 'grass'];
const grid = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let r = 'sea';
  if (island(x, y)) {
    const e = lakeE(x, y), rd = riverDist(x, y);
    if (e <= 1) r = 'lake';
    else if (rd <= 0.8 && e > 1) r = 'river';
    else if (ROCKS.some(([rx, ry, rr]) => Math.hypot(x + 0.5 - rx, y + 0.5 - ry) <= rr)) r = 'rock';
    else if (e <= 1.9) r = 'shore';
    else if (rd <= 3.5 || y < 22) r = 'woodland';
    else r = 'grass';
  }
  grid[y * W + x] = REGIONS.indexOf(r);
}
export const regionAt = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 'sea' : REGIONS[grid[y * W + x]];
const walkable = (x, y) => { const r = regionAt(x, y); return r !== 'sea' && r !== 'lake'; };
export const SAVANNA_MAP = registerMap({ id: 'savanna', w: W, h: H, land: walkable, regionAt });
export const LAND_TILES = Array.from(grid).filter(i => REGIONS[i] !== 'sea' && REGIONS[i] !== 'lake').length;
export const LAND_KM2 = LAND_TILES * TILE_KM * TILE_KM;
export const CARRYING = DENSITY * LAND_KM2;               // people the land feeds in an ordinary year

// ---------- Seasons and climate ----------
// The year starts in November, at the first rains. Wet season: first 58% of the year (Nov-May). Dry: Jun-Oct.
export const WET_SHARE = 7 / 12;
export const seasonOf = tick => ((tick % YEAR_TICKS) + YEAR_TICKS) % YEAR_TICKS / YEAR_TICKS < WET_SHARE ? 'wet' : 'dry';
const fracOf = tick => (((tick % YEAR_TICKS) + YEAR_TICKS) % YEAR_TICKS) / YEAR_TICKS;
// Yearly rain, relative to an ordinary year: a lognormal year-to-year swing (sd 0.4 in log terms, so a severe drought,
// under 60% of normal rain, comes about one year in ten) times a slow 40-year wet/dry swing of +-20%. Fixed by the seed.
export const CLIMATE = { yearSd: 0.4, swing: 0.2, swingYears: 40, drought: 0.6 };
const rainCache = new Map();
// set by weather.js when a world has weather (avoids an import cycle)
let weatherRain = s => 1, weatherRegrowHalf = () => 0.5;
export const useWeather = (rainFn, halfFn) => { weatherRain = rainFn; weatherRegrowHalf = halfFn; };
export function rainOf(seed, year) {
  const key = seed + ':' + year; if (rainCache.has(key)) return rainCache.get(key);
  const k = seedKey(seed), u = i => noise2(k, year + 1000, i, STREAMS.climate[0]);
  const z = (u(0) + u(1) + u(2) + u(3) + u(4) + u(5) - 3) * Math.SQRT2; // approx. normal, sd 1
  const phase = noise2(k, 0, 99, STREAMS.climate[0]) * 2 * Math.PI;
  // exp(sd z) averages exp(sd^2 / 2), so divide that out: an ordinary year is 1.
  const r = Math.max(0.15, Math.min(2.5, Math.exp(CLIMATE.yearSd * z - CLIMATE.yearSd ** 2 / 2) * (1 + CLIMATE.swing * Math.sin(2 * Math.PI * year / CLIMATE.swingYears + phase))));
  if (rainCache.size > 5000) rainCache.clear(); rainCache.set(key, r); return r;
}
export const yearOf = tick => Math.floor(tick / YEAR_TICKS);

// ---------- Foods ----------
// share: part of the island's food that comes from it (approx., plant and water foods; no hunting yet).
// kcalHour: adult return rate while foraging (approx.). hard: skill-intensive (tubers, honey), so children
// return far less (Pretelli et al. 2022: fruit and shellfish returns reach adult levels by adolescence; tubers
// and game rise slowly into adulthood). season(f): how productive it is at that point of the year (normalised
// below to average 1). rain: how much its yield follows the year's rain (1 fully, 0 not at all).
// halfLifeDays: natural decay of ripe food left uncollected (0 = keeps). capMonths: most it can hold (legacy only).
// realHalfLifeDays (real clock): every food decays. Tubers die back or are eaten by others over about 2 years
// (approx.); hives are abandoned and fish and shellfish populations turn over in about a year (approx.).
const bump = (f, c, w) => Math.exp(-((((f - c + 1.5) % 1 - 0.5) / w) ** 2));
export const FOODS = {
  berries: { label: 'Berries', region: ['woodland', 'river'], share: 0.18, kcalHour: 1500, hard: false, rain: 1, halfLifeDays: 14, realHalfLifeDays: 14, capMonths: 2, season: f => f < WET_SHARE ? Math.sin(Math.PI * f / WET_SHARE) : 0 },
  baobab: { label: 'Baobab fruit', region: ['grass', 'woodland'], share: 0.18, kcalHour: 2000, hard: false, rain: 0.6, halfLifeDays: 180, realHalfLifeDays: 180, capMonths: 5, season: f => f >= WET_SHARE ? 0.2 + Math.sin(Math.PI * (f - WET_SHARE) / (1 - WET_SHARE)) : 0.2 },
  tubers: { label: 'Tubers', region: ['grass', 'woodland'], share: 0.24, kcalHour: 1000, hard: true, rain: 0.4, halfLifeDays: 0, realHalfLifeDays: 730, capMonths: 12, season: f => f < WET_SHARE ? 1.1 : 0.85 },
  nuts: { label: 'Nuts and seeds', region: ['woodland'], share: 0.06, kcalHour: 900, hard: false, rain: 0.8, halfLifeDays: 90, realHalfLifeDays: 90, capMonths: 4, season: f => bump(f, 0.55, 0.12) },
  honey: { label: 'Honey', region: ['woodland', 'rock'], share: 0.08, kcalHour: 3500, hard: true, rain: 0.5, halfLifeDays: 0, realHalfLifeDays: 365, capMonths: 3, season: f => 0.6 + 1.2 * bump(f, 0.55, 0.06) },
  fish: { label: 'Fish', region: ['river', 'shore'], share: 0.13, kcalHour: 900, hard: false, rain: 0.5, halfLifeDays: 0, realHalfLifeDays: 365, capMonths: 3, season: f => f < WET_SHARE ? 1.2 : 0.75 },
  shellfish: { label: 'Shellfish', region: ['shore'], share: 0.13, kcalHour: 1200, hard: false, rain: -0.3, halfLifeDays: 0, realHalfLifeDays: 365, capMonths: 3, season: f => f < WET_SHARE ? 0.7 : 1.4 },
};
// Normalise each season curve so its yearly average is 1 (so `share` is the true yearly share).
for (const F of Object.values(FOODS)) { let m = 0; for (let i = 0; i < 360; i++) m += F.season(i / 360); F.norm = 360 / m; }
export const seasonFactor = (food, tick) => FOODS[food].season(fracOf(tick)) * FOODS[food].norm;
export const rainFactor = (food, rain) => Math.max(0, 1 + FOODS[food].rain * (rain - 1));

// Fixed places for each food (the same for every seed, so worlds are compared on the same land).
const PLACES = {
  berries: [[30, 12, 'Fig trees'], [46, 14, 'Grewia thicket'], [55, 9, 'North berries'], [38, 23, 'River berries'], [20, 18, 'West berries']],
  baobab: [[50, 34, 'Great baobab'], [62, 28, 'East baobabs'], [37, 40, 'South baobab'], [16, 40, 'Lone baobab']],
  tubers: [[46, 30, 'Tuber flats'], [58, 36, 'East tubers'], [28, 44, 'South tubers'], [33, 16, 'Woodland roots'], [68, 22, 'Far roots'], [50, 47, 'Dry roots']],
  nuts: [[24, 10, 'Nut grove'], [43, 9, 'Seed woods'], [60, 17, 'Hill nuts']],
  honey: [[36, 12, 'Bee tree'], [62, 11, 'Rock hive'], [15, 15, 'West hive']],
  fish: [[47, 19, 'River pool'], [38, 25, 'River bend'], [31, 29, 'River mouth'], [17, 27, 'West shore fishing']],
  shellfish: [[26, 37, 'South shore shells'], [15, 33, 'West shore shells'], [32, 33, 'East shore shells']],
};
// Water: the lake never fails; springs at the rocks run all year; the river runs in the wet season (and in the dry
// season only in a wet year, and only its lower pools); rain pans in the grassland hold water in the wet season only.
const WATERS = [
  ...[[34, 30], [24, 37], [15, 30], [24, 23]].map(([x, y], i) => ({ name: ['East lakeshore', 'South lakeshore', 'West lakeshore', 'North lakeshore'][i], x, y, kind: 'lake' })),
  { name: 'Hill spring', x: 63, y: 12, kind: 'spring' }, { name: 'South rock spring', x: 59, y: 41, kind: 'spring' }, { name: 'West rock spring', x: 14, y: 11, kind: 'spring' },
  { name: 'Upper river', x: 55, y: 13, kind: 'river' }, { name: 'Middle river', x: 44, y: 21, kind: 'river' }, { name: 'Lower river pools', x: 34, y: 27, kind: 'pools' },
  { name: 'Grass pan', x: 52, y: 40, kind: 'pan' }, { name: 'East pan', x: 68, y: 33, kind: 'pan' }, { name: 'South pan', x: 32, y: 48, kind: 'pan' },
];
export function waterActive(kind, season, rain) {
  if (kind === 'lake' || kind === 'spring') return true;
  if (kind === 'river') return season === 'wet' ? rain >= 0.5 : rain >= 1.3;
  if (kind === 'pools') return season === 'wet' || rain >= 0.8;
  if (kind === 'pan') return season === 'wet' && rain >= 0.7;
  return true;
}
// A tile next to the water point that people stand on (the lake itself cannot be walked on).
const stand = (x, y, regions = null) => { const ok = (a, b) => walkable(a, b) && (!regions || regions.includes(regionAt(a, b))); if (ok(x, y)) return [x, y]; for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (ok(x + dx, y + dy)) return [x + dx, y + dy]; throw Error('no fitting land near ' + x + ',' + y); };

// Food per patch from the carrying capacity: CARRYING people x 18 units a year x share, split over that food's places.
export function makePatches(s = null) {
  if (s && s.clock) return makePatchesReal(s);
  const yearUnits = CARRYING * 18, out = [];
  for (const [food, list] of Object.entries(PLACES)) {
    const F = FOODS[food], annual = yearUnits * F.share / list.length;
    list.forEach(([x0, y0, name], i) => {
      const [x, y] = stand(x0, y0, F.region);
      const cap = annual * F.capMonths / 12;
      out.push({ id: `${food[0]}${i}`, name, food, x, y, stock: cap * 0.5, capacity: cap, regen: annual / YEAR_TICKS, gift: false,
        decay: F.halfLifeDays ? Math.LN2 / (F.halfLifeDays * 24 / TICK_HOURS) : 0 });
    });
  }
  return out;
}
// Real clock: yearly food = CARRYING people x a year's need (kcal) x share. Growth per tick is that over the year;
// decay per tick from the half-life; the patch's natural level (capacity) is growth / decay at an average season.
function makePatchesReal(s) {
  const C = clockOf(s), B = body(s), yearUnits = CARRYING * 2250 * 365 / B.unitKcal, out = [];
  for (const [food, list] of Object.entries(PLACES)) {
    const F = FOODS[food], annual = yearUnits * F.share / list.length;
    list.forEach(([x0, y0, name], i) => {
      const [x, y] = stand(x0, y0, F.region);
      const regen = annual / C.year, decay = Math.LN2 / (F.realHalfLifeDays * C.day), cap = regen / decay;
      out.push({ id: `${food[0]}${i}`, name, food, x, y, stock: cap * 0.5, capacity: cap, regen, gift: false, decay });
    });
  }
  return out;
}
const WATER_REGIONS = { lake: ['shore'], spring: ['rock'], river: ['river'], pools: ['river'], pan: ['grass'] };
export const makeWaters = () => WATERS.map((w, i) => { const [x, y] = stand(w.x, w.y, WATER_REGIONS[w.kind]); return { id: 'v' + i, name: w.name, x, y, kind: w.kind, active: true }; });

// One step of the land: each food grows by its season and the year's rain, ripe food decays, water comes and goes.
export function landStep(s, groundFactor = 1) {
  if (s.clock) return landStepReal(s, groundFactor);
  const rain = rainOf(s.seed, yearOf(s.tick)), season = seasonOf(s.tick);
  for (const p of s.patches) {
    if (!p.food) continue;
    const grow = p.regen * seasonFactor(p.food, s.tick) * rainFactor(p.food, rain) * groundFactor;
    const add = Math.max(0, Math.min(grow, p.capacity - p.stock)), lost = p.stock * p.decay;
    p.stock = Math.max(0, p.stock + add - lost); s.ledger.regenerated += add; s.ledger.decayed = (s.ledger.decayed ?? 0) + lost;
  }
  if (s.tick % 30 === 0) for (const w of s.eden.springs) w.active = waterActive(w.kind, season, rain);
}
// Real clock: growth and decay together (clock.js growPatch); no cap but the natural level. Seasons by the calendar.
export const realFrac = (s, tick = s.tick) => { const C = clockOf(s); return (((tick % C.year) + C.year) % C.year) / C.year; };
export const realSeason = (s, tick = s.tick) => realFrac(s, tick) < WET_SHARE ? 'wet' : 'dry';
export const realYear = (s, tick = s.tick) => Math.floor(tick / clockOf(s).year);
function landStepReal(s, groundFactor) {
  const C = clockOf(s), f = realFrac(s), rain = s.weather ? Math.max(0.1, Math.min(2.5, weatherRain(s))) : rainOf(s.seed, realYear(s));
  for (const p of s.patches) {
    if (!p.food) continue;
    // with weather: a patch picked below regrowHalf of its natural level regrows in proportion (overuse can deplete it)
    const F = FOODS[p.food], depleted = s.weather ? Math.min(1, (p.stock / p.capacity + 0.05) / weatherRegrowHalf()) : 1;
    const grow = p.regen * F.season(f) * F.norm * rainFactor(p.food, rain) * groundFactor * depleted;
    const { add, lost } = growPatch(p, grow);
    s.ledger.regenerated += add; s.ledger.decayed = (s.ledger.decayed ?? 0) + lost;
  }
  if (!s.weather && s.tick % Math.round(C.day) === 0) { const season = realSeason(s); for (const w of (s.waters ?? s.eden.springs)) w.active = waterActive(w.kind, season, rain); } // with weather, water holes fill and empty in weather.js
}
// How many ticks it takes to gather `units` of a food: units x kcal per unit / (return rate x hours per tick).
// The return rate falls for the young on skill-intensive foods (Pretelli et al. 2022), and rises with practice.
export const AGE_RETURN = { hard: [[5, 0.3], [9, 0.5], [14, 0.75], [18, 1]], easy: [[5, 0.6], [9, 0.85], [14, 1], [18, 1]] };
export function returnRate(food, ageYears, skill) {
  const F = FOODS[food], table = AGE_RETURN[F.hard ? 'hard' : 'easy'];
  const ageF = [...table].reverse().find(([a]) => ageYears >= a)?.[1] ?? table[0][1];
  return F.kcalHour * ageF * (0.6 + 0.4 * Math.min(1, skill));
}
export const gatherTicks = (units, kcalHour) => Math.max(2, Math.ceil(units * KCAL_PER_UNIT / (kcalHour * TICK_HOURS)));
// Real clock: hours of foraging for `units` of 500 kcal, at least one tick.
export const gatherTicksReal = (s, units, kcalHour) => { const C = clockOf(s), B = body(s); return Math.max(0.25 * C.perHour, units * B.unitKcal / (kcalHour * C.hours)); }; // a fraction of a tick is fine on the real clock

// Where the first people start: a camp on the east lakeshore near the river mouth.
export const CAMP = { x: 35, y: 32, r: 3 };
