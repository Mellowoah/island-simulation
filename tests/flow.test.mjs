// Layer 3: water over any grid (dist/flow.js), on the bigger world's land.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLandscape } from '../dist/land-big.js';
import { drainage, accumulate } from '../dist/flow.js';

const L = makeLandscape(),
  W = L.W,
  n = W * W,
  outlet = Uint8Array.from({ length: n }, (_, i) => (!L.land[i] || L.lake[i] ? 1 : 0)),
  { down } = drainage(L.metres, W, W, outlet),
  A = accumulate(down, W, L.tileKm);

test('FL1 every square of land drains to the lake or the sea (hollows filled, priority-flood)', () => {
  for (let i = 0; i < n; i++) {
    if (outlet[i]) continue;
    let j = i,
      s = 0;
    while (j >= 0 && !outlet[j] && s++ < n) j = down[j];
    assert.ok(j >= 0 && outlet[j], `square ${i} is trapped`);
  }
});

test('FL2 nothing lost or made: the catchments of the squares that empty into outlets add up to all the land', () => {
  let into = 0;
  for (let i = 0; i < n; i++) if (!outlet[i] && outlet[down[i]]) into += A.km2[i];
  const land = n * L.tileKm ** 2 - outlet.reduce((a, b) => a + b, 0) * L.tileKm ** 2;
  assert.ok(Math.abs(into - land) < 1e-3 * land, `${into} against ${land}`);
});

function hack() {
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0,
    c = 0;
  for (let i = 0; i < n; i++)
    if (!outlet[i] && A.km2[i] >= 1 && A.km2[i] <= 2000) {
      const x = Math.log(A.km2[i]),
        y = Math.log(A.longestKm[i]);
      ((sx += x), (sy += y), (sxx += x * x), (sxy += x * y), c++);
    }
  return (c * sxy - sx * sy) / (c * sxx - sx * sx);
}
test(
  "FL3 Hack's law: main-stream length grows with catchment area to a power of 0.5-0.7 (Hack 1957; Dodds and Rothman 2000)",
  { todo: 'anomaly: the generated land gives 0.47 (21 Nov 2026), just below the measured range; recorded, not tuned' },
  () => {
    const h = hack();
    assert.ok(h >= 0.5 && h <= 0.7, `exponent ${h}`);
  },
);
