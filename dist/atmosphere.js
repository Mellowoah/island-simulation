// ---------- Layer 1: the atmosphere ----------
// The air over the island for each day and hour: temperature, humidity, pressure, wind, cloud (sunshine).
// Weather arrives from outside an island this size: rain days come from the weather chain (weather.js), and
// the air here follows the measured climate, the day's rain and the sun (Layer 0, sun.js).
// Sources:
// - Monthly mean daily max and min temperature, 1901-2009, the 0.5 deg grid cell over Lake Eyasi (3.75 S,
//   35.25 E; a CRU-type record shown at worldspecies.org/geographics/climate/431/173), converted from deg F.
// - Richardson, C. W. (1981) Water Resources Research 17: 182-190 (WGEN): daily max and min temperature as the
//   climate mean plus a persistent anomaly, shifted on wet days (wet days cooler by day, warmer by night).
// - Parton, W. J. and Logan, J. A. (1981) Agricultural Meteorology 23: 205-216: the hourly temperature curve,
//   a sine by day peaking after noon and an exponential fall at night, fitted to sunrise and sunset.
// - Allen et al. (1998) FAO-56: pressure from elevation (eq. 7), saturation vapour pressure (eq. 11), dew point
//   near Tmin less 2-4 deg C in semi-arid places (Annex 6), wind at 2 m.
// - Max Planck Institute fieldwork notes: the Eyasi dry season (June-Oct) is hot, dry and windy.
// Every function is under 30 lines. The numbers marked "assumption" are in the register (clock.js).
import { R } from './clock.js';
import { sunTimes, SITE } from './sun.js';

const F_TO_C = f => ((f - 32) * 5) / 9;
// Lake Eyasi cell, Jan..Dec, deg F (1901-2009)
const TMAX_F = [82.9, 83.7, 83.0, 80.1, 78.2, 77.2, 76.5, 78.5, 81.9, 84.0, 83.0, 82.1];
const TMIN_F = [60.3, 60.7, 61.5, 61.9, 60.5, 57.0, 55.9, 57.2, 58.6, 60.4, 61.0, 60.8];
export const CLIMATE = { tmax: TMAX_F.map(F_TO_C), tmin: TMIN_F.map(F_TO_C) };

// The climate mean on a day, smoothly between month midpoints; m = month 0..11, f = fraction through it
export function climateOn(m, f) {
  const at = (arr, t) => {
    const i = Math.floor(t), w = t - i;
    return arr[((i % 12) + 12) % 12] * (1 - w) + arr[(((i + 1) % 12) + 12) % 12] * w;
  };
  const t = m + f - 0.5; // months measured from mid-January
  return { tmax: at(CLIMATE.tmax, t), tmin: at(CLIMATE.tmin, t) };
}

// Pressure at an elevation, kPa (FAO-56 eq. 7)
export const pressureAt = z => 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26;

// Saturation vapour pressure at T deg C, kPa (FAO-56 eq. 11, Tetens)
export const satVapour = T => 0.6108 * Math.exp((17.27 * T) / (T + 237.3));

// Normal draw from two uniforms (Box-Muller)
const normal = (u1, u2) => Math.sqrt(-2 * Math.log(Math.max(1e-12, u1))) * Math.cos(2 * Math.PI * u2);

// One day's air. prev: yesterday's air (or null); wet: rain today; pi: this month's share of wet days;
// m, f: month and fraction; u: k -> uniform. Wet and dry shifts balance (pi x wet + (1 - pi) x dry = 0), so each
// month's mean stays on the measured climate whatever its share of wet days.
export function airDay(prev, wet, pi, m, f, u) {
  const c = climateOn(m, f), rho = R('tempPersistence'), sd = R('tempAnomalySd'), q = pi / Math.max(0.05, 1 - pi);
  const a = rho * (prev?.anomaly ?? 0) + Math.sqrt(1 - rho * rho) * sd * normal(u(200), u(201));
  const tmax = c.tmax + a + (wet ? -R('wetDayCoolMax') : q * R('wetDayCoolMax'));
  const tmin = Math.min(tmax - 2, c.tmin + 0.5 * a + (wet ? R('wetDayWarmMin') : -q * R('wetDayWarmMin')));
  const dry = m >= 5 && m <= 9; // June-October
  const tdew = tmin - (wet ? 0 : dry ? R('dewDepressionDry') : R('dewDepressionWet'));
  const meanWind = dry ? R('windDryMs') : R('windWetMs');
  const wind = meanWind * Math.sqrt(-Math.log(Math.max(1e-12, u(202)))) / 0.8862; // Weibull k = 2, mean meanWind
  const sunshine = wet ? R('sunshineWet') : R('sunshineDry');
  return { tmax, tmin, anomaly: a, ea: satVapour(tdew), wind, sunshine, pressure: pressureAt(SITE.elevation) };
}

// Air temperature at a clock hour (Parton and Logan 1981): sine from sunrise to sunset peaking a lag after
// solar noon, then an exponential fall from the sunset temperature toward the next morning's minimum
export function tempAt(air, hour, times) {
  const { rise, set } = times, lag = R('tempPeakLagH'), day = set - rise, k = R('tempNightDecay');
  const sine = h => air.tmin + (air.tmax - air.tmin) * Math.sin((Math.PI * (h - rise)) / (day + 2 * lag));
  if (hour >= rise && hour <= set) return sine(hour);
  const tSet = sine(set), night = 24 - day, since = hour > set ? hour - set : hour + 24 - set;
  return air.tmin + (tSet - air.tmin) * Math.exp((-k * since) / night) - ((tSet - air.tmin) * Math.exp(-k) * since) / night;
}

// Relative humidity (0..1) at an air temperature, from the day's vapour pressure
export const humidityAt = (air, T) => Math.min(1, air.ea / satVapour(T));

// Hourly air for the day containing jd: temperature and humidity at each clock hour 0..23
export function airHours(air, jd) {
  const times = sunTimes(jd), out = [];
  for (let h = 0; h < 24; h++) {
    const T = tempAt(air, h + 0.5, times);
    out.push({ T, rh: humidityAt(air, T) });
  }
  return out;
}
