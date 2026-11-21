// Island: the weather. One source for the sky, used by plants, water holes, animals, fire, thirst and spoilage
// (build plan change 3). Daily, island-wide (no difference across the island yet: an open question).
//
// Rain: a two-state Markov chain for wet and dry days (Richardson 1981; WGEN, Richardson and Wright 1984), with
// month-by-month odds following the two rainy seasons of the East African savanna, and gamma-distributed amounts.
// Year-to-year swings come from rainOf (rain-years.js), so wet and dry years, and runs of them, are kept as before.
// Temperature: daily highs and lows by season, cooler on wet days. Soil: a bucket (Manabe 1969) filled by rain and
// emptied by evaporation, which follows a Hargreaves-type potential evaporation. Water holes: stores filled from their
// catchment and emptied by evaporation. Moon and tides from their periods. Every number is in the register
// (clock.js RATES) or marked as an assumption here; the water books must balance (weatherLedger).
import { airDay, CLIMATE } from './atmosphere.js';
import { R, clockOf, dateOf, hourOf } from './clock.js';
import { noise2, seedKey, STREAMS } from './sim.js';
import { rainOf } from './rain-years.js';
import { LAYERS } from './layers.js';
import { referenceET, soilDay, reservoirDay, runoff, curveNumber, compositeCN, CN_BY_COVER_CLAY } from './water.js';
import { jdOfTick, dayOfYearJd } from './sun.js';
import { catchmentKm2, catchmentCover, islandCover } from './land.js';

// Month order follows the clock (year starts 1 November). Share of days that are wet (assumption, shaped on the
// bimodal rains near Lake Eyasi: short rains Nov-Dec, long rains Mar-May, a long dry season Jun-Oct).
export const WET_SHARE_BY_MONTH = {
  Nov: 0.3,
  Dec: 0.4,
  Jan: 0.35,
  Feb: 0.35,
  Mar: 0.5,
  Apr: 0.55,
  May: 0.3,
  Jun: 0.05,
  Jul: 0.02,
  Aug: 0.02,
  Sep: 0.03,
  Oct: 0.08,
};
// Hottest at the end of the dry season (Oct), coolest mid-year (Jul); degrees C (assumption, Eyasi basin).
// (temperatures now come from the measured climate: atmosphere.js, Layer 1)
const MONTH_KEYS = Object.keys(WET_SHARE_BY_MONTH);

// Water holes as stores (mm of water over their own area). catch: how much of the rain on its catchment reaches it
// (as a multiple of the rain falling on it); evap: share of potential evaporation it loses; max: depth when full.
// Lakes and springs are fed from deep ground water and do not dry on these timescales (assumption).
// ground (real water only): the share of groundwater seepage that reaches it. None for every seasonal hole:
// semi-arid seasonal rivers are losing streams, the water table lies below the bed, and groundwater comes out
// at springs and the lake (Scanlon et al. 2006, Hydrological Processes 20: 3335-3370).
// bed (with the real land): river and stream pools sit on sand beds and seep into them (poolBedSeepMm a day);
// pans sit on clay and hold their water, which is why they are pans.
export const HOLES = {
  lake: { catch: 0, evap: 0, max: Infinity, start: Infinity, lasting: true },
  spring: { catch: 0, evap: 0, max: Infinity, start: Infinity, lasting: true },
  river: { catch: 8, evap: 1.0, max: 700, start: 450, ground: 0, bed: 1 }, // a seasonal river: channel pools that seep and evaporate
  pools: { catch: 7, evap: 0.8, max: 700, start: 450, ground: 0, bed: 1 },
  pan: { catch: 4, evap: 1.0, max: 350, start: 120, ground: 0 },
};
const DRY_BELOW = 20; // mm: a hole with less than this is mud, not water

const K = STREAMS.weather[0]; // the weather's own chance block (sim.js STREAMS)
const u = (s, day, i) => noise2(seedKey(s.seed), day + 7000, i, K);
// Gamma(shape k, scale theta) from uniform draws (Marsaglia and Tsang 2000; k < 1 by the boost u^(1/k)).
function gamma(s, day, k, theta) {
  const boost = k < 1 ? Math.pow(Math.max(1e-12, u(s, day, 90)), 1 / k) : 1,
    a = k < 1 ? k + 1 : k,
    d = a - 1 / 3,
    c = 1 / Math.sqrt(9 * d);
  for (let i = 0; i < 40; i++) {
    const n =
      Math.sqrt(-2 * Math.log(Math.max(1e-12, u(s, day, 10 + 2 * i)))) * Math.cos(2 * Math.PI * u(s, day, 11 + 2 * i));
    const v = (1 + c * n) ** 3;
    if (v <= 0) continue;
    if (Math.log(Math.max(1e-12, u(s, day, 60 + i))) < 0.5 * n * n + d - d * v + d * Math.log(v))
      return d * v * boost * theta;
  }
  return a * boost * theta;
}

export function makeWeather(s) {
  s.weather = {
    day: -1,
    wet: false,
    rain: 0,
    tmax: CLIMATE.tmax[10], // November
    tmin: CLIMATE.tmin[10],
    pet: 5,
    soil: 0.5 * R('soilMaxMm'),
    recent: new Float32Array(365),
    expectedYear: expectedAnnual(),
    moon: 0,
    light: 0,
  };
  s.weatherLedger = {
    rain: 0,
    soilStart: s.weather.soil,
    soilEvap: 0,
    soilRunoff: 0,
    holeIn: 0,
    holeEvap: 0,
    holeSpill: 0,
    holeStart: 0,
  };
  fillHoles(s);
  pastYear(s.weather);
}

// Water holes start at their starting level, counted in the books
function fillHoles(s) {
  for (const w of s.waters) {
    const H = HOLES[w.kind] ?? HOLES.lake;
    w.level = H.start;
    w.catchKm2 = catchmentKm2(w.x, w.y);
    w.cn = compositeCN(catchmentCover(w.x, w.y), w.kind === 'pan' ? CN_BY_COVER_CLAY : undefined);
    w.channel = 0;
    w.active = !isFinite(w.level) || w.level > DRY_BELOW;
    if (isFinite(H.start)) s.weatherLedger.holeStart += H.start;
  }
}

// A year of normal past rain, so the running totals start where an ordinary year would leave them
function pastYear(W) {
  const m = R('rainPerWetDay');
  for (let d = 0; d < 365; d++) W.recent[d] = WET_SHARE_BY_MONTH[MONTH_KEYS[Math.floor((d / 365) * 12)]] * m;
  W.yearSum = W.recent.reduce((a, b) => a + b, 0);
}
// Mean annual rain the month odds and mean amount imply (mm), before the year's swing.
export function expectedAnnual() {
  const m = R('rainPerWetDay');
  return Object.values(WET_SHARE_BY_MONTH).reduce((n, p) => n + (p * 365) / 12, 0) * m;
}

// One day of weather (call once a day).
// Today's rain: wet or dry by a two-state chain (stationary share pi this month, raised or lowered by the year's
// swing; persistence rho), then a gamma-distributed amount. Returns pi (the air needs it).
function rainDay(s, W, day, month, year) {
  const Y = rainOf(s.seed, year) ** R('yearSwingWeight'); // this year's swing (about 1 in an ordinary year), damped so daily chance and the year together give a realistic spread
  const pi = Math.min(0.95, WET_SHARE_BY_MONTH[month] * Math.sqrt(Y)),
    rho = R('wetPersistence');
  const pWet = W.wet ? pi + rho * (1 - pi) : pi * (1 - rho);
  W.wet = u(s, day, 0) < pWet;
  W.rain = W.wet ? gamma(s, day, R('rainGammaShape'), (R('rainPerWetDay') * Math.sqrt(Y)) / R('rainGammaShape')) : 0;
  return pi;
}

export function weatherDay(s) {
  const C = clockOf(s),
    day = Math.floor(s.tick / C.day),
    W = s.weather;
  if (W.day === day) return;
  W.day = day;
  const frac = (((s.tick % C.year) + C.year) % C.year) / C.year,
    mi = Math.floor(frac * 12),
    month = MONTH_KEYS[mi];
  const pi = rainDay(s, W, day, month, Math.floor(s.tick / C.year));
  // the air (Layer 1, atmosphere.js): the measured Lake Eyasi climate for the date, a persistent day-to-day
  // anomaly, and today's rain; the world's month index counts from November, the climate's from January
  const calMonth = (mi + 10) % 12,
    inMonth = frac * 12 - Math.floor(frac * 12);
  W.air = airDay(W.air ?? null, W.wet, pi, calMonth, inMonth, k => u(s, day, k));
  W.tmax = W.air.tmax;
  W.tmin = W.air.tmin;
  // water: the real layer (water.js) once it has passed its gate, else the stand-in below (dist/layers.js)
  if ((s.config?.layers?.water ?? LAYERS.water.status) === 'real') waterDayReal(s, W, day);
  else waterDayStandIn(s, W, day);
  // the moon: synodic month 29.53 days; light at night from 0 (new) to 1 (full)
  W.moon = (((day / 29.530589) % 1) + 1) % 1;
  W.light = (1 - Math.cos(2 * Math.PI * W.moon)) / 2;
}

// Real water (Layer 2, water.js): FAO Penman-Monteith evaporation, the soil with FAO-56 deep percolation, the
// stream channels and groundwater as two reservoirs. Every flow is in the books. With the real land the
// island's curve number comes from its land cover (TR-55 composite); before that, the provisional fitted one.
function waterDayReal(s, W, day) {
  const jd = jdOfTick(s.tick, clockOf(s).hours),
    soilBefore = W.soil;
  W.pet = referenceET(W.air, jd, dayOfYearJd(jd));
  W.cn ??= landReal(s) ? compositeCN(islandCover()) : R('curveNumber');
  const L = s.weatherLedger,
    f = soilDay(W.soil, W.rain, W.pet, R('soilMaxMm'), W.cn);
  L.rain += W.rain;
  L.soilEvap += f.evap;
  L.soilRunoff += f.quick + f.recharge;
  W.soil = f.soil;
  W.aet = f.evap; // the day's actual evapotranspiration, read by the plants (Layer 4)
  const ch = reservoirDay(W.channel ?? 0, f.quick, R('channelDays')),
    g = reservoirDay(W.ground ?? 0, f.recharge, R('groundwaterDays'));
  L.quick = (L.quick ?? 0) + f.quick;
  L.channelOut = (L.channelOut ?? 0) + ch.out;
  L.recharge = (L.recharge ?? 0) + f.recharge;
  L.seep = (L.seep ?? 0) + g.out;
  W.channel = ch.store;
  W.ground = g.store;
  W.yearSum += W.rain - W.recent[day % 365];
  W.recent[day % 365] = W.rain;
  holesDay(s, W, ch.out, g.out, soilBefore);
}

// Water holes for a day (real water): stream and groundwater flow from the catchment in, evaporation out,
// spill when full
// With the real land (Layer 3) each hole gathers from its own catchment: depth in = depth over the catchment x
// catchment area / the pool's own area. Before that, a fitted multiple (catch x catchScale, provisional).
const landReal = s => (s.config?.layers?.terrain ?? LAYERS.terrain.status) === 'real';
function holesDay(s, W, stream, seep, soilBefore) {
  if (!landReal(s)) {
    W.bedSeep = 0;
    return holeStep(s, W, (H, w) => (stream + seep * (H.ground ?? 1)) * H.catch * R('catchScale'));
  }
  W.bedSeep = R('poolBedSeepMm');
  const gather = w => (w.catchKm2 * 100) / R('holeAreaHa');
  // plus the rain falling on the pool's own open water, all of which it keeps
  holeStep(s, W, (H, w) => (holeStream(s, W, w, soilBefore) + seep * (H.ground ?? 1)) * gather(w) + W.rain);
}

// A hole's own stream (with the real land): the day's runoff from its own catchment, by its own curve number
// (TR-55 composite of its land cover) at the island's soil wetness, through its own channel reservoir.
function holeStream(s, W, w, soilBefore) {
  const L = s.weatherLedger,
    q = runoff(W.rain, curveNumber(w.cn, soilBefore / R('soilMaxMm')));
  const ch = reservoirDay(w.channel, q, R('channelDays'));
  w.channel = ch.store;
  L.holeChannelIn = (L.holeChannelIn ?? 0) + q;
  L.holeChannelOut = (L.holeChannelOut ?? 0) + ch.out;
  return ch.out;
}

// One day for every water hole, real or stand-in: inflow (by kind of hole) in, evaporation out, spill when
// full, all in the books. Lakes and springs never dry.
function holeStep(s, W, inflowOf) {
  const L = s.weatherLedger;
  for (const w of s.waters) {
    const H = HOLES[w.kind] ?? HOLES.lake;
    if (!isFinite(w.level)) {
      w.active = true;
      continue;
    }
    const inflow = inflowOf(H, w),
      evap = Math.min(w.level + inflow, W.pet * H.evap),
      bed = Math.min(w.level + inflow - evap, (W.bedSeep ?? 0) * (H.bed ?? 0));
    w.level += inflow - evap - bed;
    L.holeIn += inflow;
    L.holeEvap += evap;
    L.holeBed = (L.holeBed ?? 0) + bed;
    if (w.level > H.max) {
      L.holeSpill += w.level - H.max;
      w.level = H.max;
    }
    w.active = w.level > DRY_BELOW;
  }
}

// Stand-in water (before Layer 2): Hargreaves evaporation, a soil bucket that overflows, holes fed by rain
function waterDayStandIn(s, W, day) {
  // potential evaporation, mm/day (Hargreaves form: 0.0023 Ra (Tmean + 17.8) sqrt(Tmax - Tmin), Ra ~ 15 mm/day
  // near the equator); about 5-6 mm/day here, as measured for East African savanna
  const tmean = (W.tmax + W.tmin) / 2;
  W.pet = 0.0023 * 15 * (tmean + 17.8) * Math.sqrt(Math.max(1, W.tmax - W.tmin));
  // soil bucket: rain in, evaporation out in proportion to how full it is, overflow runs off
  const L = s.weatherLedger,
    Smax = R('soilMaxMm');
  L.rain += W.rain;
  let soil = W.soil + W.rain;
  const ev = Math.min(soil, (W.pet * soil) / Smax);
  soil -= ev;
  L.soilEvap += ev;
  const off = Math.max(0, soil - Smax);
  soil -= off;
  L.soilRunoff += off;
  W.soil = soil;
  W.aet = ev;
  W.yearSum += W.rain - W.recent[day % 365];
  W.recent[day % 365] = W.rain;
  // water holes: catchment inflow (more when the ground is wet), evaporation, spill when full
  const wetGround = 0.3 + (0.7 * soil) / Smax;
  holeStep(s, W, H => W.rain * H.catch * wetGround);
}

// Derived, shared measures
export const soilMoisture = s => (s.weather ? s.weather.soil / R('soilMaxMm') : 0.5); // 0 dry .. 1 full
export const rainLastDays = (s, n) => {
  const W = s.weather;
  if (!W) return 0;
  let t = 0;
  for (let i = 0; i < n; i++) t += W.recent[(((W.day - i) % 365) + 365) % 365];
  return t;
};
// The last 12 months' rain against an ordinary year: the drought measure plants and herds respond to (1 = normal)
export const rainYearRatio = s => (s.weather ? s.weather.yearSum / s.weather.expectedYear : 1);
// Dead wood's moisture (share): wet after rain, dry after a dry spell; above 0.15 a fire drill cannot raise an ember
export const woodMoisture = s =>
  s.weather ? 0.08 + 0.3 * Math.min(1, rainLastDays(s, 7) / 20) + 0.07 * soilMoisture(s) : null;
// Heat raises water loss: about +3% per degree above 30 C of the day's high (assumption; sweat rises with heat load)
export const heatFactor = s => (s.weather ? Math.max(0.8, 1 + R('heatWaterPerC') * (s.weather.tmax - 30)) : 1);
// One temperature law for living rates (metabolic theory of ecology; Gillooly et al. 2001, Brown et al. 2004): a
// rate at temperature T (C) relative to 25 C is exp(-E/k (1/T_K - 1/298.15)), the Boltzmann-Arrhenius factor, with
// activation energy E (eV) and Boltzmann's constant k. Used for processes run by microbes and other ectotherms
// (spoilage now; infection and mosquitoes later). Warm-blooded animals and people keep their own body temperature, so
// it does not apply to them; plant growth is already shaped by season and rain (adding it would count heat twice).
export const BOLTZMANN_EV = 8.617333e-5;
export const arrhenius = (tC, E = R('activationEnergy'), refC = 25) =>
  Math.exp((-E / BOLTZMANN_EV) * (1 / (tC + 273.15) - 1 / (refC + 273.15)));
// Microbial spoilage speeds up with warmth (E 0.65 eV gives about x2.3 per 10 C near 25 C, the familiar Q10 of 2-3)
export const spoilFactor = s => (s.weather ? arrhenius((s.weather.tmax + s.weather.tmin) / 2) : 1);
// Moonlight at a given hour, 0 (no moon up, or new) .. 1 (full moon overhead): the lit fraction of the disc
// (W.light) while the moon is above the horizon. The moon crosses the sky about 50 minutes later each day: it is
// highest at noon when new and at midnight when full, and up for about 12 hours around that. (A full moon gives
// about 0.1-0.3 lux, starlight about 0.001: enough to walk by, not to see far.)
export function moonLight(s, tick = s.tick) {
  const W = s.weather;
  if (!W) return 0;
  const transit = (12 + 24 * W.moon) % 24,
    h = hourOf(clockOf(s), tick);
  const off = Math.abs(((((h - transit) % 24) + 36) % 24) - 12); // hours from the moon's highest point, 0..12
  return off < 6 ? W.light : 0;
}
// Night factors: walking pace and fall risk between a moonless night (L = 0) and a full moon up (L = 1)
export const nightPaceOf = s => R('nightPace') + (R('moonNightPace') - R('nightPace')) * moonLight(s);
export const nightInjuryOf = s => R('nightInjury') + (R('moonNightInjury') - R('nightInjury')) * moonLight(s);
// Tide (for a coast): semi-diurnal, 12.42 h, larger at new and full moon (spring tides). -1 low .. 1 high.
export const tide = (s, tick = s.tick) => {
  const C = clockOf(s),
    h = tick * C.hours,
    phase = s.weather?.moon ?? 0;
  return Math.cos((2 * Math.PI * h) / 12.42) * (0.7 + 0.3 * Math.cos(4 * Math.PI * phase));
};
// The water books: rain in = change in soil + evaporation + runoff (soil); hole inflow = change in holes + evaporation + spill.
export function weatherLedger(s) {
  const L = s.weatherLedger,
    W = s.weather;
  if (!L) return null;
  const holes = s.waters.reduce((n, w) => n + (isFinite(w.level) ? w.level : 0), 0);
  return {
    soilError: L.rain - (W.soil - L.soilStart) - L.soilEvap - L.soilRunoff,
    holeError: L.holeIn - (holes - L.holeStart) - L.holeEvap - L.holeSpill - (L.holeBed ?? 0),
    channelError: (L.quick ?? 0) - (W.channel ?? 0) - (L.channelOut ?? 0), // channels start empty
    groundError: (L.recharge ?? 0) - (W.ground ?? 0) - (L.seep ?? 0), // groundwater starts empty
    holeChannelError:
      (L.holeChannelIn ?? 0) - s.waters.reduce((t, w) => t + (w.channel ?? 0), 0) - (L.holeChannelOut ?? 0),
  };
}

// (plants read rainYearRatio and regrowHalf themselves: savanna.js imports weather.js, downhill)
