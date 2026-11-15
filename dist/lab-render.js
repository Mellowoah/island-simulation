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
    if (!edge && hash(y, x) > 0.82) { g.fillStyle = '#6b9a58'; g.fillRect(x * T + 3 + Math.floor(hash(x + 9, y) * 5), y * T + 3 + Math.floor(hash(x, y + 9) * 5), 2, 2); }
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
      g.fillStyle = `hsl(${cr.id * 47 % 360} 75% 72%)`; g.strokeStyle = '#1a2a2e'; g.lineWidth = 1.5; g.beginPath();
      if (shape === 'circle') g.arc(x, y, 5, 0, 7);
      else if (shape === 'square') g.rect(x - 4.5, y - 4.5, 9, 9);
      else if (shape === 'triangle') { g.moveTo(x, y - 6); g.lineTo(x + 5.5, y + 4.5); g.lineTo(x - 5.5, y + 4.5); g.closePath(); }
      else { g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.closePath(); }
      g.fill(); g.stroke();
      const glyph = GLYPH[cr.action?.type]; if (glyph) { g.fillStyle = 'rgba(20,34,40,.85)'; g.fillRect(x + 3, y - 13, 9, 9); g.fillStyle = '#fff'; g.fillText(glyph, x + 7.5, y - 5.5); }
      if (cr.id === selected) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9 + Math.sin(now / 250), 0, 7); g.stroke(); }
    }
  };
}
