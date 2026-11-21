// Layer 1 (the atmosphere): checked against the measured climate and against physical limits.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as A from '../dist/atmosphere.js';
import { julianDay, sunTimes } from '../dist/sun.js';
import { WET_SHARE_BY_MONTH } from '../dist/weather.js';

const NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); // test-only generator

test('A1 pressure from elevation (FAO-56 eq. 7): 101.3 kPa at sea level, 90.0 kPa at 1000 m', () => {
  assert.ok(Math.abs(A.pressureAt(0) - 101.3) < 1e-9);
  assert.ok(Math.abs(A.pressureAt(1000) - 90.0) < 0.05);
});

test('A2 twenty years of days reproduce the measured monthly max and min within 0.3 deg C, with rain days in', () => {
  const r = rng(7), sum = Array.from({ length: 12 }, () => ({ x: 0, n: 0, y: 0 }));
  let prev = null;
  for (let d = 0; d < 365 * 20; d++) {
    const m = Math.floor((d % 365) / 30.42) % 12, f = ((d % 365) / 30.42) % 1, pi = WET_SHARE_BY_MONTH[NAMES[m]];
    prev = A.airDay(prev, r() < pi, pi, m, f, () => r());
    const c = A.climateOn(m, f), s = sum[m];
    s.x += prev.tmax - c.tmax; s.y += prev.tmin - c.tmin; s.n++;
  }
  for (const [m, s] of sum.entries()) {
    assert.ok(Math.abs(s.x / s.n) < 0.3, `month ${m + 1} max off by ${(s.x / s.n).toFixed(2)}`);
    assert.ok(Math.abs(s.y / s.n) < 0.3, `month ${m + 1} min off by ${(s.y / s.n).toFixed(2)}`);
  }
});

test('A3 the day curve: coldest near sunrise, warmest in the afternoon, no jumps at sunrise or sunset', () => {
  const air = { tmax: 30, tmin: 16 }, t = sunTimes(julianDay(2026, 11, 1, 12));
  const hours = Array.from({ length: 240 }, (_, i) => i / 10), T = hours.map(h => A.tempAt(air, h, t));
  const hot = hours[T.indexOf(Math.max(...T))], cold = hours[T.indexOf(Math.min(...T))];
  assert.ok(hot > 13 && hot < 16, `warmest at ${hot}`); assert.ok(Math.abs(cold - t.rise) < 0.2, `coldest at ${cold}`);
  assert.ok(Math.max(...T) <= 30 + 1e-9 && Math.min(...T) >= 16 - 1e-9);
  for (const h of [t.rise, t.set]) assert.ok(Math.abs(A.tempAt(air, h - 1e-6, t) - A.tempAt(air, h + 1e-6, t)) < 0.01);
});

test('A4 humidity stays physical: vapour pressure never above saturation, relative humidity 0..1', () => {
  const r = rng(11); let prev = null;
  for (let d = 0; d < 2000; d++) {
    const m = d % 12; prev = A.airDay(prev, r() < 0.4, 0.4, m, 0.5, () => r());
    assert.ok(prev.ea <= A.satVapour(prev.tmin) + 1e-12);
    for (const T of [prev.tmin, prev.tmax]) { const h = A.humidityAt(prev, T); assert.ok(h > 0 && h <= 1); }
  }
});

test('A5 every function in the atmosphere module is under 30 lines', () => {
  const lines = fs.readFileSync(new URL('../dist/atmosphere.js', import.meta.url), 'utf8').split('\n');
  let start = -1;
  lines.forEach((l, i) => {
    if (/^(export )?function /.test(l)) start = i;
    if (start >= 0 && l === '}') { assert.ok(i - start + 1 < 30, `function at line ${start + 1}`); start = -1; }
  });
});
