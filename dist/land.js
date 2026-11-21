// ---------- Layer 3: the land ----------
// Heights in metres, which way water runs from every tile, how much land drains through each tile (its
// catchment), how far that water travels, slopes, and how much cooler the hills are.
// Sources:
// - Barnes, R., Lehman, C. and Mulla, D. (2014) Computers & Geosciences 62: 117-127: priority-flood, so every
//   hollow is filled and every drop of water has a way out to the lake or the sea.
// - O'Callaghan, J. F. and Mark, D. M. (1984) Computer Vision, Graphics and Image Processing 28: 323-344: flow
//   accumulation over drainage directions gives catchment areas. The directions are the map's own (terrain.js,
//   four neighbours over the priority-flooded surface), so the drawn rivers lie exactly on the flow lines.
// - The environmental lapse rate, 6.5 deg C per km (the International Standard Atmosphere).
// The map itself is still the generated one (terrain.js, a stand-in); this layer reads it and adds the physics.
// Every function is under 30 lines.
import { TW, TH, TILE_KM, DOWN, elevation, regionAt } from './terrain.js';

export const LAPSE_C_PER_KM = 6.5;

// Height in metres: the map's coast at 1000 m and its highest point at 1900 m, a 900 m rise like the Eyasi
// escarpment's (Lake Eyasi about 1030 m, the rim about 1900-2000 m), so all the land lies in the Hadza range.
// The island is fictional: its lake, inland, comes out near 1365 m, like a highland lake. Assumption: heights are
// scaled linearly. Temperatures are anchored at the median land height (REF_M), so the island as a whole keeps
// the measured climate and only its hills and lowlands depart from it.
// The largest value, as Math.max would give it (NaN if any is NaN), without spreading the whole map into one call:
// a spread of a large map overflows the call stack (found timing a 10,000 km2 map, 21 Nov 2026).
function highest(a) {
  let top = -Infinity;
  for (const v of a) {
    if (v !== v) return NaN;
    if (v > top) top = v;
  }
  return top;
}
const RAW = Float32Array.from({ length: TW * TH }, (_, i) => elevation(i % TW, (i / TW) | 0));
const SEA_RAW = 0.42,
  TOP_RAW = highest(RAW);
export const metresAt = (x, y) => 1000 + ((Math.max(SEA_RAW, RAW[y * TW + x]) - SEA_RAW) / (TOP_RAW - SEA_RAW)) * 900;
const landM = [...RAW.keys()]
  .filter(i => !['sea', 'lake'].includes(regionAt(i % TW, (i / TW) | 0)))
  .map(i => metresAt(i % TW, (i / TW) | 0))
  .sort((a, b) => a - b);
export const REF_M = landM[Math.floor(landM.length / 2)];

// Tiles in an order where every tile comes after all the tiles that drain into it (Kahn's topological sort)
function upstreamFirst(down) {
  const n = TW * TH,
    inflows = new Int32Array(n),
    order = [];
  for (let i = 0; i < n; i++) if (down[i] >= 0) inflows[down[i]]++;
  for (let i = 0; i < n; i++) if (!inflows[i]) order.push(i);
  for (let k = 0; k < order.length; k++) {
    const j = down[order[k]];
    if (j >= 0 && --inflows[j] === 0) order.push(j);
  }
  return order;
}

// Flow accumulation: tiles draining through each tile (itself included), and the mean distance (km) that water
// from those tiles travels to reach it.
function accumulate(down) {
  const n = TW * TH,
    area = new Float32Array(n).fill(1),
    len = new Float32Array(n);
  for (const i of upstreamFirst(down)) {
    const j = down[i];
    if (j < 0) continue;
    const step = Math.hypot((i % TW) - (j % TW), ((i / TW) | 0) - ((j / TW) | 0)) * TILE_KM;
    len[j] += len[i] + area[i] * step;
    area[j] += area[i];
  }
  return { area, meanLen: Float32Array.from(len, (l, i) => l / area[i]) };
}

export const FLOW = { down: DOWN, ...accumulate(DOWN) };

// Land cover upstream of every tile: for each kind of ground, how many tiles of it drain through the tile
const COVERS = ['grass', 'woodland', 'shore', 'rock', 'river'];
function coverUpstream(down) {
  const n = TW * TH,
    order = upstreamFirst(down),
    out = {};
  for (const c of COVERS) {
    const sum = Float32Array.from({ length: n }, (_, i) => (regionAt(i % TW, (i / TW) | 0) === c ? 1 : 0));
    for (const i of order) if (down[i] >= 0) sum[down[i]] += sum[i];
    out[c] = sum;
  }
  return out;
}
const COVER = coverUpstream(DOWN);

// Share of each kind of ground in the catchment of a tile (land only), and over the whole island
export function catchmentCover(x, y) {
  const i = y * TW + x,
    total = COVERS.reduce((t, c) => t + COVER[c][i], 0) || 1;
  return Object.fromEntries(COVERS.map(c => [c, COVER[c][i] / total]));
}
export function islandCover() {
  const count = Object.fromEntries(COVERS.map(c => [c, 0]));
  for (let i = 0; i < TW * TH; i++) {
    const r = regionAt(i % TW, (i / TW) | 0);
    if (r in count) count[r]++;
  }
  const total = COVERS.reduce((t, c) => t + count[c], 0);
  return Object.fromEntries(COVERS.map(c => [c, count[c] / total]));
}

// Catchment area (km2) that drains through a tile, and the mean distance (km) its water travels to get there
export const catchmentKm2 = (x, y) => FLOW.area[y * TW + x] * TILE_KM * TILE_KM;
export const flowLengthKm = (x, y) => FLOW.meanLen[y * TW + x];

// Slope (m per m) from a tile to the tile it drains to
export function slopeAt(x, y) {
  const i = y * TW + x,
    j = FLOW.down[i];
  if (j < 0) return 0;
  const dist = Math.hypot(x - (j % TW), y - ((j / TW) | 0)) * TILE_KM * 1000;
  return Math.max(0, (metresAt(x, y) - metresAt(j % TW, (j / TW) | 0)) / dist);
}

// Air temperature at a tile from the temperature at a reference height (lapse rate 6.5 deg C per km)
export const tempAtHeight = (tRef, zRef, z) => tRef - (LAPSE_C_PER_KM * (z - zRef)) / 1000;
