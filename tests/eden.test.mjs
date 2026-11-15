// Eden world (docs/EDEN-DESIGN.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, metrics, serialize, createWorld } from '../dist/sim.js';
import { createEden, edenStep, edenMetrics } from '../dist/eden.js';

test('Every creature is born warned; the serpent\'s claim is never stored as knowledge', () => {
  const s = createEden(41);
  assert.ok(s.creatures.every(c => c.eden.instruction.source === 'Creator' && /not from the tree/.test(c.eden.instruction.text) && c.eden.warning === 1));
  assert.ok(s.creatures.every(c => c.memories.some(m => /Warned by the Creator/.test(m.text))));
  for (let t = 0; t < 2 * DAY && !s.eden.deliberations.length; t++) edenStep(s);
  const heard = s.creatures.find(c => c.eden.hearings > 0);
  assert.ok(heard, 'someone met the serpent');
  assert.ok(Object.keys(heard.known).every(k => s.patches.some(p => p.id === k)), 'known holds only real food sources');
  assert.ok(heard.eden.credence > 0 && heard.eden.credence < 1);
  assert.equal(createWorld(41).mode, undefined, 'the main island is untouched');
});

test('Death is switched off while guided (by construction); every override records the creature\'s own intention and a reason', () => {
  const s = createEden(42, { regenA: 0.05, regenB: 0.05 }); // scarce garden
  for (let t = 0; t < 3 * DAY; t++) {
    edenStep(s);
    if (s.eden.phase === 'guided') assert.equal(metrics(s).alive, s.creatures.length, `death before release at tick ${s.tick}`);
    for (const c of s.creatures) {
      const g = c.decision?.guided;
      if (g && c.decision.tick === s.tick) {
        assert.ok(g.intended && g.to && /^(Thirsty|Tired|Hungry|Curiosity)/.test(g.reason), g.reason);
      }
    }
  }
  assert.ok(s.eden.overrides > 0 && s.eden.overrides <= s.eden.decisions);
});

test('Each tree choice is uncertain (0<P<1) and follows the creature\'s own draw; who eats and when vary by seed (a fall itself is near-certain at default settings)', () => {
  const outcomes = [];
  for (let seed = 41; seed <= 48; seed++) {
    const s = createEden(seed);
    edenStep(s, 5 * DAY);
    for (const d of s.eden.deliberations) {
      assert.ok(d.P > 0 && d.P < 1, 'either choice was possible');
      assert.equal(d.ate, d.draw < d.P);
    }
    assert.ok(s.eden.deliberations.some(d => !d.ate), 'creatures can refuse');
    outcomes.push(s.eden.phase === 'released' ? `${s.eden.firstEater}@${s.eden.fallTick}` : 'none');
  }
  assert.ok(new Set(outcomes).size > 2, `outcomes: ${outcomes.join(', ')}`);
  const a = createEden(44), b = createEden(44);
  edenStep(a, 2 * DAY); edenStep(b, 2 * DAY);
  assert.equal(serialize(a), serialize(b), 'same seed, same history');
});

test('The first to eat releases everyone at once: no more guidance, death possible, own judgement', () => {
  const s = createEden(50); // a seed whose first creature eats on day 1
  while (s.eden.phase === 'guided' && s.tick < 5 * DAY) edenStep(s);
  assert.equal(s.eden.phase, 'released');
  const eater = s.creatures[s.eden.firstEater], last = s.eden.deliberations.at(-1);
  assert.ok(last.ate && last.id === eater.id && last.draw < last.P);
  assert.ok(s.creatures.every(c => !c.alive || c.memories.some(m => /ate|Creator no longer/.test(m.text))));
  const overrides = s.eden.overrides;
  edenStep(s, 2 * DAY);
  assert.equal(s.eden.overrides, overrides, 'no guidance after release');
  assert.ok(s.creatures.some(c => c.eden.judged > 0), 'creatures judge their own outcomes');
  assert.ok(s.creatures.filter(c => c.alive && c.decision && c.decision.tick > s.eden.fallTick).every(c => c.decision.own || c.decision.tree), 'decisions after release are their own');
});

test('After release, creatures can produce what they need; food accounting still reconciles', () => {
  const s = createEden(50);
  edenStep(s, 6 * DAY);
  const m = edenMetrics(s), l = s.ledger;
  assert.equal(m.phase, 'released');
  assert.ok(m.fields > 0 && m.clothed > 0 && m.tools > 0, JSON.stringify(m));
  for (const p of s.patches.filter(p => p.field)) {
    assert.ok(p.capacity === s.eden.config.fieldCapacity && p.stock <= p.capacity);
    if (s.tick < p.readyTick) assert.equal(p.stock, 0, 'fields bear nothing before they are ready');
  }
  assert.ok(s.patches.filter(p => p.field).length <= 24, 'one field per creature');
  assert.ok(Math.abs(l.initial + l.regenerated + l.gifted - l.consumed - metrics(s).food) < 1e-6);
});
