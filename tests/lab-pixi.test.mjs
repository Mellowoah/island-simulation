// Presentation helpers and Canvas fallback must not write to the world, and saves stay compatible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLab, labStep, labCommand, serializeLab, deserializeLab, LAB_SAVE_FORMAT } from '../dist/frozen/lab.js';
import { createRenderer, GLYPH, SHAPES } from '../dist/frozen/lab-render.js';
import { creaturePresentation, dayNightTint, hash } from '../dist/frozen/lab-look.js';
import { setDefaultClock } from '../dist/frozen/clock.js';
setDefaultClock('legacy'); // these tests pin the original (pre-17 Nov) behaviour; tests/clock.test.mjs covers the real clock

const fakeCtx = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : (...a) => {}, set: (t, k, v) => { t[k] = v; return true; } });
const fakeCanvas = (w, h) => ({ width: w, height: h, getContext: fakeCtx });

test('P1 creature presentation and day/night never write to the world', () => {
  const s = createLab(41);
  labStep(s, 200);
  labCommand(s, { type: 'boostTrust', amount: 20 });
  const before = JSON.stringify(s);
  for (const c of s.creatures) creaturePresentation(c, s, 1600);
  dayNightTint(s.tick);
  hash(3, 7);
  assert.equal(JSON.stringify(s), before);
});

test('P2 day/night is driven only by the existing clock', () => {
  assert.equal(dayNightTint(0).phase, 'night');
  assert.equal(dayNightTint(8 * 60).phase, 'day');
  assert.equal(dayNightTint(6 * 60 + 45).phase, 'dawn');
  assert.equal(dayNightTint(18 * 60).phase, 'dusk');
  assert.equal(dayNightTint(18 * 60).minutes, 18 * 60);
  assert.ok(dayNightTint(8 * 60).alpha === 0);
  assert.ok(dayNightTint(0).alpha > 0.2);
  assert.equal(dayNightTint(1440).minutes, 0);
});

test('P3 a v1 save still deserializes after the graphics work', () => {
  const s = createLab(41);
  labStep(s, 120);
  labCommand(s, { type: 'boostTrust', amount: 20 });
  const text = serializeLab(s, { seed: 41, selected: 2, paused: true, speed: 4 });
  assert.equal(JSON.parse(text).format, LAB_SAVE_FORMAT);
  assert.equal(JSON.parse(text).version, 1);
  const { world, ui } = deserializeLab(text);
  assert.equal(world.tick, s.tick);
  assert.equal(ui.speed, 4);
  assert.equal(world.creatures.length, 24);
});

test('P4 Canvas fallback still draws without changing the world', () => {
  const a = createLab(41), b = createLab(41);
  const render = createRenderer(fakeCanvas), g = fakeCtx();
  for (let t = 0; t < 200; t++) {
    labStep(a); labStep(b);
    if (t % 5 === 0) {
      const before = JSON.stringify(a);
      render(g, a, 0, t * 16);
      assert.equal(JSON.stringify(a), before);
    }
  }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(GLYPH.explore && SHAPES.length === 4);
});
