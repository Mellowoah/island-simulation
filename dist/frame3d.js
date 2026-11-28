// Island, the diorama: the same world as the picture frame (frame.html), drawn as a table-top model in 3D by the
// graphics chip. Presentation only. The world lives in time with the viewer's own day (frame-world.js); its sun casts
// the shadows; the grass takes the season from the plants layer; people walk; fires burn at night.
import { living } from './world.js';
import { frameWorld, dryness } from './frame-world.js';
import { knownField } from './frame-render.js';
import { buildLand, colourLand, buildSea } from './frame3d-land.js';
import { buildTrees, buildLife, placeLife } from './frame3d-life.js';
import { makeStage, lightFor, aim } from './frame3d-stage.js';

const Q = new URLSearchParams(location.search);
const w = frameWorld(Number(Q.get('seed')) || 41, new Date(Number(Q.get('since')) || 2026, 10, 1));
const canvas = document.getElementById('world'),
  note = document.getElementById('note');
let st,
  land,
  life,
  night = 0,
  seen = { discovered: -1, dry: -1 };

function build() {
  land = buildLand();
  st = makeStage(canvas, land.size);
  life = buildLife();
  st.scene.add(land.mesh, ...buildSea(land), ...buildTrees(land), ...life.parts);
}
// Each few seconds: step whatever hours have passed; recolour the land when the season or what is known has moved.
function tick() {
  while (w.s.tick < Math.floor(w.target())) w.step();
  const dry = Math.round(dryness(w.s) * 50) / 50;
  if (dry !== seen.dry || w.s.discovered !== seen.discovered) {
    colourLand(land, dry, knownField(land.L, w.s.seenAt));
    seen = { discovered: w.s.discovered, dry };
  }
  night = lightFor(st, w.sun());
  const d = w.date();
  note.textContent = `Island ${w.seed} · Year ${d.year}, ${d.month} · ${living(w.s).length} people`;
}
function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1),
    W = Math.round(innerWidth * dpr),
    H = Math.round(innerHeight * dpr);
  if (canvas.width === W && canvas.height === H) return W / H;
  st.renderer.setSize(W, H, false);
  st.post.resize(W, H);
  return W / H;
}
// ?close=1 looks at the first camp from near by (to see the people), in place of the whole island.
function closeView() {
  const b = Q.get('close') && w.s.bands.find(b => !b.ended);
  return b ? [(b.camp.x + 0.5) * 0.35, (b.camp.y + 0.5) * 0.35] : null;
}
let last = 0;
function animate(now) {
  requestAnimationFrame(animate);
  if (now - last < 33) return;
  last = now;
  aim(st, Date.now(), fit(), closeView());
  placeLife(life, land, w, night, now);
  st.post.render(st.scene, st.camera);
}
async function stayAwake() {
  try {
    await navigator.wakeLock?.request('screen');
  } catch {
    // some frames do not allow it; the frame's own settings then keep the screen on
  }
}
w.catchUp(
  t => (note.textContent = t),
  () => {
    build();
    stayAwake();
    tick();
    setInterval(tick, 3000);
    requestAnimationFrame(animate);
  },
);
