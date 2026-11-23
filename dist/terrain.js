// Island: the land of the small world (Robert, 17 Nov: "make the island bigger … a better shape than that circle …
// more of an island look"; "the size to be comparable to how people lived").
//
// About 56 x 39 km at 350 m a tile, about 1,000 km² of land: room for roughly 240 people at the Hadza density of
// 0.24 per km², so a first band of ~30 has far more land than it knows. The same island every run (a fixed land seed),
// so runs compare on the same ground.
//
// Made the way landscapes are usually generated: layered value noise (fractal Brownian motion), bent by a second
// noise (domain warp) for ragged bays and headlands, plus a broad rise toward the middle so it is one main island
// with a few islets. Hills are the high ground; one lake fills the lowest inland basin; rivers run downhill from
// the hills by steepest descent to the lake or the sea; woodland follows water; grass covers the rest.

import { registerMap } from './sim.js';
import { maxOf, minOf } from './numbers.js';
import { drainage } from './flow.js';
import { makeLandscape } from './land-big.js';

export let TW = 160,
  TH = 112;
export const TILE_KM = 0.35;
const LAND_SEED = 20261117;
export const REGIONS = ['sea', 'lake', 'river', 'rock', 'shore', 'woodland', 'grass'];
const R = Object.fromEntries(REGIONS.map((r, i) => [r, i]));

// ---------- noise ----------
const hash = (x, y, k) => {
  let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(k, 1274126177) ^ LAND_SEED) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = t => t * t * (3 - 2 * t);
function value(x, y, k) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    fx = smooth(x - x0),
    fy = smooth(y - y0);
  const a = hash(x0, y0, k),
    b = hash(x0 + 1, y0, k),
    c = hash(x0, y0 + 1, k),
    d = hash(x0 + 1, y0 + 1, k);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, k, oct = 5) {
  let s = 0,
    amp = 0.5,
    f = 1,
    n = 0;
  for (let o = 0; o < oct; o++) {
    s += amp * value(x * f, y * f, k + o * 17);
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / n;
}

// ---------- the map in use: one set of grids at a time ----------
// Every function below reads these; a world on another map swaps them in (useMap, to come). Built here for the
// island, step by step in the same order as before, so the island is the same to the last bit (state hash).
let elev, grid, comp, main, coastDist, landIdx, byElev;
export let RIVERS, DOWN, MAIN_TILES, LAND_KM2;
export let METRES = null; // heights in metres, for maps that have them (the island's come from land.js scaling)
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const inside = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH;

// ---------- elevation ----------
function islandHeights() {
  const out = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      const u = x / TW,
        v = y / TH;
      const wx = (fbm(u * 3, v * 3, 101) - 0.5) * 0.7,
        wy = (fbm(u * 3, v * 3, 202) - 0.5) * 0.7; // domain warp
      const dx = (u + wx * 0.45 - 0.5) / 0.5,
        dy = (v + wy * 0.45 - 0.5) / 0.48,
        d = Math.hypot(dx, dy);
      const rise = 1 - Math.min(1, d) ** 2;
      out[y * TW + x] =
        0.55 * fbm(u * 6 + wx * 2, v * 6 + wy * 2, 303, 6) +
        0.2 * (fbm(u * 20, v * 20, 313, 3) - 0.5) +
        0.55 * rise -
        0.09;
    }
  return out;
}
// Land above sea level is grass to begin with; the edge of the map is always sea.
function seaAndLand(sea) {
  grid = new Uint8Array(TW * TH);
  for (let i = 0; i < TW * TH; i++) grid[i] = elev[i] > sea ? R.grass : R.sea;
  for (let x = 0; x < TW; x++) ((grid[x] = R.sea), (grid[(TH - 1) * TW + x] = R.sea));
  for (let y = 0; y < TH; y++) ((grid[y * TW] = R.sea), (grid[y * TW + TW - 1] = R.sea));
}
// The main island is the largest piece of land; the rest are islets (seen from the shore, out of reach on foot).
function components() {
  const comp = new Int32Array(TW * TH).fill(-1),
    sizes = [];
  for (let i = 0; i < TW * TH; i++)
    if (grid[i] !== R.sea && comp[i] < 0) {
      const id = sizes.length,
        q = [i];
      comp[i] = id;
      let n = 0;
      while (q.length) {
        const j = q.pop();
        n++;
        const x = j % TW,
          y = (j / TW) | 0;
        for (const [ax, ay] of N4) {
          const nx = x + ax,
            ny = y + ay,
            k = ny * TW + nx;
          if (inside(nx, ny) && grid[k] !== R.sea && comp[k] < 0) ((comp[k] = id), q.push(k));
        }
      }
      sizes.push(n);
    }
  return { comp, main: sizes.indexOf(maxOf(sizes)) };
}
// Distance in tiles from the squares where is(i) holds (breadth-first), e.g. to the sea.
function distanceFrom(is) {
  const dist = new Int32Array(TW * TH).fill(1e6),
    q = [];
  for (let i = 0; i < TW * TH; i++) if (is(i)) ((dist[i] = 0), q.push(i));
  for (let h = 0; h < q.length; h++) {
    const j = q[h],
      x = j % TW,
      y = (j / TW) | 0;
    for (const [ax, ay] of N4) {
      const nx = x + ax,
        ny = y + ay,
        k = ny * TW + nx;
      if (inside(nx, ny) && dist[k] > dist[j] + 1) ((dist[k] = dist[j] + 1), q.push(k));
    }
  }
  return dist;
}

// ---------- hills ----------
function hills(rockShare) {
  landIdx = [];
  for (let i = 0; i < TW * TH; i++) if (comp[i] === main) landIdx.push(i);
  byElev = [...landIdx].sort((a, b) => elev[b] - elev[a]);
  for (let k = 0; k < byElev.length * rockShare; k++) grid[byElev[k]] = R.rock;
}

// ---------- the lake: flood the lowest inland basin ----------
function lakeAt(seed, level) {
  const lake = new Set([seed]),
    q = [seed];
  while (q.length) {
    const j = q.pop(),
      x = j % TW,
      y = (j / TW) | 0;
    for (const [ax, ay] of N4) {
      const nx = x + ax,
        ny = y + ay,
        k = ny * TW + nx;
      const ok = inside(nx, ny) && !lake.has(k) && comp[k] === main && grid[k] !== R.rock && coastDist[k] >= 8;
      if (ok && Math.hypot(nx - (seed % TW), ny - ((seed / TW) | 0)) <= 13 && elev[k] <= level)
        (lake.add(k), q.push(k));
    }
  }
  return lake;
}
function floodLake() {
  const inland = landIdx.filter(i => coastDist[i] >= 16 && grid[i] !== R.rock);
  const seed = inland.reduce((b, i) => (elev[i] < elev[b] ? i : b), inland[0]);
  let level = elev[seed],
    lake = new Set([seed]);
  for (let step = 0; step < 400 && lake.size < 260; step++) {
    level += 0.002;
    lake = lakeAt(seed, level);
  }
  for (const i of lake) grid[i] = R.lake;
}

// ---------- rivers: water runs downhill to the lake or the sea ----------
// Hollows are filled first (priority-flood, Barnes et al. 2014, flow.js), so every drop of water has a way out (the
// sea counts as -1, the lake as its own height); then rivers start at high springs and follow the way down.
function route() {
  const base = Float32Array.from(elev, (h, i) => (grid[i] === R.sea ? -1 : h)),
    outlet = Uint8Array.from(grid, g => (g === R.sea || g === R.lake ? 1 : 0));
  DOWN = drainage(base, TW, TH, outlet).down;
}
function riverSources(count) {
  const high = byElev.slice(0, Math.floor(byElev.length * 0.2)).filter(i => grid[i] !== R.lake && coastDist[i] >= 10);
  const sources = [];
  for (const i of high) {
    if (sources.length >= count) break;
    const x = i % TW,
      y = (i / TW) | 0;
    if (sources.every(j => Math.hypot((j % TW) - x, ((j / TW) | 0) - y) > 18)) sources.push(i);
  }
  return sources;
}
function rivers(count) {
  RIVERS = [];
  for (const src of riverSources(count)) {
    const tiles = [];
    for (let j = src; j >= 0 && grid[j] !== R.sea && grid[j] !== R.lake; j = DOWN[j]) {
      tiles.push(j);
      if (grid[j] === R.river) break;
    }
    if (tiles.length < 12) continue;
    for (const i of tiles) if (grid[i] !== R.rock) grid[i] = R.river;
    RIVERS.push(tiles.map(i => [i % TW, (i / TW) | 0]));
  }
}

// ---------- shore, woodland, grass ----------
const RING2 = [
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];
const near = (x, y, ring, r) => ring.some(([ax, ay]) => inside(x + ax, y + ay) && grid[(y + ay) * TW + x + ax] === r);
function cover() {
  const wet = distanceFrom(i => grid[i] === R.river || grid[i] === R.lake),
    highWood = elev[byElev[Math.floor(byElev.length * 0.2)]];
  for (let i = 0; i < TW * TH; i++) {
    if (grid[i] !== R.grass) continue;
    const x = i % TW,
      y = (i / TW) | 0;
    if (coastDist[i] <= 1 || near(x, y, N4, R.lake) || near(x, y, RING2, R.lake)) grid[i] = R.shore;
    else if (wet[i] <= 4 || (elev[i] > highWood && fbm(x / 9, y / 9, 404, 3) > 0.45)) grid[i] = R.woodland;
  }
}

// The island: the same steps as always, in the same order.
function buildIsland() {
  elev = islandHeights();
  seaAndLand(0.42);
  ({ comp, main } = components());
  coastDist = distanceFrom(i => grid[i] === R.sea);
  hills(0.05);
  floodLake();
  route();
  rivers(9);
  cover();
  MAIN_TILES = landIdx.filter(i => grid[i] !== R.lake).length;
  LAND_KM2 = MAIN_TILES * TILE_KM * TILE_KM;
}
// ---------- more than one map ----------
// Each built map is kept as its set of grids; useMap swaps one in, and code that worked something out from the map
// once (land.js, w-core.js, nature.js) redoes it through onMapChange. A world selects its map when it is made and
// before every step (world.js), so worlds on different maps can run in turn.
const BUILT = new Map(),
  HOOKS = [];
let CURRENT = null;
const snapshot = () => ({
  TW,
  TH,
  elev,
  grid,
  comp,
  main,
  coastDist,
  landIdx,
  byElev,
  RIVERS,
  DOWN,
  MAIN_TILES,
  LAND_KM2,
  METRES,
});
function restore(m) {
  ({ TW, TH, elev, grid, comp, main, coastDist, landIdx, byElev, RIVERS, DOWN, MAIN_TILES, LAND_KM2, METRES } = m);
}
export const onMapChange = fn => HOOKS.push(fn);
export const mapInUse = () => CURRENT;
export const knownMaps = () => [...BUILT.keys()];
export function useMap(id = 'island') {
  if (id === CURRENT) return;
  if (!BUILT.has(id) && BUILDERS[id]) (BUILDERS[id](), BUILT.set(id, snapshot()));
  if (!BUILT.has(id)) throw new Error(`unknown map: ${id}`);
  restore(BUILT.get(id));
  CURRENT = id;
  for (const fn of HOOKS) fn(id);
}
buildIsland();
BUILT.set('island', snapshot());
CURRENT = 'island';

// The bigger world (land-big.js): the basin, escarpment and highlands around Lake Eyasi, about 10,000 km2, heights in
// metres. The same steps as the island's, with its own lake; rivers in proportion to land (the island's 9 sources per
// its 850 km2). Built on first use, then kept; the island stays the map in use until a world asks for this one.
function buildEyasi() {
  const L = makeLandscape();
  [TW, TH, METRES] = [L.W, L.H, L.metres];
  elev = L.metres;
  grid = Uint8Array.from(L.land, (land, i) => (!land ? R.sea : L.lake[i] ? R.lake : R.grass));
  ({ comp, main } = components());
  coastDist = distanceFrom(i => grid[i] === R.sea);
  hills(0.05);
  route();
  const islandLand = BUILT.get('island').LAND_KM2;
  rivers(Math.round((9 * landIdx.length * TILE_KM * TILE_KM) / islandLand));
  cover();
  MAIN_TILES = landIdx.filter(i => grid[i] !== R.lake).length;
  LAND_KM2 = MAIN_TILES * TILE_KM * TILE_KM;
  registerMap({ id: 'eyasi', w: TW, h: TH, land: walkable, regionAt, tileKm: TILE_KM });
}
const BUILDERS = { eyasi: buildEyasi };

export const regionAt = (x, y) => (inside(x, y) ? REGIONS[grid[y * TW + x]] : 'sea');
export const onMainland = (x, y) => inside(x, y) && comp[y * TW + x] === main;
const walkable = (x, y) => {
  if (!inside(x, y)) return false;
  const g = grid[y * TW + x];
  return g !== R.sea && g !== R.lake && comp[y * TW + x] === main;
};
export const ISLAND_MAP = registerMap({ id: 'island', w: TW, h: TH, land: walkable, regionAt, tileKm: TILE_KM });
export const regionGrid = () => grid; // read-only use (renderer)
export const elevation = (x, y) => elev[y * TW + x];
export const isWalkable = walkable;

// ---------- places: food and water by habitat ----------
// A fixed spread of candidate spots (a jittered grid), each given the food that suits its region. The same for every run.
export function foodSites() {
  const out = [];
  const step = 6;
  for (let gy = 2; gy < TH - 2; gy += step)
    for (let gx = 2; gx < TW - 2; gx += step) {
      const x = gx + Math.floor(hash(gx, gy, 505) * step),
        y = gy + Math.floor(hash(gx, gy, 606) * step);
      if (!walkable(x, y)) continue;
      out.push({ x, y, region: regionAt(x, y), r: hash(gx, gy, 707) });
    }
  return out;
}
// Water sites, in this order (the order sets their ids): lakeshore, springs, river reaches, rain pans
const touches = (x, y, r) => N4.some(([ax, ay]) => inside(x + ax, y + ay) && grid[(y + ay) * TW + x + ax] === r);
function shoreSites(add) {
  // lakeshore every ~8 tiles
  for (let i = 0; i < TW * TH; i++) {
    const x = i % TW,
      y = (i / TW) | 0;
    if (grid[i] === R.shore && touches(x, y, R.lake)) add(x, y, 'lake', 'Lakeshore', 8);
  }
}
function springSites(add) {
  // springs at the foot of the hills
  for (let i = 0; i < TW * TH; i++) {
    const x = i % TW,
      y = (i / TW) | 0;
    if (grid[i] !== R.rock && comp[i] === main && touches(x, y, R.rock) && hash(x, y, 808) < 0.08)
      add(x, y, 'spring', 'Spring', 14);
  }
}
function riverSites(add) {
  // river: upper reaches run in the wet season; the last stretch before the lake or the sea keeps pools
  for (const river of RIVERS)
    river.forEach(([x, y], k) => {
      if (k % 9 === 4)
        add(x, y, k > river.length - 10 ? 'pools' : 'river', k > river.length - 10 ? 'River pools' : 'River', 6);
    });
}
function panSites(add) {
  // rain pans in the open grass
  for (let i = 0; i < TW * TH; i++) {
    const x = i % TW,
      y = (i / TW) | 0;
    if (grid[i] === R.grass && hash(x, y, 909) < 0.012) add(x, y, 'pan', 'Rain pan', 12);
  }
}
export function waterSites() {
  const out = [],
    taken = [];
  const far = (x, y, d) => taken.every(([a, b]) => Math.abs(a - x) + Math.abs(b - y) >= d);
  const add = (x, y, kind, name, d) => {
    if (walkable(x, y) && far(x, y, d)) {
      taken.push([x, y]);
      out.push({ x, y, kind, name });
    }
  };
  for (const sites of [shoreSites, springSites, riverSites, panSites]) sites(add);
  return out.map((w, i) => ({ ...w, id: 'v' + i, name: `${w.name} ${i + 1}` }));
}
