// Fingerprint of every engine: the small world, Eden, the Lab island, the old island (sim.js) and a Lab16 run.
// Each is run a short while on three seeds and its whole state hashed. Two code versions that should behave the same
// (a refactor, a reformat) must print the same five hashes. Usage: node tools/fingerprint-all.mjs
import { createHash } from 'node:crypto';
const D = '../dist/', F = '../dist/frozen/'; // the small world is live; the other engines are frozen copies
const hashOf = x => createHash('sha256').update(JSON.stringify(x, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))).digest('hex').slice(0, 12);
const runs = {
  world: async seed => { const m = await import(D + 'world.js'); const s = m.createWorld2(seed); m.stepWorld(s, 24 * 40); return s; },
  eden: async seed => { const m = await import(F + 'eden.js'); const s = m.createEden(seed); m.edenStep(s, 1440 * 4); return s; },
  lab: async seed => { const m = await import(F + 'lab.js'); const s = m.createLab(seed); m.labStep(s, 1440 * 2); return s; },
  sim: async seed => { const m = await import(F + 'sim.js'); const s = m.createWorld(seed); m.step(s, 1440 * 2); return s; },
  lab16: async seed => { const m = await import(F + 'lab16-run.js'); const r = m.createRun({ seed }); m.stepRun(r, 1440 * 2); return r.world ?? r; },
};
for (const [name, run] of Object.entries(runs)) {
  const parts = [];
  for (const seed of [1, 2, 3]) parts.push(hashOf(await run(seed)));
  console.log(name.padEnd(6), hashOf(parts));
}
