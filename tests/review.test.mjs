// Regression tests added during the November 2026 review. Each named defect test fails on the
// unpatched 0.1.1 sources and passes after the matching patch (see REVIEW/CHANGELOG.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, command, serialize, deserialize } from '../dist/sim.js';
import { PLAN, schedule, runSeed } from '../dist/experiment.js';

const mutated = (fn) => { const e = JSON.parse(serialize(createWorld(41))); fn(e.world); return JSON.stringify(e); };

test('R1 saves that would crash the inspector are rejected', () => {
  assert.throws(() => deserialize(mutated(w => { w.creatures[3].alive = false; w.creatures[3].death = null; })), /Invalid or incompatible save/);
  assert.throws(() => deserialize(mutated(w => { w.creatures[0].decision = { tick: 0, hunger: 'x', energy: 1, selected: 'rest', patch: null, options: [] }; })), /Invalid or incompatible save/);
  assert.throws(() => deserialize(mutated(w => { w.creatures[0].decision = { tick: 'x', hunger: 1, energy: 1, selected: 'rest', patch: null, options: [] }; })), /Invalid or incompatible save/);
  assert.throws(() => deserialize(mutated(w => { w.creatures[0].decision = { tick: 0, hunger: 1, energy: 1, selected: 'rest', patch: null, options: [{ type: {}, score: 1, reason: 'r' }] }; })), /Invalid or incompatible save/);
  assert.throws(() => deserialize(mutated(w => { w.creatures[0].death = { tick: 0, cause: 'x' }; })), /Invalid or incompatible save/);
});

test('R1b genuine saves with deaths and recorded decisions still load', () => {
  const s = createWorld(41, { regenA: 0, regenB: 0 });
  step(s, 12000);
  assert.ok(s.creatures.some(c => !c.alive) && s.creatures.every(c => c.decision));
  assert.equal(serialize(deserialize(serialize(s))), serialize(s));
});

test('R2 opening the crossing does not cancel gathering already under way', () => {
  const s = createWorld(41);
  let gatherer, traveller;
  for (let t = 0; t < 5000 && !(gatherer && traveller); t++) {
    step(s);
    gatherer = s.creatures.find(c => c.alive && c.action?.type === 'gather' && c.action.route.length === 0 && c.action.left > 2);
    traveller = s.creatures.find(c => c.alive && c.action?.route?.length > 0);
  }
  const action = gatherer.action;
  command(s, { type: 'bridge' });
  assert.equal(gatherer.action, action, 'gathering in progress kept');
  assert.equal(traveller.action, null, 'creatures still travelling replan with the new costs');
});

test('R3 revealing a location the creature already knows does not overwrite its estimate', () => {
  const s = createWorld(41);
  let c;
  for (let t = 0; t < 30000 && !c; t++) { step(s); c = s.creatures.find(c => c.alive && c.known.b && Math.abs(c.known.b.expected - 60) > 5); }
  const before = { ...c.known.b }, action = c.action;
  command(s, { type: 'reveal', id: c.id });
  assert.deepEqual(c.known.b, before);
  assert.equal(c.action, action);
  const fresh = createWorld(41);
  command(fresh, { type: 'reveal', id: 0 });
  assert.equal(fresh.creatures[0].known.b.expected, 60, 'first reveal unchanged');
});

test('R4 experiment interventions come from the recorded PLAN', () => {
  const saved = structuredClone(PLAN);
  try {
    Object.assign(PLAN.provision, { x: 20, y: 10, amount: 25 });
    const s = createWorld(41);
    schedule(s, 'provision');
    const gift = s.patches.find(p => p.gift);
    assert.deepEqual([gift.x, gift.y, s.ledger.gifted], [20, 10, 25]);

    PLAN.access.tick = 3;
    const a = createWorld(41);
    for (let i = 0; i < 3; i++) schedule(a, 'access');
    assert.equal(a.bridge, false);
    schedule(a, 'access');
    assert.equal(a.bridge, true);

    PLAN.recipient = 5;
    const r = createWorld(41);
    schedule(r, 'information');
    assert.ok(r.creatures[5].known.b && !r.creatures[0].known.b);

    const f = createWorld(41);
    command(f, { type: 'failure', patch: 'b' });
    assert.deepEqual(f.patches.slice(0, 2).map(p => p.regen), [0.18, 0]);
    assert.throws(() => command(createWorld(41), { type: 'failure', patch: 'g0' }), /Unknown source/);
  } finally {
    for (const k of Object.keys(PLAN)) delete PLAN[k];
    Object.assign(PLAN, saved);
  }
});

test('R4b default PLAN keeps experiment rows reproducible', () => {
  assert.equal(JSON.stringify(runSeed(45)), JSON.stringify(runSeed(45)));
});

test('K1 hidden gifted food far away cannot affect decisions until observed', () => {
  const a = createWorld(43), b = createWorld(43);
  command(b, { type: 'food', x: 30, y: 12, amount: 200 });
  for (let t = 0; t < 20000; t++) {
    step(a); step(b);
    if (b.creatures.some(c => c.known.g2)) break;
    for (let i = 0; i < 24; i++) {
      assert.deepEqual(b.creatures[i].decision, a.creatures[i].decision);
      assert.deepEqual([b.creatures[i].x, b.creatures[i].y], [a.creatures[i].x, a.creatures[i].y]);
    }
  }
});
