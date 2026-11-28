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
  base: { rank: -1, plan: null, status: 'real', files: ['sim.js', 'streams.js', 'clock.js', 'layers.js', 'numbers.js'],
    note: 'time, chance keys and the register of numbers; clock.js also reads the sun for darkness' },
  sun: { rank: 0, plan: 0, status: 'real', files: ['sun.js'], gate: 'admitted' },
  air: { rank: 1, plan: 1, status: 'real', files: ['atmosphere.js', 'rain-years.js', 'orographic.js', 'rainmap.js'], gate: 'admitted' },
  terrain: { rank: 2, plan: 3, status: 'real', files: ['terrain.js'], real: ['land.js', 'land-big.js', 'flow.js'], toggle: 'config.layers.terrain',
    note: 'heights in metres, flow accumulation and catchments over the map (land.js); gate passed 20 Nov 2026; the map itself is still generated, with no erosion, soil or nutrients yet' },
  water: { rank: 3, plan: 2, status: 'real', files: ['weather.js'], real: ['water.js'], toggle: 'config.layers.water',
        note: 'FAO Penman-Monteith, SCS runoff, HBV percolation, stream channels and groundwater; gate passed 19 Nov 2026; catchScale retired by Layer 3 catchments; curve numbers from land cover (TR-55 composite); rivers are losing streams (20 Nov)' },
  plants: { rank: 4, plan: 4, status: 'real', files: ['savanna.js'], real: ['plants.js', 'yields.js'], toggle: 'config.layers.plants',
    note: 'herb layer grows from transpired water (plants.js); food grown from measured yields per km2 (yields.js), no people density; each year follows the plants; gate passed 20 Nov 2026. fish, shellfish and honey yields moved to Layer 5 (fauna.js)' },
  animals: { rank: 5, plan: 5, status: 'real', files: ['nature.js'], real: ['fauna.js'], toggle: 'config.layers.animals',
    note: 'herds at field-count densities that follow the plants year and graze the herb layer, starving if it runs short (fauna.js); gate passed 20 Nov 2026; no predators of their own yet (field counts carry them)' },
  people: { rank: 6, plan: 6, status: 'stand-in',
    files: ['being.js', 'body.js', 'energy.js', 'feelings.js', 'learning.js', 'world.js', 'w-checks.js',
      'w-core.js', 'w-craft.js', 'w-food.js', 'w-meat.js', 'w-mind.js', 'w-move.js', 'w-people.js', 'w-social.js', 'w-memo.js'],
    real: ['disease.js'], toggle: 'config.disease.pneumococcus',
    note: 'the existing people; to be rebuilt on one currency (survival and reproduction) and body heat balance' },
  measures: { rank: 7, plan: null, status: 'real', files: ['patterns.js', 'price.js'],
    note: 'scoring and measuring only; nothing in the world reads them' },
  display: { rank: 8, plan: null, status: 'real', files: ['world-app.js', 'frame.js', 'frame-render.js', 'frame-weather.js', 'frame-sky.js', 'frame-people.js', 'frame-world.js', 'frame3d.js', 'frame3d-land.js', 'frame3d-life.js', 'frame3d-stage.js'], note: 'the pages that draw the world (the app, and the picture frame)' },
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
