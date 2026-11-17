// Island Lab 16-bit page: setup screen -> game -> graphs -> report.
import { DAY } from './sim.js';
import { labCommand, confidence } from './lab.js';
import { WORLDS, fieldsFor, defaultSetup, normalizeSetup, HELP } from './lab16-setup.js';
import { createRun, stepRun, seriesOf, serializeRun, restoreLabRun, restoreTheoryRun, THEORY_SAVE_KEY, LAB_SAVE_KEY } from './lab16-run.js';
import { viewOfEden, viewOfLab } from './lab16-view.js';
import { createPixelRenderer, loadImage } from './lab16-render.js';
import { chartSpecs, drawLineChart } from './lab16-charts.js';
import { attributesOf, beingsOf, LAYERS, SOURCE } from './being.js';
import { batchSeeds, batchEden, batchLab } from './lab16-batch.js';
import { summarizeEden, summarizeLab, buildEdenReport, buildLabReport, reportMarkdown, reportHTML, reportBodyHTML, twinSetups } from './lab16-report.js';

const $ = id => document.getElementById(id);
const REPORTS_KEY = 'island-lab-reports-v1';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }, del: k => { try { localStorage.removeItem(k); } catch {} } };

let setup = defaultSetup('eden'), run = null, renderer = null, layoutInfo = null, drawInfo = null;
let selected = 0, paused = false, speed = 16, zoom = false, acc = 0, last = performance.now(), lastUI = 0, lastChart = 0, lastSave = 0;
let report = null, reportImages = [];
const cv = $('map'); const g = cv.getContext('2d');
const toast = t => { $('toast').textContent = t; };
const show = id => { for (const s of ['setup', 'game', 'report']) $(s).hidden = s !== id; document.body.dataset.screen = id; window.scrollTo(0, 0); };

// ---------- Setup screen ----------
function renderSetup() {
  $('worlds').innerHTML = Object.entries(WORLDS).map(([k, w]) => `<label class="${setup.world === k ? 'on' : ''}"><input type="radio" name="world" value="${k}" ${setup.world === k ? 'checked' : ''}>${esc(w.label)}<small>${esc(w.note)}</small></label>`).join('');
  for (const r of document.querySelectorAll('input[name=world]')) r.onchange = () => { setup = { ...defaultSetup(r.value), seed: setup.seed, speed: setup.speed, runDays: setup.runDays }; renderSetup(); };
  const f = fieldsFor(setup.world);
  $('setupForm').innerHTML = f.map(x => {
    const fixed = x.fixed?.[setup.world];
    let input;
    if (fixed !== undefined) input = `<span class="fixed">${fixed} (fixed)</span>`;
    else if (x.type === 'number') input = `<input type="number" inputmode="numeric" id="f_${x.key}" min="${x.min}" max="${x.max}" step="${x.step}" value="${setup[x.key]}">`;
    else if (x.type === 'select') input = `<select id="f_${x.key}">${x.options.map(([v, l]) => `<option value="${v}" ${setup[x.key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else input = `<span class="toggle"><button type="button" id="f_${x.key}_off" class="${setup[x.key] ? '' : 'on'}">Off</button><button type="button" id="f_${x.key}_on" class="${setup[x.key] ? 'on' : ''}">On</button></span>`;
    const note = fixed !== undefined ? x.fixedNote : x.note;
    return `<div class="field"><div class="lab"><span>${esc(x.label)}</span>${input}</div><div class="why">${esc(note).replace(/\b(T\d+|P\d)\b/g, '<b>$1</b>')}</div></div>`;
  }).join('');
  for (const x of f) {
    if (x.type === 'toggle') { $(`f_${x.key}_on`).onclick = () => { setup[x.key] = true; renderSetup(); }; $(`f_${x.key}_off`).onclick = () => { setup[x.key] = false; renderSetup(); }; }
    else if ($(`f_${x.key}`)) $(`f_${x.key}`).onchange = e => { setup[x.key] = e.target.value; setup = normalizeSetup(setup); };
  }
  // Continue a saved world
  const cont = [];
  const t = store.get(THEORY_SAVE_KEY);
  if (t) { try { const r = restoreTheoryRun(t).run; cont.push(`<div class="saved"><span>Eden run in progress: seed ${r.setup.seed}, year ${(r.world.tick / DAY).toFixed(1)} of ${r.setup.runDays}.</span><button id="contEden">Continue it</button></div>`); } catch { store.set(THEORY_SAVE_KEY + '-rejected', t); store.del(THEORY_SAVE_KEY); } }
  const l = store.get(LAB_SAVE_KEY);
  if (l) { try { const r = restoreLabRun(l).run; cont.push(`<div class="saved"><span>Saved Lab island: seed ${r.world.seed}, day ${Math.floor(r.world.tick / DAY) + 1}, ${r.world.creatures.filter(c => c.alive).length} alive.</span><button id="contLab">Continue it</button></div>`); } catch { /* left in place: the old page's rules for rejected saves apply when it is opened */ cont.push('<p class="note">A saved Lab island was found but could not be read.</p>'); } }
  $('continue').innerHTML = cont.join('');
  if ($('contEden')) $('contEden').onclick = () => { const r = restoreTheoryRun(store.get(THEORY_SAVE_KEY)); begin(r.run, r.ui); };
  if ($('contLab')) $('contLab').onclick = () => { const r = restoreLabRun(store.get(LAB_SAVE_KEY)); begin(r.run, { ...r.ui, speed: r.ui.speed }); };
  renderSaved();
}
function readForm() { for (const x of fieldsFor(setup.world)) { const el = $(`f_${x.key}`); if (el && x.type !== 'toggle') setup[x.key] = el.value; } return normalizeSetup(setup); }
$('startRun').onclick = () => {
  setup = readForm();
  if (setup.world === 'lab' && store.get(LAB_SAVE_KEY) && !confirm('Start a new Lab island? This replaces the saved Lab island on this device.')) return;
  begin(createRun(setup), { speed: setup.speed });
};

// ---------- Game ----------
function begin(r, ui = {}) {
  run = r; setup = run.setup; report = null;
  selected = Number.isInteger(ui.selected) && ui.selected < run.world.creatures.length ? ui.selected : 0;
  speed = [1, 4, 16, 64].includes(ui.speed) ? ui.speed : setup.speed; paused = false; zoom = false; acc = 0;
  $('speed').textContent = speed + '×'; $('pause').textContent = 'Pause'; $('zoom').textContent = 'Zoom';
  $('labActions').hidden = run.kind !== 'lab';
  $('charts').innerHTML = chartSpecs(run.kind, []).map(c => `<div class="chart"><h3>${esc(c.title)}</h3><canvas id="ch_${c.id}" width="560" height="300"></canvas><div class="key" id="key_${c.id}"></div><p>${esc(c.caption)}</p></div>`).join('');
  show('game'); sizeCanvas(); persist(); update(); drawCharts();
}
const view = () => run.kind === 'eden' ? viewOfEden(run.world) : viewOfLab(run.world);
function sizeCanvas() {
  if (!run || !renderer) return;
  const v = view(), cssW = Math.min(document.documentElement.clientWidth || innerWidth || 360, 1186) - 6; // full width of the screen, minus the border
  layoutInfo = renderer.layout(v, cssW, Math.min(3, window.devicePixelRatio || 1));
  cv.width = layoutInfo.width; cv.height = layoutInfo.height;
  cv.style.width = layoutInfo.cssWidth + 'px'; cv.style.height = layoutInfo.cssHeight + 'px';
}
addEventListener('resize', () => sizeCanvas());
function persist() {
  if (!run) return;
  const text = serializeRun(run, { selected, paused, speed: run.kind === 'lab' ? Math.min(16, speed) : speed });
  store.set(run.kind === 'lab' ? LAB_SAVE_KEY : THEORY_SAVE_KEY, text);
}
const clockOf = t => run.kind === 'eden' ? `YEAR ${(t / DAY).toFixed(1)}` : `DAY ${Math.floor(t / DAY) + 1} ${String(Math.floor(t % DAY / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
function hud() {
  const s = run.world, alive = s.creatures.filter(c => c.alive).length;
  if (run.kind === 'eden') {
    const E = s.eden, rel = E.phase === 'released', spoke = s.creatures.reduce((n, c) => n + c.eden.hearings, 0);
    const silent = s.tick < setup.guidanceYears * DAY;
    const gtxt = setup.guidance < 1 ? ` ${Math.round(setup.guidance * 100)}%` : '';
    $('hud').innerHTML = `<span>${clockOf(s.tick)}<span class="mute">/${setup.runDays}</span></span><span class="heart">♥ ${alive}</span><span class="phase ${rel ? 'rel' : ''}">${rel ? 'RELEASED' : 'GUIDED' + gtxt}</span><span>🐍 ${silent ? 'silent' : 'spoke ' + spoke}</span>${setup.help ? `<span>${s.tick < run.helpUntil ? 'HELP ON' : 'HELP ENDED'}</span>` : ''}<span class="mute">seed ${s.seed}</span>`;
  } else {
    const m = s.samples.at(-1);
    $('hud').innerHTML = `<span>${clockOf(s.tick)}<span class="mute">/${setup.runDays}d</span></span><span class="heart">♥ ${alive}</span><span>trust ${m ? m.trustMean.toFixed(0) : s.config.startTrust}</span><span>lies ${Math.round(s.config.falseInformationRate * 100)}%</span><span class="mute">seed ${s.seed}</span>`;
  }
}
function inspector() {
  const s = run.world, c = s.creatures[selected];
  const bar = (label, v, invert = false) => `<span>${label}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;${invert ? 'background:#ff9a6a' : ''}"></i></div><span>${Math.round(v)}</span>`;
  if (!c) { $('inspector').innerHTML = ''; return; }
  if (!c.alive) {
    const next = s.creatures.find(o => o.alive && o.id > c.id) ?? s.creatures.find(o => o.alive);
    if (next) { selected = next.id; toast(`${c.name} died (${c.death.cause.toLowerCase()}). Now following ${next.name}.`); return inspector(); }
    $('inspector').innerHTML = `<h2>${esc(c.name)}</h2><p>Died: ${esc(c.death.cause)} (${clockOf(c.death.tick)}).</p>`; return;
  }
  if (run.kind === 'eden') {
    const e = c.eden, d = c.decision, age = (s.tick - e.born) / DAY;
    $('inspector').innerHTML = `<h2>${esc(c.name)} <span class="note">age ${age.toFixed(0)} · ${e.sex === 'M' ? 'male' : 'female'} · tap a creature to follow it</span></h2>
      <div class="bars">${bar('Hunger', c.hunger, true)}${bar('Thirst', e.thirst, true)}${bar('Energy', c.energy)}${bar('Health', e.health)}</div>
      <p class="note">Doing: <b>${esc(c.action?.type ?? 'deciding')}</b>${d?.guided && s.tick - d.tick < 90 ? ` · <span style="color:#ffe680">the Creator led it: ${esc(d.guided.reason)}</span>` : d?.own ? ' · its own choice (released)' : ''}</p>
      <p class="note">Curiosity ${(e.curiosity * 100).toFixed(0)} · times led by the Creator ${e.guided} · heard the deceiver ${e.hearings}× · belief in the claim ${(e.credence * 100).toFixed(0)}%${e.covered ? ' · <span style="color:#fff7c2">restored: led and fed by the Creator</span>' : ''}${e.clothed ? ' · clothed' : ''}${e.tool ? ' · has a tool' : ''}</p>`;
  } else {
    const n = c.needs, trusted = Object.values(c.trust), avg = trusted.length ? trusted.reduce((a, b) => a + b, 0) / trusted.length : s.config.startTrust;
    $('inspector').innerHTML = `<h2>${esc(c.name)} <span class="note">tap a creature to follow it</span></h2>
      <div class="bars">${bar('Hunger', n.hunger, true)}${bar('Energy', n.energy)}${bar('Safety', n.safety)}${bar('Social', n.social)}</div>
      <p class="note">Doing: <b>${esc(c.action?.type ?? 'deciding')}</b> · knows ${c.knowledge.length} places · average trust in others ${avg.toFixed(0)}</p>
      <p class="note">${c.knowledge.slice(0, 4).map(k => `${k.type} at ${k.x},${k.y} (${Math.round(confidence(s, k))}%${k.verified ? '' : ', unchecked'})`).join(' · ') || 'Knows no places yet.'}</p>`;
  }
}
// ---------- Attributes and layers of existence (read-only views; they change nothing) ----------
// The <details> boxes are static in the page; only their contents are refreshed, and only while open.
function fmtAttr(a) {
  if (a.status === 'planned') return `<span class="note">planned, phase ${a.phase}</span>`;
  const v = a.value, shown = typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(a.unit === ' years' ? 1 : 0)) : esc(String(v));
  const small = [a.subText, a.status === 'recorded' ? 'recorded' : null].filter(Boolean).join(' · ');
  return `${shown}${a.unit && typeof v === 'number' ? esc(a.unit) : ''}${small ? `<br><span class="note">${esc(small)}</span>` : ''}`;
}
const attrRow = a => `<tr><td>${esc(a.label)}<br><span class="note">${esc(a.channel)}${a.note ? ' · ' + esc(a.note) : ''}</span></td><td class="v">${fmtAttr(a)}</td></tr>`;
function beingPanels(s, c) {
  $('beingBox').hidden = !(run.kind === 'eden' && c && c.alive);
  if ($('beingBox').hidden) return;
  $('attrTitle').textContent = `Attributes of ${c.name}`;
  if ($('attrBox').open) $('attrBody').innerHTML = attributesOf(s, c).map(g => `<p class="note" style="margin:.6em 0 .2em"><b>${esc(g.layer.name)}</b> · ${esc(g.layer.powers)}</p><table class="attrs">${g.rows.map(a => attrRow({ ...a, subText: a.sub ? a.sub(s, c) : null })).join('')}</table>`).join('');
  if ($('layerBox').open) { const byId = Object.fromEntries(LAYERS.map(l => [l.id, l])); $('layerBody').innerHTML = `<table class="attrs">${beingsOf(s).map(b => { const l = b.layer ? byId[b.layer] : SOURCE; return `<tr><td><b>${esc(l.name)}</b><br><span class="note">${esc(l.powers)}</span></td><td class="v">${esc(b.items.join(', '))}</td></tr>`; }).join('')}</table>`; }
}
$('attrBox').ontoggle = () => { if (run) beingPanels(run.world, run.world.creatures[selected]); };
$('layerBox').ontoggle = () => { if (run) beingPanels(run.world, run.world.creatures[selected]); };
function events() {
  const s = run.world;
  const list = run.kind === 'eden' ? [...s.events].reverse().slice(0, 7).map(e => ({ t: e.tick, text: e.text })) : s.events.slice(0, 7).map(e => ({ t: e.tick, text: (e.id !== null ? s.creatures[e.id].name + ': ' : '') + e.text }));
  $('events').innerHTML = list.map(e => `<li><span class="t">${clockOf(e.t)}</span> ${esc(e.text)}</li>`).join('');
}
function update() { if (!run) return; hud(); inspector(); beingPanels(run.world, run.world.creatures[selected]); events(); if (run.kind === 'lab') $('cross').disabled = run.world.crossingsOpen.length >= run.world.config.crossings.length; }
function chartMeta() { return run.kind === 'eden' ? { fallTick: run.world.eden.fallTick, helpStop: setup.help ? run.helpUntil : null } : {}; }
function drawCharts() {
  if (!run) return;
  const rows = seriesOf(run);
  for (const c of chartSpecs(run.kind, rows, chartMeta())) {
    const el = $('ch_' + c.id); if (!el) continue;
    const ctx = el.getContext('2d');
    if (c.empty || rows.length < 2) { ctx.fillStyle = '#101a2e'; ctx.fillRect(0, 0, el.width, el.height); ctx.fillStyle = '#a9b4cf'; ctx.font = '20px monospace'; ctx.fillText(c.empty ? 'Not in this world' : 'Collecting…', 20, 40); }
    else { ctx.save(); ctx.scale(2, 2); drawLineChart(ctx, el.width / 2, el.height / 2, c.xs, c.series, c.opts); ctx.restore(); }
    $('key_' + c.id).innerHTML = c.series.map(s => { const v = s.values.at(-1); return `<span style="color:${s.color}">■ ${esc(s.label)}${v === null || v === undefined ? '' : ' ' + (Math.round(v * 10) / 10)}</span>`; }).join(' &nbsp; ') + ` <span class="note">(x: ${run.kind === 'eden' ? 'years' : 'days'})</span>`;
  }
}
cv.addEventListener('pointerdown', e => {
  if (!run || !drawInfo) return;
  const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * cv.width, py = (e.clientY - r.top) / r.height * cv.height;
  const id = renderer.pick(view(), px, py, drawInfo);
  if (id !== null) { selected = id; inspector(); }
});
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; persist(); };
$('speed').onclick = () => { speed = speed === 1 ? 4 : speed === 4 ? 16 : speed === 16 ? 64 : 1; $('speed').textContent = speed + '×'; };
$('zoom').onclick = () => { zoom = !zoom; $('zoom').textContent = zoom ? 'Whole map' : 'Zoom'; };
$('toSetup').onclick = () => { persist(); run = null; show('setup'); renderSetup(); };
$('reveal').onclick = () => { try { labCommand(run.world, { type: 'revealFood', id: selected }); toast(`Revealed a food source to ${run.world.creatures[selected].name} only.`); persist(); } catch (e) { toast(e.message); } };
$('cross').onclick = () => { try { labCommand(run.world, { type: 'openCrossing' }); toast('A second ford is open.'); persist(); } catch (e) { toast(e.message); } };
$('trust').onclick = () => { labCommand(run.world, { type: 'boostTrust', amount: 20 }); toast('Everyone trusts everyone 20 points more.'); persist(); };
$('endRun').onclick = () => { if (!run) return; if (!run.done && !confirm('End the run now and write the report?')) return; finish(); };

function frame(now) {
  const dt = Math.min(200, now - last); last = now;
  if (run && !paused && !run.done && !document.hidden) {
    const msPerTick = run.kind === 'eden' ? 100 : 50;
    acc += dt * speed; const n = Math.min(Math.floor(acc / msPerTick), 400);
    if (n) { stepRun(run, n); acc -= n * msPerTick; if (acc > msPerTick * 400) acc = 0; }
    if (run.done) { paused = true; persist(); finish(); }
  } else acc = 0;
  if (run && renderer && !$('game').hidden) {
    drawInfo = renderer.draw(g, view(), { selected, now, k: layoutInfo.k, zoom, width: cv.width, height: cv.height });
    if (now - lastUI > 250) { update(); lastUI = now; }
    if (now - lastChart > 1000) { drawCharts(); lastChart = now; }
    if (now - lastSave > 10000) { persist(); lastSave = now; }
  }
  frameTimes.push(now); if (frameTimes.length > 240) frameTimes.shift();
  requestAnimationFrame(frame);
}
const frameTimes = [];
window.__lab16 = { fps: () => { const n = frameTimes.length; return n > 1 ? (n - 1) * 1000 / (frameTimes[n - 1] - frameTimes[0]) : 0; }, run: () => run, report: () => report, setSpeed: v => { speed = v; }, setPaused: v => { paused = v; } };
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
addEventListener('pagehide', () => persist());

// ---------- Report ----------
function runTwin(job, twinSetup, endTick, onProgress) {
  return new Promise((resolve, reject) => {
    let w;
    try { w = new Worker(new URL('./lab16-worker.js', import.meta.url), { type: 'module' }); } catch { w = null; }
    if (!w) return resolve(runTwinHere(twinSetup, endTick, onProgress));
    let settled = false;
    w.onmessage = e => { const m = e.data; if (m.progress !== undefined) onProgress(m.progress); else { settled = true; w.terminate(); m.error ? reject(Error(m.error)) : resolve(m.summary); } };
    w.onerror = () => { if (!settled) { settled = true; w.terminate(); resolve(runTwinHere(twinSetup, endTick, onProgress)); } };
    w.postMessage({ job, setup: twinSetup, endTick });
  });
}
async function runTwinHere(twinSetup, endTick, onProgress) { // fallback: same code, on the page, in slices
  const r = createRun(twinSetup); r.endTick = Math.min(r.endTick, endTick);
  while (!r.done) { stepRun(r, 720); onProgress(r.world.tick / r.endTick); await new Promise(res => setTimeout(res, 0)); }
  return r.kind === 'lab' ? summarizeLab(r) : summarizeEden(r);
}
function chartImages() {
  return chartSpecs(run.kind, seriesOf(run), chartMeta()).filter(c => !c.empty).map(c => ({ title: c.title, caption: c.caption, src: $('ch_' + c.id)?.toDataURL('image/png') })).filter(i => i.src);
}
async function finish() {
  if (!run) return;
  run.endTick = run.world.tick; run.done = true; paused = true; $('pause').textContent = 'Resume';
  persist(); drawCharts();
  show('report'); $('reportActions').hidden = true; $('reportBody').innerHTML = '';
  const created = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET';
  reportImages = chartImages();
  if (run.kind === 'lab') { report = buildLabReport(summarizeLab(run), { created, setup }); return showReport(); }
  const tw = twinSetups(setup), prog = { guidance: 0, help: 0 };
  const paint = () => { $('reportProgress').innerHTML = `<h2>Writing the report</h2><p class="note">To judge each prediction fairly, the lab runs two matched islands with the same seed for the same ${(run.world.tick / DAY).toFixed(1)} years: one where the Creator steps in ${Math.round(tw.guidance.guidance * 100)}% of the time instead of ${Math.round(setup.guidance * 100)}%, and one with help ${tw.help.help ? 'on' : 'off'}.</p><div class="progress"><i style="width:${Math.round((prog.guidance + prog.help) * 50)}%"></i></div>`; };
  paint();
  try {
    const main = summarizeEden(run);
    const [gS, hS] = await Promise.all([runTwin('guidance', tw.guidance, run.world.tick, p => { prog.guidance = p; paint(); }), runTwin('help', tw.help, run.world.tick, p => { prog.help = p; paint(); })]);
    report = buildEdenReport(main, gS, hS, { created, setup });
    showReport();
  } catch (e) { $('reportProgress').innerHTML = `<h2>Report failed</h2><p>${esc(e.message)}</p>`; }
}
function showReport() {
  $('reportProgress').innerHTML = `<h2>Run complete</h2><p class="note">Read it here, download it, or save it on this device.</p>`;
  $('reportBody').innerHTML = reportBodyHTML(report, reportImages);
  $('reportActions').hidden = false;
  $('batchBox').hidden = false; $('batchRun').disabled = false; $('batchProgress').innerHTML = report.batch ? '<p class="note">Batch test added to the report above.</p>' : '';
}
// ---------- Batch test: the same choices on many seeds ----------
async function pool(jobs, width) { const out = Array(jobs.length); let next = 0; await Promise.all(Array.from({ length: width }, async () => { while (next < jobs.length) { const i = next++; out[i] = await jobs[i](); } })); return out; }
$('batchRun').onclick = async () => {
  if (!report || !run) return;
  const n = Number($('batchN').value), seeds = batchSeeds(setup.seed, n), endTick = run.world.tick, kind = run.kind;
  const variants = kind === 'eden' ? { main: setup, g: twinSetups(setup).guidance, h: twinSetups(setup).help, ...(setup.restoration ? { r: { ...setup, restoration: false } } : {}), ...(setup.tempters ? { d: { ...setup, tempters: 0 } } : {}) }
    : { main: setup, talk: { ...setup, talk: !setup.talk }, ...(setup.falseInfo > 0 ? { lies: { ...setup, falseInfo: 0 } } : {}) };
  const keys = Object.keys(variants), total = seeds.length * keys.length, prog = Array(total).fill(0);
  const paint = () => { const p = prog.reduce((a, b) => a + b, 0) / total; $('batchProgress').innerHTML = `<p class="note">Running ${total} islands (${seeds.length} seeds × ${keys.length} worlds). You can leave this screen open; it takes a few minutes.</p><div class="progress"><i style="width:${Math.round(p * 100)}%"></i></div>`; };
  $('batchRun').disabled = true; paint();
  try {
    const jobs = seeds.flatMap((seed, si) => keys.map((k, ki) => () => runTwin(k, { ...variants[k], seed }, endTick, p => { prog[si * keys.length + ki] = p; paint(); }).then(r => { prog[si * keys.length + ki] = 1; paint(); return r; })));
    const res = await pool(jobs, Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)));
    const rows = seeds.map((seed, si) => Object.fromEntries([['seed', seed], ...keys.map((k, ki) => [k, res[si * keys.length + ki]])]));
    if (kind === 'lab') for (const r of rows) r.lies ??= null; else for (const r of rows) { r.r ??= null; r.d ??= null; }
    report.batch = { seeds, rows: kind === 'eden' ? batchEden(rows) : batchLab(rows) };
    showReport(); $('saveReport').textContent = 'Save on this phone';
  } catch (e) { $('batchProgress').innerHTML = `<p>Batch test failed: ${esc(e.message)}</p>`; $('batchRun').disabled = false; }
};
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
const fileBase = () => `island-lab-${report.kind}-seed${report.main.seed}-${new Date().toISOString().slice(0, 10)}`;
$('dlMd').onclick = () => download(fileBase() + '.md', reportMarkdown(report), 'text/markdown');
$('dlHtml').onclick = () => download(fileBase() + '.html', reportHTML(report, reportImages), 'text/html');
$('saveReport').onclick = () => {
  let list = []; try { list = JSON.parse(store.get(REPORTS_KEY) || '[]'); } catch {}
  list.unshift({ title: report.title, created: report.created, md: reportMarkdown(report), html: reportHTML(report) });
  list = list.slice(0, 20);
  toast(store.set(REPORTS_KEY, JSON.stringify(list)) ? 'Report saved on this device.' : 'Could not save on this device (storage full?).');
  $('saveReport').textContent = 'Saved ✓';
};
$('backToGame').onclick = () => { if (run) { show('game'); sizeCanvas(); } else show('setup'); };
$('newRun').onclick = () => { if (run?.kind === 'eden') store.del(THEORY_SAVE_KEY); run = null; show('setup'); renderSetup(); };
function renderSaved() {
  let list = []; try { list = JSON.parse(store.get(REPORTS_KEY) || '[]'); } catch {}
  if (!list.length) return;
  $('savedReports').innerHTML = list.map((r, i) => `<div class="saved"><span>${esc(r.title)}<br><span class="note">${esc(r.created ?? '')}</span></span><button data-i="${i}" data-a="open">Open</button><button data-i="${i}" data-a="md">.md</button><button data-i="${i}" data-a="del">Delete</button></div>`).join('');
  for (const b of $('savedReports').querySelectorAll('button')) b.onclick = () => {
    const r = list[+b.dataset.i];
    if (b.dataset.a === 'open') { const w = window.open('', '_blank'); if (w) { w.document.write(r.html); w.document.close(); } else download(r.title.replace(/\W+/g, '-') + '.html', r.html, 'text/html'); }
    else if (b.dataset.a === 'md') download(r.title.replace(/\W+/g, '-') + '.md', r.md, 'text/markdown');
    else if (confirm('Delete this saved report?')) { list.splice(+b.dataset.i, 1); store.set(REPORTS_KEY, JSON.stringify(list)); renderSetup(); }
  };
}

// ---------- Start ----------
(async () => {
  const want = params.get('renderer');
  let town = null, dungeon = null;
  if (want !== 'plain') { try { [town, dungeon] = await Promise.all([loadImage('art/tiny-town.png'), loadImage('art/tiny-dungeon.png')]); } catch (e) { console.warn('Art failed; using flat pixel tiles', e); } }
  renderer = createPixelRenderer({ makeCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }), town, dungeon, reducedMotion: reduced });
  $('engine').textContent = `Renderer: Canvas 2D, ${renderer.art ? '16-bit tiles (Kenney CC0)' : 'flat pixel fallback'}. Help, when on: ${HELP.amount} food every sim month.`;
  renderSetup(); show('setup');
  requestAnimationFrame(frame);
})();
