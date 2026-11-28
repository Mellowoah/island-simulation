// What grows and lives on the diorama (presentation only): trees where the map has woodland (and a few out on the
// grass), people as small figures in their own cloth, children smaller, and camp fires that light the ground at night.
// Sizes are model sizes, far larger than true, so they read on a table-top island.
import * as THREE from './vendor/three.min.js';
import * as T from './terrain.js';
import { living } from './world.js';
import { groundAt } from './frame3d-land.js';
import { SKIN, CLOTH, pick } from './frame-people.js';

const MAX_PEOPLE = 800,
  FIRES = 10;
function hash(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const rgb = s => new THREE.Color().setRGB(...s.split(',').map(v => Math.pow(v / 255, 2.2)));

// Where trees stand: four to a woodland square, now and then one on the grass; each its own size and turn.
function treeSpots() {
  const spots = [];
  for (let y = 0; y < T.TH; y++)
    for (let x = 0; x < T.TW; x++) {
      const r = T.regionAt(x, y),
        n = r === 'woodland' ? 4 : r === 'grass' && hash(x, y, 3) < 0.1 ? 1 : 0;
      for (let i = 0; i < n; i++)
        spots.push([
          x + hash(x, y, 10 + i),
          y + hash(x, y, 20 + i),
          0.7 + 0.6 * hash(x, y, 30 + i),
          hash(x, y, 40 + i),
        ]);
    }
  return spots;
}
// Flat-topped trees, like the acacias of the East African savanna the world is measured from.
export function buildTrees(land) {
  const spots = treeSpots(),
    trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.012, 0.02, 0.2, 5).translate(0, 0.1, 0),
      new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }),
      spots.length,
    ),
    crown = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.15, 0.1, 0.05, 9).translate(0, 0.22, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      spots.length,
    );
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    green = new THREE.Color();
  spots.forEach(([x, y, size, turn], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn * 6.28);
    m.compose(
      new THREE.Vector3(x * T.TILE_KM, groundAt(land, x, y), y * T.TILE_KM),
      q,
      new THREE.Vector3(size, size, size),
    );
    trunk.setMatrixAt(i, m);
    crown.setMatrixAt(i, m);
    crown.setColorAt(i, green.setRGB(0.05 + 0.03 * turn, 0.12 + 0.05 * size, 0.04));
  });
  for (const t of [trunk, crown]) t.castShadow = t.receiveShadow = true;
  return [trunk, crown];
}
export function buildLife() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    body = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.035, 0.06, 0.2, 7).translate(0, 0.1, 0),
      mat,
      MAX_PEOPLE,
    ),
    head = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.042, 10, 8).translate(0, 0.245, 0),
      mat.clone(),
      MAX_PEOPLE,
    );
  body.castShadow = head.castShadow = true;
  body.count = head.count = 0;
  const fires = Array.from({ length: FIRES }, () => {
    const light = new THREE.PointLight(0xff9a40, 0, 3.5, 1.4),
      flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 7), new THREE.MeshBasicMaterial({ color: 0xffa040 }));
    flame.visible = false;
    return { light, flame };
  });
  return { body, head, fires, parts: [body, head, ...fires.flatMap(f => [f.light, f.flame])] };
}
// Everyone where they are this moment (gliding between where they were and are this hour), and the fires.
export function placeLife(life, land, w, night, now) {
  const f = w.frac(),
    m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    people = living(w.s).slice(0, MAX_PEOPLE);
  people.forEach((p, i) => {
    const [x0, y0] = w.prev.get(p.id) ?? [p.x, p.y],
      x = x0 + (p.x - x0) * f + 0.5 + (((p.id * 37) % 7) - 3) / 8,
      y = y0 + (p.y - y0) * f + 0.5 + (((p.id * 53) % 7) - 3) / 8,
      walk = x0 !== p.x || y0 !== p.y ? Math.abs(Math.sin(now / 170 + p.id)) * 0.02 : 0,
      size = p.body.age < 14 ? 0.5 + (0.5 * p.body.age) / 14 : 1;
    m.compose(
      new THREE.Vector3(x * T.TILE_KM, groundAt(land, x, y) + walk, y * T.TILE_KM),
      q,
      new THREE.Vector3(size, size, size),
    );
    life.body.setMatrixAt(i, m);
    life.head.setMatrixAt(i, m);
    life.body.setColorAt(i, rgb(pick(CLOTH, p.id, 13)));
    life.head.setColorAt(i, rgb(pick(SKIN, p.id, 7)));
  });
  life.body.count = life.head.count = people.length;
  for (const part of [life.body, life.head]) {
    part.instanceMatrix.needsUpdate = true;
    if (part.instanceColor) part.instanceColor.needsUpdate = true;
  }
  placeFires(life, land, w, night, now);
}
function placeFires(life, land, w, night, now) {
  const burning = w.s.bands.filter(b => !b.ended && b.fire?.fuel > 0);
  life.fires.forEach((f, i) => {
    const b = burning[i];
    f.flame.visible = Boolean(b);
    f.light.intensity = b ? (0.15 + 2.2 * night) * (0.9 + 0.1 * Math.sin(now / 130 + i)) : 0;
    if (!b) return;
    const x = (b.camp.x + 0.5) * T.TILE_KM,
      y = (b.camp.y + 0.5) * T.TILE_KM,
      g = groundAt(land, b.camp.x + 0.5, b.camp.y + 0.5);
    f.flame.position.set(x, g + 0.09, y);
    f.light.position.set(x, g + 0.25, y);
  });
}
