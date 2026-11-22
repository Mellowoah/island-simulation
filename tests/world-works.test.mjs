// Rule 16: the whole world works. Each layer has its own checks; this one checks they still live together. Every
// world in WORLDS runs 5 years on two islands and must: not crash, keep people alive and having children, balance
// its water and food books, stay under a minute per island-year, and the page code must still parse.
// When the bigger world is built (rule 15, beside the working one), its config joins WORLDS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const WORLDS = { island: {} };
const YEARS = 5,
  SEEDS = [42, 43],
  MAX_SECONDS_PER_YEAR = 60;

async function lifeOf(config, seed) {
  const { createWorld2, stepWorld, living } = await import('../dist/world.js');
  const { weatherLedger } = await import('../dist/weather.js');
  const s = createWorld2(seed, config),
    t0 = Date.now();
  stepWorld(s, 24 * 365 * YEARS);
  const L = s.ledger,
    left = s.patches.reduce((n, q) => n + q.stock, 0);
  return {
    secondsPerYear: (Date.now() - t0) / 1000 / YEARS,
    alive: living(s).length,
    births: s.births,
    water: weatherLedger(s),
    foodError: Math.abs(L.initial + L.regenerated - L.consumed - L.decayed - left) / (L.initial + L.regenerated),
  };
}

for (const [name, config] of Object.entries(WORLDS))
  for (const seed of SEEDS)
    test(`WW ${name} world, island ${seed}: ${YEARS} years without a crash, people alive and having children, books balanced, under ${MAX_SECONDS_PER_YEAR} s a year`, async () => {
      const r = await lifeOf(config, seed);
      assert.ok(r.alive > 0, 'people alive at the end');
      assert.ok(r.births > 0, 'children born');
      assert.ok(r.foodError < 1e-6, `food books off by ${r.foodError}`);
      const W = r.water;
      assert.ok(Math.abs(W.soilError) < 1e-3 && Math.abs(W.holeError) < 1e-2 && Math.abs(W.groundError) < 1e-3, JSON.stringify(W));
      assert.ok(r.secondsPerYear < MAX_SECONDS_PER_YEAR, `${r.secondsPerYear.toFixed(1)} s per island-year`);
    });

test('WW the page code parses', () => {
  for (const f of ['world-app.js', 'world.js']) execFileSync('node', ['--check', new URL(`../dist/${f}`, import.meta.url).pathname]);
});
