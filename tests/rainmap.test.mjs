// Layer 1: each place's yearly rain from measurements (dist/rainmap.js), the rule 17 fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RAIN_STATIONS,
  stationRainMm,
  rainShareFromHeights,
  rainShareFromMap,
  checkStations,
  BASIN_MM,
} from '../dist/rainmap.js';

test('RM1 the input stations are given back exactly, rain rises with height between them and stays flat beyond', () => {
  for (const s of RAIN_STATIONS.filter(x => x.role === 'input'))
    assert.equal(stationRainMm(s.m), (s.mm[0] + s.mm[1]) / 2);
  let last = 0;
  for (let m = 500; m <= 3000; m += 50) {
    const r = stationRainMm(m);
    assert.ok(r >= last);
    last = r;
  }
  assert.equal(stationRainMm(500), BASIN_MM);
});

test("RM2 shares: the basin gets the weather chain's rain (share 1); a measured map in mm passes through as its share", () => {
  assert.deepEqual([...rainShareFromHeights([1030, 800])], [1, 1]);
  assert.deepEqual([...rainShareFromMap([350, 700, -5])], [1, 2, 0]);
});

test('RM3 every check station is held out (not an input) and is reported, hit or miss', () => {
  const rows = checkStations();
  assert.equal(rows.length, RAIN_STATIONS.filter(s => s.role === 'check').length);
  for (const r of rows) assert.ok(Number.isFinite(r.got) && typeof r.within === 'boolean');
});
