// Lab renderer. Draws only what the simulation has: land, shore, river and fords, food and its stock,
// danger zones, creatures, their current action, and information passing between them.
// It reads the world and never writes to it (tests/lab-render.test.mjs).
import { isLand } from './lab.js';

export const TILE = 12;
export const GLYPH = { eat: '•', findFood: '→', rest: 'z', explore: '?', socialize: '♥', share: '…', investigate: '!', avoidDanger: '×' };
export const SHAPES = ['circle', 'square', 'triangle', 'diamond'];
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function terrain(world, makeCanvas) {
  const c = world.config, T = TILE, cv = makeCanvas(c.width * T, c.height * T), g = cv.getContext('2d');
  const land = (x, y) => isLand(world, x, y), river = x => x === c.riverX;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { // water, a little lighter near land
    let near = false; for (let b = -2; b <= 2 && !near; b++) for (let a = -2; a <= 2; a++) if (land(x + a, y + b) && !river(x + a)) { near = true; break; }
    g.fillStyle = near ? '#2c6f86' : hash(x, y) > 0.5 ? '#1f5568' : '#1d5064'; g.fillRect(x * T, y * T, T, T);
  }
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (!land(x, y)) continue;
    if (river(x)) { // a ford: sand with stepping stones
      g.fillStyle = '#cdb983'; g.fillRect(x * T, y * T, T, T); g.fillStyle = '#8d8a80'; g.fillRect(x * T + 2, y * T + 3, 3, 3); g.fillRect(x * T + 7, y * T + 6, 3, 3); continue;
    }
    const shore = !land(x + 1, y) || !land(x - 1, y) || !land(x, y + 1) || !land(x, y - 1);
    const edge = shore && !(river(x + 1) || river(x - 1)); // sand on the sea shore, grass up to the river bank
    g.fillStyle = edge ? '#d8c890' : hash(x, y) > 0.5 ? '#7cab66' : '#84b36d'; g.fillRect(x * T, y * T, T, T);
    // Deterministic terrain details: purely decorative, never fed into simulation.
    const h = hash(x + 17, y + 31), px = x * T, py = y * T;
    if (edge) {
      g.fillStyle = '#f0dea9'; g.fillRect(px + 1, py + 2, 4, 1);
      if (h > .74) { g.fillStyle = '#9e9870'; g.fillRect(px + 8, py + 8, 2, 1); }
    } else {
      g.fillStyle = h > .5 ? '#86b873' : '#75a962'; g.fillRect(px + 1, py + 1, 3, 2);
      if (h > .88 && Math.abs(x - c.riverX) > 2) {
        // Small canopy with a readable trunk and ground shadow.
        g.fillStyle = '#496c4c'; g.fillRect(px + 5, py + 8, 6, 2);
        g.fillStyle = '#76593e'; g.fillRect(px + 5, py + 5, 2, 5);
        g.fillStyle = '#2e674c'; g.fillRect(px + 2, py + 2, 8, 5);
        g.fillStyle = '#44895a'; g.fillRect(px + 3, py + 1, 6, 4);
        g.fillStyle = '#78aa69'; g.fillRect(px + 4, py + 2, 3, 2);
      } else if (h > .64) {
        g.fillStyle = '#356d4c'; g.fillRect(px + 4, py + 7, 1, 3); g.fillRect(px + 7, py + 6, 1, 4);
        g.fillStyle = '#b8d58c'; g.fillRect(px + 4, py + 5, 2, 2);
        if (h > .76) { g.fillStyle = '#efc57e'; g.fillRect(px + 8, py + 5, 2, 2); }
      }
    }
  }
  for (let y = 0; y < c.height; y++) if (!land(c.riverX, y)) { // river: flowing stripes, only where the island is
    if (!land(c.riverX - 1, y) && !land(c.riverX + 1, y)) continue;
    g.fillStyle = '#3b88ad'; g.fillRect(c.riverX * T, y * T, T, T); g.fillStyle = '#7fc1dd'; g.fillRect(c.riverX * T + 3 + (y % 2) * 4, y * T + 2, 2, 6);
  }
  for (const d of world.dangers) { // danger: hatched, so it reads without colour
    for (let y = d.y - c.dangerRadius; y <= d.y + c.dangerRadius; y++) for (let x = d.x - c.dangerRadius; x <= d.x + c.dangerRadius; x++) {
      if (Math.abs(x - d.x) + Math.abs(y - d.y) > c.dangerRadius || !land(x, y)) continue;
      g.fillStyle = 'rgba(150,60,45,.30)'; g.fillRect(x * T, y * T, T, T);
      g.strokeStyle = 'rgba(110,30,20,.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x * T, y * T + T); g.lineTo(x * T + T, y * T); g.moveTo(x * T, y * T + T / 2); g.lineTo(x * T + T / 2, y * T); g.moveTo(x * T + T / 2, y * T + T); g.lineTo(x * T + T, y * T + T / 2); g.stroke();
    }
  }
  return cv;
}

export function createRenderer(makeCanvas) {
  let cache = null, key = '';
  return function render(g, world, selected, now = 0) {
    const T = TILE, c = world.config, k = `${world.seed},${c.width},${c.height},${world.crossingsOpen.join('.')}`;
    if (k !== key) { cache = terrain(world, makeCanvas); key = k; }
    g.drawImage(cache, 0, 0);
    // A restrained water shimmer uses presentation time only; world state stays deterministic.
    g.fillStyle = 'rgba(166,222,224,.22)';
    for (let y = 2; y < c.height - 2; y += 4) {
      const x = c.riverX;
      if (!isLand(world, x, y)) {
        const offset = Math.floor(now / 320 + y) % 5;
        g.fillRect(x * T + 2 + offset, y * T + 3, 3, 1);
      }
    }
    for (const p of world.sources) { // food shows how full it is: that is what creatures misjudge
      const x = p.x * T + 6, y = p.y * T + 6, f = p.stock / p.capacity;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill();
      if (p.type === 'garden') { g.fillStyle = '#7a5230'; g.fillRect(x - 6, y - 5, 12, 10); g.fillStyle = '#9fd070'; for (let i = 0; i < Math.round(f * 4); i++) g.fillRect(x - 5 + i * 3, y - 4, 2, 8); }
      else { g.fillStyle = '#2e6a3a'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.fillStyle = '#e0556a'; for (let i = 0; i < Math.round(f * 6); i++) g.fillRect(x - 4 + (i % 3) * 3, y - 3 + Math.floor(i / 3) * 4, 2, 2); }
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.stroke();
    }
    const sel = world.creatures[selected];
    if (sel?.alive) for (const kn of sel.knowledge) { g.strokeStyle = kn.verified ? 'rgba(255,255,255,.85)' : 'rgba(255,230,140,.95)'; g.lineWidth = 1; g.setLineDash(kn.verified ? [] : [3, 2]); g.strokeRect(kn.x * T - 2, kn.y * T - 2, T + 4, T + 4); }
    g.setLineDash([]);
    for (const m of world.messages.slice(-14)) { // information passing: solid if accepted, faint if ignored
      const age = world.tick - m.tick; if (age > 45) continue;
      const a = world.creatures[m.from], b = world.creatures[m.to];
      g.strokeStyle = m.accepted ? `rgba(255,255,255,${0.9 - age / 60})` : 'rgba(255,255,255,.18)'; g.lineWidth = m.accepted ? 2 : 1;
      g.beginPath(); g.moveTo(a.x * T + 6, a.y * T + 6); g.lineTo(b.x * T + 6, b.y * T + 6); g.stroke();
    }
    g.font = 'bold 9px system-ui, sans-serif'; g.textAlign = 'center';
    for (const cr of world.creatures) {
      if (!cr.alive) continue;
      const x = cr.x * T + 6, y = cr.y * T + 6, shape = SHAPES[cr.id % 4];
      // Presentation only: body, facing, a light bob and colour from existing needs and trust. Never writes to the world.
      const act = cr.action;
      let tx = cr.x, ty = cr.y;
      if (act?.route?.length) { tx = act.route[0][0]; ty = act.route[0][1]; }
      else if (Number.isFinite(act?.target?.x)) { tx = act.target.x; ty = act.target.y; }
      else if (act?.target && act.target.id != null && world.creatures[act.target.id]) { const o = world.creatures[act.target.id]; tx = o.x; ty = o.y; }
      const face = tx < cr.x ? -1 : 1;
      const walking = act && (['findFood', 'explore', 'investigate', 'avoidDanger'].includes(act.type) || ((act.type === 'socialize' || act.type === 'share') && (tx !== cr.x || ty !== cr.y)));
      const phase = now / (walking ? 140 : 420), bob = Math.sin(phase) * (walking ? 1.2 : 0.45), squash = 1 + Math.sin(phase) * (walking ? 0.1 : 0.03);
      const hunger = cr.needs?.hunger ?? 20, energy = cr.needs?.energy ?? 80, safety = cr.needs?.safety ?? 80;
      const trustVals = Object.values(cr.trust || {});
      const trust = trustVals.length ? trustVals.reduce((n, v) => n + v, 0) / trustVals.length : 50;
      const hue = cr.id * 47 % 360;
      const sat = Math.max(42, Math.min(82, 62 + (50 - hunger) * 0.15 + (trust - 50) * 0.12));
      const light = Math.max(38, Math.min(76, 52 + energy * 0.16 + safety * 0.05 - hunger * 0.08));
      const body = `hsl(${hue} ${sat}% ${light}%)`, shade = `hsl(${hue} ${Math.max(30, sat - 8)}% ${Math.max(22, light - 18)}%)`;
      g.save(); g.translate(x, y + bob); g.scale(face, squash);
      g.fillStyle = 'rgba(16,30,34,.35)'; g.beginPath(); g.ellipse(0, 6.2, 5, 1.6, 0, 0, 7); g.fill();
      const step = walking ? Math.sin(phase) * 2 : 0;
      g.fillStyle = shade;
      if (shape === 'diamond') { // fins
        g.beginPath(); g.moveTo(-6, 1); g.lineTo(-9, 4); g.lineTo(-3.5, 4); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(6, 1); g.lineTo(9, 4); g.lineTo(3.5, 4); g.closePath(); g.fill();
      } else { g.fillRect(-4.2, 3 + step, 2.6, 4.2); g.fillRect(1.6, 3 - step, 2.6, 4.2); }
      g.fillStyle = body; g.strokeStyle = '#1a2a2e'; g.lineWidth = 1.2; g.beginPath();
      if (shape === 'square') { g.moveTo(-5, -2); g.lineTo(5, -2); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); }
      else if (shape === 'triangle') { g.moveTo(0, -4); g.lineTo(6.2, 5.5); g.lineTo(-6.2, 5.5); g.closePath(); }
      else if (shape === 'diamond') g.ellipse(0, 1.2, 6.2, 4.3, 0, 0, 7);
      else g.ellipse(0, 1, 5.6, 5.1, 0, 0, 7);
      g.fill(); g.stroke();
      g.beginPath();
      if (shape === 'triangle') { g.moveTo(1.5, -6.5); g.lineTo(7, -2.2); g.lineTo(0.5, -1.2); g.closePath(); }
      else g.arc(0, -5.1, 3.7, 0, 7);
      g.fill(); g.stroke();
      if (shape === 'circle' || shape === 'square') {
        g.fillStyle = shade; g.beginPath(); g.arc(-2.3, -8, 1.5, 0, 7); g.fill(); g.beginPath(); g.arc(2.3, -8, 1.5, 0, 7); g.fill();
      }
      g.fillStyle = '#f9f3df'; g.fillRect(0.5, -6.3, 2.3, 2.2); g.fillRect(-2.5, -6.3, 2, 2);
      g.fillStyle = '#152e35'; g.fillRect(1.5, -5.7, 1.1, 1.2); g.fillRect(-1.3, -5.7, 1, 1.1);
      g.fillStyle = 'rgba(255,255,255,.38)'; g.fillRect(-2.2, 0.2, 3.2, 1.6);
      g.restore();
      const glyph = GLYPH[cr.action?.type]; if (glyph) { g.fillStyle = 'rgba(20,34,40,.85)'; g.fillRect(x + 3, y - 13, 9, 9); g.fillStyle = '#fff'; g.fillText(glyph, x + 7.5, y - 5.5); }
      if (cr.id === selected) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 10 + Math.sin(now / 250), 0, 7); g.stroke(); }
    }
  };
}
