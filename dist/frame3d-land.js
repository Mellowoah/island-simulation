// The diorama's land (presentation only): the island's own heights and colours as a 3D surface, the sea over a
// sandy shelf, and trees where the map has woodland. One unit is a kilometre. Heights are drawn LIFT times steeper
// than true, and trees and people far larger than true, so they read at the scale of a table-top model.
import * as THREE from './vendor/three.min.js';
import * as T from './terrain.js';
import { prepareLand, groundColour, blur, RES } from './frame-render.js';

export const LIFT = 3;
const STEP = 2; // a corner every 2 points of the land picture (3 a map square)
const KM = T.TILE_KM / RES; // kilometres a point
const SHELF = [200, 186, 140], // the sand under shallow sea
  DEEP = [12, 44, 72]; // and the deep water's floor
const lin = v => Math.pow(v / 255, 2.2); // colour from screen values to light values

// The surface height at a point: the land above sea level (the lowest land on the map), lifted; under the sea the
// floor shelves away from the coast; lakes and rivers sit a little low.
function heightAt(L, k) {
  const a = Math.min(1, Math.max(0, (L.landness[k] - 0.42) / 0.16)),
    land = 0.004 + (Math.max(0, L.height[k] - L.base) / 1000) * LIFT,
    floor = -(0.015 + 0.6 * (1 - Math.min(1, L.near[k] * 2.5)));
  return a * land + (1 - a) * floor - (L.wet[k] > 0.5 ? 0.006 : 0);
}
// Sea level, and how near the coast each point is (for the shelf).
function seaLevel(L) {
  let base = Infinity;
  for (let k = 0; k < L.W * L.H; k++) if (L.landness[k] >= 0.5) base = Math.min(base, L.height[k]);
  const near = Float32Array.from(L.landness);
  blur(near, L.W, L.H, 24, 1);
  return Object.assign(L, { base, near });
}
// The height under a map position (x, y in squares), for standing trees and people on the ground.
export function groundAt(land, x, y) {
  const L = land.L,
    i = Math.max(0, Math.min(L.W - 1, Math.round(x * RES))),
    j = Math.max(0, Math.min(L.H - 1, Math.round(y * RES)));
  return Math.max(0, heightAt(L, j * L.W + i));
}
function surface(L) {
  const nx = Math.floor((L.W - 1) / STEP) + 1,
    ny = Math.floor((L.H - 1) / STEP) + 1,
    pos = new Float32Array(nx * ny * 3),
    at = new Int32Array(nx * ny),
    idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v = j * nx + i,
        k = j * STEP * L.W + i * STEP;
      at[v] = k;
      pos.set([(i * STEP + 0.5) * KM, heightAt(L, k), (j * STEP + 0.5) * KM], v * 3);
    }
  let n = 0;
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      idx.set([a, a + nx, a + 1, a + 1, a + nx, a + nx + 1], n);
      n += 6;
    }
  return { pos, at, idx };
}
export function buildLand() {
  const L = seaLevel(prepareLand()),
    { pos, at, idx } = surface(L),
    geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 }));
  mesh.castShadow = mesh.receiveShadow = true;
  return { L, mesh, at, size: [L.W * KM, L.H * KM] };
}
// The land's colours for the season (dryness 0..1) and for what the people have seen (known: 0..1 a point).
export function colourLand(land, dryness, known) {
  const c = land.mesh.geometry.attributes.color,
    L = land.L;
  for (let v = 0; v < land.at.length; v++) {
    const k = land.at[v],
      g = L.landness[k] < 0.5 ? seabed(L, k) : groundColour(L, k, dryness),
      f = (1 + 0.07 * L.grain[k]) * (known && L.landness[k] >= 0.5 ? 0.55 + 0.45 * known[k] : 1);
    c.setXYZ(v, lin(g[0]) * f, lin(g[1]) * f, lin(g[2]) * f);
  }
  c.needsUpdate = true;
}
// The sea floor: sand near the coast, darkening to deep water further out.
function seabed(L, k) {
  const d = 1 - Math.min(1, L.near[k] * 4);
  return SHELF.map((v, i) => v + (DEEP[i] - v) * Math.sqrt(d));
}
// The sea: a clear, glossy sheet at sea level over the shelf, and a deep floor under all of it.
export function buildSea(land) {
  const [w, h] = land.size,
    sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1a6a92, roughness: 0.12, transparent: true, opacity: 0.72 }),
    ),
    floor = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0c2c48, roughness: 1 }),
    );
  sheet.position.set(w / 2, 0, h / 2);
  floor.position.set(w / 2, -0.62, h / 2);
  sheet.receiveShadow = true;
  return [floor, sheet];
}
