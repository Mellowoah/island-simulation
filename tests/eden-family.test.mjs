// Eden reproduction (docs/EDEN-DESIGN.md, "Family"). 1 simulated day = 1 year.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, metrics } from '../dist/frozen/sim.js';
import { createEden, edenStep, edenMetrics } from '../dist/frozen/eden.js';
import { setDefaultClock } from '../dist/frozen/clock.js';
setDefaultClock('legacy'); // these tests pin the original (pre-17 Nov) behaviour; tests/clock.test.mjs covers the real clock

const ageAt = (c, tick) => (tick - c.eden.born) / DAY;
const early = createEden(50); edenStep(early, 8 * DAY);   // falls on day 0: almost all births after release
const guided = createEden(42); edenStep(guided, 4 * DAY); // stays guided for these years

test('Births follow the demographic rules: sexes, ages 15-40, spacing at least postpartum + gestation (mean accepted 2.55-6 years)', () => {
  for (const s of [early, guided]) {
    const cfg = s.eden.config;
    for (const k of s.creatures.filter(c => c.eden.mother !== null)) {
      const m = s.creatures[k.eden.mother], f = s.creatures[k.eden.father];
      assert.equal(m.eden.sex, 'F'); assert.equal(f.eden.sex, 'M');
      const conceivedAt = k.eden.born - Math.round(cfg.gestation * DAY);
      assert.ok(ageAt(m, conceivedAt) >= cfg.menarche && ageAt(m, conceivedAt) < cfg.menopause, 'mother of fertile age');
      assert.ok(ageAt(f, conceivedAt) >= cfg.maleMaturity, 'father mature');
    }
    for (const m of s.creatures) for (let i = 1; i < m.eden.births.length; i++)
      assert.ok((m.eden.births[i] - m.eden.births[i - 1]) / DAY >= cfg.postpartum + cfg.gestation - 1e-9, 'no birth sooner than postpartum + gestation');
  }
  const iv = edenMetrics(early).birthIntervals;
  assert.ok(edenMetrics(early).births > 10, 'a fed population reproduces');
  if (iv.length) { const mean = iv.reduce((a, b) => a + b, 0) / iv.length; assert.ok(mean >= 2.55 && mean <= 6, `mean birth interval ${mean.toFixed(2)} years`); }
});

test('Children born before the release are warned and guided; children born after are born released', () => {
  const pre = guided.creatures.filter(c => c.eden.mother !== null);
  assert.ok(pre.length > 0, 'births happened while guided');
  assert.ok(pre.every(c => c.eden.instruction?.source === 'Creator' && c.eden.warning === 1));
  assert.equal(metrics(guided).alive, guided.creatures.length, 'no one dies before release, children included');
  const fall = early.eden.fallTick;
  const post = early.creatures.filter(c => c.eden.mother !== null && c.eden.born > fall);
  assert.ok(post.length > 0 && post.every(c => c.eden.instruction === null && c.eden.warning === 0));
});

test('Young children stay with a carer and share food; the food ledger still reconciles', () => {
  for (const s of [early, guided]) {
    const l = s.ledger;
    assert.ok(Math.abs(l.initial + l.regenerated + l.gifted - l.consumed - metrics(s).food) < 1e-6);
    const eaten = s.creatures.reduce((n, c) => n + c.consumed, 0);
    assert.ok(Math.abs(eaten - l.consumed) < 1e-6, 'every unit eaten is attributed to someone');
    for (const k of s.creatures.filter(c => c.alive && c.eden.mother !== null && ageAt(c, s.tick) < s.eden.config.weanAge)) {
      const m = s.creatures[k.eden.mother], f = s.creatures[k.eden.father], carer = m.alive ? m : f.alive ? f : null;
      if (carer) assert.deepEqual([k.x, k.y], [carer.x, carer.y], `${k.name} is with its carer`);
    }
  }
});

test('The population cap stops conception (and is reported) rather than killing anyone', () => {
  const s = createEden(50, {}, { populationCap: 30 });
  edenStep(s, 5 * DAY);
  const m = edenMetrics(s);
  assert.ok(m.population <= 30 && m.capReached > 0, JSON.stringify({ population: m.population, cap: m.capReached }));
});
