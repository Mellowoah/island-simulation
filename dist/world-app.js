// Island: the small world, on a phone. Presentation only: it reads the world and steps it; it never changes a rule.
import { createWorld2, stepWorld, worldMetrics, ageOf, living } from './world.js';
import { clockOf, dateOf, hourOf, isNight } from './clock.js';
import * as T from './terrain.js';
import { FOODS } from './savanna.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const seed = Number(new URLSearchParams(location.search).get('seed')) || 41;
const s = createWorld2(seed);
const C = clockOf(s);

let skipping = 0, skipEnd = 0;
const history = []; // one row a year (measure only, kept here, not in the world)
let px = 6, speed = 24, paused = false, selected = null, follow = false, acc = 0, last = performance.now(), drawnDiscovered = -1, lastUi = 0;

const REGION_COL = { sea: '#1d4f86', lake: '#3a86c8', river: '#4aa3df', rock: '#8a7f72', shore: '#e4d7a0', woodland: '#3f7d3a', grass: '#a8c45a' };
const FOOD_COL = { berries: '#d0455e', baobab: '#f0c040', tubers: '#a0602a', nuts: '#7a4a20', honey: '#ffb000', fish: '#c0e8ff', shellfish: '#f4f0ec' };
$('legend').innerHTML = Object.entries(REGION_COL).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('') +
  Object.entries(FOOD_COL).map(([k, c]) => `<span><i style="background:${c};border-radius:50%"></i>${FOODS[k].label.toLowerCase()}</span>`).join('') +
  '<span><i style="background:#ff6a2a;border-radius:50%"></i>camp</span><span><i style="background:#fff;border-radius:50%"></i>woman</span><span><i style="background:#ffd84a;border-radius:50%"></i>man</span><span><i style="background:#9fe0ff;border-radius:50%"></i>child</span>';

const land = $('land'), ppl = $('people'), wrap = $('mapWrap');
function sizeCanvases() { for (const c of [land, ppl]) { c.width = T.TW * px; c.height = T.TH * px; c.style.width = c.width + 'px'; c.style.height = c.height + 'px'; } drawnDiscovered = -1; }

// Land layer: only what someone has seen; the rest stays black. Redrawn when more is discovered.
function drawLand() {
  const g = land.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, land.width, land.height);
  for (let y = 0; y < T.TH; y++) for (let x = 0; x < T.TW; x++) {
    const i = y * T.TW + x;
    if (s.seenAt[i] < 0) continue;
    g.fillStyle = REGION_COL[T.regionAt(x, y)]; g.fillRect(x * px, y * px, px, px);
  }
  drawnDiscovered = s.discovered;
}
const seen = (x, y) => s.seenAt[y * T.TW + x] >= 0;
function drawPeople() {
  const g = ppl.getContext('2d'); g.clearRect(0, 0, ppl.width, ppl.height);
  // food and water that has been seen
  for (const q of s.patches) if (seen(q.x, q.y)) {
    const f = Math.min(1, q.stock / Math.max(1e-9, q.capacity)); g.globalAlpha = 0.35 + 0.65 * f; g.fillStyle = FOOD_COL[q.food];
    g.beginPath(); g.arc((q.x + 0.5) * px, (q.y + 0.5) * px, Math.max(2, px * 0.45), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (const w of s.waters) if (seen(w.x, w.y)) { g.strokeStyle = w.active ? '#bfe8ff' : '#6b5a40'; g.lineWidth = 2; g.beginPath(); g.arc((w.x + 0.5) * px, (w.y + 0.5) * px, Math.max(2, px * 0.5), 0, 7); g.stroke(); }
  // camp
  g.fillStyle = '#ff6a2a'; g.beginPath(); g.arc((s.camp.x + 0.5) * px, (s.camp.y + 0.5) * px, Math.max(4, px * 0.9), 0, 7); g.fill();
  // people
  for (const p of s.people) {
    if (!p.alive) continue;
    const a = p.body.age, col = a < 14 ? '#9fe0ff' : p.sex === 'F' ? '#ffffff' : '#ffd84a';
    const jx = ((p.id * 37) % 7 - 3) / 8, jy = ((p.id * 53) % 7 - 3) / 8; // spread people on the same tile
    g.fillStyle = '#000'; g.beginPath(); g.arc((p.x + 0.5 + jx) * px, (p.y + 0.5 + jy) * px, Math.max(2.5, px * 0.42), 0, 7); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc((p.x + 0.5 + jx) * px, (p.y + 0.5 + jy) * px, Math.max(1.8, px * 0.32), 0, 7); g.fill();
    if (selected === p.id) { g.strokeStyle = '#ff3a3a'; g.lineWidth = 2; g.beginPath(); g.arc((p.x + 0.5 + jx) * px, (p.y + 0.5 + jy) * px, Math.max(6, px * 1.1), 0, 7); g.stroke(); }
  }
  // night
  const h = hourOf(C, s.tick);
  if (isNight(C, s.tick)) { g.fillStyle = 'rgba(5,10,40,0.45)'; g.fillRect(0, 0, ppl.width, ppl.height); }
  else if (h < 7.5 || h > 17.5) { g.fillStyle = 'rgba(40,20,60,0.18)'; g.fillRect(0, 0, ppl.width, ppl.height); }
}
function centerOn(x, y, smooth = false) { wrap.scrollTo({ left: (x + 0.5) * px - wrap.clientWidth / 2, top: (y + 0.5) * px - wrap.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' }); }

// Tap: pick the nearest living person to the tap.
wrap.addEventListener('click', e => {
  const r = land.getBoundingClientRect(), x = (e.clientX - r.left) / px, y = (e.clientY - r.top) / px;
  let best = null, bd = 3;
  for (const p of s.people) if (p.alive) { const d = Math.hypot(p.x + 0.5 - x, p.y + 0.5 - y); if (d < bd) { bd = d; best = p; } }
  if (best) { selected = best.id; ui(true); }
});

const pct = v => Math.round(v);
function bar(label, v, col, txt) { return `<span>${label}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></span><span>${txt ?? pct(v)}</span>`; }
const STEP_WORD = { walk: 'walking', gather: 'gathering', sleep: 'asleep', rest: 'resting', camp: 'at camp', drink: 'drinking', unload: 'bringing food home' };
function who() {
  const p = s.people[selected]; if (!p) return;
  const a = ageOf(s, p), fam = s.households[p.household]?.members.filter(i => i !== p.id).map(i => s.people[i]).filter(q => q.alive).map(q => `${esc(q.name)} (${Math.floor(ageOf(s, q))})`).join(', ') || 'none';
  const parents = [p.mother, p.father].map(i => i === null ? null : s.people[i]).filter(Boolean).map(q => esc(q.name) + (q.alive ? '' : ' †')).join(' and ') || 'not recorded (first generation)';
  const carer = s.carer.get(p.id);
  const doing = !p.alive ? `died: ${esc(p.death.cause.toLowerCase())}` : carer ? `with ${esc(carer.name)}${a < 3 ? ', carried' : ''}` : (STEP_WORD[p.step?.k] ?? 'deciding') + (p.step?.q ? ` ${esc(p.step.q.name.toLowerCase())}` : '') + (p.step?.explore ? ' (exploring)' : '');
  let known = p.seenCount ?? 0; if (p.seen) { known = 0; for (let i = 0; i < p.seen.length; i++) known += p.seen[i]; }
  const d = p.decision;
  $('whoTitle').textContent = `${p.name} · ${p.sex === 'F' ? 'female' : 'male'} · ${Math.floor(a)}`;
  $('who').innerHTML = `<p>Parents: ${parents}. Household: ${fam}.</p>
    <div class="bars">${bar('Hunger', p.hunger, '#e0703a')}${bar('Thirst', p.thirst, '#4aa3df')}${bar('Body fat', p.reserve / p.body.fatMax * 100, '#f0c040', pct(p.reserve / p.body.fatMax * 100) + '%')}${bar('Energy', p.energy, '#7fd88f')}${bar('Health', p.health, '#ff8aa0')}</div>
    <p><b>Now:</b> ${doing}. ${p.carry > 0 ? `Carrying ${Math.round(p.carry)} kcal home.` : ''}</p>
    ${d && !carer ? `<p class="opts"><b>Last choice:</b> ${esc(d.chose)}, because ${esc(d.why)}.<br>Options weighed: ${d.options.map(o => `${esc(o.k)} ${o.u.toFixed(2)}`).join(' · ')}</p>` : ''}
    <p class="note">Body: ${p.body.mass.toFixed(1)} kg, burns about ${Math.round(p.body.base)} kcal a day at rest and work, walks ${(p.body.kmh).toFixed(1)} km/h. Temperament: curiosity ${pct(p.mind.curiosity * 100)}, caution ${pct(p.mind.caution * 100)}, care ${pct(p.mind.care * 100)}, sociability ${pct(p.mind.social * 100)}. Knows ${(known * T.TILE_KM ** 2).toFixed(0)} km² of the island and ${Object.keys(p.places).length} food places. Walked ${(p.tiles * T.TILE_KM).toFixed(0)} km in all.</p>
    <details><summary>Their life so far</summary><ul id="story">${p.memories.slice(-30).reverse().map(m => `<li><span class="t">${esc(dateOf(C, m.t).label)}</span>${esc(m.text)}</li>`).join('')}</ul></details>`;
}
function ui(force = false) {
  const m = worldMetrics(s);
  $('hud').innerHTML = `<span>${esc(m.date.toUpperCase())}</span><span>♥ ${m.population}</span><span class="mute">${m.households} families · ${m.generations + 1} generation${m.generations ? 's' : ''}</span><span class="mute">known ${Math.round(m.discoveredShare * 100)}% of ${Math.round(m.landKm2)} km²</span><span class="mute">${paused ? 'paused' : speed === 24 ? '1 day/s' : speed === 168 ? '1 week/s' : '1 month/s'}</span>`;
  const dd = Object.entries(m.deaths).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ') || 'none';
  $('band').innerHTML = `Born: ${m.births}. Died: ${dd}. Children under 14: ${m.children}. Grown members' body fat: ${Math.round(m.meanFat * 100)}% of full. Food shared between families so far: ${Math.round(m.shared / 1000)} thousand kcal. Camp: ${esc(s.waters.find(w => w.id === s.camp.water).name.toLowerCase())}.`;
  $('log').innerHTML = s.events.slice(-14).reverse().map(e => `<li><span class="t">${esc(dateOf(C, e.t).label)}</span>${esc(e.text)}</li>`).join('');
  if (selected !== null) who();
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === speed && !paused);
  $('pause').textContent = paused ? 'Play' : 'Pause'; if (skipping) $('hud').innerHTML += `<span>SKIPPING to year ${Math.floor(skipEnd / C.year) + 1}…</span>`; $('follow').classList.toggle('on', follow);
}

$('pause').onclick = () => { paused = !paused; ui(); };
for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => { speed = Number(b.dataset.speed); paused = false; ui(); };
$('zoomIn').onclick = () => { const cx = (wrap.scrollLeft + wrap.clientWidth / 2) / px, cy = (wrap.scrollTop + wrap.clientHeight / 2) / px; px = Math.min(16, px + 2); sizeCanvases(); centerOn(cx, cy); };
$('zoomOut').onclick = () => { const cx = (wrap.scrollLeft + wrap.clientWidth / 2) / px, cy = (wrap.scrollTop + wrap.clientHeight / 2) / px; px = Math.max(3, px - 2); sizeCanvases(); centerOn(cx, cy); };
$('toCamp').onclick = () => centerOn(s.camp.x, s.camp.y, true);
$('follow').onclick = () => { if (selected === null) selected = s.people.find(p => p.alive && p.body.age >= 18)?.id ?? null; follow = !follow; ui(true); };

function record() {
  const y = Math.floor(s.tick / C.year); if (history.length && history.at(-1).y >= y) return;
  const m = worldMetrics(s), died = Object.values(m.deaths).reduce((a, b) => a + b, 0), prev = history.at(-1);
  history.push({ y, pop: m.population, born: m.births - (prev?.bornTot ?? 0), died: died - (prev?.diedTot ?? 0), bornTot: m.births, diedTot: died, known: m.discoveredShare, gen: m.generations });
}
function drawLong() {
  const c = $('long'), g = c.getContext('2d'), W2 = c.width, H2 = c.height, pad = 28;
  g.clearRect(0, 0, W2, H2); g.fillStyle = '#0a1230'; g.fillRect(0, 0, W2, H2);
  if (history.length < 2) { g.fillStyle = '#aab4d4'; g.font = '14px monospace'; g.fillText('A point appears each simulated year.', 20, H2 / 2); return; }
  const n = history.length, maxPop = Math.max(10, ...history.map(h => h.pop)), maxGen = Math.max(1, ...history.map(h => h.gen));
  const X = i => pad + (W2 - pad - 8) * i / (n - 1), Y = (v, mx) => H2 - pad - (H2 - pad - 10) * v / mx;
  g.strokeStyle = '#33478c'; g.beginPath(); g.moveTo(pad, 10); g.lineTo(pad, H2 - pad); g.lineTo(W2 - 8, H2 - pad); g.stroke();
  g.fillStyle = '#aab4d4'; g.font = '12px monospace'; g.fillText(String(maxPop), 2, 18); g.fillText(`year ${history[0].y + 1}`, pad, H2 - 8); g.fillText(`year ${history.at(-1).y + 1}`, W2 - 90, H2 - 8);
  const line = (k, mx, col) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); history.forEach((h, i) => { const y = Y(h[k], mx); i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); }); g.stroke(); };
  line('known', 1, '#ffd84a'); line('gen', maxGen * 1.1, '#7fc4ff'); line('born', maxPop, '#7fd88f'); line('died', maxPop, '#ff6a6a'); line('pop', maxPop, '#ffffff');
}
for (const b of document.querySelectorAll('[data-skip]')) b.onclick = () => { skipping = Number(b.dataset.skip); skipEnd = s.tick + skipping * C.year; paused = false; $('stopSkip').disabled = false; for (const x of document.querySelectorAll('[data-skip]')) x.disabled = true; };
$('stopSkip').onclick = () => { skipEnd = s.tick; };
function skipStep(now) {
  // run in slices so the page stays responsive; the map is not drawn while skipping
  const until = performance.now() + 40;
  while (performance.now() < until && s.tick < skipEnd && worldMetrics(s).population > 0) { stepWorld(s, 24); record(); }
  if (s.tick >= skipEnd || !living(s).length) { skipping = 0; $('stopSkip').disabled = true; for (const x of document.querySelectorAll('[data-skip]')) x.disabled = false; drawnDiscovered = -1; }
  $('longNote').firstChild && ($('longNote').dataset.k = 1);
}

function frame(now) {
  const dt = Math.min(200, now - last); last = now;
  if (skipping) { skipStep(now); if (now - lastUi > 500) { ui(); drawLong(); lastUi = now; } requestAnimationFrame(frame); return; }
  if (!paused) {
    acc += dt / 1000 * speed;
    const n = Math.min(Math.floor(acc), 400);
    if (n) { stepWorld(s, n); acc -= n; if (acc > 400) acc = 0; }
  }
  if (s.discovered !== drawnDiscovered && (now - lastUi > 400 || drawnDiscovered < 0)) drawLand();
  drawPeople();
  if (follow && selected !== null) { const p = s.people[selected]; if (p?.alive) centerOn(p.x, p.y); }
  record();
  if (now - lastUi > 500) { ui(); drawLong(); lastUi = now; }
  requestAnimationFrame(frame);
}
sizeCanvases(); drawLand(); ui();
requestAnimationFrame(() => { centerOn(s.camp.x, s.camp.y); requestAnimationFrame(frame); });
window.__world = { s, setSpeed: v => { speed = v; }, select: id => { selected = id; ui(true); } };
