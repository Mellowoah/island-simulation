// ---------- drawing the land well: relief, seasons, water and light, all from the world itself ----------
// The land is drawn at RES points per square, each point's height, colour, land-or-sea and water blended between the
// squares' centres (bilinear), so coasts and edges are smooth. Hills are lit by the world's own sun for the hour
// (sun.js elevation and azimuth), so shadows move through the day. Grass and woodland take the season from the plants
// layer (green to straw as the grass cures). Then the hour's light: golden at sunrise and sunset, blue at night.
import * as T from './terrain.js';
import { metresAt } from './land.js';
import { sunAt, clockHourOf, elevation, SITE, jdOfTick } from './sun.js';

const RES = 6;
const COL = {
  sea: [22, 66, 118],
  lake: [44, 116, 170],
  river: [56, 136, 190],
  rock: [132, 120, 104],
  shore: [214, 198, 148],
  woodland: [52, 104, 50],
  grass: [138, 172, 78],
};
const STRAW = [190, 166, 104];
const rad = d => (d * Math.PI) / 180;

// The sun's direction (east, south, up) at a Julian day, from its elevation and the hour angle (azimuth by the
// standard spherical formula; sun.js gives the elevation and declination).
export function sunVector(jd) {
  const el = rad(elevation(jd)),
    s = sunAt(jd),
    h = clockHourOf(jd, SITE.zone);
  const w = rad((h * 60 + s.eot + 4 * SITE.lon - 60 * SITE.zone) / 4 - 180),
    d = rad(s.dec),
    phi = rad(SITE.lat);
  const az = Math.atan2(Math.sin(w), Math.cos(w) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)); // from south, west +
  return {
    el: (el * 180) / Math.PI,
    x: -Math.cos(el) * Math.sin(az),
    y: -Math.cos(el) * Math.cos(az),
    z: Math.sin(el),
  };
}

// Everything that does not change with the hour, worked out once per map: blended height, colour and masks.
export function prepareLand() {
  const W = T.TW * RES,
    H = T.TH * RES,
    n = W * H;
  const at = (f, x, y) => f(Math.max(0, Math.min(T.TW - 1, x)), Math.max(0, Math.min(T.TH - 1, y)));
  const height = new Float32Array(n),
    landness = new Float32Array(n),
    wet = new Float32Array(n),
    rgb = new Float32Array(n * 3),
    kind = new Float32Array(n); // how much of the colour is grass or woodland (takes the season)
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const fx = (i + 0.5) / RES - 0.5,
        fy = (j + 0.5) / RES - 0.5;
      blendAt(fx, fy, at, j * W + i, { height, landness, wet, rgb, kind });
    }
  // Smoothed, so coasts are round and colours run into each other as land does (radii in points; 6 points a square).
  for (const [f, r] of [
    [landness, 4],
    [wet, 2],
    [kind, 2],
    [height, 2],
  ])
    blur(f, W, H, r, 1);
  blur(rgb, W, H, 2, 3);
  return { W, H, height, landness, wet, rgb, kind, normal: normals(height, W, H), grain: grainField(W, H) };
}
function blendAt(fx, fy, at, k, F) {
  const x0 = Math.floor(fx),
    y0 = Math.floor(fy),
    tx = fx - x0,
    ty = fy - y0;
  const corners = [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x0 + 1, y0, tx * (1 - ty)],
    [x0, y0 + 1, (1 - tx) * ty],
    [x0 + 1, y0 + 1, tx * ty],
  ];
  for (const [x, y, w] of corners) {
    const r = at(T.regionAt, x, y),
      c = COL[r];
    F.height[k] += w * at(metresAt, x, y);
    F.landness[k] += w * (r === 'sea' ? 0 : 1);
    F.wet[k] += w * (r === 'lake' || r === 'river' ? 1 : 0);
    F.kind[k] += w * (r === 'grass' ? 1 : r === 'woodland' ? 0.4 : 0);
    for (let c3 = 0; c3 < 3; c3++) F.rgb[k * 3 + c3] += w * c[c3];
  }
}
// A box blur run twice each way (close to a Gaussian), in place, for fields of 1 or 3 numbers a point.
export function blur(f, W, H, r, ch) {
  const tmp = new Float32Array(f.length);
  for (let pass = 0; pass < 2; pass++) {
    line(f, tmp, W, H, r, ch, 1, W);
    line(tmp, f, H, W, r, ch, W, 1);
  }
}
// One direction of the blur: along runs of n points, `step` apart, `lines` of them, each `stride` from the last.
function line(src, dst, n, lines, r, ch, step, stride) {
  const w = 2 * r + 1;
  for (let l = 0; l < lines; l++)
    for (let c = 0; c < ch; c++) {
      const at = i => src[(l * stride + Math.max(0, Math.min(n - 1, i)) * step) * ch + c];
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += at(i);
      for (let i = 0; i < n; i++) {
        dst[(l * stride + i * step) * ch + c] = sum / w;
        sum += at(i + r + 1) - at(i - r);
      }
    }
}
// Surface normals from the blended heights (each point RES times finer than a square of 350 m).
function normals(h, W, H) {
  const out = new Float32Array(W * H * 3),
    dx = (T.TILE_KM * 1000) / RES,
    lift = 2.5; // heights drawn 2.5 times steeper than they are, so relief reads at this scale
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = j * W + i,
        gx = (h[j * W + Math.min(W - 1, i + 1)] - h[j * W + Math.max(0, i - 1)]) / (2 * dx),
        gy = (h[Math.min(H - 1, j + 1) * W + i] - h[Math.max(0, j - 1) * W + i]) / (2 * dx);
      const nx = -gx * lift,
        ny = -gy * lift,
        len = Math.hypot(nx, ny, 1);
      [out[k * 3], out[k * 3 + 1], out[k * 3 + 2]] = [nx / len, ny / len, 1 / len];
    }
  return out;
}

// The hour's light: colour multiplied in by the sun's height (warm near the horizon, blue at night).
export function skyLight(el) {
  if (el > 12) return [1, 1, 1];
  if (el > 0) return mix([1.08, 0.86, 0.66], [1, 1, 1], el / 12);
  if (el > -6) return mix([0.42, 0.42, 0.66], [1.08, 0.86, 0.66], (el + 6) / 6);
  return [0.2, 0.26, 0.46];
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// One picture of the land for this moment: relief lit by the sun, the season's grass, water and coast, the light.
export function paintLand(L, img, sun, dryness, known, time) {
  const light = skyLight(sun.el),
    up = Math.max(0, sun.z);
  for (let k = 0, n = L.W * L.H; k < n; k++) {
    const sea = L.landness[k] < 0.5;
    const c = sea ? seaColour(L, k, up, time) : landColour(L, k, sun, up, dryness);
    const seen = sea ? 1 : 0.55 + 0.45 * known[k];
    img.data[k * 4] = c[0] * light[0] * seen;
    img.data[k * 4 + 1] = c[1] * light[1] * seen;
    img.data[k * 4 + 2] = c[2] * light[2] * seen;
    img.data[k * 4 + 3] = 255;
  }
}
function landColour(L, k, sun, up, dryness) {
  const g = L.kind[k] * dryness,
    own = landOnly(L, k);
  let r = own[0] * (1 - g) + STRAW[0] * g,
    gr = own[1] * (1 - g) + STRAW[1] * g,
    b = own[2] * (1 - g) + STRAW[2] * g;
  if (L.wet[k] > 0.5) [r, gr, b] = COL.lake;
  const n = L.normal,
    lit = n[k * 3] * sun.x + n[k * 3 + 1] * sun.y + n[k * 3 + 2] * sun.z;
  const shade = 0.55 + 0.6 * Math.max(0, lit) * (up > 0 ? 1 : 0) + 0.25 * (1 - up),
    coast = 1 + 0.14 * Math.max(0, 1 - Math.abs(L.landness[k] - 0.53) / 0.06); // a pale fringe where land meets sea
  const tex = 1 + 0.07 * L.grain[k];
  return [r * shade * coast * tex, gr * shade * coast * tex, b * shade * coast * tex];
}
// The land's own colour near the coast: the blended colour without the sea's share in it, so land never turns blue.
function landOnly(L, k) {
  const a = Math.max(0.5, L.landness[k]);
  return [0, 1, 2].map(c => Math.max(0, (L.rgb[k * 3 + c] - (1 - a) * COL.sea[c]) / a));
}
// Fine ground texture: value noise at two scales (3 and 11 points), fixed per map, -1..1.
function grainField(W, H) {
  const hash = (x, y, s) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ s;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, y, p, s) => {
    const fx = x / p,
      fy = y / p,
      x0 = Math.floor(fx),
      y0 = Math.floor(fy),
      tx = fx - x0,
      ty = fy - y0;
    const a = hash(x0, y0, s),
      b = hash(x0 + 1, y0, s),
      c = hash(x0, y0 + 1, s),
      d = hash(x0 + 1, y0 + 1, s);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return Float32Array.from({ length: W * H }, (_, k) => {
    const x = k % W,
      y = (k / W) | 0;
    return (0.6 * noise(x, y, 3, 7) + 0.4 * noise(x, y, 11, 13)) * 2 - 1;
  });
}
function seaColour(L, k, up, time) {
  const deep = 1 - Math.min(1, L.landness[k] * 2),
    ripple = 1 + 0.025 * L.grain[k] * Math.sin(time * 0.0005 + L.grain[k] * 6); // a slow, faint shimmer
  const base = mix([46, 112, 160], COL.sea, deep);
  return base.map(v => v * ripple * (0.85 + 0.15 * up));
}

// How much of the land around each point people have seen (0..1), blurred so its edge is soft, not square.
export function knownField(L, seenAt) {
  const f = new Float32Array(L.W * L.H);
  for (let j = 0; j < L.H; j++)
    for (let i = 0; i < L.W; i++) f[j * L.W + i] = seenAt[((j / RES) | 0) * T.TW + ((i / RES) | 0)] >= 0 ? 1 : 0;
  blur(f, L.W, L.H, 6, 1);
  return f;
}
// The open sea's colour at this hour, for the frame beyond the island.
export const seaAt = el =>
  mix([46, 112, 160], COL.sea, 1).map((v, i) => v * skyLight(el)[i] * (0.85 + 0.15 * Math.max(0, Math.sin(rad(el)))));
