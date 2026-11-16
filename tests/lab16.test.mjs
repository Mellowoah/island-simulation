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
  const p1 = preds[0], longer = M.guidanceYears > G.guidanceYears ? M : G, shorter = longer === M ? G : M;
  assert.equal(p1.a, longer.meanChance); assert.equal(p1.b, shorter.meanChance);
  const p5 = preds[4], on = M.help ? M : H, off = M.help ? H : M;
  assert.equal(p5.a, on.ownLater); assert.equal(p5.b, off.ownLater);
  assert.equal(H.tick, M.tick); assert.equal(G.tick, M.tick, 'matched worlds run for the same time');
  assert.equal(G.seed, M.seed); assert.equal(G.help, M.help); assert.equal(H.guidanceYears, M.guidanceYears);
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
    assert.equal(specs.length, 6);
    for (const c of specs) { for (const s of c.series) assert.equal(s.values.length, c.xs.length); if (!c.empty) drawLineChart(fakeCtx(), 280, 150, c.xs, c.series, c.opts); }
  }
});
