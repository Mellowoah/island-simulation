// Salt registry and hidden stock (Edge). One table, no overlapping ranges, call sites read it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STREAMS } from '../dist/frozen/sim.js';
import { createEden, edenStep } from '../dist/frozen/eden.js';
import { setDefaultClock } from '../dist/frozen/clock.js';
setDefaultClock('legacy'); // these tests pin the original (pre-17 Nov) behaviour; tests/clock.test.mjs covers the real clock

const span = ([lo, hi]) => hi - lo;

test('S1 no salt range overlaps another', () => {
  const all = Object.entries(STREAMS);
  assert.ok(all.length >= 12, 'every process is listed');
  for (const [name, range] of all) {
    assert.ok(Array.isArray(range) && range.length === 2 && Number.isInteger(range[0]) && Number.isInteger(range[1]) && range[0] <= range[1], name);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const [a, [a0, a1]] = all[i], [b, [b0, b1]] = all[j];
    assert.ok(a1 < b0 || b1 < a0, `${a} [${a0},${a1}] overlaps ${b} [${b0},${b1}]`);
  }
  // Island numbers are frozen. Changing them changes every save and experiment row.
  assert.deepEqual(STREAMS.startPosition, [0, 1]);
  assert.deepEqual(STREAMS.exploreX, [10, 27]);
  assert.deepEqual(STREAMS.exploreY, [40, 57]);
  assert.deepEqual(STREAMS.order, [99, 99]);
  // Paired draws share a loop index, so the two ranges must be the same width.
  assert.equal(span(STREAMS.exploreX), span(STREAMS.exploreY));
  assert.equal(span(STREAMS.guideX), span(STREAMS.guideY));
  assert.ok(STREAMS.startPosition[0] + 1 <= STREAMS.startPosition[1]);
  assert.ok(STREAMS.exploreTarget[0] + 1 <= STREAMS.exploreTarget[1]);
  assert.ok(STREAMS.conception[0] + 1 <= STREAMS.conception[1]);
  assert.equal(STREAMS.newborn[0] + 6 - 1, STREAMS.newborn[1]);
});

// Salt argument of a draw/noise/noise2 call. Declarations are skipped.
function saltArgs(src, name, index) {
  const out = [];
  const re = new RegExp(`\\b${name}\\(`, 'g');
  let m;
  while ((m = re.exec(src))) {
    const before = src.slice(Math.max(0, m.index - 20), m.index);
    if (/function\s+$/.test(before)) continue;
    let i = m.index + m[0].length, depth = 1, start = i;
    const args = [];
    for (; i < src.length && depth; i++) {
      const ch = src[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (!depth) args.push(src.slice(start, i).trim()); }
      else if (ch === ',' && depth === 1) { args.push(src.slice(start, i).trim()); start = i + 1; }
    }
    assert.ok(args.length > index, `${name}(${args.join(', ')}) has no salt argument`);
    out.push(args[index]);
  }
  return out;
}

const SALT = /^(?:salt|STREAMS\.\w+\[0\](?:\s*\+\s*(?:i(?:\s*-\s*1)?|\d+))?)$/;

test('S2 every simulation draw takes its salt from STREAMS', () => {
  const sim = fs.readFileSync(new URL('../dist/frozen/sim.js', import.meta.url), 'utf8');
  const eden = fs.readFileSync(new URL('../dist/frozen/eden.js', import.meta.url), 'utf8');
  const used = [
    ...saltArgs(sim, 'draw', 3),
    ...saltArgs(sim, 'noise2', 3),
    ...saltArgs(sim, 'noise', 3),
    ...saltArgs(eden, 'draw', 2),
    ...saltArgs(eden, 'noise2', 3),
  ];
  assert.ok(used.length >= 20, `found ${used.length} draws`);
  for (const salt of used) assert.match(salt, SALT, salt);
  assert.match(sim, /i\s*<=\s*STREAMS\.exploreX\[1\]\s*-\s*STREAMS\.exploreX\[0\]/); // spacing-free: the code is formatted by prettier
  assert.match(eden, /i\s*<=\s*STREAMS\.guideX\[1\]\s*-\s*STREAMS\.guideX\[0\]/);
  assert.match(eden, /r\(1\)/);
  assert.match(eden, /r\(6\)/);
  assert.doesNotMatch(eden, /r\((?:0|7)\)/);
});

test('S3 changing stock a released creature has not observed does not change its decision', () => {
  // Out of sight of both sources (root garden is 6 tiles away; sight here is about 2).
  const setup = () => {
    const s = createEden(50);
    while (s.eden.phase === 'guided') edenStep(s);
    const c = s.creatures.find(x => x.alive && x.eden.mother === null);
    Object.assign(c, { x: 30, y: 12, hunger: 80, energy: 60, action: { type: 'rest', left: 20, start: { hunger: 80, energy: 60 } } });
    c.eden.thirst = 0;
    c.decision = { tick: -1, marker: true };
    return { s, c };
  };
  const snap = c => ({ decision: c.decision, action: c.action?.type ?? null, x: c.x, y: c.y });

  // A source it has never seen. Only that source's true stock differs.
  const unseen = stock => {
    const { s, c } = setup();
    c.known = { a: { expected: 80, last: s.tick } };
    const hidden = s.patches.find(p => p.id !== 'a');
    hidden.stock = stock;
    edenStep(s);
    assert.equal(c.known[hidden.id], undefined, 'the source was observed');
    return snap(c);
  };
  assert.deepEqual(unseen(0), unseen(120), 'unobserved stock changed a decision');

  // A source it remembers as empty. The true stock is out of sight.
  // Before the fix, pressing() read that stock and broke off the rest when it was high.
  const stale = stock => {
    const { s, c } = setup();
    c.known = { a: { expected: 0, last: s.tick } };
    for (const p of s.patches) p.stock = stock;
    edenStep(s);
    assert.equal(c.known.a.expected, 0, 'it observed the source this tick');
    return snap(c);
  };
  assert.deepEqual(stale(100), stale(0), 'true stock it cannot see changed the interrupt');
  assert.equal(stale(0).decision.marker, true, 'with nothing remembered worth going to, it keeps resting');
  assert.equal(stale(0).action, 'rest');
});
