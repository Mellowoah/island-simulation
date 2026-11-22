// ---------- Layer 3 (terrain), the bigger world: a lake basin under an escarpment and a highland plateau ----------
// Built beside today's island (rule 15): nothing imports this yet. A pure function of a landscape description, so
// other places can be described the same way (rule 12). The description below follows the real land around Lake
// Eyasi: a basin at about 1,030 m with the lake along the foot of the Eyasi escarpment, which rises to the Mbulu
// plateau (1,500-2,300 m) on its south-east, and a volcanic highland block to the north-east (Ngorongoro, whose
// conservation area spans 1,030-3,648 m). Real heights from a survey (SRTM) would be better than this generated
// shape: such a survey grid can replace heightAt when one can be brought in.
// Coordinates: x east, y south, in km from the centre; every height in metres.
export const EYASI_HIGHLANDS = {
  name: 'Eyasi basin and highlands',
  tileKm: 0.35,
  sizeKm: 120, // the square that holds the island and its sea
  radiusKm: 57, // the island's mean radius (about 10,000 km2 of land)
  seed: 20261121,
  coastM: 1000,
  basinM: 1030, // Lake Eyasi (sun.js SITE)
  basinRiseM: 350, // the basin's far (north-west) side rises toward low hills
  scarp: { bearingDeg: 45, offsetKm: 0, widthKm: 4, topM: 1850 }, // the escarpment runs south-west to north-east
  plateauRiseM: 300, // the plateau keeps rising away from the scarp edge, toward 2,150 m
  massif: { xKm: 25, yKm: -25, radiusKm: 18, peakM: 2900 }, // the volcanic block north-east
  lake: { alongKm: 70, acrossKm: 10, fromScarpKm: -6 }, // the lake's length, width and centre line from the scarp foot
  noise: { basinM: 60, plateauM: 140, km: 12 },
};

const hash = (x, y, k, seed) => {
  let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(k, 1274126177) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = t => t * t * (3 - 2 * t);
function value(x, y, k, seed) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    fx = smooth(x - x0),
    fy = smooth(y - y0),
    [a, b, c, d] = [
      hash(x0, y0, k, seed),
      hash(x0 + 1, y0, k, seed),
      hash(x0, y0 + 1, k, seed),
      hash(x0 + 1, y0 + 1, k, seed),
    ];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// Fractal noise in 0..1 (five octaves).
export function fbm(x, y, k, seed, oct = 5) {
  let s = 0,
    amp = 0.5,
    f = 1,
    n = 0;
  for (let o = 0; o < oct; o++, amp *= 0.5, f *= 2) ((s += amp * value(x * f, y * f, k + o * 17, seed)), (n += amp));
  return s / n;
}

// Signed distance (km) from the escarpment line, positive on its high (south-east) side, and distance along it.
function scarpFrame(x, y, sc) {
  const a = (sc.bearingDeg * Math.PI) / 180,
    ux = Math.sin(a),
    uy = -Math.cos(a); // along the line (toward its bearing)
  return { across: x * -uy + y * ux - sc.offsetKm, along: x * ux + y * uy };
}
// Is (x, y) land? A circle bent by noise, so the coast has bays and headlands.
export function isLand(x, y, d) {
  const bend = (fbm(x / 25, y / 25, 1, d.seed) - 0.5) * 0.45;
  return Math.hypot(x, y) < d.radiusKm * (1 + bend);
}
// Height (m) of land at (x, y) km.
export function heightAt(x, y, d) {
  const { across, along } = scarpFrame(x, y, d.scarp),
    s = d.scarp,
    t = Math.min(1, Math.max(0, across / s.widthKm + 0.5)),
    up = smooth(t);
  const basin = d.basinM + d.basinRiseM * Math.min(1, Math.max(0, -across / 45)),
    plateau = s.topM + d.plateauRiseM * Math.min(1, Math.max(0, (across - s.widthKm / 2) / 40));
  const n = fbm(x / d.noise.km, y / d.noise.km, 2, d.seed) - 0.5,
    rough = (1 - up) * d.noise.basinM + up * d.noise.plateauM;
  let h = basin + (plateau - basin) * up + 2 * n * rough;
  const m = d.massif,
    r = Math.hypot(x - m.xKm, y - m.yKm) / m.radiusKm;
  if (r < 1) h = Math.max(h, h + (m.peakM - h) * (1 - r * r) ** 2);
  const L = d.lake,
    inLake = Math.abs(along) < L.alongKm / 2 && Math.abs(across - L.fromScarpKm) < L.acrossKm / 2;
  return inLake ? d.basinM : Math.max(d.basinM, h);
}

// The whole grid: heights (m, sea at the coast height), land and lake masks, and its size.
export function makeLandscape(d = EYASI_HIGHLANDS) {
  const N = Math.round(d.sizeKm / d.tileKm),
    metres = new Float32Array(N * N),
    land = new Uint8Array(N * N),
    lake = new Uint8Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i,
        x = (i + 0.5) * d.tileKm - d.sizeKm / 2,
        y = (j + 0.5) * d.tileKm - d.sizeKm / 2;
      if (!isLand(x, y, d)) {
        metres[k] = d.coastM;
        continue;
      }
      land[k] = 1;
      metres[k] = heightAt(x, y, d);
      lake[k] =
        metres[k] === d.basinM && Math.abs(scarpFrame(x, y, d.scarp).across - d.lake.fromScarpKm) < d.lake.acrossKm / 2
          ? 1
          : 0;
    }
  return { W: N, H: N, tileKm: d.tileKm, metres, land, lake, d };
}
