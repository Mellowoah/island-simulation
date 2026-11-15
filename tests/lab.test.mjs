// Island lab core (docs/LAB-PLAN.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STREAMS } from '../dist/sim.js';
import { createLab, labStep, labCommand, labMetrics, runTrial, isLand, confidence, LAB_STREAMS, LAB_DEFAULTS, ACTIONS, serializeLab, deserializeLab, LAB_VERSION, LAB_SAVE_FORMAT } from '../dist/lab.js';

test('L1 same seed and settings give the same history; a different seed gives another', () => {
  const a = createLab(41), b = createLab(41), c = createLab(42);
  labStep(a, 1500); labStep(b, 1500); labStep(c, 1500);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(JSON.stringify(a.creatures), JSON.stringify(c.creatures));
});

test('L2 the island is the larger marshmallow: rounded corners, a river, and fords that can be closed', () => {
  const s = createLab(41), { width, height, riverX } = s.config;
  let land = 0; for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (isLand(s, x, y)) land++;
  assert.ok(land > 2000, `land tiles ${land} (classic island has about 550)`);
  assert.ok(!isLand(s, 3, 3) && !isLand(s, width - 4, height - 4) && isLand(s, 3, height / 2) && isLand(s, width / 2 - 5, 3), 'corners are rounded off; sides are straight');
  assert.ok(!isLand(s, riverX, 20) && isLand(s, riverX, s.config.crossings[0]));
  assert.equal(s.sources.length, 12);
  const west = s.sources.filter(p => p.x < riverX).length; assert.equal(west, 6, 'food is balanced across the river');
  assert.equal(createLab(41, { crossingAvailability: 0 }).crossingsOpen.length, 0);
});

test('L3 knowledge is local: creatures start knowing nothing, and unseen changes cannot affect any decision', () => {
  const a = createLab(43), b = createLab(43);
  assert.ok(a.creatures.every(c => c.knowledge.length === 0));
  const far = b.sources.filter(p => p.x > b.config.riverX); for (const p of far) p.stock = 1;
  for (let t = 0; t < 3000; t++) {
    labStep(a); labStep(b);
    if (b.creatures.some(c => c.knowledge.some(k => far.some(p => p.x === k.x && p.y === k.y)))) break;
    for (let i = 0; i < 24; i++) assert.deepEqual(b.creatures[i].decision, a.creatures[i].decision, `creature ${i} tick ${a.tick}`);
  }
  const s = createLab(41); labStep(s, 2000);
  for (const c of s.creatures) for (const k of c.knowledge) {
    assert.ok(['food', 'garden', 'danger', 'crossing'].includes(k.type) && Number.isInteger(k.x) && Number.isInteger(k.y) && k.confidence >= 0 && k.confidence <= 100 && typeof k.source === 'string' && Number.isInteger(k.tick) && Array.isArray(k.chain));
    assert.ok(k.source === 'self' || k.source === 'player' || /^C\d\d$/.test(k.source), 'only discovery, communication or the player');
  }
});

test('L4 every decision shows its real scores, and the highest total is the action taken', () => {
  const s = createLab(41);
  for (let t = 0; t < 1500; t++) {
    labStep(s);
    for (const c of s.creatures.filter(c => c.alive)) {
      const d = c.decision, max = Math.max(...d.options.map(o => o.total));
      assert.equal(d.total, max);
      assert.equal(c.action.type, d.chosen);
      assert.ok(d.options.every(o => ACTIONS.includes(o.type) && o.score >= 0 && o.score <= 100 && o.reason.length > 0));
    }
  }
});

test('L5 personality is set once and never changes; old knowledge loses confidence', () => {
  const s = createLab(41), before = JSON.stringify(s.creatures.map(c => c.traits));
  labStep(s, 2000);
  assert.equal(JSON.stringify(s.creatures.map(c => c.traits)), before);
  assert.ok(s.creatures.every(c => Object.values(c.traits).every(v => v >= 0 && v <= 100)));
  const k = { confidence: 80, tick: s.tick - s.config.memoryLength };
  assert.equal(confidence(s, k), 40, 'half as reliable after one memory length');
});

test('L6 trust follows outcomes: useful information raises it, false information lowers it', () => {
  const run = real => {
    const s = createLab(41, { communication: false }), c = s.creatures[0], teller = s.creatures[1];
    const p = s.sources[0], spot = real ? { x: p.x, y: p.y } : { x: c.x + 1, y: c.y };
    Object.assign(c, { x: spot.x, y: spot.y });
    c.knowledge.push({ type: 'food', x: spot.x, y: spot.y, confidence: 80, source: teller.name, chain: [teller.id, c.id], tick: 0, verified: false });
    labStep(s);
    return c.trust[teller.id];
  };
  assert.equal(run(true), LAB_DEFAULTS.startTrust + LAB_DEFAULTS.trustGainRate);
  assert.equal(run(false), LAB_DEFAULTS.startTrust - LAB_DEFAULTS.trustLossRate);
});

test('L7 messages carry their source chain; misinformation appears only when the setting is on', () => {
  const clean = createLab(41); labStep(clean, 3000);
  assert.ok(clean.stats.sent > 0 && clean.stats.accepted > 0 && clean.stats.accepted <= clean.stats.sent);
  assert.equal(clean.stats.falseSent, 0);
  assert.equal(clean.stats.verifiedFalse, 0, 'with no misinformation nothing told proves false');
  const told = clean.creatures.flatMap(c => c.knowledge.filter(k => k.source !== 'self').map(k => [c, k]));
  assert.ok(told.length > 0);
  for (const [c, k] of told) { assert.equal(k.chain.at(-1), c.id); assert.ok(k.chain.length >= 2); assert.equal(clean.creatures[k.chain.at(-2)].name, k.source); }
  const noisy = createLab(41, { falseInformationRate: 0.25 }); labStep(noisy, 3000);
  assert.ok(noisy.stats.falseSent > 0 && noisy.stats.verifiedFalse > 0);
  const off = createLab(41, { communication: false }); labStep(off, 1500);
  assert.equal(off.stats.sent, 0);
});

test('L8 the player changes knowledge and conditions only: reveal to one, open a crossing, boost trust, add food', () => {
  const s = createLab(41);
  labCommand(s, { type: 'revealFood', id: 3 });
  assert.equal(s.creatures[3].knowledge.length, 1); assert.equal(s.creatures[3].knowledge[0].source, 'player');
  assert.ok(s.creatures.every(c => c.id === 3 || c.knowledge.length === 0));
  labCommand(s, { type: 'openCrossing' }); assert.equal(s.crossingsOpen.length, 2);
  assert.throws(() => labCommand(s, { type: 'openCrossing' }), /All crossings/);
  labCommand(s, { type: 'boostTrust', amount: 20 }); assert.equal(s.creatures[0].trust[1], 70);
  labStep(s, 600); const p = s.sources.reduce((a, b) => a.stock < b.stock ? a : b), had = p.stock;
  labCommand(s, { type: 'provideFood', source: p.id, amount: 10 }); assert.ok(p.stock <= p.capacity && p.stock >= had);
  assert.throws(() => labCommand(s, { type: 'move', id: 0 }), /Unknown command/, 'no direct control exists');
  const l = s.ledger; assert.ok(Math.abs(l.initial + l.regrown + l.provided - l.eaten - s.sources.reduce((n, q) => n + q.stock, 0)) < 1e-6);
});

test('L9 a trial changes only the variables it names; metrics count the dead', () => {
  const a = runTrial(45, {}, [], 1440), b = runTrial(45, {}, [], 1440);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = runTrial(45, { foodRegrowth: 0 }, [], 1440);
  const diff = Object.keys(a.config).filter(k => JSON.stringify(a.config[k]) !== JSON.stringify(c.config[k]));
  assert.deepEqual(diff, ['foodRegrowth']);
  assert.ok(a.samples.length === 24 && 'hungerAll' in a.final && 'deaths' in a.final && a.final.alive + a.final.deaths === 24);
  const s = createLab(41); for (const x of s.creatures.slice(0, 13)) { x.alive = false; x.death = { tick: 0, cause: 'test' }; }
  assert.equal(labMetrics(s).hungerAll, (13 * 100 + 11 * 20) / 24);
});

test('L10 lab random streams are registered and overlap nothing', () => {
  const all = [...Object.entries(STREAMS).map(([k, r]) => ['core.' + k, r]), ...Object.entries(LAB_STREAMS).map(([k, r]) => ['lab.' + k, r])];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const [a, [a0, a1]] = all[i], [b, [b0, b1]] = all[j];
    if (a.startsWith('core.') && b.startsWith('core.')) continue;
    assert.ok(a1 < b0 || b1 < a0, `${a} overlaps ${b}`);
  }
});

test('L11 a snapshot restores the same world, and later steps match an unrestored twin', () => {
  const a = createLab(41), b = createLab(41);
  labStep(a, 400); labStep(b, 400);
  labCommand(a, { type: 'boostTrust', amount: 20 }); labCommand(b, { type: 'boostTrust', amount: 20 });
  labCommand(a, { type: 'openCrossing' }); labCommand(b, { type: 'openCrossing' });
  labStep(a, 80); labStep(b, 80);
  const text = serializeLab(a, { seed: 41, selected: 3, paused: true, speed: 4 });
  const { world: c, ui } = deserializeLab(text);
  assert.equal(ui.selected, 3);
  assert.equal(ui.paused, true);
  assert.equal(ui.speed, 4);
  assert.equal(JSON.stringify(c), JSON.stringify(a));
  labStep(a, 200); labStep(c, 200); labStep(b, 200);
  assert.equal(JSON.stringify(c), JSON.stringify(a));
  assert.equal(JSON.stringify(c), JSON.stringify(b));
});

test('L12 corrupt or incompatible saves fail clearly and do not throw on later valid worlds', () => {
  const s = createLab(41); labStep(s, 20);
  const good = serializeLab(s, { seed: 41, selected: 0, paused: false, speed: 1 });
  assert.equal(JSON.parse(good).format, LAB_SAVE_FORMAT);
  assert.equal(JSON.parse(good).version, LAB_VERSION);
  assert.throws(() => deserializeLab('not-json'), /Invalid save/);
  assert.throws(() => deserializeLab('{}'), /Incompatible save/);
  assert.throws(() => deserializeLab(JSON.stringify({ format: LAB_SAVE_FORMAT, version: 999, world: s })), /Incompatible save/);
  assert.throws(() => deserializeLab(JSON.stringify({ format: 'island-save', version: LAB_VERSION, world: s })), /Incompatible save/);
  const broken = JSON.parse(good); broken.world.creatures = [{ id: 99 }];
  assert.throws(() => deserializeLab(JSON.stringify(broken)), /Invalid save/);
  const again = deserializeLab(good);
  assert.equal(again.world.seed, 41);
  assert.equal(again.world.creatures.length, 24);
});
