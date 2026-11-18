// Tests for the 0.1.2 integration decisions (see docs/DECISIONS.md, D1–D6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, command, metrics, serialize, deserialize, DEFAULTS, VERSION } from '../dist/sim.js';
import { runSeed, aggregate } from '../dist/experiment.js';
import { setDefaultClock } from '../dist/clock.js';
setDefaultClock('legacy'); // these tests pin the original (pre-17 Nov) behaviour; tests/clock.test.mjs covers the real clock

test('D6 version-2 saves convert to version 3 with default values and continue identically', () => {
  const live = createWorld(41); step(live, 500);
  const e = JSON.parse(serialize(live));
  e.version = 2; e.world.version = 2; delete e.world.config.expectationRate; delete e.world.config.revealPrior;
  const loaded = deserialize(JSON.stringify(e));
  assert.equal(VERSION, 3);
  assert.equal(loaded.version, 3);
  assert.equal(loaded.config.expectationRate, DEFAULTS.expectationRate);
  assert.equal(loaded.config.revealPrior, DEFAULTS.revealPrior);
  step(live, 300); step(loaded, 300);
  assert.equal(serialize(loaded), serialize(live));
});

test('D6 unsupported versions and out-of-range values are rejected', () => {
  const e = JSON.parse(serialize(createWorld(41)));
  assert.throws(() => deserialize(JSON.stringify({ ...e, version: 1, world: { ...e.world, version: 1 } })), /Invalid or incompatible save/);
  assert.throws(() => deserialize(JSON.stringify({ ...e, version: 2 })), /Invalid or incompatible save/, 'header and world versions must agree');
  const bad = structuredClone(e); bad.world.config.expectationRate = 1.5;
  assert.throws(() => deserialize(JSON.stringify(bad)), /Invalid or incompatible save/);
});

test('D6 expectation rate and reveal prior come from configuration', () => {
  const blend = (rate) => {
    const s = createWorld(41, { expectationRate: rate, regenA: 0 });
    step(s); // first sighting stores the observed stock
    const c = s.creatures.find(c => c.known.a); const first = c.known.a.expected;
    s.patches[0].stock = 0; step(s);
    return { first, second: c.known.a.expected };
  };
  const d = blend(DEFAULTS.expectationRate), half = blend(0.5);
  assert.equal(d.second, d.first * 0.65 + 0 * 0.35, 'default reproduces the 0.1.1 blend');
  assert.equal(half.second, half.first * 0.5);
  const r = createWorld(41, { revealPrior: 25 }); command(r, { type: 'reveal', id: 0 });
  assert.equal(r.creatures[0].known.b.expected, 25);
});

test('D3 recovery is only defined for disturbed runs and is judged against the matched control', () => {
  const rows = runSeed(45);
  const by = (b, c) => rows.find(r => r.branch === b && r.condition === c);
  for (const r of rows.filter(r => !r.condition.includes('failure'))) {
    assert.equal(r.recoveryNote, 'Not applicable (no disturbance)');
    assert.equal(r.recoveryMinutes, null);
  }
  for (const r of rows.filter(r => r.condition.includes('failure'))) {
    assert.equal(r.controlCondition, r.condition.startsWith('withdrawn') ? 'withdrawn' : r.condition.startsWith('continued') ? 'continued-provision' : 'unchanged');
    assert.ok(Number.isFinite(r.controlMaxMedianHunger));
    assert.ok(by(r.branch, r.controlCondition), 'matched control exists in the same branch');
    if (r.recoveryMinutes !== null) assert.ok(r.recoveryAlive >= 0 && r.recoveryAlive <= 24);
  }
  for (const r of rows.filter(r => r.recoveryMinutes !== null)) assert.ok(r.after.medianHungerAll <= 100);
  const dead = rows.find(r => r.branch === 'baseline' && r.condition === 'berry-failure');
  if (dead.after.medianHungerAll === 100) assert.equal(dead.recoveryMinutes, null, 'a majority dead can never count as recovered');
  for (const r of rows.filter(r => r.recoverySustained)) assert.ok(r.after.medianHungerAll <= r.before.medianHungerAll, 'sustained means it held to the end');
  for (const r of rows.filter(r => r.recoveryMinutes !== null && !r.recoverySustained)) assert.equal(r.recoveryNote, 'Recovered temporarily, then worsened');
  const summary = aggregate(rows);
  assert.ok(summary.every(g => g.disturbed === g.key.includes('failure')));
});

test('D4 gifted food left on the ground is reported, not removed', () => {
  const s = createWorld(41);
  command(s, { type: 'food', x: 13, y: 13, amount: 200 });
  const m = metrics(s);
  assert.equal(m.giftRemaining, 200);
  assert.equal(m.food, 440);
  const rows = runSeed(45).filter(r => r.branch === 'provision');
  assert.ok(rows.every(r => r.before.giftRemaining > 0), 'provision leaves gifts at the branch point');
  assert.ok(rows.every(r => r.before.giftRemaining === rows[0].before.giftRemaining), 'all follow-ups start from the same snapshot');
});

test('Learning fixture: experience changes later gathering outcomes, and disabling learning removes that', () => {
  const run = (config) => { const s = createWorld(41, config); step(s, 14400); return s; };
  const perUnit = (s) => s.creatures.reduce((n, c) => n + c.times.gather, 0) / s.ledger.consumed;
  const learned = run({}), fixed = run({ learning: 0 });
  assert.ok(learned.creatures.every(c => c.skills.a + c.skills.b > 0));
  assert.ok(fixed.creatures.every(c => c.skills.a === 0 && c.skills.b === 0));
  assert.ok(perUnit(learned) < perUnit(fixed), `gathering minutes per food unit: learning ${perUnit(learned).toFixed(3)} vs none ${perUnit(fixed).toFixed(3)}`);
});
