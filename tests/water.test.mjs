// Layer 2 (water): checked against FAO-56, the SCS curve-number method and conservation of water.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as W from '../dist/water.js';

test('W1 FAO-56 example 18 (Uccle, 6 July): Penman-Monteith gives 3.88 mm/day', () => {
  const et0 = W.penmanMonteith({ tmax: 21.5, tmin: 12.3, ea: 1.409, wind: 2.078, Rn: 13.282, P: 100.124 });
  assert.ok(Math.abs(et0 - 3.88) < 0.01, `${et0}`);
});

test('W2 SCS runoff: none below the initial loss 0.2 S, never more than the rain, more on wet ground', () => {
  const S = 25400 / 75 - 254;
  assert.equal(W.runoff(0.2 * S - 0.01, 75), 0);
  for (const P of [10, 30, 80, 200]) assert.ok(W.runoff(P, 75) < P);
  assert.ok(W.runoff(50, W.curveNumber(75, 1)) > W.runoff(50, W.curveNumber(75, 0)));
  assert.ok(Math.abs(W.curveNumber(75, 0.5) - 75) < 1e-9);
});

test('W3 water is conserved in the soil and groundwater over 10 000 random days', () => {
  let soil = 50, g = 0, rain = 0, out = 0, r = 3;
  const u = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let d = 0; d < 10000; d++) {
    const P = u() < 0.3 ? -Math.log(u()) * 12 : 0, f = W.soilDay(soil, P, 2 + 4 * u(), 150, 75), q = W.groundDay(g, f.recharge, 120);
    rain += P; out += f.quick + f.evap + q.seep; soil = f.soil; g = q.store;
    assert.ok(soil >= -1e-9 && soil <= 150 + 1e-9 && g >= 0);
  }
  assert.ok(Math.abs(rain - out - (soil - 50) - g) < 1e-6);
});

test('W4 the drier the air, the more it draws: evaporation rises with heat, wind and sun, falls with humidity', () => {
  const base = { tmax: 28, tmin: 15, ea: 1.4, wind: 2, Rn: 14, P: 89.7 }, f = o => W.penmanMonteith({ ...base, ...o });
  assert.ok(f({ tmax: 32 }) > f({}) && f({ wind: 4 }) > f({}) && f({ Rn: 18 }) > f({}) && f({ ea: 1.8 }) < f({}));
});

test('W5 every function in the water module is under 30 lines', () => {
  const lines = fs.readFileSync(new URL('../dist/water.js', import.meta.url), 'utf8').split('\n');
  let start = -1;
  lines.forEach((l, i) => {
    if (/^(export )?function /.test(l)) start = i;
    if (start >= 0 && l === '}') { assert.ok(i - start + 1 < 30, `function at line ${start + 1}`); start = -1; }
  });
});
