import test from 'node:test';
import assert from 'node:assert/strict';
import { createEden, edenStep, EDEN_DEFAULTS } from '../dist/eden.js';
import { noise2, seedKey, STREAMS, clamp } from '../dist/sim.js';
import { LAYERS, KINDS, SOURCE, TEMPERAMENT, HUMAN_ATTRIBUTES, CHANNELS, temperament, plasticity, attributesOf, beingsOf } from '../dist/being.js';

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

test('A3 children inherit temperament by the same rule as curiosity (hand check)', () => {
  const s = createEden(41); edenStep(s, 9 * 1440);
  const kids = s.creatures.filter(c => c.eden.mother !== null); assert.ok(kids.length > 5);
  const cfg = s.eden.config, mean = (cfg.curiosityMin + cfg.curiosityMax) / 2, k = seedKey(41);
  for (const c of kids.slice(0, 6)) {
    const mo = temperament(s, s.creatures[c.eden.mother]), fa = temperament(s, s.creatures[c.eden.father]), b = c.eden.born, salt = STREAMS.temperament[0] + 2;
    const noise = (noise2(k, b, c.id, salt) + noise2(k, b + 1, c.id, salt) + noise2(k, b + 2, c.id, salt) - 1.5) * 0.2;
    assert.equal(temperament(s, c).grief, clamp(mean + cfg.heritability * ((mo.grief + fa.grief) / 2 - mean) + noise, cfg.curiosityMin, cfg.curiosityMax));
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

import { develop, DEV, developmentSummary, traitsNow } from '../dist/being.js';
import { normalizeSetup } from '../dist/lab16-setup.js';
import { runToEnd } from '../dist/lab16-run.js';
import { summarizeEden, buildEdenReport, reportMarkdown, twinSetups } from '../dist/lab16-report.js';

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
