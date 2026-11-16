// Island Lab 16-bit: setup config, run driver, report numbers and the renderer's read-only rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY } from '../dist/sim.js';
import { createEden, edenStep, edenMetrics, EDEN_DEFAULTS } from '../dist/eden.js';
import { createLab, labStep, labMetrics, serializeLab, deserializeLab } from '../dist/lab.js';
import { SETUP_FIELDS, THEORY, PROPOSED, normalizeSetup, defaultSetup, fieldsFor, HELP } from '../dist/lab16-setup.js';
import { createRun, stepRun, runToEnd, serializeRun, restoreTheoryRun, restoreLabRun, seriesOf, habitSpread, giftEaten, LAB_SAVE_KEY } from '../dist/lab16-run.js';
import { summarizeEden, summarizeLab, judge, predictionsEden, buildEdenReport, buildLabReport, reportMarkdown, reportHTML, twinSetups, MARGIN } from '../dist/lab16-report.js';
import { viewOfEden, viewOfLab } from '../dist/lab16-view.js';
import { createPixelRenderer } from '../dist/lab16-render.js';
import { paired, batchVerdict, batchSeeds, batchEden, batchLab, batchMarkdown, batchHTML, t95 } from '../dist/lab16-batch.js';
import { barSample, hardshipEden, BAR_MARGIN } from '../dist/lab16-run.js';
import { led } from '../dist/eden.js';
import { niceMax, drawLineChart, chartSpecs } from '../dist/lab16-charts.js';

const fakeCtx = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : (...a) => {}, set: (t, k, v) => { t[k] = v; return true; } });
const fakeCanvas = (w, h) => ({ width: w, height: h, getContext: fakeCtx });
const strip = s => JSON.parse(JSON.stringify(s));

test('G1 guidance-length input defaults to the original rules (0 years) and only acts through the serpent', () => {
  assert.equal(EDEN_DEFAULTS.serpentSilentYears, 0);
  const a = createEden(44), b = createEden(44, {}, { serpentSilentYears: 2 });
  // Until the first time the serpent speaks in the default world, the two worlds are identical apart from the setting itself.
  let t = 0;
  while (a.eden.serpentSpoke === null && t < 2 * DAY) { edenStep(a); edenStep(b); t++; }
  assert.ok(a.eden.serpentSpoke !== null, 'serpent spoke in the default world');
  const ca = strip(a), cb = strip(b); delete ca.eden.config.serpentSilentYears; delete cb.eden.config.serpentSilentYears;
  ca.eden.serpentSpoke = cb.eden.serpentSpoke = null; ca.eden.deliberations = cb.eden.deliberations = [];
  for (const c of [...ca.creatures, ...cb.creatures]) { c.eden.hearings = 0; c.eden.credence = 0; c.eden.lastSerpent = null; c.memories = []; c.decision = null; }
  ca.events = cb.events = []; ca.digest = cb.digest = 0;
  assert.deepEqual(ca, cb);
});

test('G2 with N silent years nobody hears the deceiver or falls before year N', () => {
  const s = createEden(41, {}, { serpentSilentYears: 3 });
  edenStep(s, 3 * DAY);
  assert.equal(s.creatures.reduce((n, c) => n + c.eden.hearings, 0), 0);
  assert.equal(s.eden.phase, 'guided');
  assert.equal(s.eden.deliberations.length, 0);
});

test('S1 setup input is clamped to what the sims support', () => {
  const d = defaultSetup('eden');
  assert.deepEqual(normalizeSetup(d), d);
  const n = normalizeSetup({ world: 'eden', seed: -5, guidanceYears: 99, help: 'on', speed: 7, runDays: 1, population: 7, falseInfo: 0.25 });
  assert.equal(n.seed, 1); assert.equal(n.guidanceYears, 10); assert.equal(n.help, true); assert.equal(n.speed, 16); assert.equal(n.runDays, 2);
  assert.equal(n.population, 24, 'Eden has 24 creatures; the count is fixed there');
  assert.equal(n.falseInfo, 0, 'false information is a Lab setting');
  const l = normalizeSetup({ world: 'lab', population: 30, guidanceYears: 5, help: true, falseInfo: '0.1', seed: 'abc' });
  assert.equal(l.population, 32, 'snapped to the step of 4'); assert.equal(l.guidanceYears, 0); assert.equal(l.help, false); assert.equal(l.falseInfo, 0.1); assert.equal(l.seed, 41);
  assert.equal(normalizeSetup({ world: 'mars' }).world, 'eden');
});

test('S2 every choice names the theory line or prediction it tests, and proposed lines are labelled', () => {
  for (const f of SETUP_FIELDS) {
    assert.ok(/\b(T\d+|P\d)\b/.test(f.note) || /tests nothing/i.test(f.note), `${f.key} note cites no line`);
    for (const id of PROPOSED) if (new RegExp(`\\b${id}\\b`).test(f.note)) assert.match(f.note, new RegExp(`${id} \\(proposed\\)`), `${f.key} must label ${id} as proposed`);
  }
  for (const id of PROPOSED) assert.match(THEORY[id], /^\[proposed\]/);
  for (const id of ['T1', 'T2', 'T3', 'T4', 'T5', 'T8']) assert.doesNotMatch(THEORY[id], /proposed/);
  const eden = fieldsFor('eden').map(f => f.key);
  for (const k of ['seed', 'population', 'guidanceYears', 'help', 'speed', 'runDays']) assert.ok(eden.includes(k), `Eden setup shows ${k}`);
  assert.ok(!fieldsFor('lab').some(f => f.key === 'guidanceYears' || f.key === 'help'), 'Lab has no guidance or help input');
});

test('S3 setup choices reach the sim as config inputs only', () => {
  const e = createRun({ world: 'eden', seed: 50, guidanceYears: 4, help: true, runDays: 10 });
  assert.equal(e.world.eden.config.serpentSilentYears, 4); assert.equal(e.world.seed, 50);
  assert.equal(e.helpUntil, 5 * DAY); assert.deepEqual(Object.keys(e.help), ['x', 'y']);
  const l = createRun({ world: 'lab', seed: 9, population: 16, falseInfo: 0.25, runDays: 3 });
  assert.equal(l.world.creatures.length, 16); assert.equal(l.world.config.falseInformationRate, 0.25); assert.equal(l.endTick, 3 * DAY);
  const plain = createLab(9, { population: 16, falseInformationRate: 0.25 }); labStep(plain, 300); stepRun(l, 300);
  assert.deepEqual(strip(l.world), strip(plain), 'the Lab run is exactly labStep');
});

test('R1 stepping in uneven chunks gives the same history as one tick at a time (help on)', () => {
  const a = createRun({ seed: 43, guidanceYears: 0, help: true, runDays: 2 }), b = createRun({ seed: 43, guidanceYears: 0, help: true, runDays: 2 });
  for (let i = 0; i < 1500; i++) stepRun(a, 1);
  for (const n of [7, 400, 1, 92, 1000]) stepRun(b, n);
  assert.equal(a.world.tick, 1500); assert.equal(b.world.tick, 1500);
  assert.deepEqual(strip(a), strip(b));
  assert.equal(a.world.ledger.gifted, HELP.amount * Math.ceil(Math.min(1500, a.helpUntil) / HELP.every), "help delivered on schedule, first half only");
});

test('R2 an Eden run saves and continues exactly', () => {
  const a = createRun({ seed: 45, guidanceYears: 1, help: true, runDays: 3 }); stepRun(a, 1700);
  const { run: b } = restoreTheoryRun(serializeRun(a, { selected: 3 }));
  stepRun(a, 1300); stepRun(b, 1300);
  assert.deepEqual(strip(b), strip(a));
  assert.throws(() => restoreTheoryRun('{"format":"other"}'));
});

test('R3 the Lab island keeps island-lab-save-v1: old saves load and new saves stay readable by the old code', () => {
  assert.equal(LAB_SAVE_KEY, 'island-lab-save-v1');
  const s = createLab(41, { falseInformationRate: 0.1 }); labStep(s, 500);
  const old = serializeLab(s, { seed: 41, selected: 2, paused: false, speed: 4 }); // what the previous page wrote
  const { run, ui } = restoreLabRun(old);
  assert.equal(run.world.tick, 500); assert.equal(ui.selected, 2); assert.equal(run.setup.falseInfo, 0.1);
  stepRun(run, 100);
  const back = deserializeLab(serializeRun(run, { selected: 2, speed: 64 }));
  assert.equal(back.world.tick, 600); assert.equal(back.ui.speed, 1, 'speeds the old page does not know fall back to 1');
  assert.throws(() => restoreLabRun('not json'));
});

// One short shared run for the report checks.
const setup = normalizeSetup({ seed: 41, guidanceYears: 1, help: true, runDays: 8 });
const main = runToEnd(setup);
const tw = twinSetups(setup);
const gRun = runToEnd(tw.guidance, main.world.tick), hRun = runToEnd(tw.help, main.world.tick);
const M = summarizeEden(main), G = summarizeEden(gRun), H = summarizeEden(hRun);

test('N1 every report number equals the sim\'s own counters', () => {
  const s = main.world, E = s.eden, m = edenMetrics(s), alive = s.creatures.filter(c => c.alive);
  assert.equal(M.population, alive.length); assert.equal(M.population, m.population);
  assert.equal(M.births, E.births); assert.equal(M.deaths, s.creatures.length - alive.length);
  assert.equal(M.hearings, s.creatures.reduce((n, c) => n + c.eden.hearings, 0));
  assert.equal(M.overrides, E.overrides); assert.equal(M.decisions, E.decisions); assert.equal(M.guidedShare, E.overrides / E.decisions * 100);
  assert.equal(M.fell, E.fallTick !== null);
  if (M.fell) { assert.equal(M.fallYear, E.fallTick / DAY); assert.equal(M.firstEater, s.creatures[E.firstEater].name); }
  assert.equal(M.meanChance, E.deliberations.reduce((n, d) => n + d.P, 0) / E.deliberations.length * 100);
  assert.equal(M.refusals, E.deliberations.filter(d => !d.ate).length);
  assert.equal(M.gifted, s.ledger.gifted); assert.equal(M.giftEaten, giftEaten(s));
  assert.deepEqual(M.deathCauses, E.deaths);
  // own food in the second half, recomputed from the ledger
  const own = (s.ledger.consumed - main.half.consumed) - (giftEaten(s) - main.half.giftEaten);
  const pops = main.series.filter(r => r.t >= main.half.tick).map(r => r.pop);
  assert.ok(Math.abs(M.ownLater - own / (pops.reduce((a, b) => a + b, 0) / pops.length) / ((s.tick - main.half.tick) / DAY)) < 1e-9);
  // survival of the cohort at the end, recomputed from creature records
  if (M.fell) { const ids = main.cohort; assert.ok(Math.abs(M.cohortEnd - ids.filter(i => s.creatures[i].alive).length / ids.length * 100) < 1e-9); }
  assert.equal(M.habitAfter, habitSpread(s), 'the last graph sample is the world as it ended');
});

test('N2 graph samples match the world at their tick', () => {
  const r = createRun({ seed: 47, guidanceYears: 0, runDays: 2 });
  for (let i = 0; i < 20; i++) {
    stepRun(r, 60);
    const row = r.series.at(-1), s = r.world;
    assert.equal(row.t, s.tick);
    assert.equal(row.pop, s.creatures.filter(c => c.alive).length);
    assert.equal(row.hearings, s.creatures.reduce((n, c) => n + c.eden.hearings, 0));
    assert.equal(row.food, s.patches.reduce((n, p) => n + p.stock, 0));
    assert.equal(row.ate, s.eden.firstEater === null ? 0 : 1);
  }
  const lab = runToEnd({ world: 'lab', seed: 41, runDays: 2 });
  const rows = seriesOf(lab), last = rows.at(-1), m = labMetrics(lab.world);
  assert.equal(last.t, lab.world.tick); assert.equal(last.pop, m.alive); assert.equal(last.trust, m.trustMean); assert.equal(last.falseSent, m.messages.falseSent);
});

test('N3 pass/fail rule: right direction and at least the margin, otherwise fail; missing data is "not judged"', () => {
  assert.equal(judge(10, 12, false).verdict, 'held');
  assert.equal(judge(12, 10, false).verdict, 'failed');
  assert.equal(judge(10, 10.2, false).verdict, 'failed', 'a 2% gap is no real difference');
  assert.equal(judge(10, 10.2, false).direction, 'no real difference');
  assert.equal(judge(100 * (1 + MARGIN), 100, true).verdict, 'held');
  assert.equal(judge(null, 3, true).verdict, 'not judged');
  assert.equal(judge(0, 0, true).verdict, 'failed');
});

test('N4 each prediction gets a verdict, compared the right way round', () => {
  const preds = predictionsEden(M, G, H);
  assert.deepEqual(preds.map(p => p.id), ['P1', 'P2', 'P3', 'P4', 'P5']);
  for (const p of preds) assert.ok(['held', 'failed', 'not judged', 'not tested'].includes(p.verdict), p.id);
  assert.equal(preds[3].verdict, 'not tested');
  const p1 = preds[0], longer = M.guidance > G.guidance ? M : G, shorter = longer === M ? G : M;
  assert.notEqual(M.guidance, G.guidance, 'the guidance twin differs in how often the Creator steps in');
  assert.equal(preds[2].verdict, 'not tested', 'P3 is built into the rules'); assert.equal(preds[2].builtIn, true);
  assert.equal(p1.a, longer.meanChance); assert.equal(p1.b, shorter.meanChance);
  const p5 = preds[4], on = M.help ? M : H, off = M.help ? H : M;
  assert.equal(p5.a, on.ownLater); assert.equal(p5.b, off.ownLater);
  assert.equal(H.tick, M.tick); assert.equal(G.tick, M.tick, 'matched worlds run for the same time');
  assert.equal(G.seed, M.seed); assert.equal(G.help, M.help); assert.equal(H.guidance, M.guidance); assert.equal(G.guidanceYears, M.guidanceYears);
});

test('N5 the written report carries the same numbers and reads cleanly', () => {
  const r = buildEdenReport(M, G, H, { created: 'test' });
  const md = reportMarkdown(r), html = reportHTML(r);
  for (const text of [md, html]) { assert.doesNotMatch(text, /undefined|NaN|\[object/); assert.match(text, /P1/); assert.match(text, /T7 \(proposed\)/); }
  assert.match(md, new RegExp(`The deceiver spoke ${M.hearings} time`));
  assert.match(md, new RegExp(`At the end ${M.population} were alive`));
  for (const p of r.predictions) assert.match(md, new RegExp(`### ${p.id}: (HELD|FAILED|NOT JUDGED|NOT TESTED)`));
  const lab = runToEnd({ world: 'lab', seed: 41, runDays: 2, falseInfo: 0.1 }), L = summarizeLab(lab), m = labMetrics(lab.world);
  assert.equal(L.population, m.alive); assert.equal(L.sent, m.messages.sent); assert.equal(L.falseSent, m.messages.falseSent); assert.equal(L.trustEnd, m.trustMean);
  const lr = reportMarkdown(buildLabReport(L));
  assert.match(lr, new RegExp(`They passed on ${m.messages.sent} pieces of news`)); assert.doesNotMatch(lr, /undefined|NaN/);
});

test('V1 the 16-bit renderer and views never write to the world', () => {
  const r = createPixelRenderer({ makeCanvas: fakeCanvas });
  const e = createRun({ seed: 41, guidanceYears: 0, help: true, runDays: 2 }), lab = createRun({ world: 'lab', seed: 41, runDays: 2 });
  const g = fakeCtx();
  for (let i = 0; i < 30; i++) {
    stepRun(e, 37); stepRun(lab, 37);
    for (const [run, v] of [[e, viewOfEden], [lab, viewOfLab]]) {
      const before = JSON.stringify(run.world);
      const info = r.draw(g, v(run.world), { selected: i % 5, now: i * 16, k: 2, zoom: i % 2 === 0 });
      r.pick(v(run.world), 100, 100, info);
      assert.equal(JSON.stringify(run.world), before);
    }
  }
  const a = createRun({ seed: 41, guidanceYears: 0, help: true, runDays: 2 }); stepRun(a, 30 * 37);
  assert.deepEqual(strip(a.world), strip(e.world), 'a drawn world and an undrawn world have the same history');
  const lay = r.layout(viewOfEden(e.world), 390, 3);
  assert.equal(lay.k, 2); assert.equal(lay.width, 36 * 16 * 2); assert.ok(lay.cssWidth <= 390);
});

test('C1 charts: tidy axis tops, one value per sample, drawing is safe', () => {
  assert.equal(niceMax(0), 1); assert.equal(niceMax(7), 10); assert.equal(niceMax(23), 25); assert.equal(niceMax(101), 200);
  for (const kind of ['eden', 'lab']) {
    const rows = kind === 'eden' ? main.series : seriesOf(runToEnd({ world: 'lab', seed: 41, runDays: 2 }));
    const specs = chartSpecs(kind, rows, { fallTick: main.world.eden.fallTick });
    assert.equal(specs.length, 8);
    for (const c of specs) { for (const s of c.series) assert.equal(s.values.length, c.xs.length); if (!c.empty) drawLineChart(fakeCtx(), 280, 150, c.xs, c.series, c.opts); }
  }
});

// ---- Features added on claude/lab-features ----
test('F1 guidance rate: the default (always) is the original rule and makes no new draw', () => {
  assert.equal(EDEN_DEFAULTS.guidanceRate, 1);
  const a = createEden(46), b = createEden(46, {}, { guidanceRate: 1 }); edenStep(a, 900); edenStep(b, 900);
  assert.deepEqual(strip(a), strip(b));
  assert.ok(a.creatures.every(c => led(a, c)));
});

test('F2 guidance rate below 1: the Creator steps in less, the world really differs, and nobody is forced', () => {
  const full = createEden(41), half = createEden(41, {}, { guidanceRate: 0.5 }), none = createEden(41, {}, { guidanceRate: 0 });
  for (const s of [full, half, none]) edenStep(s, 2 * DAY);
  const share = s => edenMetrics(s).guidedShare;
  assert.ok(share(full) > share(half) && share(half) > 0, `${share(full)} > ${share(half)} > 0`);
  assert.equal(none.eden.overrides, 0, 'never guided means no override at all');
  assert.notDeepEqual(strip(full.creatures.map(c => [c.x, c.y, c.hunger])), strip(half.creatures.map(c => [c.x, c.y, c.hunger])));
  // Same seed and rate gives the same history.
  const again = createEden(41, {}, { guidanceRate: 0.5 }); edenStep(again, 2 * DAY);
  assert.deepEqual(strip(again), strip(half));
  for (const s of [half, none]) assert.ok(s.eden.deliberations.every(d => d.P > 0 && d.P < 1 && d.ate === (d.draw < d.P)), 'eating is still the creature\'s own draw');
});

test('F3 the matched guidance worlds are now different worlds (the old comparison was a world against itself)', () => {
  const tw = twinSetups(normalizeSetup({ world: 'eden', seed: 41, runDays: 8 }));
  assert.equal(tw.guidance.guidance, 0.5); assert.equal(twinSetups({ ...tw.guidance }).guidance.guidance, 1);
  const a = summarizeEden(runToEnd({ world: 'eden', seed: 41, runDays: 8 })), b = summarizeEden(runToEnd(tw.guidance));
  assert.ok(a.fell && b.fell); assert.notEqual(a.fallYear, b.fallYear);
});

test('F4 paired statistics: hand-checked numbers, missing seeds left out and counted', () => {
  const st = paired([[3, 1], [5, 2], [4, 4], [null, 2], [7, 3]]);
  assert.equal(st.n, 4); assert.equal(st.skipped, 1); assert.equal(st.mean, 2.25);
  assert.ok(Math.abs(st.sd - 1.707825) < 1e-5);
  assert.ok(Math.abs((st.hi - st.lo) / 2 - 3.182 * 1.707825 / 2) < 1e-4, 't for 3 degrees of freedom');
  assert.deepEqual([st.up, st.down, st.same], [3, 0, 1]);
  assert.equal(t95(19), 2.093);
  assert.equal(batchVerdict({ n: 10, lo: 0.5, hi: 2 }, true), 'held'); assert.equal(batchVerdict({ n: 10, lo: 0.5, hi: 2 }, false), 'against');
  assert.equal(batchVerdict({ n: 10, lo: -1, hi: 2 }, true), 'unclear'); assert.equal(batchVerdict({ n: 2, lo: 1, hi: 2 }, true), 'unclear', 'too few seeds');
  assert.equal(paired([[null, 1]]).n, 0);
  assert.deepEqual(batchSeeds(999998, 4), [999998, 999999, 1, 2]);
});

test('F5 batch report: Eden and Lab rows are built from run summaries and read cleanly', () => {
  const base = normalizeSetup({ world: 'eden', seed: 41, runDays: 6 }), tw = twinSetups(base);
  const rows = batchSeeds(41, 3).map(seed => ({ seed, main: summarizeEden(runToEnd({ ...base, seed })), g: summarizeEden(runToEnd({ ...tw.guidance, seed })), h: summarizeEden(runToEnd({ ...tw.help, seed })) }));
  const b = { seeds: batchSeeds(41, 3), rows: batchEden(rows) };
  assert.deepEqual(b.rows.map(r => r.id), ['P1', 'P2', 'P5', 'Fall', 'Bar·help', 'Bar·guidance']);
  const p5 = b.rows[2]; assert.equal(p5.n, 3);
  assert.ok(Math.abs(p5.mean - rows.reduce((n, r) => n + (r.h.ownLater - r.main.ownLater), 0) / 3) < 1e-9, 'help on minus help off, seed by seed');
  for (const r of b.rows) assert.ok(['held', 'against', 'unclear', 'measured'].includes(r.verdict));
  const md = batchMarkdown(b), html = batchHTML(b);
  for (const t of [md, html]) { assert.doesNotMatch(t, /undefined|NaN|\[object/); assert.match(t, /3 islands/); }
  const lb = normalizeSetup({ world: 'lab', seed: 7, runDays: 2, falseInfo: 0.25, food: 15 });
  const lrows = batchSeeds(7, 3).map(seed => ({ seed, main: summarizeLab(runToEnd({ ...lb, seed })), talk: summarizeLab(runToEnd({ ...lb, seed, talk: false })), lies: summarizeLab(runToEnd({ ...lb, seed, falseInfo: 0 })) }));
  const L = batchLab(lrows); assert.equal(L.length, 5); assert.doesNotMatch(batchMarkdown({ seeds: [7, 8, 9], rows: L }), /undefined|NaN/);
});

test('F6 scarcity and telling reach the Lab sim as config inputs only', () => {
  const n = normalizeSetup({ world: 'lab', food: 15, regrowth: 0.0075, talk: false });
  assert.equal(n.food, 15); assert.equal(n.regrowth, 0.0075); assert.equal(n.talk, false);
  assert.equal(normalizeSetup({ world: 'lab', food: 17 }).food, 60, 'unknown values fall back to the default'); assert.equal(normalizeSetup({ world: 'lab' }).talk, true);
  const r = createRun({ ...n, seed: 9, runDays: 2 }); stepRun(r, 400);
  const plain = createLab(9, { population: 24, falseInformationRate: 0, foodQuantity: 15, foodRegrowth: 0.0075, communication: false }); labStep(plain, 400);
  assert.deepEqual(strip(r.world), strip(plain));
  assert.equal(labMetrics(r.world).messages.sent, 0, 'telling off: no messages');
});

test('F7 the moving bar is a measure only: it never changes a world, and it follows hardship', () => {
  for (const w of [0.5, 3]) {
    const r = createRun({ world: 'eden', seed: 43, runDays: 3, barWindow: w }); stepRun(r, 2000);
    const plain = createEden(43, {}, { serpentSilentYears: 0, guidanceRate: 1 }); edenStep(plain, 2000);
    assert.deepEqual(strip(r.world), strip(plain), `bar window ${w} leaves the world untouched`);
    for (const row of r.series) { assert.ok(row.hard >= 0 && row.hard <= 100); assert.ok(row.over >= 0 && row.over <= 100); }
  }
  // A creature held at a higher hardship ends up with a higher bar, and is no longer "above its bar".
  const run = { kind: 'eden', setup: { barWindow: 0.5 }, bar: {}, world: { creatures: [{ id: 0, alive: true, hunger: 0, energy: 100, eden: { thirst: 0, health: 100 } }] } };
  assert.equal(barSample(run).over, 0);
  Object.assign(run.world.creatures[0], { hunger: 80 }); assert.equal(hardshipEden(run.world.creatures[0]), 20);
  assert.equal(barSample(run).over, 100, 'a sudden rise is above the bar');
  for (let i = 0; i < 200; i++) barSample(run);
  const end = barSample(run); assert.ok(end.bar > 20 - BAR_MARGIN && end.over === 0, 'the bar has moved up to meet it');
});

// ---- One of many worlds: the way back (T9) and the deceiver's demons (T11). Off by default. ----
test('W1 with the way back and demons off, Eden is exactly the original world', () => {
  assert.equal(EDEN_DEFAULTS.restoration, false); assert.equal(EDEN_DEFAULTS.tempters, 0);
  const a = createEden(41), b = createEden(41, {}, { restoration: false, tempters: 0, fallAgain: false }); edenStep(a, 8 * DAY); edenStep(b, 8 * DAY);
  assert.equal(a.eden.phase, 'released'); assert.equal(a.eden.restored, undefined); assert.equal(a.eden.tempters, undefined);
  const ca = strip(a), cb = strip(b); delete ca.eden.config.fallAgain; delete cb.eden.config.fallAgain;
  assert.deepEqual(ca, cb);
  assert.ok(a.creatures.every(c => c.eden.covered === undefined));
});

test('W2 the way back: nobody is restored before the fall, every answer is the creature\'s own draw, and it repeats exactly', () => {
  const s = createEden(41, {}, { restoration: true });
  while (s.eden.phase === 'guided') { edenStep(s, 60); assert.ok(s.creatures.every(c => !c.eden.covered)); }
  edenStep(s, 12 * DAY);
  const R = s.eden.restored, m = edenMetrics(s).restored;
  assert.ok(R.calls > 50 && R.returned > 0 && R.returned < R.calls, `${R.returned} of ${R.calls}`);
  for (const a of R.answers) { assert.ok(a.P > 0 && a.P < 1); assert.equal(a.yes, a.draw < a.P); }
  assert.equal(m.living, s.creatures.filter(c => c.alive && c.eden.covered).length);
  const again = createEden(41, {}, { restoration: true }); edenStep(again, s.tick);
  assert.deepEqual(strip(again), strip(s));
});

test('W3 provision: a restored creature is fed before want can harm it, and none dies of hunger or thirst', () => {
  const s = createEden(42, {}, { restoration: true }); edenStep(s, 25 * DAY);
  assert.ok(s.eden.restored.bread > 0);
  const want = s.creatures.filter(c => !c.alive && c.death.covered && /deprivation|Thirst/.test(c.death.cause));
  assert.equal(want.length, 0);
  for (const c of s.creatures) if (c.alive && c.eden.covered) { assert.ok(c.hunger < 99 && c.eden.thirst < 99); assert.equal(c.starving, 0); }
  assert.ok(s.creatures.some(c => !c.alive && !c.death.covered), 'the rest of the world is still fallen');
});

test('W4 demons can only whisper: they move and speak, and never touch a creature\'s body, place or choice', () => {
  const a = createEden(41, {}, { tempters: 3 }), b = createEden(41);
  edenStep(a, 9 * DAY); edenStep(b, 9 * DAY);
  assert.equal(a.eden.tempters.length, 3); assert.ok(a.eden.restored.whispers > 20);
  // With no way back, whispers change only what a creature has heard and believes. The rest of the world is untouched.
  const clean = w => { const c = strip(w); delete c.eden.restored; delete c.eden.tempters; for (const k of ['tempters', 'restoration', 'fallAgain']) delete c.eden.config[k];
    for (const x of c.creatures) { x.eden.hearings = 0; x.eden.credence = 0; x.eden.lastSerpent = null; x.memories = []; } c.events = []; c.digest = 0; return c; };
  assert.deepEqual(clean(a), clean(b));
});

test('W5 drawn away again is a setting: on, it is the creature\'s own draw; off, a whisper has no hold', () => {
  const on = createEden(41, {}, { restoration: true, tempters: 6 }), off = createEden(41, {}, { restoration: true, tempters: 6, fallAgain: false });
  edenStep(on, 30 * DAY); edenStep(off, 30 * DAY);
  assert.equal(off.eden.restored.left, 0); assert.ok(!off.eden.restored.answers.some(a => a.kind === 'whisper'));
  const wh = on.eden.restored.answers.filter(a => a.kind === 'whisper');
  assert.ok(wh.length > 0); for (const a of wh) { assert.ok(a.P > 0 && a.P < 1); assert.equal(a.yes, a.draw < a.P); }
});

test('W6 the report and batch rows carry the way back and the demons, and T9 is Robert\'s line, not a proposal', () => {
  assert.ok(!PROPOSED.includes('T9')); assert.doesNotMatch(THEORY.T9, /proposed/); assert.ok(THEORY.T11);
  const set = normalizeSetup({ world: 'eden', seed: 41, runDays: 12, restoration: true, tempters: 3 });
  const run = runToEnd(set), m = summarizeEden(run), tw = twinSetups(set);
  assert.equal(m.restored.returned, run.world.eden.restored.returned);
  assert.equal(run.series.at(-1).restored, m.restored.living / m.population * 100);
  const rep = buildEdenReport(m, summarizeEden(runToEnd(tw.guidance)), summarizeEden(runToEnd(tw.help)), {});
  const md = reportMarkdown(rep); assert.match(md, /A way back was open/); assert.match(md, /They forced no one/); assert.doesNotMatch(md, /undefined|NaN/);
  const rows = [41, 42, 43].map(seed => { const f = x => summarizeEden(runToEnd({ ...x, seed, runDays: 9 })); return { seed, main: f(set), g: f(tw.guidance), h: f(tw.help), r: f({ ...set, restoration: false }), d: f({ ...set, tempters: 0 }) }; });
  const b = batchEden(rows); assert.deepEqual(b.slice(0, 5).map(r => r.id), ['Way back·lives', 'Way back·deaths', 'Way back·turned', 'Demons·turned', 'Demons·lives']);
  assert.doesNotMatch(batchMarkdown({ seeds: [41, 42, 43], rows: b }), /undefined|NaN/);
  const lab = normalizeSetup({ world: 'lab', restoration: true, tempters: 3 }); assert.equal(lab.restoration, false); assert.equal(lab.tempters, 0);
});

test('D1 natural drives: "Normal" is the original world, and each setting only rescales a number the sim already has', () => {
  const r = createRun({ world: 'eden', seed: 45, runDays: 3 }); stepRun(r, 1500);
  const plain = createEden(45, {}, { serpentSilentYears: 0, guidanceRate: 1, restoration: false, tempters: 0, fallAgain: true }); edenStep(plain, 1500);
  assert.deepEqual(strip(r.world), strip(plain));
  const hi = createRun({ world: 'eden', seed: 45, runDays: 3, dAppetite: 1.25, dThirst: 0.75, dCuriosity: 0.15, dChildren: 0.3, dFruit: 0.75, dWarning: 2 });
  const c = hi.world.eden.config;
  assert.equal(hi.world.config.hungerRate, 0.05 * 1.25); assert.equal(c.thirstRate, EDEN_DEFAULTS.thirstRate * 0.75);
  assert.ok(Math.abs(c.curiosityMin - 0.35) < 1e-9 && c.curiosityMax === 1, 'curiosity stays within 0 to 1');
  assert.equal(c.fecundability, 0.3); assert.equal(c.beauty, 0.75); assert.equal(c.wWarn, 2);
  assert.ok(Object.keys(c).every(k => k in EDEN_DEFAULTS), 'no new sim setting was invented');
  assert.equal(normalizeSetup({ world: 'eden', dAppetite: 9 }).dAppetite, 1, 'unknown values fall back to Normal');
  // Stronger pull and a looser hold on the warning must raise the sim's own chance of eating at the tree.
  const lo = runToEnd({ world: 'eden', seed: 45, runDays: 4, dFruit: 0.25, dWarning: 4 }), up = runToEnd({ world: 'eden', seed: 45, runDays: 4, dFruit: 0.75, dWarning: 2 });
  const P = x => x.world.eden.deliberations.reduce((n, d) => n + d.P, 0) / x.world.eden.deliberations.length;
  assert.ok(P(up) > P(lo));
});
