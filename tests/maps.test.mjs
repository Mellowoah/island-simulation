// The map a world runs on (terrain.js useMap): rule 15, the bigger world beside the island.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/terrain.js';
import * as Land from '../dist/land.js';

test('MP1 the island is the map in use unless a world asks for another; asking again changes nothing', () => {
  assert.equal(T.mapInUse(), 'island');
  const before = [T.TW, T.TH, T.LAND_KM2, Land.REF_M, Land.FLOW];
  T.useMap('island');
  assert.deepEqual([T.TW, T.TH, T.LAND_KM2, Land.REF_M, Land.FLOW], before);
  assert.ok(T.knownMaps().includes('island'));
});

test('MP2 an unknown map is refused, and the map in use is left as it was', () => {
  assert.throws(() => T.useMap('atlantis'), /unknown map/);
  assert.equal(T.mapInUse(), 'island');
});

test('MP3 a world made without a map runs on the island and says so', async () => {
  const { createWorld2 } = await import('../dist/world.js');
  const s = createWorld2(42, {});
  assert.deepEqual(s.map, { id: 'island' });
  assert.equal(s.config.map, undefined, 'the default config is unchanged');
});
