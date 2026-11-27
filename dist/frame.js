// Island, the picture frame: the small world living in time with the viewer's own day. Presentation only: it steps the
// world and draws it; it never changes a rule. One world hour passes each real hour, by the viewer's local clock and
// calendar. The world's year starts on 1 November (the short rains, clock.js), so the world began at 06:00 on
// 1 November of its first year (2026 unless ?since=YYYY): its dawn, its months and its rains run with the viewer's.
// On opening it catches up from its start to now (the same island seed always gives the same history), then carries
// on in real time. Nothing to press.
import { createWorld2, stepWorld, living } from './world.js';
import { clockOf, isNight, START_HOUR, dateOf } from './clock.js';
import * as T from './terrain.js';

const Q = new URLSearchParams(location.search);
const seed = Number(Q.get('seed')) || 41;
const born = new Date(Number(Q.get('since')) || 2026, 10, 1); // 1 November
const REGION_COL = {
  sea: [29, 79, 134],
  lake: [58, 134, 200],
  river: [74, 163, 223],
  rock: [138, 127, 114],
  shore: [228, 215, 160],
  woodland: [63, 125, 58],
  grass: [168, 196, 90],
};
const canvas = document.getElementById('world'),
  note = document.getElementById('note');
const s = createWorld2(seed, {}),
  C = clockOf(s);
let prev = new Map(),
  landImg = null,
  landSeen = -1;

// Where the world should be now, in ticks (fractional), from the local calendar and clock (so daylight saving and
// time zones keep the world's hour equal to the viewer's).
function targetTick(now = new Date()) {
  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(born.getFullYear(), born.getMonth(), born.getDate())) /
      864e5,
  );
  const hours = days * 24 + now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 - START_HOUR;
  return Math.max(0, hours / C.hours);
}
// One tick at a time, keeping where everyone was, so they can be drawn gliding to where they are.
function stepOne() {
  prev = new Map(living(s).map(p => [p.id, [p.x, p.y]]));
  stepWorld(s, 1);
}
// Catch up from the world's birth to now in slices, saying how far it has got, then hand over to real time.
function catchUp(done) {
  const goal = Math.floor(targetTick());
  if (s.tick >= goal - 1) return done();
  const n = Math.min(24 * 14, goal - 1 - s.tick);
  stepWorld(s, n);
  note.textContent = `The island is catching up to today: ${dateOf(C, s.tick).label}`;
  setTimeout(() => catchUp(done), 0);
}

// The land, drawn once into its own image (and again when people have seen more): known land in its colours,
// land no one has seen yet dimmed, so the frame shows the whole island and how much of it is known.
function drawLand() {
  const w = T.TW,
    h = T.TH,
    img = new ImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        c = REGION_COL[T.regionAt(x, y)],
        k = T.regionAt(x, y) === 'sea' || s.seenAt[i] >= 0 ? 1 : 0.38;
      img.data.set([c[0] * k, c[1] * k, c[2] * k, 255], i * 4);
    }
  const off = new OffscreenCanvas(w, h);
  off.getContext('2d').putImageData(img, 0, 0);
  landImg = off;
  landSeen = s.discovered;
}
// How dark the sky is now: night, or the soft light of dawn and dusk, fading across the hour.
function darkness(frac) {
  const at = t => (isNight(C, t) ? 0.5 : isNight(C, t - 1) || isNight(C, t + 1) ? 0.22 : 0);
  return at(s.tick) * (1 - frac) + at(s.tick + 1) * frac;
}

function fit() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  const px = Math.min(canvas.width / T.TW, canvas.height / T.TH);
  return { px, ox: (canvas.width - T.TW * px) / 2, oy: (canvas.height - T.TH * px) / 2 };
}
function drawCamps(g, v) {
  for (const b of s.bands) {
    if (b.ended) continue;
    const x = v.ox + (b.camp.x + 0.5) * v.px,
      y = v.oy + (b.camp.y + 0.5) * v.px;
    if (b.fire?.fuel > 0) {
      g.fillStyle = 'rgba(255,190,60,0.35)';
      g.beginPath();
      g.arc(x, y, v.px * 2.4, 0, 7);
      g.fill();
    }
    g.fillStyle = '#ff6a2a';
    g.beginPath();
    g.arc(x, y, Math.max(3, v.px * 0.9), 0, 7);
    g.fill();
  }
}
function drawPeople(g, v, frac) {
  for (const p of living(s)) {
    const [x0, y0] = prev.get(p.id) ?? [p.x, p.y],
      jx = (((p.id * 37) % 7) - 3) / 8,
      jy = (((p.id * 53) % 7) - 3) / 8;
    const x = v.ox + (x0 + (p.x - x0) * frac + 0.5 + jx) * v.px,
      y = v.oy + (y0 + (p.y - y0) * frac + 0.5 + jy) * v.px;
    const r = Math.max(2.5, v.px * 0.55);
    g.fillStyle = 'rgba(0,0,0,0.7)'; // a dark rim, so people show on light grass and sand
    g.beginPath();
    g.arc(x, y, r * 1.35, 0, 7);
    g.fill();
    g.fillStyle = p.body.age < 14 ? '#9fe0ff' : p.sex === 'F' ? '#ffffff' : '#ffd84a';
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
}
function draw(frac) {
  const v = fit(),
    g = canvas.getContext('2d');
  if (!landImg || landSeen !== s.discovered) drawLand();
  g.fillStyle = 'rgb(29,79,134)'; // the sea runs to the frame's edges
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(landImg, v.ox, v.oy, T.TW * v.px, T.TH * v.px);
  drawCamps(g, v);
  drawPeople(g, v, frac);
  g.fillStyle = `rgba(5,10,40,${darkness(frac)})`;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const d = dateOf(C, s.tick);
  note.textContent = `Island ${seed} · Year ${d.year}, ${d.month} · ${living(s).length} people`;
}
// Real time: every few seconds, step whatever hours have passed and draw where everyone is within the hour.
function tick() {
  const t = targetTick();
  while (s.tick < Math.floor(t)) stepOne();
  draw(Math.min(1, Math.max(0, t - s.tick)));
}
async function stayAwake() {
  try {
    await navigator.wakeLock?.request('screen');
  } catch {
    // some frames do not allow it; the frame's own settings then keep the screen on
  }
}
catchUp(() => {
  stayAwake();
  tick();
  setInterval(tick, 3000);
  addEventListener('resize', () => tick());
});
