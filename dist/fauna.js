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
