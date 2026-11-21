// Contracts between layers: what each layer hands the next stays in physical range, every day of a year.
// A real layer feeding a stand-in (or the other way) that hands over nonsense fails here, at the boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld2, stepWorld } from '../dist/world.js';
import { satVapour } from '../dist/atmosphere.js';
import { R } from '../dist/clock.js';

const inRange = (x, lo, hi, what) => assert.ok(Number.isFinite(x) && x >= lo && x <= hi, `${what} = ${x}, outside ${lo}..${hi}`);

function checkAir(W) { // atmosphere -> water, plants, people
  inRange(W.tmax, 5, 45, 'max temperature (deg C)');
  inRange(W.tmin, 0, 35, 'min temperature (deg C)');
  assert.ok(W.tmin < W.tmax, 'min below max');
  inRange(W.air.ea, 0.1, satVapour(W.tmax), 'vapour pressure (kPa)');
  inRange(W.air.wind, 0, 25, 'wind (m/s)');
  inRange(W.air.sunshine, 0, 1, 'sunshine (n/N)');
}

function checkWater(W) { // water -> plants, animals, people
  inRange(W.rain, 0, 300, 'rain (mm/day)');
  inRange(W.soil, 0, R('soilMaxMm') + 1e-9, 'soil water (mm)');
  inRange(W.pet, 0, 12, 'evaporation (mm/day)');
}

function checkLife(s) { // plants -> animals -> people
  for (const p of s.patches) inRange(p.stock, 0, p.capacity * 3, `food stock at ${p.id}`);
  for (const id in s.animals) for (const n of Object.values(s.animals[id])) inRange(n, 0, 1e6, `animals ${id}`);
}

test('C1 every boundary stays in physical range over a year (island 71)', () => {
  const s = createWorld2(71);
  for (let d = 0; d < 365; d++) {
    stepWorld(s, 24);
    checkAir(s.weather);
    checkWater(s.weather);
    checkLife(s);
  }
});
