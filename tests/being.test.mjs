import test from 'node:test';
import assert from 'node:assert/strict';
import { createEden, edenStep, EDEN_DEFAULTS } from '../dist/frozen/eden.js';
import { noise2, seedKey, STREAMS, clamp } from '../dist/frozen/sim.js';
import { LAYERS, KINDS, SOURCE, TEMPERAMENT, HUMAN_ATTRIBUTES, CHANNELS, temperament, plasticity, attributesOf, beingsOf } from '../dist/frozen/being.js';

const strip = w => JSON.parse(JSON.stringify(w));

test('A1 reading attributes changes nothing in the world', () => {
  const a = createEden(41, {}, { restoration: true, tempters: 2 }), b = createEden(41, {}, { restoration: true, tempters: 2 });
  for (let i = 0; i < 40; i++) { edenStep(a, 200); edenStep(b, 200); for (const c of a.creatures) { attributesOf(a, c); temperament(a, c); } beingsOf(a); }
  assert.ok(a.creatures.length > 24, 'children were born, so inherited temperament was exercised');
  assert.deepEqual(strip(a), strip(b));
});

test('A2 temperament: seeking is the sim\'s own curiosity; the rest are fixed by the seed and in range', () => {
  const s = createEden(41), t = createEden(41), u = createEden(42), cfg = s.eden.config;
  for (const c of s.creatures) {
    const x = temperament(s, c);
    assert.equal(x.seeking, c.eden.curiosity);
    for (const k of TEMPERAMENT) assert.ok(x[k.key] >= cfg.curiosityMin && x[k.key] <= cfg.curiosityMax, k.key);
    assert.deepEqual(x, temperament(t, t.creatures[c.id]), 'same seed, same temperament');
    // hand check of the first-generation rule
    assert.equal(x.fear, cfg.curiosityMin + noise2(seedKey(41), 0, c.id, STREAMS.temperament[0]) * (cfg.curiosityMax - cfg.curiosityMin));
  }
  assert.notDeepEqual(temperament(s, s.creatures[0]), temperament(u, u.creatures[0]), 'another seed, another temperament');
  const care = s.creatures.map(c => temperament(s, c).care);
  assert.ok(Math.max(...care) - Math.min(...care) > 0.2, 'creatures differ');
});

test('A3 children inherit temperament by breeding value, like curiosity (hand check; no pull back to the founders)', () => {
  const s = createEden(41); edenStep(s, 9 * 1440);
  const kids = s.creatures.filter(c => c.eden.mother !== null); assert.ok(kids.length > 5);
  const cfg = s.eden.config, k = seedKey(41), h2 = cfg.heritability;
  const lo = cfg.curiosityMin, hi = cfg.curiosityMax, vp = (hi - lo) ** 2 / 12;
  for (const c of kids.slice(0, 6)) {
    const mo = temperament(s, s.creatures[c.eden.mother]), fa = temperament(s, s.creatures[c.eden.father]);
    const b = c.eden.born, salt = STREAMS.temperament[0] + 2;
    const z = j => (noise2(k, b + 3 * j, c.id, salt) + noise2(k, b + 3 * j + 1, c.id, salt) + noise2(k, b + 3 * j + 2, c.id, salt) - 1.5) * 2;
    const g = (mo.g.grief + fa.g.grief) / 2 + Math.sqrt(h2 * vp / 2) * z(1);
    assert.equal(temperament(s, c).g.grief, g);
    assert.equal(temperament(s, c).grief, clamp(g + Math.sqrt((1 - h2) * vp) * z(2), lo, hi));
    assert.equal(temperament(s, c).seeking, c.eden.curiosity);
  }
});

test('A4 plasticity: hand-checked values, falls with age, never below the floor', () => {
  assert.equal(plasticity(0), 1);
  assert.ok(Math.abs(plasticity(8) - (0.15 + 0.85 / Math.E)) < 1e-12);
  assert.ok(plasticity(5) > plasticity(20) && plasticity(200) >= 0.15 && plasticity(-3) === 1);
});

test('A5 the attribute catalogue is complete and honest about what acts', () => {
  const layerIds = LAYERS.map(l => l.id), seen = new Set();
  for (const a of HUMAN_ATTRIBUTES) {
    assert.ok(!seen.has(a.key), 'unique key ' + a.key); seen.add(a.key);
    assert.ok(KINDS.human.layers.includes(a.layer), a.key + ' sits in a human layer');
    assert.ok(CHANNELS.includes(a.channel), a.key);
    assert.ok(['active', 'recorded', 'planned'].includes(a.status), a.key);
    if (a.status === 'planned') assert.ok(Number.isInteger(a.phase), a.key + ' names its phase');
  }
  for (const id of KINDS.human.layers) assert.ok(HUMAN_ATTRIBUTES.some(a => a.layer === id), 'every human layer has attributes: ' + id);
  for (const ch of ['Body', 'Feeling', 'Knowledge', 'Judgment', 'Practice']) assert.ok(HUMAN_ATTRIBUTES.some(a => a.channel === ch), 'channel ' + ch);
  const s = createEden(43); edenStep(s, 3 * 1440);
  for (const c of s.creatures.filter(c => c.alive)) for (const g of attributesOf(s, c)) for (const r of g.rows) {
    if (r.status === 'planned') assert.equal(r.value, null, r.key);
    else assert.ok(r.value !== null && r.value !== undefined && !(typeof r.value === 'number' && !Number.isFinite(r.value)), r.key);
  }
});

test('A6 layers of existence: each kind holds the layers below it, spirit has no body, the Creator is not a layer', () => {
  assert.deepEqual(LAYERS.map(l => l.id), ['matter', 'life', 'sense', 'reason', 'spirit']);
  for (const k of ['thing', 'plant', 'animal', 'human']) { const L = KINDS[k].layers; assert.deepEqual(L, LAYERS.slice(0, L.length).map(l => l.id), k + ' is nested'); }
  assert.deepEqual(KINDS.spirit.layers, ['spirit']);
  assert.ok(!LAYERS.some(l => l.id === SOURCE.id));
  const s = createEden(41, {}, { tempters: 3 }); edenStep(s, 9 * 1440);
  const b = beingsOf(s), by = Object.fromEntries(b.map(x => [x.kind, x]));
  assert.match(by.thing.items[0], /^3 springs/); assert.match(by.human.items[0], new RegExp(`^${s.creatures.filter(c => c.alive).length} living`));
  assert.match(by.spirit.items[1], /^3 demons/); assert.deepEqual(by.source.items, ['the Creator']);
  assert.equal(EDEN_DEFAULTS.tempters, 0);
});

import { develop, DEV, developmentSummary, traitsNow } from '../dist/frozen/being.js';
import { normalizeSetup } from '../dist/frozen/lab16-setup.js';
import { runToEnd } from '../dist/frozen/lab16-run.js';
import { summarizeEden, buildEdenReport, reportMarkdown, twinSetups } from '../dist/frozen/lab16-report.js';

test('D2 development off is the original world; on, the same seed gives the same history', () => {
  assert.equal(EDEN_DEFAULTS.traitDevelopment, false);
  const a = createEden(44), b = createEden(44, {}, { traitDevelopment: false }); edenStep(a, 4 * 1440); edenStep(b, 4 * 1440);
  assert.deepEqual(strip(a), strip(b)); assert.ok(a.creatures.every(c => c.eden.traits === undefined));
  const x = createEden(44, {}, { traitDevelopment: true }), y = createEden(44, {}, { traitDevelopment: true });
  edenStep(x, 4 * 1440); edenStep(y, 4 * 1440); assert.deepEqual(strip(x), strip(y));
});

test('D3 traits move over a life, stay in range, curiosity follows seeking, and parents pass on only what they were born with', () => {
  const s = createEden(61, {}, { traitDevelopment: true }); edenStep(s, 12 * 1440);
  const alive = s.creatures.filter(c => c.alive);
  for (const c of alive) for (const k of TEMPERAMENT) { const v = c.eden.traits.now[k.key]; assert.ok(v >= DEV.min && v <= DEV.max); }
  for (const c of alive) assert.equal(c.eden.curiosity, c.eden.traits.now.seeking);
  assert.ok(developmentSummary(s).meanShift > 2, 'traits actually developed');
  // inborn traits of a child come from the parents' inborn traits, never from what they became
  const kid = s.creatures.find(c => c.eden.mother !== null && c.eden.traits), mo = s.creatures[kid.eden.mother], fa = s.creatures[kid.eden.father];
  assert.ok(mo.eden.traits.now.care !== mo.eden.traits.base.care, 'the mother had changed');
  const fresh = createEden(61, {}, { traitDevelopment: true }); edenStep(fresh, s.tick);
  assert.equal(temperament(fresh, fresh.creatures[kid.id]).care, kid.eden.traits.base.care);
  assert.equal(traitsNow(s, kid), kid.eden.traits.now);
  void fa;
});

test('D4 hand-checked: a lone young creature drifts toward a close parent, and harm raises fear', () => {
  const s = createEden(41, {}, { traitDevelopment: true });
  for (const c of s.creatures) c.alive = false;
  const [m, k] = [s.creatures[0], s.creatures[1]]; m.alive = k.alive = true;
  k.eden.mother = m.id; k.eden.father = 2; k.eden.born = s.tick; k.x = m.x; k.y = m.y; m.eden.born = s.tick - 20 * 1440;
  develop(s); // creates records, first step
  m.eden.traits.now.care = 0.9; k.eden.traits.now.care = 0.3; m.eden.traits.base.care = 0.9; k.eden.traits.base.care = 0.3;
  const before = k.eden.traits.now.care; develop(s);
  const p = 1; // newborn: full plasticity (age 0 at s.tick)
  // social pull (kin weight cancels for a single neighbour) + a fed young child's small push toward care
  assert.ok(Math.abs(k.eden.traits.now.care - (before + DEV.social * p * (0.9 - 0.3) + DEV.experience * p * 0.05 * (1 - 0.3))) < 1e-9);
  const f0 = k.eden.traits.now.fear; k.eden.health -= 25; develop(s);
  assert.ok(k.eden.traits.now.fear > f0, 'harm raises fear');
});

test('D5 the report describes development only when it is on', () => {
  const on = normalizeSetup({ world: 'eden', seed: 61, runDays: 6, traitDev: true }), off = { ...on, traitDev: false };
  const mOn = summarizeEden(runToEnd(on)), mOff = summarizeEden(runToEnd(off));
  assert.ok(mOn.development && mOn.development.meanShift > 0); assert.equal(mOff.development, null);
  const tw = twinSetups(on), md = reportMarkdown(buildEdenReport(mOn, summarizeEden(runToEnd(tw.guidance)), summarizeEden(runToEnd(tw.help)), {}));
  assert.match(md, /Traits developed through life/); assert.doesNotMatch(md, /undefined|NaN/);
  assert.equal(normalizeSetup({ world: 'lab', traitDev: true }).traitDev, false);
});

import { LIFE_STAGES, LIFE, lifeStage, wakeDrain, healFactor, illnessFactor, ageHazard, pregnancyExtra } from '../dist/frozen/being.js';
import { DEFAULTS } from '../dist/frozen/sim.js';

test('L1 the body changing with age is off by default, and off is the original world', () => {
  assert.equal(EDEN_DEFAULTS.lifeCourse, false);
  const a = createEden(45), b = createEden(45, {}, { lifeCourse: false }); edenStep(a, 9 * 1440); edenStep(b, 9 * 1440);
  assert.deepEqual(strip(a), strip(b));
  assert.ok(!Object.keys(a.eden.deaths).includes('Old age'));
});

test('L2 stage figures match their sources (hand-checked)', () => {
  const at = a => lifeStage(a);
  assert.equal(at(0).id, 'infant'); assert.equal(at(2).id, 'toddler'); assert.equal(at(4.9).id, 'preschool'); assert.equal(at(5).id, 'child');
  assert.equal(at(16).id, 'adolescent'); assert.equal(at(30).id, 'adult'); assert.equal(at(55).id, 'middle'); assert.equal(at(80).id, 'elder');
  // sleep hours within CDC / AASM ranges
  const range = { toddler: [11, 14], preschool: [10, 13], child: [9, 12], juvenile: [9, 12], adolescent: [8, 10], adult: [7, 9], middle: [7, 9], elder: [7, 8] };
  for (const [id, [lo, hi]] of Object.entries(range)) { const h = LIFE_STAGES.find(x => x.id === id).sleepHours; assert.ok(h >= lo && h <= hi, id); }
  // food need rises to adolescence, then falls (Dietary Guidelines)
  const f = id => LIFE_STAGES.find(x => x.id === id).food;
  assert.ok(f('child') < f('juvenile') && f('juvenile') < f('adolescent') && f('adolescent') > f('adult') && f('adult') > f('middle') && f('middle') >= f('elder'));
  // sleep pressure: an adult resting only to recover rests 7.5/24 of the time
  const d = wakeDrain(at(30), DEFAULTS.restGain); assert.ok(Math.abs(d / (d + DEFAULTS.restGain) - 7.5 / 24) < 1e-12);
  // Gompertz: doubles every 8 years
  assert.ok(Math.abs(ageHazard(78) / ageHazard(70) - 2) < 1e-12); assert.equal(ageHazard(70), LIFE.hazardAt70);
  assert.equal(healFactor(30), 1); assert.ok(Math.abs(healFactor(50) - 0.8) < 1e-12); assert.equal(healFactor(200), LIFE.healFloor);
  assert.equal(illnessFactor(8), LIFE.illnessYoung); assert.equal(illnessFactor(40), 1); assert.equal(illnessFactor(70), LIFE.illnessOld);
});

test('L3 pregnancy needs more food, by trimester', () => {
  const s = createEden(41, {}, { lifeCourse: true }), m = s.creatures.find(c => c.eden.sex === 'F'), g = s.eden.config.gestation * 1440;
  assert.equal(pregnancyExtra(s, m), 0);
  m.eden.pregnant = { due: s.tick + g, father: 1 }; assert.equal(pregnancyExtra(s, m), 0);
  m.eden.pregnant.due = s.tick + g / 2; assert.equal(pregnancyExtra(s, m), 0.17);
  m.eden.pregnant.due = s.tick + g / 10; assert.equal(pregnancyExtra(s, m), 0.22);
  // and the sim uses it: hunger rises faster in the third trimester
  const h0 = m.hunger; m.action = { type: 'rest', left: 99 }; edenStep(s, 1);
  const rise = m.hunger - h0; assert.ok(Math.abs(rise - DEFAULTS.hungerRate * (1.0 + 0.22)) < 1e-9, `rise ${rise}`);
});

test('L4 nobody dies of age before the fall; after it, the old do', () => {
  const s = createEden(41, {}, { lifeCourse: true }, ); for (const c of s.creatures) c.eden.born -= 60 * 1440; // everyone about 78
  edenStep(s, 2 * 1440);
  if (s.eden.phase === 'guided') assert.ok(s.creatures.every(c => c.alive), 'no death in the garden');
  const t = createEden(41, {}, { lifeCourse: true, guidanceRate: 0 }); for (const c of t.creatures) c.eden.born -= 60 * 1440;
  edenStep(t, 25 * 1440);
  assert.equal(t.eden.phase, 'released');
  const old = t.creatures.filter(c => !c.alive && c.death.cause === 'Old age');
  assert.ok(old.length > 0, 'some died of age');
  for (const c of old) assert.ok(c.death.tick > t.eden.fallTick);
});

test('L5 rest shares by stage come close to real sleep shares, and the report shows routines', () => {
  const run = runToEnd(normalizeSetup({ world: 'eden', seed: 61, runDays: 25, lifeCourse: true }));
  const r = run.routine, share = id => { const u = r[id]; const n = Object.values(u).reduce((a, b) => a + b, 0); return u.rest / n; };
  assert.ok(share('adult') > 0.25 && share('adult') < 0.45, 'adult rest ' + share('adult'));
  assert.ok(share('child') > share('adult'), 'children rest more than adults');
  const off = runToEnd(normalizeSetup({ world: 'eden', seed: 61, runDays: 25 }));
  const so = (() => { const u = off.routine.adult; return u.rest / Object.values(u).reduce((a, b) => a + b, 0); })();
  assert.ok(so < 0.15, 'with the rules off adults barely rest: ' + so);
  const m = summarizeEden(run); assert.ok(m.routine.length >= 3);
  const tw = twinSetups(run.setup), md = reportMarkdown(buildEdenReport(m, summarizeEden(runToEnd({ ...tw.guidance, runDays: 6 })), summarizeEden(runToEnd({ ...tw.help, runDays: 6 })), {}));
  assert.match(md, /How each stage spent its time \(life-stage rules on/); assert.doesNotMatch(md, /undefined|NaN/);
  assert.equal(normalizeSetup({ world: 'lab', lifeCourse: true }).lifeCourse, false);
});

import { createRun, stepRun, LIFE_SNAP_KEYS } from '../dist/frozen/lab16-run.js';

test('S1 the deceiver can be switched off: no one is tempted, no fall, and on is the original world', () => {
  assert.equal(EDEN_DEFAULTS.serpent, true);
  const off = createEden(41, {}, { serpent: false }); edenStep(off, 15 * 1440);
  assert.equal(off.eden.phase, 'guided'); assert.equal(off.eden.fallTick, null);
  assert.ok(off.creatures.every(c => c.eden.hearings === 0)); assert.equal(off.eden.deliberations.length, 0);
  assert.ok(off.creatures.every(c => c.alive), 'no death in the garden');
  const a = createEden(41), b = createEden(41, {}, { serpent: true }); edenStep(a, 6 * 1440); edenStep(b, 6 * 1440); assert.deepEqual(strip(a), strip(b));
  const set = normalizeSetup({ world: 'eden', seed: 41, runDays: 6, serpent: false }), m = summarizeEden(runToEnd(set)), tw = twinSetups(set);
  const md = reportMarkdown(buildEdenReport(m, summarizeEden(runToEnd(tw.guidance)), summarizeEden(runToEnd(tw.help)), {}));
  assert.match(md, /The deceiver was absent/); assert.doesNotMatch(md, /undefined|NaN/);
  assert.equal(normalizeSetup({ world: 'eden' }).serpent, true);
});

test('S2 the life record follows every creature without touching the world', () => {
  const r = createRun({ world: 'eden', seed: 61, runDays: 12, traitDev: true }); stepRun(r, 12 * 1440);
  const plain = createEden(61, {}, { serpentSilentYears: 0, guidanceRate: 1, restoration: false, tempters: 0, fallAgain: true, traitDevelopment: true, lifeCourse: false, serpent: true }); edenStep(plain, 12 * 1440);
  assert.deepEqual(strip(r.world), strip(plain));
  const s = r.world;
  for (const c of s.creatures) {
    const L = r.lives[c.id]; assert.ok(L, 'every creature has a record: ' + c.name);
    assert.ok(L.snaps.length >= 1); for (const k of LIFE_SNAP_KEYS) assert.ok(Number.isFinite(L.snaps[0][k]), k);
    for (let i = 1; i < L.snaps.length; i++) assert.ok(L.snaps[i].t > L.snaps[i - 1].t);
    if (!c.alive) { assert.equal(L.died.cause, c.death.cause); }
  }
  const founder = r.lives[0]; assert.ok(founder.snaps.length >= 11, 'about one snapshot a year');
  assert.ok(founder.events.length > c0(s), 'keeps more of its story than the creature itself remembers');
  function c0(w) { return w.creatures[0].memories.length; }
});

import { registerMap, MAPS, path as findPath, onLand, mapOf } from '../dist/frozen/sim.js';
import { setDefaultClock } from '../dist/frozen/clock.js';
setDefaultClock('legacy'); // these tests pin the original (pre-17 Nov) behaviour; tests/clock.test.mjs covers the real clock

test('M1 a world can name its own map; with none it is the original island, unchanged', () => {
  const ring = registerMap({ id: 'test-ring', w: 12, h: 9, land: (x, y) => !(x >= 4 && x <= 7 && y >= 3 && y <= 5) }); // a lake in the middle
  assert.equal(MAPS['test-ring'], ring);
  assert.equal(onLand(ring, 5, 4), false); assert.equal(onLand(ring, 0, 0), true); assert.equal(onLand(ring, 12, 0), false, 'outside the map');
  const r = findPath(1, 4, 10, 4, false, ring);
  assert.ok(r.length >= 9 + 2, 'walks around the lake'); assert.deepEqual(r.at(-1), [10, 4]);
  for (const [x, y] of r) assert.ok(onLand(ring, x, y));
  const plain = createEden(41); assert.equal(mapOf(plain), null);
  assert.ok(findPath(5, 10, 27, 15, false).length > 0, 'the original island still routes');
});
