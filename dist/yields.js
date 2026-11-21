// ---------- What the plants yield (Layer 4) ----------
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
// Honey, fish and shellfish are animal production: their yields are in fauna.js (Layer 5).
// Every function is under 30 lines.
import { R } from './clock.js';

const HA_PER_KM2 = 100;

// Yearly edible kcal per km2 of the food's own ground. Tubers, fish and shellfish are standing stocks that renew
// at the food's own pace; their yearly yield is the stock's renewal (stock x ln 2 / half-life).
const renewal = food => (Math.LN2 * 365) / R(food + 'HalfLifeDays');
export const KCAL_PER_KM2 = {
  tubers: () => 5200 * HA_PER_KM2 * R('tuberCover') * 1460 * 0.22 * renewal('tuber'),
  berries: () => 935 * HA_PER_KM2 * 3200 * R('berryDryShare') * R('berryEdibleShare'),
  baobab: () => R('baobabPerHa') * HA_PER_KM2 * 36.8 * 0.166 * 0.9 * 3460,
  nuts: () => R('baobabPerHa') * HA_PER_KM2 * 36.8 * 0.29 * 0.9 * 3460,
};
