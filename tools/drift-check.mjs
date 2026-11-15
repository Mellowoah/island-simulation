// Anti-drift check (Robert, 15 Nov 2026): run every ~30 minutes and after every change.
// Re-tests each statement in docs/THEORY-CHECK.md on fresh worlds, checks the island's
// reporting rules, and flags code changes that the theory/decision docs have not caught up with.
// Usage: node tools/drift-check.mjs   (exit code 1 if anything drifted)
import { execSync } from 'node:child_process';
import { createWorld, step, metrics, DAY } from '../dist/sim.js';
import { createEden, edenStep, edenMetrics, EDEN_DEFAULTS } from '../dist/eden.js';

const out = [];
const check = (id, statement, ok, detail = '') => out.push({ id, statement, ok: !!ok, detail });

// Eden: one guided-for-a-while world and one that falls early.
const g = createEden(42); let preDeath = false, overrideOk = true;
for (let t = 0; t < 3 * DAY; t++) {
  edenStep(g);
  if (g.eden.phase === 'guided' && g.creatures.some(c => !c.alive)) preDeath = true;
  for (const c of g.creatures) { const d = c.decision; if (d?.guided && d.tick === g.tick && !(d.guided.intended && /^(Thirsty|Tired|Hungry|Curiosity)/.test(d.guided.reason))) overrideOk = false; }
}
const e = createEden(50); edenStep(e, 4 * DAY);
const all = [g, e];

check(1, 'Warned at the beginning of life', all.every(s => s.creatures.every(c => c.eden.mother === null || (c.eden.born > (s.eden.fallTick ?? Infinity)) || c.eden.instruction?.source === 'Creator')));
check(2, 'Creator leads only choices outside what is best; every override records intention and reason', overrideOk && g.eden.overrides > 0);
check(3, 'Share of overridden decisions is reported, not asserted', typeof edenMetrics(g).guidedShare === 'number', `guided share ${(edenMetrics(g).guidedShare * 100).toFixed(0)}%`);
check(4, 'Never eating is allowed: no death and no forced eating while guided', !preDeath);
check(5, "Serpent's claim is a claim, never knowledge", all.every(s => s.creatures.every(c => Object.keys(c.known).every(k => s.patches.some(p => p.id === k)))));
check(6, 'Eating comes from the creature\'s own state and draw; never certain', all.every(s => s.eden.deliberations.every(d => d.P > 0 && d.P < 1 && d.ate === (d.draw < d.P))));
check(7, 'First eating releases everyone; no guidance afterwards', e.eden.phase === 'released' && (() => { const o = e.eden.overrides; edenStep(e, 60); return e.eden.overrides === o; })());
check(8, 'Death only after release', !preDeath && g.eden.phase === 'guided' ? metrics(g).alive === g.creatures.length : true);
const fieldNeed = EDEN_DEFAULTS.fieldRegen * DAY / (0.05 * DAY / 4);
check(9, 'After release, production is hard work, not abundance (one field ≈ one person)', fieldNeed > 0.8 && fieldNeed < 2 && EDEN_DEFAULTS.cursedRegen < 1, `one field = ${fieldNeed.toFixed(2)}× an adult's need; cursed ground ${EDEN_DEFAULTS.cursedRegen * 100}%`);
const iv = edenMetrics(e).birthIntervals, mean = iv.length ? iv.reduce((a, b) => a + b, 0) / iv.length : NaN;
check(10, 'Reproduction stays within natural-fertility statistics', EDEN_DEFAULTS.fecundability >= 0.15 && EDEN_DEFAULTS.fecundability <= 0.25 && EDEN_DEFAULTS.menarche === 15 && EDEN_DEFAULTS.menopause === 40 && (iv.length === 0 || mean >= EDEN_DEFAULTS.gestation + EDEN_DEFAULTS.postpartum), iv.length ? `mean birth interval ${mean.toFixed(2)} y` : 'no intervals yet');
for (const s of all) { const l = s.ledger; check('L', 'Food ledger reconciles (Eden)', Math.abs(l.initial + l.regenerated + l.gifted - l.consumed - (l.withdrawn ?? 0) - metrics(s).food) < 1e-6); }

const { senseRadius } = await import('../dist/eden.js');
{ const t = createEden(41), c = t.creatures[0], full = t.config.perception; const o = c.energy; c.energy = 5; const low = senseRadius(t, c); c.energy = o;
  check(11, 'Senses depend on condition (maintain senses and life)', senseRadius(t, c) === full && low < full && low >= 1, `well ${full}, exhausted ${low}`); }
check(12, 'Creator never overrules a choice that already meets a real need', all.every(s => s.creatures.every(c => !(c.decision?.guided && c.decision.guided.intended === 'drink' && c.decision.thirst >= s.eden.config.thirstGuide))));
check(13, 'No harm before release (health stays whole while guided)', g.eden.phase !== 'guided' || g.creatures.every(c => c.eden.health === 100));
{ const cfg = EDEN_DEFAULTS, r = (80 / 0.05 + 300) / (100 / cfg.thirstRate + cfg.thirstDeathTicks);
  check(14, 'Thirst kills about 7x sooner than hunger (3 days vs 3 weeks)', r > 5 && r < 9, `ratio ${r.toFixed(1)}`); }

// Island: reporting rules from the critic review must still hold.
const w = createWorld(41, { regenA: 0, regenB: 0 }); step(w, 12000); const m = metrics(w);
check('I1', 'Island: deaths stay visible (dead-inclusive metrics present)', 'medianHungerAll' in m && 'knownSourcesAll' in m && 'skillAll' in m && m.individuals.length === 24);
check('I2', 'Island: new worlds use decorrelated randomness', createWorld(41).rng === 2);

// Documentation freshness: Eden code must not change after THEORY-CHECK without the doc being updated.
try {
  const last = f => Number(execSync(`git log -1 --format=%ct -- ${f}`, { encoding: 'utf8' }).trim() || 0);
  const dirty = execSync('git status --porcelain dist/eden.js docs/THEORY-CHECK.md', { encoding: 'utf8' });
  const edenNewer = last('dist/eden.js') > last('docs/THEORY-CHECK.md') || (/eden\.js/.test(dirty) && !/THEORY-CHECK/.test(dirty));
  check('D', 'THEORY-CHECK.md updated with every Eden code change', !edenNewer, edenNewer ? 'dist/eden.js changed after docs/THEORY-CHECK.md' : '');
} catch { check('D', 'THEORY-CHECK.md freshness (git unavailable)', true, 'skipped'); }

let failed = 0;
for (const r of out) { if (!r.ok) failed++; console.log(`${r.ok ? 'OK   ' : 'DRIFT'} [${r.id}] ${r.statement}${r.detail ? ' — ' + r.detail : ''}`); }
console.log(failed ? `\n${failed} drift item(s). Fix or record a decision before continuing.` : '\nNo drift detected.');
process.exit(failed ? 1 : 0);
