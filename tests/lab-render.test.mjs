// The renderer is display only: it must draw every state and never change the world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, labStep, ACTIONS } from '../dist/frozen/lab.js';
import { createRenderer, GLYPH, SHAPES } from '../dist/frozen/lab-render.js';
import { setDefaultClock } from '../dist/frozen/clock.js';
setDefaultClock('legacy'); // these tests pin the original (pre-17 Nov) behaviour; tests/clock.test.mjs covers the real clock

const calls = { n: 0 };
const fakeCtx = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : (...a) => { calls.n++; }, set: (t, k, v) => { t[k] = v; return true; } });
const fakeCanvas = (w, h) => ({ width: w, height: h, getContext: fakeCtx });

test('V1 drawing never changes the world, so visual work cannot change a result', () => {
  const a = createLab(41, { falseInformationRate: 0.1 }), b = createLab(41, { falseInformationRate: 0.1 });
  const render = createRenderer(fakeCanvas), g = fakeCtx();
  for (let t = 0; t < 600; t++) { labStep(a); labStep(b); if (t % 7 === 0) { const before = JSON.stringify(a); render(g, a, t % 24, t * 16); assert.equal(JSON.stringify(a), before); } }
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'a drawn world and an undrawn world have the same history');
  assert.ok(calls.n > 1000, 'something was drawn');
});

test('V2 every action has a sign, and creatures differ by shape as well as colour', () => {
  for (const a of ACTIONS) assert.ok(GLYPH[a], `no sign for ${a}`);
  assert.equal(new Set(Object.values(GLYPH)).size, ACTIONS.length, 'signs are distinct');
  assert.equal(SHAPES.length, 4);
});
