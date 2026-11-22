// Rule 9 (exact speed-ups): the whole world state after one year on islands 42 and 43, hashed, plus wall time.
// A speed change must print the same hash as before it. Usage: node tools/state-hash.mjs [repo root]
import { createHash } from 'node:crypto';
const ROOT = process.argv[2] ?? new URL('..', import.meta.url).pathname;
const { createWorld2, stepWorld } = await import(ROOT + '/dist/world.js');
const h = createHash('sha256');
const t0 = Date.now();
for (const seed of [42, 43]) {
  const s = createWorld2(seed, {});
  stepWorld(s, 24 * 365);
  h.update(JSON.stringify(s, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v instanceof Map ? [...v] : v)));
}
console.log(h.digest('hex').slice(0, 16), ((Date.now() - t0) / 1000).toFixed(1) + ' s for 2 island-years');
