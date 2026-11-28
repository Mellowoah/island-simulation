// Island, the picture frame: the small world living in time with the viewer's own day. Presentation only: it steps the
// world and draws it; it never changes a rule. One world hour passes each real hour, by the viewer's local clock and
// calendar. The world's year starts on 1 November (the short rains, clock.js), so the world began at 06:00 on
// 1 November of its first year (2026 unless ?since=YYYY): its dawn, its months and its rains run with the viewer's.
// On opening it catches up from its start to now (the same island seed always gives the same history), then carries
// on in real time. Nothing to press.
import { createWorld2, stepWorld, living } from './world.js';
import { clockOf, START_HOUR, dateOf } from './clock.js';
import * as T from './terrain.js';
import { jdOfTick } from './sun.js';
import { prepareLand, paintLand, sunVector, knownField, seaAt } from './frame-render.js';
import { WINTER_HAVEN, followLive, worldSky, lakeCountry } from './frame-weather.js';
import { drawSky } from './frame-sky.js';
import { drawFigure, heightOf } from './frame-people.js';

const Q = new URLSearchParams(location.search);
const seed = Number(Q.get('seed')) || 41;
const born = new Date(Number(Q.get('since')) || 2026, 10, 1); // 1 November
const canvas = document.getElementById('world'),
  note = document.getElementById('note');
const s = createWorld2(seed, {}),
  C = clockOf(s);
let prev = new Map(),
  land = null, // the land's fixed blends and its picture (frame-render.js), made after catching up
  sun = null, // the world's sun this hour (painted with the land)
  live = null, // Winterhaven's sky: the live weather at Winter Haven, Florida (frame-weather.js)
  view = null,
  layer = null; // where each sky is drawn before it is cut to its area
const haven = lakeCountry(T.regionAt, T.TW, T.TH); // Winterhaven: the lake country

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

// The season on the grass: the share of it standing dead (straw) in the plants layer, if the world has one.
const dryness = () => {
  const P = s.plants;
  return P && P.green + P.dead > 0 ? P.dead / (P.green + P.dead) : 0.3;
};
function paint() {
  if (!land) {
    const L = prepareLand(),
      off = new OffscreenCanvas(L.W, L.H);
    land = { L, off, img: new ImageData(L.W, L.H), seen: -1 };
  }
  if (land.seen !== s.discovered) ((land.known = knownField(land.L, s.seenAt)), (land.seen = s.discovered));
  sun = sunVector(jdOfTick(s.tick + frac(), C.hours));
  paintLand(land.L, land.img, sun, dryness(), land.known, performance.now());
  land.off.getContext('2d').putImageData(land.img, 0, 0);
}
const frac = () => Math.min(1, Math.max(0, targetTick() - s.tick));

// The canvas fitted to the screen (only when the screen changes), the island letterboxed in it.
function fit() {
  const dpr = window.devicePixelRatio || 1,
    w = Math.round(innerWidth * dpr),
    h = Math.round(innerHeight * dpr);
  if (view && canvas.width === w && canvas.height === h) return view;
  ((canvas.width = w), (canvas.height = h));
  layer = new OffscreenCanvas(Math.ceil(w / 2), Math.ceil(h / 2));
  const px = Math.min(w / T.TW, h / T.TH);
  view = { px, ox: (w - T.TW * px) / 2, oy: (h - T.TH * px) / 2 };
  return view;
}
// Camps, and their fires glowing in the dark (brighter the darker it is).
function drawCamps(g, v, night) {
  for (const b of s.bands) {
    if (b.ended) continue;
    const x = v.ox + (b.camp.x + 0.5) * v.px,
      y = v.oy + (b.camp.y + 0.5) * v.px;
    if (b.fire?.fuel > 0) {
      const r = v.px * (2.5 + 3.5 * night) * (0.92 + 0.08 * Math.sin(performance.now() / 310 + b.id)),
        glow = g.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, `rgba(255,200,90,${0.35 + 0.5 * night})`);
      glow.addColorStop(1, 'rgba(255,120,30,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = glow;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
      g.globalCompositeOperation = 'source-over';
    }
    g.fillStyle = '#e8622a';
    g.beginPath();
    g.arc(x, y, Math.max(2, v.px * 0.45), 0, 7);
    g.fill();
  }
}
// People as small figures (frame-people.js), gliding between where they were and where they are this hour;
// walking when they are on their way somewhere. Drawn from the back of the picture to the front.
function drawPeople(g, v, f, night) {
  const now = performance.now(),
    at = living(s).map(p => {
      const [x0, y0] = prev.get(p.id) ?? [p.x, p.y],
        jx = (((p.id * 37) % 7) - 3) / 8,
        jy = (((p.id * 53) % 7) - 3) / 8;
      const x = v.ox + (x0 + (p.x - x0) * f + 0.5 + jx) * v.px,
        y = v.oy + (y0 + (p.y - y0) * f + 0.5 + jy) * v.px;
      return { p, x, y, moving: x0 !== p.x || y0 !== p.y };
    });
  for (const { p, x, y, moving } of at.sort((a, b) => a.y - b.y))
    drawFigure(g, p, x, y, heightOf(p, v.px), moving ? Math.sin(now / 170 + p.id) : 0, sun, night);
}
// The two skies: the live one over Winterhaven, the world's own everywhere else.
function drawSkies(g, v, night) {
  const t = performance.now(),
    a = haven && { x: v.ox + haven.x * v.px, y: v.oy + haven.y * v.px, r: haven.r * v.px };
  drawSky(g, layer, worldSky(s.weather), a, false, t, night);
  drawSky(g, layer, live, a, true, t, night);
  if (!a) return;
  g.font = `italic ${Math.round(v.px * 2.4)}px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'center';
  g.fillStyle = `rgba(255,255,255,${0.78 - 0.3 * night})`;
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = v.px;
  g.fillText(WINTER_HAVEN.name, a.x, a.y - a.r * 0.62);
  g.shadowBlur = 0;
}
const skyWords = () =>
  live ? `\n${WINTER_HAVEN.name} · ${Math.round(live.tempF)}°F, ${live.words} · live from ${WINTER_HAVEN.place}` : '';
function draw(f) {
  const v = fit(),
    g = canvas.getContext('2d'),
    night = Math.min(1, Math.max(0, -sun.el / 8));
  g.fillStyle = `rgb(${seaAt(sun.el).map(Math.round).join(',')})`; // the sea runs to the frame's edges
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(land.off, v.ox, v.oy, T.TW * v.px, T.TH * v.px);
  drawSkies(g, v, night);
  drawCamps(g, v, night);
  drawPeople(g, v, f, night);
  const d = dateOf(C, s.tick);
  note.textContent = `Island ${seed} · Year ${d.year}, ${d.month} · ${living(s).length} people${skyWords()}`;
}
// Real time: every few seconds, step whatever hours have passed and repaint the land for the sun's place.
function tick() {
  const t = targetTick();
  while (s.tick < Math.floor(t)) stepOne();
  paint();
}
// Between, about 15 times a second: the skies move, people glide.
let last = 0;
function animate(now) {
  requestAnimationFrame(animate);
  if (now - last < 66) return;
  last = now;
  draw(frac());
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
  followLive(sky => (live = sky));
  tick();
  setInterval(tick, 3000);
  requestAnimationFrame(animate);
});
