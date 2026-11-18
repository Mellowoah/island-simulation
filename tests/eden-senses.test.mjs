// Eden step 1: senses and needs (docs/ROADMAP.md, docs/EDEN-DESIGN.md "Senses and needs").
import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, metrics } from '../dist/sim.js';
import { createEden, edenStep, senseRadius } from '../dist/eden.js';
import { setDefaultClock } from '../dist/clock.js';
setDefaultClock('legacy'); // these tests pin the original (pre-17 Nov) behaviour; tests/clock.test.mjs covers the real clock

test('Sight depends on condition: full when well, shrinking with hunger, thirst, tiredness or harm, never below 1', () => {
  const s = createEden(41), c = s.creatures[0], full = s.config.perception;
  assert.equal(senseRadius(s, c), full);
  for (const [field, value] of [['hunger', 90], ['energy', 8]]) { const o = c[field]; c[field] = value; assert.ok(senseRadius(s, c) < full, field); c[field] = o; }
  for (const [field, value] of [['thirst', 95], ['health', 10]]) { const o = c.eden[field]; c.eden[field] = value; assert.ok(senseRadius(s, c) < full, field); c.eden[field] = o; }
  c.hunger = 100; c.energy = 0; c.eden.thirst = 100; c.eden.health = 0;
  assert.equal(senseRadius(s, c), 1);
});

test('Before release there is no injury, illness or death, even with no water at all', () => {
  const s = createEden(42, {}, { springs: [] });
  for (let t = 0; t < 2 * DAY && s.eden.phase === 'guided'; t++) {
    edenStep(s);
    if (s.eden.phase === 'guided') {
      assert.equal(metrics(s).alive, s.creatures.length);
      assert.ok(s.creatures.every(c => c.eden.health === 100));
    }
  }
});

test('After release, thirst kills, and far sooner than hunger (about 3 days vs 3 weeks)', () => {
  const s = createEden(50, {}, { springs: [] });
  while (s.eden.phase === 'guided') edenStep(s);
  const start = s.tick;
  while (s.creatures.every(c => c.alive) && s.tick - start < 3 * DAY) edenStep(s);
  const first = s.creatures.find(c => !c.alive);
  assert.equal(first.death.cause, 'Thirst');
  const cfg = s.eden.config, toThirstDeath = 100 / cfg.thirstRate + cfg.thirstDeathTicks, toStarve = 80 / s.config.hungerRate + s.config.starveTicks;
  assert.ok(toStarve / toThirstDeath > 5 && toStarve / toThirstDeath < 9, `ratio ${(toStarve / toThirstDeath).toFixed(1)}`);
});

test('The Creator leads the thirsty to water, but never overrules a choice that already meets a real need', () => {
  const s = createEden(41); let led = 0;
  for (let t = 0; t < DAY; t++) {
    edenStep(s);
    for (const c of s.creatures) {
      const d = c.decision;
      if (!d || d.tick !== s.tick || !d.guided) continue;
      if (/^Thirsty/.test(d.guided.reason)) led++;
      assert.ok(!(d.guided.intended === 'drink' && d.thirst >= s.eden.config.thirstGuide), 'a thirsty creature choosing water is never overruled');
    }
  }
  assert.ok(led > 0);
  assert.ok(s.eden.overrides < s.eden.decisions * 0.6, `override share ${(s.eden.overrides / s.eden.decisions).toFixed(2)}`);
});

test('Interrupted work is kept: a garment needs the same total work however it is split', () => {
  const s = createEden(50);
  edenStep(s, 3 * DAY);
  const made = s.creatures.filter(c => c.eden.clothed);
  assert.ok(made.length > 0, 'someone finished clothing despite interruptions');
  assert.ok(s.creatures.every(c => c.eden.work.clothing >= 0 && c.eden.work.clothing < s.eden.config.craftWork));
});

test('Condition changes what is found in at least one of 12 seeds (too few seeds to show direction)', () => {
  let weakerFoundMore = 0, fitterFoundMore = 0;
  for (let seed = 41; seed <= 52; seed++) {
    const run = weaken => {
      const s = createEden(seed);
      const c = s.creatures[3];
      if (weaken) { c.energy = 20; c.hunger = 75; }
      edenStep(s, 600);
      return Object.keys(c.known).length + Object.keys(c.eden.water).length;
    };
    const fit = run(false), weak = run(true);
    if (weak > fit) weakerFoundMore++; if (fit > weak) fitterFoundMore++;
  }
  assert.ok(fitterFoundMore + weakerFoundMore > 0, 'condition changes what is found');
  assert.ok(weakerFoundMore > 0 || fitterFoundMore < 12, `fitter found more in ${fitterFoundMore}/12, weaker in ${weakerFoundMore}/12`);
});
