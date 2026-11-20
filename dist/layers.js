// ---------- The layer switchboard ----------
// Every file of the small world belongs to one layer; each layer is either real (built from the physics and
// checked) or a stand-in (older code keeping the world running until the real layer passes its gate).
// Rules, all checked automatically (tests/layers.test.mjs, tools/gate.mjs, tools/ship.sh):
// 1. A layer becomes real only by changing its status here, and only with a passing gate record
//    (docs/gates/<layer>.json) whose code hashes match the files as they are.
// 2. Downhill only: a file may import from its own layer, a lower layer, or the base (time, chance, register).
// 3. Contracts: what each layer hands upward stays in physical range (tests/contracts.test.mjs).
// 4. Stand-ins are listed with what feeds them, so a real layer feeding a temporary one is always visible.
// Ranks follow the physics: the land's shape sits under the water that runs over it. Robert's numbering
// (energy 0, atmosphere 1, water 2, terrain and soil 3, plants 4, animals 5, agents 6) is kept as `plan`.

export const LAYERS = {
  base: { rank: -1, plan: null, status: 'real', files: ['sim.js', 'streams.js', 'clock.js'],
    note: 'time, chance keys and the register of numbers; clock.js also reads the sun for darkness' },
  sun: { rank: 0, plan: 0, status: 'real', files: ['sun.js'], gate: 'admitted' },
  air: { rank: 1, plan: 1, status: 'real', files: ['atmosphere.js', 'rain-years.js'], gate: 'admitted' },
  terrain: { rank: 2, plan: 3, status: 'stand-in', files: ['terrain.js'],
    note: 'a fixed generated map; no erosion, sediment or nutrients yet' },
  water: { rank: 3, plan: 2, status: 'stand-in', files: ['weather.js'], real: ['water.js'],
    note: 'old soil bucket and hole rule; water.js is built and tested but not yet through its gate' },
  plants: { rank: 4, plan: 4, status: 'stand-in', files: ['savanna.js'],
    note: 'food patches that regrow; not yet growth from light, water and nutrients' },
  animals: { rank: 5, plan: 5, status: 'stand-in', files: ['nature.js'],
    note: 'herds with a carrying capacity; no predators or population dynamics yet' },
  people: { rank: 6, plan: 6, status: 'stand-in',
    files: ['being.js', 'body.js', 'energy.js', 'feelings.js', 'learning.js', 'world.js', 'w-checks.js',
      'w-core.js', 'w-craft.js', 'w-food.js', 'w-meat.js', 'w-mind.js', 'w-move.js', 'w-people.js', 'w-social.js'],
    note: 'the existing people; to be rebuilt on one currency (survival and reproduction) and body heat balance' },
  measures: { rank: 7, plan: null, status: 'real', files: ['patterns.js', 'price.js'],
    note: 'scoring and measuring only; nothing in the world reads them' },
  display: { rank: 8, plan: null, status: 'real', files: ['world-app.js'], note: 'the page that draws the world' },
};

// The layer a file belongs to (null if none: rule 1 of tests/layers.test.mjs forbids that)
export function layerOf(file) {
  for (const [name, L] of Object.entries(LAYERS)) if (L.files.includes(file) || L.real?.includes(file)) return name;
  return null;
}

// May a file in layer `from` import from layer `to`? Downhill, own layer, or the base.
export const allowed = (from, to) => to === 'base' || LAYERS[to].rank <= LAYERS[from].rank;

// The stand-ins and what real layers feed them (lower-ranked real layers)
export function standIns() {
  const real = Object.entries(LAYERS).filter(([, L]) => L.status === 'real' && L.rank >= 0 && L.rank <= 6);
  return Object.entries(LAYERS)
    .filter(([, L]) => L.status === 'stand-in')
    .map(([name, L]) => ({ name, note: L.note, fedBy: real.filter(([, R]) => R.rank < L.rank).map(([n]) => n) }));
}
