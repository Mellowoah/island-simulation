// Layer 0 (the sun): checked against published answers and against itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../dist/sun.js';

test('S1 FAO-56 example 8 reproduced exactly: Ra on 3 September at 20 S is 32.19 MJ/m2/day', () => {
  const site = { lat: -20, lon: 45, zone: 3, elevation: 0 }, J = 246;
  assert.ok(Math.abs(S.dailyRa(S.declinationFAO(J), J, site) - 32.194) < 0.005); // NCAR's NCL reproduction: 32.194
});

test('S2 the sun at the real 2026 equinox and solstices (USNO times): declination 0 and +/-23.44 deg', () => {
  const at = (mo, d, h, m) => S.sunAt(S.julianDay(2026, mo, d, h + m / 60, 0)).dec;
  assert.ok(Math.abs(at(9, 23, 0, 5)) < 0.02, 'September equinox, 00:05 UT');
  assert.ok(Math.abs(at(6, 21, 8, 24) - 23.436) < 0.02, 'June solstice, 08:24 UT');
  assert.ok(Math.abs(at(12, 21, 20, 50) + 23.436) < 0.02, 'December solstice, 20:50 UT');
});

test('S3 day length at Lake Eyasi (3.6 S): about 12 h 07 min at the equinox, longest in December, shortest in June', () => {
  const day = (y, mo, d) => S.sunTimes(S.julianDay(y, mo, d, 12)).dayHours;
  assert.ok(Math.abs(day(2027, 3, 20) - (12 + 7 / 60)) < 0.03); // 12 h plus refraction and the sun's half-width
  assert.ok(day(2026, 12, 21) > day(2027, 3, 20) && day(2027, 3, 20) > day(2027, 6, 21));
  assert.ok(day(2026, 12, 21) - day(2027, 6, 21) < 0.5, 'near the equator days change by under half an hour');
});

test('S4 two independent calculations agree: hourly sunlight summed over a day equals FAO-56 daily Ra (within 1%)', () => {
  for (const [y, mo, d] of [[2026, 11, 1], [2027, 3, 20], [2027, 6, 21], [2027, 9, 3]]) {
    const noon = S.julianDay(y, mo, d, 12), start = noon - 0.5;
    let mj = 0;
    for (let k = 0; k < 1440; k++) mj += (S.topOfAir(start + (k + 0.5) / 1440) * 60) / 1e6; // W/m2 x 60 s
    const J = Math.round(noon - S.julianDay(y, 1, 1, 12)) + 1, ra = S.dailyRa(S.sunAt(noon).dec, J);
    assert.ok(Math.abs(mj / ra - 1361 / 1367) < 0.01, `${y}-${mo}-${d}: summed ${mj.toFixed(2)} v Ra ${ra.toFixed(2)}`);
  }
});

test('S5 tick 0 is 06:00 EAT on 1 Nov 2026, and daylight follows the sun (dark at 04:00, light at noon)', () => {
  assert.ok(Math.abs(S.clockHourOf(S.jdOfTick(0)) - 6) < 1e-9);
  assert.equal(S.daylight(S.jdOfTick(22)), 0); // 04:00 next day
  assert.equal(S.daylight(S.jdOfTick(6)), 1); // 12:00
});

test('S6 every function in the sun module is under 30 lines', () => {
  const lines = fs.readFileSync(new URL('../dist/sun.js', import.meta.url), 'utf8').split('\n');
  let start = -1;
  lines.forEach((l, i) => {
    if (/^(export )?function /.test(l)) start = i;
    if (start >= 0 && l === '}') { assert.ok(i - start + 1 < 30, `function at line ${start + 1} is ${i - start + 1} lines`); start = -1; }
  });
});

test('S7 every place its own sun: degree lengths on WGS84 (equator 110.574 and 111.320 km; 45 deg 111.132 and 78.847 km); a place 100 km south of Lake Eyasi sits at 4.50 S; clear sky lets more through at 2,300 m (0.796)', () => {
  const e = S.kmPerDegree(0), m = S.kmPerDegree(45);
  assert.ok(Math.abs(e.lat - 110.574) < 0.002 && Math.abs(e.lon - 111.32) < 0.002, JSON.stringify(e));
  assert.ok(Math.abs(m.lat - 111.132) < 0.002 && Math.abs(m.lon - 78.847) < 0.002, JSON.stringify(m));
  const here = S.placeAt(0, 0, S.SITE.elevation);
  assert.equal(here.lat, S.SITE.lat); assert.equal(here.lon, S.SITE.lon); assert.equal(here.zone, S.SITE.zone);
  const south = S.placeAt(0, 100, 1030), high = S.placeAt(60, -20, 2300);
  assert.ok(Math.abs(south.lat + 4.5044) < 0.001, `${south.lat}`);
  assert.ok(Math.abs(S.clearSkyShare(high) - 0.796) < 1e-12);
  const jd = S.julianDay(2026, 12, 21, 12), a = S.sunTimes(jd).dayHours, b = S.sunTimes(jd, south).dayHours;
  // geometry alone (no refraction): day = (2/15) acos(-tan(lat) tan(dec)) hours; the change southward should match it
  const dec = S.sunAt(jd).dec, geo = lat => (2 / 15) * (180 / Math.PI) * Math.acos(-Math.tan((lat * Math.PI) / 180) * Math.tan((dec * Math.PI) / 180));
  const want = geo(south.lat) - geo(S.SITE.lat);
  assert.ok(b > a && Math.abs(b - a - want) < 0.1 * want, `December day longer to the south by ${(b - a) * 60} min, geometry ${want * 60}`);
});
