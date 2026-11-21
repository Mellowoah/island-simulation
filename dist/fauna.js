// ---------- Layer 5: animals ----------
// The herds eat the grass the plants layer grew; when it runs short they lose condition and die. Fish, shellfish
// and honey are measured animal production, kept here (moved from yields.js, 20 Nov 2026).
// Sources:
// - Intake: herbivores eat in proportion to metabolic body mass (mass^0.75): energy and protein needs scale with it
//   (Clauss and others, reviewed in PLoS ONE 2013). Ruminant voluntary intake about 60-120 g of dry matter per kg^0.75
//   a day (standard animal nutrition; register intakePerKgMetabolic, approx.).
// - Dry grass is eaten too: dry tissue was a substantial part of Serengeti ungulates' dry-season diets
//   (McNaughton 1985).
// - Check (tools/gate-patterns.mjs): native large herbivores eat from 1% (desert grassland) to about 64% (mesic
//   grassland) of the grass that grows (Joern and Raynor 2018); their biomass across African parks spans
//   10^2-10^4 kg/km2 (Fritz and Duncan 1994).
// - Fish: lake yield by area (Marshall 1984, in FAO): 355 kg/ha at 1 km2, 200 at 10, 112 at 100, 68 at 1000;
//   floodplain rivers about 43 kg/ha (FAO); fresh fish about 96 kcal/100 g, half of it edible.
// - Shellfish: rocky-shore community 88 g ash-free dry mass per m2 (Seys et al., in Smaal 1994), about 5 kcal/g.
// - Honey: wild honeybee colonies in Africa 6.8 per km2 (Visick and Ratnieks 2023); 5-8 kg a colony a year in
//   traditional hives (Ethiopia); honey about 304 kcal/100 g.
// Browse (leaves of shrubs and trees) is not yet grown, so browsers (dik-dik, hyrax) eat from the herb layer too.
// Every function is under 30 lines.
import { R } from './clock.js';

const HA_PER_KM2 = 100;

// Dry matter a herbivore eats in a day (kg)
export const intakeKgDay = massKg => R('intakePerKgMetabolic') * massKg ** 0.75;

// The herds graze the island's herb layer: green grass first, then dead. Returns the share of their need met.
export function grazeDay(P, demandKg, landKm2) {
  const want = (demandKg / (landKm2 * 1e6)) * 1000 || 0; // g/m2 over the island's land
  if (!P || want <= 0) return 1;
  const green = Math.min(P.green, want),
    dead = Math.min(P.dead, want - green);
  P.green -= green;
  P.dead -= dead;
  P.eatenTotal = (P.eatenTotal ?? 0) + green + dead;
  return (green + dead) / want;
}

// Extra deaths in a day for a herd of n that got only `met` of its food (it lasts about starveDays on reserves)
export const starveDeaths = (n, met) => (met < 1 ? (n * (1 - met)) / R('starveDays') : 0);

// Lake fish yield (kg/ha/yr) by lake area (km2): log-log interpolation through Marshall's (1984) points
const MARSHALL = [
  [1, 355],
  [10, 200],
  [100, 112],
  [1000, 68],
];
export function lakeFishKgHa(km2) {
  const a = Math.min(1000, Math.max(1, km2)),
    i = Math.min(2, Math.max(0, Math.floor(Math.log10(a))));
  const [[x0, y0], [x1, y1]] = [MARSHALL[i], MARSHALL[i + 1]];
  const t = (Math.log(a) - Math.log(x0)) / (Math.log(x1) - Math.log(x0));
  return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
}
// Fish: from the lake's and the rivers' own areas (kcal a year in all)
export const fishKcal = (lakeKm2, riverKm2) =>
  (lakeFishKgHa(lakeKm2) * lakeKm2 + 43 * riverKm2) * HA_PER_KM2 * 960 * 0.5;
// Yearly edible kcal per km2 of their own ground (shellfish: a standing stock renewed at its own pace)
export const FAUNA_KCAL_PER_KM2 = {
  honey: () => 6.8 * 6.5 * 3040,
  shellfish: () => 88 * 1e6 * R('intertidalShare') * 5 * ((Math.LN2 * 365) / R('shellfishHalfLifeDays')),
};

// ---------- predators (on with config.predators; until herds are limited by grass, field counts already hold them
// down, so with both on predation would be counted twice) ----------
// The grouped functional response of Fryxell, Mosser, Sinclair and Packer (2007, Nature 449: 1041-1043), measured on
// Serengeti lions: a group of G predators searches as one, meets prey herds (not single animals: prey-group density is
// lower than individual density), and each success is one whole animal shared by the group. Kills a day for the group:
//   a H / (1 + a H (h1 + h2 / G)),  H = herds per km2 = animals per km2 / herd size.
// - a = 1.16 km2 a day: a 0.4 km search path x 10 km a day x 0.29 success (Serengeti lions, wildebeest).
// - h1 = 0.045 days to attack and subdue; h2 = 1.422 days of digestive pause per carcass, shared by the group.
// - G: lions 6.3 adults a pride (Fryxell 2007); hyenas hunt in small groups (assumption 3). Hyenas are given the
//   lion's search rate and handling times (assumption).
// - Grouping by both predators and prey is what steadies the system (Fryxell 2007); without it, lions here wiped out
//   their prey in two to three years (20 Nov 2026).
// - Need: lions about 5-7 kg of meat a day (Shamwari); hyenas 3.8-4.0 kg (Henschel and Tilson 1988).
// - Prey: carnivores favour prey of about half to twice their own mass (Owen-Smith and Mills 2008); hyenas prefer
//   56-182 kg and avoid buffalo and zebra (Hayward 2006).
// - Births when fed, at the most a mammal of that mass can grow (Fenchel 1974); adults die at predatorDeathRate.
// - Check: about 90 kg of a carnivore species per 10,000 kg of its prey (Carbone and Gittleman 2002).
export const PREDATORS = {
  lion: { mass: 150, needKg: 6, group: 'lionGroup', prey: ['impala', 'zebra', 'buffalo'] },
  hyena: { mass: 55, needKg: 3.9, group: 'hyenaGroup', prey: ['impala'] },
};
// Kills a day by one predator of each prey kind, given herds per km2 of each (type II over all its prey together)
export function killsPerDay(P, herds, group = R(P.group)) {
  const a = R('predatorSearchKm2'),
    G = Math.max(1, group),
    h = R('handleDays') + R('digestDays') / G;
  const total = herds.reduce((t, H) => t + H, 0),
    groupKills = (a * total) / (1 + a * total * h);
  return herds.map(H => (total ? (groupKills * H) / total / G : 0));
}
// A year's change in a predator population of n with fed share `fed` (0..1): growth at full food, decline when hungry
export const predatorChange = (n, fed, mass) => {
  const d = R('predatorDeathRate'),
    rMax = 1.1 * mass ** -0.26;
  return n * ((rMax + d) * fed - d);
};
// Starting numbers from Carbone and Gittleman's ratio (the check then sees where the island takes them)
export const startPredators = (preyKg, mass) => (0.009 * preyKg) / mass;

// ---------- territories ----------
// Prides and clans each hold a home range and hunt in it. Measured: lion pride ranges about 36-43 km2 where prey is
// rich (Ishasha, Uganda) to 300-600 km2 where it is sparse; range shrinks as prey biomass rises (Loveridge et al.
// 2009); spotted hyena clan territories 9 to over 1000 km2, smaller where prey is rich (East and Hofer 2013).
// Ranges here are fixed in size (lionRangeKm2, hyenaRangeKm2: assumptions within those ranges); land between them is
// hunted by nobody, so prey there is in a refuge until it moves.
export const RANGE = { lion: 'lionRangeKm2', hyena: 'hyenaRangeKm2' };
// Cells within r cells of a centre (square grid w x h), keeping only those `ok` allows
export function cellsAround(c, r, w, h, ok) {
  const out = [],
    cx = c % w,
    cy = Math.floor(c / w);
  for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && ok(y * w + x)) out.push(y * w + x);
  return out;
}
// Place ranges one by one on unclaimed habitat, each about areaKm2, none sharing a cell
export function placeRanges(habitatCells, areaKm2, cellKm2, w, h) {
  const r = Math.max(1, Math.round(Math.sqrt(areaKm2 / cellKm2 / Math.PI))),
    free = new Set(habitatCells),
    ranges = [];
  for (const c of habitatCells) {
    if (!free.has(c)) continue;
    const cells = cellsAround(c, r, w, h, k => free.has(k));
    if (cells.length * cellKm2 < areaKm2 / 2) continue;
    cells.forEach(k => free.delete(k));
    ranges.push(cells);
  }
  return ranges;
}
