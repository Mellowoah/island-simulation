// Moving bar prototype (docs/PROTO-MOVING-BAR.md). Flag off leaves island and Eden bytes unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { DAY, STREAMS, createWorld, step, serialize } from '../dist/sim.js';
import {
  createEden, edenStep, MOVING_BAR_DEFAULTS, feltStep, hazardMultiplier, barTarget, creepBar,
  freshBar, recordExposure, runMovingBar,
} from '../dist/eden.js';

const sha = s => createHash('sha256').update(serialize(s)).digest('hex');

// Captured on cursor/fix-hidden-info-and-salts-949f before this layer existed.
const GOLDEN = {
  island: [
    { seed: 41, n: 2880, digest: 2997509014, sha: '5d14b10c65cd925399944811a0aa12b791999938fb5460af88586dde351dc3ce' },
    { seed: 61, n: 2880, digest: 2483439683, sha: '3596dd33d4b5aa7b6b1a09720ebdaf3fa1f0aef1a2dedcd5172e62b8ff8e7d5e' },
  ],
  eden: [
    { seed: 42, n: 2880, digest: 1743017609, sha: '0bd66bd43e5ee46429aabbd464129f7f9969fca1a30725e6416bc5a57f3737e3' },
    { seed: 50, n: 5760, digest: 166744817, sha: '3fead2f32aac9c080f7ad7848e207bb0215a4e055c8366e8cfedf60fb0b584f0' },
    { seed: 61, n: 2880, digest: 2265003492, sha: 'ea7d525f726911330622cb23b5819b7b8988143d94c7a0ef765f2db4e66454a8' },
  ],
};

test('flag off: island and Eden digests and save bytes match the base branch', () => {
  for (const g of GOLDEN.island) {
    const s = createWorld(g.seed);
    step(s, g.n);
    assert.equal(s.digest, g.digest, `island ${g.seed} digest`);
    assert.equal(sha(s), g.sha, `island ${g.seed} bytes`);
  }
  for (const g of GOLDEN.eden) {
    const s = createEden(g.seed);
    assert.equal(s.eden.movingBar, undefined);
    assert.equal(s.creatures.every(c => c.eden.bar === undefined), true);
    edenStep(s, g.n);
    assert.equal(s.digest, g.digest, `eden ${g.seed} digest`);
    assert.equal(sha(s), g.sha, `eden ${g.seed} bytes`);
  }
});

test('felt = harm - rho * EMA is the definition, not a result', () => {
  assert.equal(MOVING_BAR_DEFAULTS.rho, 0.7);
  assert.equal(MOVING_BAR_DEFAULTS.halfLife, 720);
  for (const rho of [0, 0.5, 0.7, 1]) {
    const out = feltStep(3, 10, 720, rho, 720);
    assert.equal(out.felt, 10 - rho * 3);
    // One half-life closes half the gap from the old EMA to the new harm.
    assert.equal(out.ema, 3 + 0.5 * (10 - 3));
  }
  const held = feltStep(4, 9, 720, 1, 720);
  const later = feltStep(held.ema, 9, 720, 1, 720);
  assert.ok(later.ema > held.ema && later.ema < 9);
});

test('the schedule is at least a 50% rise for the whole final third', () => {
  const cfg = MOVING_BAR_DEFAULTS;
  assert.equal(hazardMultiplier(0, cfg), 1);
  assert.equal(hazardMultiplier(0.5, cfg), 1.6);
  assert.equal(hazardMultiplier(1, cfg), 1.6);
  const window = cfg.windowDays * DAY;
  const start = Math.floor(window * 2 / 3);
  for (let u0 = start; u0 <= window; u0 += 30) {
    assert.ok(hazardMultiplier(u0 / window, cfg) >= 1.5, `u0 ${u0}`);
  }
});

test('DRIFT can stop firing once the bar has caught up; ANCHOR keeps firing (rule check, not a world result)', () => {
  const cfg = { ...MOVING_BAR_DEFAULTS, condition: 'drift' };
  let bar = freshBar(cfg);
  for (const harm of [8, 8, 14, 14, 14, 14]) bar = recordExposure(bar, harm, cfg.halfLife, cfg, emptyCtx());
  for (let i = 0; i < 20000; i++) bar = creepBar(bar, cfg, emptyCtx());
  assert.ok(Math.abs(bar.B - bar.mean) < 1e-6);
  assert.equal(bar.firing, false);

  const anchorCfg = { ...cfg, condition: 'anchor' };
  let anchor = freshBar(anchorCfg);
  for (const harm of [8, 8, 14, 14, 14, 14]) anchor = recordExposure(anchor, harm, cfg.halfLife, anchorCfg, emptyCtx());
  for (let i = 0; i < 20000; i++) anchor = creepBar(anchor, anchorCfg, emptyCtx());
  assert.equal(anchor.B, 8);
  assert.equal(anchor.firing, true);
});

test('B does not read felt: rho does not change the bar when the signal is harm', () => {
  const harms = [6, 9, 11, 13, 12, 14, 10];
  const run = rho => {
    const cfg = { ...MOVING_BAR_DEFAULTS, condition: 'drift', rho, signal: 'harm' };
    let bar = freshBar(cfg);
    const trace = [];
    for (const harm of harms) {
      bar = recordExposure(bar, harm, 400, cfg, emptyCtx());
      bar = creepBar(bar, cfg, emptyCtx());
      trace.push([bar.B, bar.firing, bar.recent.slice()]);
    }
    return trace;
  };
  assert.deepEqual(run(0), run(1));
  assert.deepEqual(run(0.5), run(0.7));

  // The felt numbers themselves do change with rho. That is the definition, kept off the bar.
  const feltAt = rho => {
    let ema = 8, last = null;
    for (const harm of harms) { const s = feltStep(ema, harm, 400, rho, 720); ema = s.ema; last = s.felt; }
    return last;
  };
  assert.notEqual(feltAt(0), feltAt(1));
});

test('peer and monitor targets use witnessed numbers only; ablation never fires', () => {
  const mean = 14;
  const cfg = { ...MOVING_BAR_DEFAULTS, condition: 'peer' };
  const plain = barTarget(mean, { ...cfg, condition: 'drift' }, emptyCtx());
  assert.equal(plain, mean);
  const noMonitor = barTarget(mean, { ...cfg, monitorWeight: 0 }, { peerMedian: mean, groupPast: 8 });
  assert.equal(noMonitor, mean);
  const pulled = barTarget(mean, cfg, { peerMedian: mean, groupPast: 8 });
  assert.ok(pulled < mean && pulled > 8, pulled);

  let bar = freshBar({ ...cfg, condition: 'ablation' });
  bar = recordExposure(bar, 20, 720, { ...cfg, condition: 'ablation' }, emptyCtx());
  bar = creepBar(bar, { ...cfg, condition: 'ablation' }, emptyCtx());
  assert.equal(bar.firing, false);
  assert.equal(bar.B, 8);
});

test('flag on does not move the fall, and hidden stock does not move the bar', () => {
  const off = createEden(50);
  const on = createEden(50, {}, { movingBar: true });
  while (off.eden.phase === 'guided') edenStep(off);
  while (on.eden.phase === 'guided') edenStep(on);
  assert.equal(on.eden.fallTick, off.eden.fallTick);
  assert.equal(on.digest, off.digest);
  assert.deepEqual(on.creatures.map(c => [c.x, c.y, c.alive]), off.creatures.map(c => [c.x, c.y, c.alive]));

  const arm = stock => {
    const s = createEden(50, {}, { movingBar: { condition: 'drift' } });
    while (s.eden.phase === 'guided') edenStep(s);
    const c = s.creatures.find(x => x.alive && x.eden.mother === null);
    Object.assign(c, { x: 30, y: 12, hunger: 40, energy: 80, action: { type: 'rest', left: 30 } });
    c.eden.thirst = 0;
    c.eden.bar.recent = [8, 8, 8];
    c.eden.bar.exposures = 3;
    c.eden.bar.harm = 24;
    c.known = { a: { expected: 10, last: s.tick } };
    const hidden = s.patches.find(p => p.id === 'b');
    hidden.stock = stock;
    edenStep(s);
    assert.equal(c.known.b, undefined, 'the source stayed unobserved');
    return { B: c.eden.bar.B, firing: c.eden.bar.firing, x: c.x, y: c.y, exposures: c.eden.bar.exposures, harm: c.eden.bar.harm };
  };
  assert.deepEqual(arm(0), arm(120));
});

test('no salt overlap for the hazard draw, and the new code does not read stock', () => {
  assert.deepEqual(STREAMS.hazardHarm, [340, 340]);
  const src = fs.readFileSync(new URL('../dist/eden.js', import.meta.url), 'utf8');
  const start = src.indexOf('// MOVING-BAR START');
  const end = src.indexOf('// MOVING-BAR END');
  assert.ok(start > 0 && end > start);
  const body = src.slice(start, end);
  assert.doesNotMatch(body, /\.stock/);
  assert.match(body, /STREAMS\.hazardHarm\[0\]/);
  // Hooks outside the block are calls, not stock reads.
  assert.doesNotMatch(src.slice(end), /movingBar[\s\S]{0,80}\.stock/);
});

test('a finished flagged run records the ledger and keeps B off felt', () => {
  const a = runMovingBar(50, { condition: 'anchor', rho: 0 });
  const b = runMovingBar(50, { condition: 'anchor', rho: 1 });
  assert.equal(a.report.excluded, false);
  assert.equal(b.report.excluded, false);
  assert.equal(a.report.detection, b.report.detection);
  assert.equal(a.world.digest, b.world.digest);
  const strip = s => s.creatures.map(c => ({ B: c.eden.bar.B, firing: c.eden.bar.firing, harm: c.eden.bar.harm, exposures: c.eden.bar.exposures, x: c.x, y: c.y }));
  assert.deepEqual(strip(a.world), strip(b.world));
  // Felt itself is allowed to differ.
  const felt = s => s.creatures.map(c => c.eden.bar.lastFelt);
  if (a.world.creatures.some(c => c.eden.bar.exposures > 0)) assert.notDeepEqual(felt(a.world), felt(b.world));

  const off = runMovingBar(50, { condition: 'ablation' });
  assert.equal(off.report.detection, 0);
  assert.ok(off.world.creatures.every(c => c.eden.bar.firing === false && c.eden.bar.avoidanceCost === 0));
  assert.ok(off.world.creatures.some(c => c.eden.bar.exposures > 0), 'the ablation still walks into the grove');
  for (const c of off.world.creatures) {
    if (!c.eden.bar.exposures) continue;
    assert.ok(c.eden.bar.harm > 0);
    assert.equal(typeof c.eden.bar.avoidanceCost, 'number');
    assert.equal(typeof c.eden.bar.benefitFromOthers, 'number');
  }
});

function emptyCtx() { return { peerMedian: null, groupPast: null }; }
