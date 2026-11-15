// Random-stream registry: no two uses may share a stream number (Edge, issue #1 / CHANNEL 14:41 UTC).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SIM_STREAMS, EDEN_STREAMS, createEden, edenStep } from '../dist/eden.js';

test('S1 no stream range overlaps another (the per-tick ordering stream is the one shared use)', () => {
  const all = [...Object.entries(SIM_STREAMS).map(([k, r]) => ['sim.' + k, r]), ...Object.entries(EDEN_STREAMS).map(([k, r]) => ['eden.' + k, r])].filter(([k]) => !k.endsWith('.order'));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const [a, [a0, a1]] = all[i], [b, [b0, b1]] = all[j];
    assert.ok(a1 < b0 || b1 < a0, `${a} [${a0},${a1}] overlaps ${b} [${b0},${b1}]`);
  }
});

test('S2 every stream number used in eden.js is in the registry', () => {
  const src = fs.readFileSync(new URL('../dist/eden.js', import.meta.url), 'utf8');
  const used = [...src.matchAll(/draw\(s, [a-z]+\.id, (\d+)(?: \+ i)?\)/g)].map(m => Number(m[1]));
  assert.ok(used.length >= 9);
  for (const n of used) assert.ok(Object.values(EDEN_STREAMS).some(([lo, hi]) => n >= lo && n <= hi), `stream ${n} is not registered`);
});

test('S3 a released creature decides to break off using only what it remembers, never true stock', () => {
  // Same creature, same memory ("the grove was empty"), hungry and resting far from any food.
  // Only the true stock differs between the two worlds, and it cannot see it.
  const run = stock => {
    const s = createEden(50);
    while (s.eden.phase === 'guided') edenStep(s);
    const c = s.creatures.find(c => c.alive && c.eden.mother === null);
    Object.assign(c, { x: 30, y: 12, hunger: 80, energy: 60, action: { type: 'rest', left: 20, start: { hunger: 80, energy: 60 } } });
    c.eden.thirst = 0; c.known = { a: { expected: 0, last: s.tick } }; c.decision = { tick: -1, marker: true };
    for (const p of s.patches) p.stock = stock;
    edenStep(s);
    return c.decision;
  };
  assert.deepEqual(run(100), run(0), 'true stock it cannot see must not make it reconsider');
  assert.ok(run(0).marker, 'with nothing remembered worth going to, it keeps resting');
});
