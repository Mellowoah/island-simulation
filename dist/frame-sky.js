// Drawing the frame's skies (frame-weather.js says which sky is where). Presentation only.
// Clouds are tiling noise thresholded by cloud cover, drifting with the wind, casting soft shade by day;
// rain falls as streaks slanted by the wind; fog is a veil; storms flash. Each sky is drawn on its own layer
// and cut to its area: inside Winterhaven for the live sky, outside it for the world's own.

const N = 256; // cloud texture size, tiles seamlessly
let noise = null;
const cache = new Map();

function hash(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise on a lattice that wraps every `cells`, so the texture tiles.
function wrapNoise(x, y, cells, s) {
  const f = N / cells,
    fx = x / f,
    fy = y / f,
    x0 = Math.floor(fx),
    y0 = Math.floor(fy),
    tx = fx - x0,
    ty = fy - y0;
  const at = (i, j) => hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, s);
  const sx = tx * tx * (3 - 2 * tx),
    sy = ty * ty * (3 - 2 * ty);
  const a = at(x0, y0),
    b = at(x0 + 1, y0),
    c = at(x0, y0 + 1),
    d = at(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function makeNoise() {
  const out = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) {
    const x = k % N,
      y = (k / N) | 0;
    out[k] = 0.55 * wrapNoise(x, y, 4, 11) + 0.3 * wrapNoise(x, y, 8, 23) + 0.15 * wrapNoise(x, y, 16, 37);
  }
  return out;
}
// The cloud texture for a cover (0..1) in one colour: more cover, lower threshold, softer edge.
function cloudTexture(cover, rgb) {
  const key = `${Math.round(cover * 20)}|${rgb.map(Math.round).join(',')}`;
  if (cache.has(key)) return cache.get(key);
  noise ??= makeNoise();
  const c = new OffscreenCanvas(N, N),
    img = new ImageData(N, N),
    lo = 0.72 - 0.5 * cover,
    hi = lo + 0.3;
  for (let k = 0; k < N * N; k++) {
    const t = Math.min(1, Math.max(0, (noise[k] - lo) / (hi - lo)));
    img.data.set([rgb[0], rgb[1], rgb[2], 255 * t * t * (3 - 2 * t) * (0.35 + 0.35 * cover)], k * 4);
  }
  c.getContext('2d').putImageData(img, 0, 0);
  if (cache.size > 40) cache.clear();
  cache.set(key, c);
  return c;
}
// One tiled pass of a texture, shifted by (dx, dy) screen pixels, each tile `size` pixels across.
function tile(g, tex, size, dx, dy, W, H) {
  const ox = (((dx % size) + size) % size) - size,
    oy = (((dy % size) + size) % size) - size;
  for (let y = oy; y < H; y += size) for (let x = ox; x < W; x += size) g.drawImage(tex, x, y, size, size);
}
// Clouds and their shade, drifting downwind. t: milliseconds; night: 0 (day) to 1 (dark).
function drawClouds(g, sky, W, H, t, night) {
  if (sky.cover < 0.05) return;
  const to = ((sky.from + 180) * Math.PI) / 180,
    speed = (0.004 + 0.0015 * sky.wind) * W * 0.001; // pixels a millisecond
  const dx = Math.sin(to) * speed * t,
    dy = -Math.cos(to) * speed * t,
    size = Math.max(W, H) * 0.7;
  g.fillStyle = `rgba(16,22,34,${0.3 * sky.cover * (1 - 0.5 * night)})`; // overcast dims the ground
  g.fillRect(0, 0, W, H);
  if (night < 0.9) tile(g, cloudTexture(sky.cover, [10, 14, 22]), size, dx + W * 0.03, dy + H * 0.05, W, H);
  const day = [246, 247, 250],
    dark = [52, 60, 82],
    grey = sky.kind === 'rain' || sky.kind === 'storm' ? 0.35 : 0;
  const rgb = day.map((d, i) => d + (dark[i] - d) * Math.min(1, night + grey));
  tile(g, cloudTexture(sky.cover, rgb), size, dx, dy, W, H);
}
// Rain (or snow) as streaks slanted by the wind; the more rain, the more streaks.
function drawRain(g, sky, W, H, t, night) {
  if (!(sky.rain > 0) && sky.kind !== 'drizzle') return;
  const n = Math.round((Math.min(1400, 120 + 160 * Math.max(sky.rain, 0.4)) * (W * H)) / 2e6),
    snow = sky.kind === 'snow',
    to = ((sky.from + 180) * Math.PI) / 180,
    slant = Math.sin(to) * Math.min(0.6, sky.wind / 15),
    len = (snow ? 2 : 14) * (W / 1000),
    fall = (snow ? 0.05 : 0.9) * (H / 1000);
  g.strokeStyle = `rgba(${night > 0.5 ? '150,165,200' : '210,220,235'},${snow ? 0.8 : 0.5})`;
  g.lineWidth = Math.max(1, W / 1400) * (snow ? 2 : 1);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const y = (hash(i, 1, 5) * H + t * fall * (0.8 + 0.4 * hash(i, 2, 5))) % H,
      x = (hash(i, 3, 5) * W + y * slant + W) % W;
    g.moveTo(x, y);
    g.lineTo(x + slant * len, y + len);
  }
  g.stroke();
}
// Fog as a veil; storms as a brief flash every so often.
function drawVeil(g, sky, W, H, t, night) {
  if (sky.kind === 'fog') {
    g.fillStyle = night > 0.5 ? 'rgba(90,100,120,0.45)' : 'rgba(220,224,230,0.5)';
    g.fillRect(0, 0, W, H);
  }
  if (sky.kind === 'storm' && t % 9000 < 140) {
    g.fillStyle = 'rgba(235,240,255,0.45)';
    g.fillRect(0, 0, W, H);
  }
}
// A sky drawn on its own layer, then cut to its area. area: {x, y, r} in screen pixels; inside: draw within it
// (true) or everywhere but it (false). The edge is soft, the outer half of the radius.
export function drawSky(g, layer, sky, area, inside, t, night) {
  if (!sky) return;
  const W = layer.width,
    H = layer.height,
    l = layer.getContext('2d');
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, W, H);
  drawClouds(l, sky, W, H, t, night);
  drawRain(l, sky, W, H, t, night);
  drawVeil(l, sky, W, H, t, night);
  if (area) {
    const s = W / g.canvas.width,
      m = l.createRadialGradient(area.x * s, area.y * s, area.r * s * 0.55, area.x * s, area.y * s, area.r * s);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    l.globalCompositeOperation = inside ? 'destination-in' : 'destination-out';
    l.fillStyle = m;
    l.fillRect(0, 0, W, H);
  }
  g.drawImage(layer, 0, 0, g.canvas.width, g.canvas.height);
}
