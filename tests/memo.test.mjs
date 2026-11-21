// Speed work must change nothing: memos give the same values as working them out fresh, and the shortcuts compute
// exactly what the code they replace did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMemos } from '../dist/w-memo.js';
import { ageFactor, AGE_RETURN } from '../dist/savanna.js';

test('M1 the age row without copying the table equals the old reverse().find, at every age', () => {
  for (const hard of [false, true]) {
    const table = AGE_RETURN[hard ? 'hard' : 'easy'];
    for (let a = -1; a <= 90; a += 0.05) {
      const old = [...table].reverse().find(([x]) => a >= x)?.[1] ?? table[0][1];
      assert.equal(ageFactor(a, hard), old, `${hard} ${a}`);
    }
  }
});

test('M2 memo check: 60 days on an island with every memo also worked out fresh and compared', async () => {
  const { createWorld2, stepWorld } = await import('../dist/world.js');
  checkMemos(true);
  try {
    const s = createWorld2(42, {});
    stepWorld(s, 24 * 60);
  } finally {
    checkMemos(false);
  }
});
