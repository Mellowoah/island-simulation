// Layer 6 step 2a: germs passed between people (dist/disease.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PNEUMOCOCCUS, forceOn, hungerHazard, caseFatality } from '../dist/disease.js';
import { RATES } from '../dist/clock.js';

const person = (age, reserve = 1, household = 0, pnc = false) => ({ body: { age, fatMax: 1 }, reserve, household, pnc });
const world = households => ({ households });
const counts = (hh, band) => ({ hh: new Map(hh), band: new Map(band) });

test('D1 no carriers anywhere: nobody can pick the germ up (there is no outside world)', () => {
  const s = world([{ band: 0 }]),
    T = counts([[0, { n: 4, child: 0, adult: 0 }]], [[0, { n: 4, c: 0 }]]);
  assert.equal(forceOn(s, person(2), T), 0);
  assert.equal(forceOn(s, person(30), T), 0);
});

test('D2 one adult carrier at home: a child catches it at the measured adult-to-child rate over (size-1)^w', () => {
  const s = world([{ band: 0 }]),
    T = counts([[0, { n: 3, child: 0, adult: 1 }]], [[0, { n: 3, c: 1 }]]),
    want = PNEUMOCOCCUS.household.childFromAdult / Math.pow(2, PNEUMOCOCCUS.densityW);
  assert.ok(Math.abs(forceOn(s, person(2), T) - want) < 1e-12);
});

test('D3 carriers elsewhere in camp: the community rate, scaled by their share over the measured share', () => {
  const s = world([{ band: 0 }, { band: 0 }]),
    T = counts([[0, { n: 2, child: 0, adult: 0 }], [1, { n: 4, child: 0, adult: 1 }]], [[0, { n: 6, c: 1 }]]),
    want = PNEUMOCOCCUS.community.adult * (0.25 / PNEUMOCOCCUS.communityShare);
  assert.ok(Math.abs(forceOn(s, person(30), T) - want) < 1e-12);
});

test('D4 hunger: no extra risk with a full store, the measured severe-wasting ratio when empty, rising between', () => {
  assert.equal(hungerHazard(person(2, 1)), 1);
  assert.ok(Math.abs(hungerHazard(person(2, 0)) - RATES.hungerRiskMax.value) < 1e-9);
  let last = 0;
  for (let r = 1; r >= 0; r -= 0.05) {
    const h = caseFatality(person(2, r));
    assert.ok(h >= last - 1e-12 && h <= 1);
    last = h;
  }
  assert.ok(Math.abs(caseFatality(person(30, 1)) - RATES.pneumoniaFatalAdult.value) < 1e-12);
});
