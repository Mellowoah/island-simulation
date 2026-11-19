// ---------- Layer 0: energy from the sun ----------
// Where the sun is, how long the day is, and how much sunlight reaches the top of the air and the ground.
// The sun runs on true astronomical time: tick 0 is 06:00 East Africa Time (UTC+3) on 1 November 2026, and each
// tick adds its hours. The world's calendar has 365-day years (a "no-leap" calendar, as in many climate models),
// so its date labels drift from the sun by about a day every four years; the sun itself does not drift.
// Sources:
// - Meeus, J. (1998) Astronomical Algorithms, 2nd ed., ch. 7 (Julian day), ch. 25 (the sun, low precision:
//   about 0.01 degree) and ch. 28 (equation of time); the method of the NOAA Solar Calculator.
// - Allen, R. G., Pereira, L. S., Raes, D. and Smith, M. (1998) FAO Irrigation and Drainage Paper 56, ch. 3:
//   extraterrestrial radiation Ra (eq. 21), clear-sky radiation Rso (eq. 37), Angstrom (eq. 35), net shortwave
//   (eq. 38), net longwave (eq. 39). Its example 8 is test S1.
// - Kopp, G. and Lean, J. L. (2011) Geophysical Research Letters 38: total solar irradiance 1361 W/m2.
// Every function is under 30 lines (tests/sun.test.mjs checks).

export const SOLAR_CONSTANT = 1361; // W/m2 (Kopp and Lean 2011)
export const GSC_MJ = 0.082; // MJ/m2/min, FAO-56's solar constant (used only in dailyRa, as FAO-56 does)
export const STEFAN_BOLTZMANN_MJ = 4.903e-9; // MJ/K4/m2/day
export const SITE = { lat: -3.6, lon: 35.2, zone: 3, elevation: 1030 }; // Lake Eyasi, Tanzania; EAT = UTC+3

const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;
const mod = (x, m) => ((x % m) + m) % m;

// Julian day from a calendar date and a clock hour in a time zone (Meeus ch. 7, Gregorian calendar)
export function julianDay(year, month, day, hour = 12, zone = SITE.zone) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100), B = 2 - A + Math.floor(A / 4);
  const jd0 = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  return jd0 + (hour - zone) / 24;
}

export const JD_START = julianDay(2026, 11, 1, 6); // tick 0: 06:00 EAT, 1 November 2026

// Julian day of a world tick
export const jdOfTick = (tick, hoursPerTick = 1) => JD_START + (tick * hoursPerTick) / 24;

// The sun at a Julian day: declination (deg), equation of time (min), Earth-sun distance (AU) (Meeus ch. 25, 28)
export function sunAt(jd) {
  const T = (jd - 2451545) / 36525, L0 = mod(280.46646 + 36000.76983 * T + 0.0003032 * T * T, 360);
  const M = rad(357.52911 + 35999.05029 * T - 0.0001537 * T * T), e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const om = rad(125.04 - 1934.136 * T), lam = rad(L0 + C - 0.00569 - 0.00478 * Math.sin(om));
  const eps = rad(23.439291 - 0.0130042 * T + 0.00256 * Math.cos(om));
  const R = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(M + rad(C)));
  const y = Math.tan(eps / 2) ** 2, L = rad(L0);
  const E = y * Math.sin(2 * L) - 2 * e * Math.sin(M) + 4 * e * y * Math.sin(M) * Math.cos(2 * L) -
    0.5 * y * y * Math.sin(4 * L) - 1.25 * e * e * Math.sin(2 * M);
  return { dec: deg(Math.asin(Math.sin(eps) * Math.sin(lam))), eot: 4 * deg(E), dist: R };
}

// Clock hour (0..24, zone time) of a Julian day
export const clockHourOf = (jd, zone = SITE.zone) => mod((jd + 0.5 + zone / 24) * 24, 24);

// Sun's elevation above the horizon (deg) at a Julian day
export function elevation(jd, site = SITE) {
  const s = sunAt(jd), h = clockHourOf(jd, site.zone);
  const solarMin = h * 60 + s.eot + 4 * site.lon - 60 * site.zone; // true solar time, minutes
  const w = rad(solarMin / 4 - 180), phi = rad(site.lat), d = rad(s.dec);
  const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(w);
  return deg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
}

// Half the time (hours) the sun's centre stays above altitude a (deg), for declination dec (deg)
export function halfDay(dec, a, site = SITE) {
  const phi = rad(site.lat), d = rad(dec);
  const c = (Math.sin(rad(a)) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d));
  if (c <= -1) return 12;
  if (c >= 1) return 0;
  return deg(Math.acos(c)) / 15;
}

// Julian day of local noon (clock 12:00) on the local day containing jd
export const localNoonJd = (jd, zone = SITE.zone) => Math.floor(jd + 0.5 + zone / 24) - 0.5 + (12 - zone) / 24;

// Sun times for the local day containing jd, in clock hours: solar noon, sunrise and sunset (upper limb with
// refraction, -0.833 deg), civil dawn and dusk (-6 deg); day length in hours
export function sunTimes(jd, site = SITE) {
  const s = sunAt(localNoonJd(jd, site.zone)), noon = 12 - (s.eot + 4 * site.lon - 60 * site.zone) / 60;
  const up = halfDay(s.dec, -0.833, site), civil = halfDay(s.dec, -6, site);
  return { noon, rise: noon - up, set: noon + up, dawn: noon - civil, dusk: noon + civil, dayHours: 2 * up };
}

// Light outside: 1 in full day, 0 in the dark, rising through civil twilight (sun between -6 and 0 deg)
export function daylight(jd, site = SITE) {
  const a = elevation(jd, site);
  return a >= 0 ? 1 : a <= -6 ? 0 : (a + 6) / 6;
}

// Extraterrestrial radiation for a day, MJ/m2/day (FAO-56 eq. 21), from declination (deg) and day of year J
export function dailyRa(dec, J, site = SITE) {
  const phi = rad(site.lat), d = rad(dec), ws = rad(15 * halfDay(dec, 0, site));
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * J) / 365); // FAO-56 eq. 23
  const k = ((24 * 60) / Math.PI) * GSC_MJ * dr;
  return k * (ws * Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.sin(ws));
}

// FAO-56's simple declination (eq. 24), deg; kept only so its worked example can be reproduced exactly
export const declinationFAO = J => deg(0.409 * Math.sin((2 * Math.PI * J) / 365 - 1.39));

// Sunlight at the top of the air on level ground, W/m2: the solar constant over distance squared, times sin(elevation)
export function topOfAir(jd, site = SITE) {
  const s = Math.sin(rad(elevation(jd, site)));
  return s > 0 ? (SOLAR_CONSTANT * s) / sunAt(jd).dist ** 2 : 0;
}

// Clear-sky share of top-of-air sunlight reaching the ground (FAO-56 eq. 37)
export const clearSkyShare = (site = SITE) => 0.75 + 2e-5 * site.elevation;

// Share reaching the ground with sunshine fraction n/N (Angstrom, FAO-56 eq. 35: a = 0.25, b = 0.50)
export const angstromShare = sunshine => 0.25 + 0.5 * Math.max(0, Math.min(1, sunshine));

// Sunlight at the ground (W/m2) at a Julian day with sunshine fraction n/N
export const atGround = (jd, sunshine, site = SITE) => topOfAir(jd, site) * angstromShare(sunshine);

// What the ground keeps after reflecting a share (albedo; FAO-56 eq. 38 uses 0.23 for grass)
export const netShortwave = (Rs, albedo = 0.23) => (1 - albedo) * Rs;

// Net longwave loss for a day, MJ/m2/day (FAO-56 eq. 39): Stefan-Boltzmann on Tmax and Tmin (deg C), lowered by
// humidity (actual vapour pressure ea, kPa), larger under clear skies (Rs/Rso)
export function netLongwave(tmax, tmin, ea, RsOverRso) {
  const k4 = t => (t + 273.16) ** 4;
  const sigma = (STEFAN_BOLTZMANN_MJ * (k4(tmax) + k4(tmin))) / 2;
  const cloud = 1.35 * Math.max(0.05, Math.min(1, RsOverRso)) - 0.35;
  return sigma * (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) * cloud;
}
