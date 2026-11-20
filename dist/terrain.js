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

export const TW = 160,
  TH = 112,
  TILE_KM = 0.35;
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

// ---------- elevation ----------
const elev = new Float32Array(TW * TH);
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
    elev[y * TW + x] =
      0.55 * fbm(u * 6 + wx * 2, v * 6 + wy * 2, 303, 6) +
      0.2 * (fbm(u * 20, v * 20, 313, 3) - 0.5) +
      0.55 * rise -
      0.09;
  }
const SEA = 0.42;
const grid = new Uint8Array(TW * TH);
for (let i = 0; i < TW * TH; i++) grid[i] = elev[i] > SEA ? R.grass : R.sea;
// keep the edge sea
for (let x = 0; x < TW; x++) {
  grid[x] = R.sea;
  grid[(TH - 1) * TW + x] = R.sea;
}
for (let y = 0; y < TH; y++) {
  grid[y * TW] = R.sea;
  grid[y * TW + TW - 1] = R.sea;
}

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const inside = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH;
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
          if (inside(nx, ny) && grid[k] !== R.sea && comp[k] < 0) {
            comp[k] = id;
            q.push(k);
          }
        }
      }
      sizes.push(n);
    }
  return { comp, main: sizes.indexOf(Math.max(...sizes)) };
}
let { comp, main } = components();
// Distance to the sea, in tiles (for the lake, the shore and the hills).
const coastDist = new Int32Array(TW * TH).fill(1e6);
{
  const q = [];
  for (let i = 0; i < TW * TH; i++)
    if (grid[i] === R.sea) {
      coastDist[i] = 0;
      q.push(i);
    }
  for (let h = 0; h < q.length; h++) {
    const j = q[h],
      x = j % TW,
      y = (j / TW) | 0;
    for (const [ax, ay] of N4) {
      const nx = x + ax,
        ny = y + ay,
        k = ny * TW + nx;
      if (inside(nx, ny) && coastDist[k] > coastDist[j] + 1) {
        coastDist[k] = coastDist[j] + 1;
        q.push(k);
      }
    }
  }
}

// ---------- hills ----------
const landIdx = [];
for (let i = 0; i < TW * TH; i++) if (comp[i] === main) landIdx.push(i);
const byElev = [...landIdx].sort((a, b) => elev[b] - elev[a]);
const ROCK_SHARE = 0.05;
for (let k = 0; k < byElev.length * ROCK_SHARE; k++) grid[byElev[k]] = R.rock;

// ---------- the lake: flood the lowest inland basin ----------
{
  const inland = landIdx.filter(i => coastDist[i] >= 16 && grid[i] !== R.rock);
  const seed = inland.reduce((b, i) => (elev[i] < elev[b] ? i : b), inland[0]);
  let level = elev[seed],
    lake = new Set([seed]);
  for (let step = 0; step < 400 && lake.size < 260; step++) {
    level += 0.002;
    lake = new Set([seed]);
    const q = [seed];
    while (q.length) {
      const j = q.pop(),
        x = j % TW,
        y = (j / TW) | 0;
      for (const [ax, ay] of N4) {
        const nx = x + ax,
          ny = y + ay,
          k = ny * TW + nx;
        if (
          inside(nx, ny) &&
          !lake.has(k) &&
          comp[k] === main &&
          grid[k] !== R.rock &&
          coastDist[k] >= 8 &&
          Math.hypot(nx - (seed % TW), ny - ((seed / TW) | 0)) <= 13 &&
          elev[k] <= level
        ) {
          lake.add(k);
          q.push(k);
        }
      }
    }
  }
  for (const i of lake) grid[i] = R.lake;
}

// ---------- rivers: water runs downhill to the lake or the sea ----------
// Hollows are filled first (priority-flood, Barnes et al. 2014), so every drop of water has a way out; then rivers
// start at high springs and follow the steepest way down the filled surface.
export const RIVERS = [];
// Which tile each tile drains to (-1 at the lake and the sea); read by the land layer (land.js)
export let DOWN;
{
  const filled = new Float32Array(elev),
    done = new Uint8Array(TW * TH),
    heap = [];
  const push = i => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (filled[heap[p]] <= filled[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1,
          r = l + 1;
        let m = k;
        if (l < heap.length && filled[heap[l]] < filled[heap[m]]) m = l;
        if (r < heap.length && filled[heap[r]] < filled[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  for (let i = 0; i < TW * TH; i++)
    if (grid[i] === R.sea || grid[i] === R.lake) {
      done[i] = 1;
      filled[i] = grid[i] === R.lake ? elev[i] : -1;
      push(i);
    }
  const down = new Int32Array(TW * TH).fill(-1);
  DOWN = down;
  while (heap.length) {
    const j = pop(),
      x = j % TW,
      y = (j / TW) | 0;
    for (const [ax, ay] of N4) {
      const nx = x + ax,
        ny = y + ay,
        k = ny * TW + nx;
      if (!inside(nx, ny) || done[k]) continue;
      done[k] = 1;
      filled[k] = Math.max(filled[k], filled[j] + 1e-5);
      down[k] = j;
      push(k);
    }
  }
  const high = byElev.slice(0, Math.floor(byElev.length * 0.2)).filter(i => grid[i] !== R.lake && coastDist[i] >= 10);
  const sources = [];
  for (const i of high) {
    if (sources.length >= 9) break;
    const x = i % TW,
      y = (i / TW) | 0;
    if (sources.every(j => Math.hypot((j % TW) - x, ((j / TW) | 0) - y) > 18)) sources.push(i);
  }
  for (const src of sources) {
    const tiles = [];
    for (let j = src; j >= 0 && grid[j] !== R.sea && grid[j] !== R.lake; j = down[j]) {
      if (grid[j] === R.river) {
        tiles.push(j);
        break;
      }
      tiles.push(j);
    }
    if (tiles.length < 12) continue;
    for (const i of tiles) if (grid[i] !== R.rock) grid[i] = R.river;
    RIVERS.push(tiles.map(i => [i % TW, (i / TW) | 0]));
  }
}

// ---------- shore, woodland, grass ----------
{
  const wet = new Int32Array(TW * TH).fill(1e6),
    q = [];
  for (let i = 0; i < TW * TH; i++)
    if (grid[i] === R.river || grid[i] === R.lake) {
      wet[i] = 0;
      q.push(i);
    }
  for (let h = 0; h < q.length; h++) {
    const j = q[h],
      x = j % TW,
      y = (j / TW) | 0;
    for (const [ax, ay] of N4) {
      const nx = x + ax,
        ny = y + ay,
        k = ny * TW + nx;
      if (inside(nx, ny) && wet[k] > wet[j] + 1) {
        wet[k] = wet[j] + 1;
        q.push(k);
      }
    }
  }
  for (let i = 0; i < TW * TH; i++) {
    if (grid[i] !== R.grass) continue;
    const x = i % TW,
      y = (i / TW) | 0;
    const nearSea = coastDist[i] <= 1,
      nearLake =
        N4.some(([ax, ay]) => inside(x + ax, y + ay) && grid[(y + ay) * TW + x + ax] === R.lake) ||
        [
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ].some(([ax, ay]) => inside(x + ax, y + ay) && grid[(y + ay) * TW + x + ax] === R.lake);
    if (nearSea || nearLake) grid[i] = R.shore;
    else if (
      wet[i] <= 4 ||
      (elev[i] > elev[byElev[Math.floor(byElev.length * 0.2)]] && fbm(x / 9, y / 9, 404, 3) > 0.45)
    )
      grid[i] = R.woodland;
  }
}

export const regionAt = (x, y) => (inside(x, y) ? REGIONS[grid[y * TW + x]] : 'sea');
export const onMainland = (x, y) => inside(x, y) && comp[y * TW + x] === main;
const walkable = (x, y) => {
  if (!inside(x, y)) return false;
  const g = grid[y * TW + x];
  return g !== R.sea && g !== R.lake && comp[y * TW + x] === main;
};
export const ISLAND_MAP = registerMap({ id: 'island', w: TW, h: TH, land: walkable, regionAt, tileKm: TILE_KM });
export const MAIN_TILES = landIdx.filter(i => grid[i] !== R.lake).length;
export const LAND_KM2 = MAIN_TILES * TILE_KM * TILE_KM;
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
