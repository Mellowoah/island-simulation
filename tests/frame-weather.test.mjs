// The frame's weather (dist/frame-weather.js): presentation only. Winterhaven's sky reads Open-Meteo's live
// weather for Winter Haven, Florida; the rest of the island shows the world's own sky for its day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOfCode, liveSky, worldSky, lakeCountry, WINTER_HAVEN } from '../dist/frame-weather.js';
import * as T from '../dist/terrain.js';
import { createWorld2, stepWorld } from '../dist/world.js';

test('FW1 weather codes read as the sky they name (WMO 4677, Open-Meteo)', () => {
  const k = c => kindOfCode(c)[0];
  assert.deepEqual([0, 2, 3, 45, 53, 63, 81, 75, 95].map(k), [
    'clear',
    'cloud',
    'cloud',
    'fog',
    'drizzle',
    'rain',
    'rain',
    'snow',
    'storm',
  ]);
});
test('FW2 a live reading becomes a sky: cover 0..1, rain per hour from the 15-minute total, wind in m/s', () => {
  const sky = liveSky({
    weather_code: 61,
    cloud_cover: 80,
    precipitation: 0.5,
    interval: 900,
    wind_speed_10m: 18,
    wind_direction_10m: 120,
    temperature_2m: 70.2,
  });
  assert.equal(sky.kind, 'rain');
  assert.equal(sky.cover, 0.8);
  assert.equal(sky.rain, 2);
  assert.equal(sky.wind, 5);
  assert.equal(liveSky({}), null, 'no reading, no live sky');
});
test("FW3 the world's own sky comes from its weather that day; reading it changes nothing", () => {
  const s = createWorld2(41, {});
  stepWorld(s, 24 * 20);
  const before = JSON.stringify(s.weather),
    sky = worldSky(s.weather);
  assert.ok(sky.cover >= 0 && sky.cover <= 1);
  assert.equal(sky.rain > 0, Boolean(s.weather.wet));
  assert.equal(JSON.stringify(s.weather), before);
});
test('FW4 Winterhaven sits on the lake: its middle is lake, its reach takes in the shore', () => {
  T.useMap('island');
  const h = lakeCountry(T.regionAt, T.TW, T.TH);
  assert.equal(T.regionAt(Math.floor(h.x), Math.floor(h.y)), 'lake');
  assert.ok(h.r > 6 && h.r < T.TW / 3);
  assert.equal(WINTER_HAVEN.place, 'Winter Haven, FL');
});
