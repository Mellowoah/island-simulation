// ---------- What the land yields (Layer 4, with the animal foods until Layer 5 is built) ----------
// Each food's yearly edible energy per km2 of the ground it grows on, from field measurements. Nothing here comes
// from how many people are wanted on the land: how many it feeds is a result, measured afterwards.
// Where a number is an assumption it says so, and it is in the register (clock.js) with a range.
// Sources:
// - Tubers: //ekwa (Vigna frutescens) 5,200 kg/ha where it grows (Vincent 1985, in Wood et al. 2021, Nature Human
//   Behaviour); edible portion 146 kcal/100 g dry, about 78% water (Schoeninger et al. 2001).
// - Berries: edible wild fruit in savanna woodland 935 kg/ha fresh a year (KwaZulu-Natal, Forests, Trees and
//   Livelihoods 2022); berries 320 kcal/100 g dry (Crittenden et al. 2009, Hadza foods).
// - Baobab: 36.8 kg of fruit per tree a year (Venter and Witkowski 2011); pulp 16.6% of the fruit (Kenya, coastal
//   and lower eastern); seeds about 29% (14 kg pulp, 23 kg seeds per 80 kg); 346 kcal/100 g dry (Crittenden 2009).
// - Honey: wild honeybee colonies in Africa 6.8 per km2 (Visick and Ratnieks 2023); 5-8 kg of honey per colony a
//   year in traditional hives (Ethiopia); honey about 304 kcal/100 g.
// - Fish: lake yield by area (Marshall 1984, in FAO): 355 kg/ha at 1 km2, 200 at 10, 112 at 100, 68 at 1000;
//   floodplain rivers about 43 kg/ha (FAO); fresh fish about 96 kcal/100 g, half of it edible.
// - Shellfish: rocky-shore community 88 g ash-free dry mass per m2 (Seys et al., in Smaal 1994), about 5 kcal/g.
// Every function is under 30 lines.
import { R } from './clock.js';

const HA_PER_KM2 = 100;

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

// Yearly edible kcal per km2 of the food's own ground. Tubers, fish and shellfish are standing stocks that renew
// at the food's own pace; their yearly yield is the stock's renewal (stock x ln 2 / half-life).
const renewal = food => (Math.LN2 * 365) / R(food + 'HalfLifeDays');
export const KCAL_PER_KM2 = {
  tubers: () => 5200 * HA_PER_KM2 * R('tuberCover') * 1460 * 0.22 * renewal('tuber'),
  berries: () => 935 * HA_PER_KM2 * 3200 * R('berryDryShare') * R('berryEdibleShare'),
  baobab: () => R('baobabPerHa') * HA_PER_KM2 * 36.8 * 0.166 * 0.9 * 3460,
  nuts: () => R('baobabPerHa') * HA_PER_KM2 * 36.8 * 0.29 * 0.9 * 3460,
  honey: () => 6.8 * 6.5 * 3040,
  shellfish: () => 88 * 1e6 * R('intertidalShare') * 5 * renewal('shellfish'),
};
// Fish: from the lake's and the rivers' own areas (kcal a year in all)
export const fishKcal = (lakeKm2, riverKm2) =>
  (lakeFishKgHa(lakeKm2) * lakeKm2 + 43 * riverKm2) * HA_PER_KM2 * 960 * 0.5;
