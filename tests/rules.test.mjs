// Robert's rules that a machine can check (docs/RULES.md). Each test names its rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { maxOf, minOf } from '../dist/numbers.js';

const DIST = new URL('../dist/', import.meta.url);
const code = f => readFileSync(new URL(f, DIST), 'utf8').replace(/\/\/.*$/gm, ''); // comments may name what is banned

test('R1 rule 12, nothing breaks at large sizes: no list is spread into Math.max or Math.min (use maxOf, minOf)', () => {
  const bad = readdirSync(DIST)
    .filter(f => f.endsWith('.js'))
    .filter(f => /Math\.(max|min)\(\s*\.\.\./.test(code(f)));
  assert.deepEqual(bad, []);
});

test('R2 rule 11, no double counting: disease is off in a default world (the Hadza illness curve still covers it)', async () => {
  const { createWorld2 } = await import('../dist/world.js');
  const s = createWorld2(42, {});
  assert.ok(!s.config.disease?.pneumococcus);
  assert.ok(s.config.illnessShare > 0, 'the stand-in it would replace is still on');
});

test('R3 maxOf and minOf give exactly what Math.max and Math.min give, signed zeros, NaN and empty lists included', () => {
  const lists = [[], [0, -0], [-0, 0], [-0], [3, NaN, 5], [1e300, -1e300, 5], [-Infinity], [2, 2, 1]];
  let x = 7;
  for (let i = 0; i < 200; i++)
    lists.push(Array.from({ length: i % 17 }, () => ((x = (x * 16807) % 2147483647) / 2147483647 - 0.5) * 1e3));
  for (const a of lists) {
    assert.ok(Object.is(maxOf(a), Math.max(...a)), `max ${a}`);
    assert.ok(Object.is(minOf(a), Math.min(...a)), `min ${a}`);
  }
  assert.equal(maxOf(new Float32Array(3e6).fill(1)), 1, 'a whole large map');
});
