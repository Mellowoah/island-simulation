// ---------- Layer 2: water ----------
// Each day: how much water the air can draw up (reference evaporation), how rain splits between soaking in and
// running off, the soil store, the groundwater store and its slow seepage, and the water holes. Every flow is
// counted in the water books (weatherLedger), which must balance.
// Sources:
// - Allen, R. G., Pereira, L. S., Raes, D. and Smith, M. (1998) FAO Irrigation and Drainage Paper 56: the FAO
//   Penman-Monteith reference evaporation (eq. 6) with its parts: slope of the vapour curve (eq. 13), the
//   psychrometric constant (eq. 8), mean saturation vapour pressure (eq. 12), net radiation (eqs. 35-40), G = 0
//   for a day (eq. 42). Its example 18 is test W1.
// - USDA Soil Conservation Service (1986) Technical Release 55: the curve-number runoff Q = (P - 0.2 S)^2 /
//   (P + 0.8 S), S = 25400 / CN - 254 mm; with antecedent moisture by Chow, Maidment and Mays (1988), eqs. 5.5.4-5.
// - Groundwater as a linear reservoir (outflow = store / time constant): the standard baseflow model
//   (e.g. Brutsaert 2005, Hydrology: An Introduction, ch. 10).
// - Bergstrom, S. (1976) SMHI Report RHO 7; (1992) The HBV model, SMHI Reports Hydrology 4: percolation in
//   proportion to (soil wetness)^beta, and a response routine of a fast and a slow linear reservoir.
// Every function is under 30 lines.
import { R } from './clock.js';
import { satVapour, pressureAt } from './atmosphere.js';
import { sunAt, dailyRa, angstromShare, clearSkyShare, netShortwave, netLongwave, SITE } from './sun.js';

// Slope of the saturation vapour curve at T, kPa/deg C (FAO-56 eq. 13)
export const vapourSlope = T => (4098 * satVapour(T)) / (T + 237.3) ** 2;

// Psychrometric constant from pressure, kPa/deg C (FAO-56 eq. 8)
export const psychrometric = P => 0.000665 * P;

// FAO Penman-Monteith reference evaporation for a day, mm/day (eq. 6). Rn in MJ/m2/day, G = 0 for a day.
export function penmanMonteith({ tmax, tmin, ea, wind, Rn, P }) {
  const T = (tmax + tmin) / 2, es = (satVapour(tmax) + satVapour(tmin)) / 2;
  const D = vapourSlope(T), g = psychrometric(P);
  const top = 0.408 * D * Rn + (g * 900 * wind * Math.max(0, es - ea)) / (T + 273);
  return Math.max(0, top / (D + g * (1 + 0.34 * wind)));
}

// Net radiation for a day, MJ/m2/day, from the air (Layer 1) and the sun (Layer 0) on day of year J at jd
export function netRadiation(air, jd, J, site = SITE) {
  const Ra = dailyRa(sunAt(jd).dec, J, site);
  const Rs = angstromShare(air.sunshine) * Ra, Rso = clearSkyShare(site) * Ra;
  return netShortwave(Rs) - netLongwave(air.tmax, air.tmin, air.ea, Rs / Rso);
}

// Reference evaporation for a day of air: mm/day
export function referenceET(air, jd, J, site = SITE) {
  const Rn = netRadiation(air, jd, J, site);
  return penmanMonteith({ ...air, Rn, P: air.pressure ?? pressureAt(site.elevation) });
}

// Curve number for the day's soil wetness w (0 dry .. 1 full): dry (I) and wet (III) conditions from the
// average (II) number (Chow et al. 1988 eqs. 5.5.4-5), straight-line between them
export function curveNumber(cn2, w) {
  const dry = (4.2 * cn2) / (10 - 0.058 * cn2), wet = (23 * cn2) / (10 + 0.13 * cn2);
  return w < 0.5 ? dry + (cn2 - dry) * (w / 0.5) : cn2 + (wet - cn2) * ((w - 0.5) / 0.5);
}

// Runoff from a day's rain P (mm) with curve number CN (SCS TR-55)
export function runoff(P, CN) {
  const S = 25400 / CN - 254, Ia = 0.2 * S;
  return P > Ia ? (P - Ia) ** 2 / (P + 0.8 * S) : 0;
}

// The soil for a day: rain less what runs off soaks in; of what soaks in, a share (soil wetness)^beta passes on
// down to groundwater (the HBV soil routine: Bergstrom 1976, 1992), the rest wets the soil; evaporation by how
// full the soil is (FAO-56 water stress, straight-line); anything over the soil's capacity also drains down.
export function soilDay(soil, rain, et0, Smax, cn2, beta = 2) {
  const quick = runoff(rain, curveNumber(cn2, soil / Smax)), into = rain - quick;
  const perc = into * Math.min(1, soil / Smax) ** beta;
  let s = soil + into - perc;
  const evap = Math.min(s, (et0 * s) / Smax);
  s -= evap;
  const over = Math.max(0, s - Smax);
  return { soil: s - over, quick, evap, recharge: perc + over };
}

// A linear reservoir for a day: inflow in, outflow = store over its time constant (days). Used twice, as in the
// HBV response routine: the stream channels (runoff, drains in days to weeks) and groundwater (recharge, months).
export function reservoirDay(store, inflow, days) {
  const g = store + inflow, out = g / days;
  return { store: g - out, out };
}

// Groundwater for a day (a reservoir; kept under its first name for the tests)
export function groundDay(store, recharge, days) {
  const r = reservoirDay(store, recharge, days);
  return { store: r.store, seep: r.out };
}
