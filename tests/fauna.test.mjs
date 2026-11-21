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

test('F3 starvation: none when fed; a herd with nothing lasts about herdStarveDays', () => {
  assert.equal(F.starveDeaths(100, 1), 0);
  assert.equal(F.starveDeaths(100, 0), 100 / 60);
});

test('F4 fish follow Marshall (1984): 355 kg/ha at 1 km2, 200 at 10, falling with area', () => {
  assert.ok(Math.abs(F.lakeFishKgHa(1) - 355) < 1e-9 && Math.abs(F.lakeFishKgHa(10) - 200) < 1e-9);
  assert.ok(F.lakeFishKgHa(34) < 200 && F.lakeFishKgHa(34) > 112);
});

test('F5 fire needs fuel: no dead grass, no fire; a fire burns its share of the dead grass and the books hold', async () => {
  const { createWorld2, stepWorld } = await import('../dist/world.js');
  const s = createWorld2(3, {});
  stepWorld(s, 24 * 400);
  const P = s.plants;
  const held = P.green + P.dead + P.removedTotal + (P.eatenTotal ?? 0) + (P.burnedTotal ?? 0);
  assert.ok(Math.abs(P.grownTotal - held) < 1e-6 * P.grownTotal, `${P.grownTotal} vs ${held}`);
});

test('F6 grouped hunting (Fryxell 2007): kills level off at the handling limit of the group; more herds, more kills', async () => {
  const { PREDATORS } = F;
  const few = F.killsPerDay(PREDATORS.lion, [0.01]), many = F.killsPerDay(PREDATORS.lion, [1000]);
  assert.ok(many[0] > few[0]);
  const limit = 1 / (0.045 + 1.422 / 6.3) / 6.3; // per lion, at endless prey
  assert.ok(many[0] < limit && many[0] > 0.9 * limit);
});

test('F7 energy law: green grass feeds above need, cured grass below it (Minson ME; maintenance 0.51 MJ/kg^0.75)', () => {
  assert.ok(Math.abs(F.meOf(F.FORAGE.green) - (0.157 * 62 + 0.059 * 10 - 1.073)) < 1e-9);
  assert.ok(F.energyRatio(1, 1) > 1.5 && F.energyRatio(0, 1) < 0.8);
  const fed = F.conditionDay(10, 1.5), starving = F.conditionDay(0.2, 0.5);
  assert.equal(fed.breed, 1);
  assert.equal(starving.breed, 0);
  assert.ok(starving.starve > 0);
});
