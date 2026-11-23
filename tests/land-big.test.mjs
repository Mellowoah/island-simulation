// Layer 3, the bigger world (dist/land-big.js): its shape against measured heights, and built beside (rule 15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLandscape, heightAt, EYASI_HIGHLANDS as D } from '../dist/land-big.js';

const L = makeLandscape(),
  N = L.W,
  where = k => [((k % N) + 0.5) * D.tileKm - D.sizeKm / 2, (Math.floor(k / N) + 0.5) * D.tileKm - D.sizeKm / 2];
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
function zones() {
  const z = { basin: [], plateau: [], top: 0 };
  for (let k = 0; k < N * N; k++) {
    if (!L.land[k] || L.lake[k]) continue;
    const [x, y] = where(k),
      across = (x + y) * Math.SQRT1_2,
      offMassif = Math.hypot(x - D.massif.xKm, y - D.massif.yKm) > D.massif.radiusKm + 2;
    if (across < -10 && offMassif) z.basin.push(L.metres[k]);
    if (across > 10 && offMassif) z.plateau.push(L.metres[k]);
    z.top = Math.max(z.top, L.metres[k]);
  }
  return z;
}

test('TB1 about 10,000 km2 of land (9,000-11,000), with a lake', () => {
  const km2 = L.land.reduce((a, b) => a + b, 0) * D.tileKm ** 2,
    lake = L.lake.reduce((a, b) => a + b, 0);
  assert.ok(km2 > 9000 && km2 < 11000, `${km2} km2`);
  assert.ok(lake > 0);
});

test('TB2 measured heights: basin near Lake Eyasi (1,030-1,400 m), plateau inside the Mbulu Highlands range (1,500-2,300 m), nothing above Ngorongoro (3,648 m)', () => {
  const z = zones();
  assert.ok(median(z.basin) >= 1030 && median(z.basin) <= 1400, `basin ${median(z.basin)}`);
  assert.ok(median(z.plateau) >= 1500 && median(z.plateau) <= 2300, `plateau ${median(z.plateau)}`);
  assert.ok(z.top <= 3648, `top ${z.top}`);
});

test('TB3 an escarpment: across the scarp the land climbs at least 500 m within 8 km', () => {
  let rise = 0;
  for (let s = -20; s <= 0; s += 0.5) {
    const a = heightAt(s * Math.SQRT1_2, s * Math.SQRT1_2, D),
      b = heightAt((s + 8) * Math.SQRT1_2, (s + 8) * Math.SQRT1_2, D);
    rise = Math.max(rise, b - a);
  }
  assert.ok(rise >= 500, `${rise} m`);
});

test('TB4 built beside, not over (rule 15): a default world still runs on the island; the same map every time', async () => {
  const { createWorld2 } = await import('../dist/world.js');
  assert.equal(createWorld2(42, {}).map.id, 'island');
  const again = makeLandscape();
  assert.ok(again.metres.every((v, i) => v === L.metres[i]));
});
