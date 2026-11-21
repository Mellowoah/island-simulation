// Layer 5 (animals): intake by metabolic mass, grazing books, starvation, and the measured fish yields.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../dist/fauna.js';

test('F1 intake scales with mass^0.75: a 16x heavier animal eats 8x as much', () => {
  assert.ok(Math.abs(F.intakeKgDay(160) / F.intakeKgDay(10) - 8) < 1e-9);
  assert.ok(Math.abs(F.intakeKgDay(1) - 0.09) < 1e-12);
});

test('F2 grazing books: what is eaten leaves the green grass first, then the dead; never more than there is', () => {
  const P = { green: 2, dead: 3 };
  const met = F.grazeDay(P, 4000, 1); // 4,000 kg over 1 km2 is 4 g/m2
  assert.equal(P.green, 0);
  assert.equal(P.dead, 1);
  assert.equal(P.eatenTotal, 4);
  assert.equal(met, 1);
  assert.equal(F.grazeDay(P, 4000, 1), 0.25); // only 1 g/m2 left
});

test('F3 starvation: none when fed; a herd with nothing lasts about starveDays', () => {
  assert.equal(F.starveDeaths(100, 1), 0);
  assert.equal(F.starveDeaths(100, 0), 100 / 60);
});

test('F4 fish follow Marshall (1984): 355 kg/ha at 1 km2, 200 at 10, falling with area', () => {
  assert.ok(Math.abs(F.lakeFishKgHa(1) - 355) < 1e-9 && Math.abs(F.lakeFishKgHa(10) - 200) < 1e-9);
  assert.ok(F.lakeFishKgHa(34) < 200 && F.lakeFishKgHa(34) > 112);
});
