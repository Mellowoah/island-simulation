// Layer 4 (plants): growth from transpired water, curing on dry soil, and conservation of grass matter.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../dist/plants.js';

test('P1 growth from water: 1 mm of evapotranspiration gives 0.51 x 1000 g / 300 x 0.53 = 0.90 g/m2 above ground', () => {
  assert.ok(Math.abs(P.growthFrom(1) - ((0.51 * 1000) / 300) * 0.53) < 1e-9);
  assert.equal(P.growthFrom(0), 0);
});

test('P2 curing: none on wet soil, faster the drier the soil', () => {
  assert.equal(P.curingShare(0.8), 0);
  assert.ok(P.curingShare(0.3) > 0 && P.curingShare(0.1) > P.curingShare(0.3));
});

test('P3 books: grass grown = green + dead + removed, over many wet and dry days', () => {
  const s = { weather: { aet: 0, soil: 0 }, plants: P.newPlants() };
  for (let d = 0; d < 400; d++) {
    s.weather.aet = d % 30 < 15 ? 4 : 0.5;
    s.weather.soil = d % 30 < 15 ? 120 : 20;
    P.plantsDay(s);
  }
  const { green, dead, grownTotal, removedTotal } = s.plants;
  assert.ok(grownTotal > 0 && removedTotal > 0);
  assert.ok(Math.abs(grownTotal - green - dead - removedTotal) < 1e-9 * grownTotal);
});

test('P4 grown food knows nothing of a people density: changing it changes no patch', async () => {
  const { createWorld2 } = await import('../dist/world.js');
  const a = createWorld2(1, { layers: { plants: 'real' } }),
    b = createWorld2(1, { layers: { plants: 'real' }, density: 5 });
  assert.deepEqual(
    a.patches.map(p => [p.food, p.regen]),
    b.patches.map(p => [p.food, p.regen]),
  );
});
