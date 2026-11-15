// Tests answering the Edge critic review (issue #1), implementation items 1–3 and F4 reporting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, command, metrics, serialize, deserialize, noise, noise2, seedKey } from '../dist/sim.js';
import { PLAN, schedule } from '../dist/experiment.js';
import { DAY } from '../dist/sim.js';

const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n; let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return s / Math.sqrt(sa * sb); };
const seq = (f, n = 5000) => Array.from({ length: n }, (_, t) => f(t));

test('E1 random streams of different seeds are uncorrelated (new worlds)', () => {
  // Legacy function: nearby seeds were strongly correlated (the defect).
  assert.ok(Math.abs(corr(seq(t => noise(41, t, 5, 10)), seq(t => noise(43, t, 5, 10)))) > 0.3);
  let worst = 0;
  for (let x = 41; x <= 60; x++) for (let y = x + 1; y <= 60; y++)
    worst = Math.max(worst, Math.abs(corr(seq(t => noise2(seedKey(x), t, 5, 10)), seq(t => noise2(seedKey(y), t, 5, 10)))));
  assert.ok(worst < 0.06, `worst pairwise |r| over seeds 41–60 was ${worst.toFixed(3)}`);
  assert.equal(createWorld(41).rng, 2);
});

test('E1b saves without the rng field keep the legacy stream and continue identically', () => {
  assert.deepEqual([noise(41, 0, 0), noise(41, 137, 5, 99), noise(43, 1000, 23, 40)], [0.3108978329692036, 0.648869052529335, 0.9887221269309521], 'legacy function unchanged');
  const legacy = createWorld(41); delete legacy.rng; step(legacy, 300);
  const e = JSON.parse(serialize(legacy));
  const loaded = deserialize(JSON.stringify(e));
  assert.equal(loaded.rng, undefined);
  const modern = deserialize(JSON.stringify({ ...e, world: { ...e.world, rng: 2 } }));
  step(legacy, 500); step(loaded, 500); step(modern, 500);
  assert.equal(serialize(loaded), serialize(legacy));
  assert.notEqual(JSON.stringify(modern.creatures), JSON.stringify(legacy.creatures), 'the two streams really differ');
  assert.throws(() => deserialize(JSON.stringify({ ...e, world: { ...e.world, rng: 3 } })), /Invalid or incompatible save/);
});

test('E2 an intervention reaches other creatures only through the world, never through random draws', () => {
  for (const seed of [41, 43, 52]) {
    const a = createWorld(seed), b = createWorld(seed);
    command(b, { type: 'reveal', id: 0 });
    let stockDiffered = false;
    for (let t = 0; t < 14400; t++) {
      step(a); step(b);
      if (a.patches.some((p, i) => p.stock !== b.patches[i].stock)) stockDiffered = true;
      if (stockDiffered) break;
      for (let i = 1; i < 24; i++) {
        assert.deepEqual(b.creatures[i].decision, a.creatures[i].decision, `seed ${seed} creature ${i} tick ${a.tick}`);
        assert.deepEqual([b.creatures[i].x, b.creatures[i].y], [a.creatures[i].x, a.creatures[i].y]);
      }
    }
  }
});

test('E3 withdrawal accounting: after provision stops, gifts stop, leftovers only shrink, ledger reconciles', () => {
  const s = createWorld(45), train = PLAN.trainingDays * DAY;
  for (let i = 0; i < train; i++) schedule(s, 'provision');
  const giftedAtStop = s.ledger.gifted;
  assert.equal(giftedAtStop, PLAN.provision.amount * (train / PLAN.provision.every));
  let left = metrics(s).giftRemaining;
  assert.ok(left > 0);
  for (let i = 0; i < DAY; i++) {
    schedule(s, 'provision', false);
    const m = metrics(s);
    assert.equal(s.ledger.gifted, giftedAtStop, 'no further gifts');
    assert.ok(m.giftRemaining <= left + 1e-9, 'leftover never grows');
    left = m.giftRemaining;
    const l = s.ledger;
    assert.ok(Math.abs(l.initial + l.regenerated + l.gifted - l.consumed - m.food) < 1e-6);
  }
});

test('E4 summaries can count the dead: medianHungerAll treats each death as 100', () => {
  const s = createWorld(41);
  for (const c of s.creatures.slice(0, 13)) { c.alive = false; c.death = { tick: 0, cause: 'test' }; }
  const m = metrics(s);
  assert.equal(m.deaths, 13);
  assert.equal(m.medianHunger, 20);
  assert.equal(m.medianHungerAll, 100);
  assert.equal(m.knownSourcesAll, m.knownSources * 11 / 24, 'capacity proxies count each death as 0');
  assert.equal(m.skillAll, m.skill * 11 / 24);
});
