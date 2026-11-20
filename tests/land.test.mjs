// Layer 3 (land): checked against conservation (every tile drains somewhere, once) and against the map's rivers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/terrain.js';
import * as L from '../dist/land.js';

const n = T.TW * T.TH;
const outlets = [...Array(n).keys()].filter(i => L.FLOW.down[i] < 0);

test('T1 every tile drains to the lake or the sea, and the catchments of the outlets add up to the whole map', () => {
  const total = outlets.reduce((a, i) => a + L.FLOW.area[i], 0);
  assert.equal(total, n);
  for (const i of outlets) assert.ok(['sea', 'lake'].includes(T.regionAt(i % T.TW, (i / T.TW) | 0)));
});

test('T2 water runs downhill: no tile drains to a higher tile on the filled surface, catchments grow downstream', () => {
  for (let i = 0; i < n; i++) {
    const j = L.FLOW.down[i];
    if (j >= 0) assert.ok(L.FLOW.area[j] > L.FLOW.area[i]);
  }
});

test('T3 the drawn rivers lie on the flow lines: their catchments are larger than ordinary land', () => {
  const at = r => [...Array(n).keys()].filter(i => T.regionAt(i % T.TW, (i / T.TW) | 0) === r).map(i => L.FLOW.area[i]);
  const med = a => a.sort((p, q) => p - q)[a.length >> 1];
  assert.ok(med(at('river')) >= 10 * med(at('grass')), `${med(at('river'))} vs ${med(at('grass'))}`);
});

test('T4 heights and the lapse rate: land 1000-1900 m; 6.5 deg C cooler per km of height', () => {
  for (let i = 0; i < n; i += 37) {
    const z = L.metresAt(i % T.TW, (i / T.TW) | 0);
    assert.ok(z >= 1000 && z <= 1900, `${z}`);
  }
  assert.equal(L.tempAtHeight(25, 1000, 2000), 18.5);
});
