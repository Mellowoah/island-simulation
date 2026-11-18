// Presentation helpers shared by the Canvas and Pixi renderers.
// They read a world and never write to it.
import { TILE, GLYPH, SHAPES } from './lab-render.js';

export { TILE, GLYPH, SHAPES };

export const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Same facing, bob and state colours as the current Canvas creature forms.
export function creaturePresentation(cr, world, now = 0) {
  const T = TILE, act = cr.action;
  let tx = cr.x, ty = cr.y;
  if (act?.route?.length) { tx = act.route[0][0]; ty = act.route[0][1]; }
  else if (Number.isFinite(act?.target?.x)) { tx = act.target.x; ty = act.target.y; }
  else if (act?.target && act.target.id != null && world.creatures[act.target.id]) {
    const o = world.creatures[act.target.id]; tx = o.x; ty = o.y;
  }
  const face = tx < cr.x ? -1 : 1;
  const walking = !!(act && (['findFood', 'explore', 'investigate', 'avoidDanger'].includes(act.type)
    || ((act.type === 'socialize' || act.type === 'share') && (tx !== cr.x || ty !== cr.y))));
  const phase = now / (walking ? 140 : 420);
  const bob = Math.sin(phase) * (walking ? 1.2 : 0.45);
  const squash = 1 + Math.sin(phase) * (walking ? 0.1 : 0.03);
  const hunger = cr.needs?.hunger ?? 20, energy = cr.needs?.energy ?? 80, safety = cr.needs?.safety ?? 80;
  const trustVals = Object.values(cr.trust || {});
  const trust = trustVals.length ? trustVals.reduce((n, v) => n + v, 0) / trustVals.length : 50;
  const hue = cr.id * 47 % 360;
  const sat = Math.max(42, Math.min(82, 62 + (50 - hunger) * 0.15 + (trust - 50) * 0.12));
  const light = Math.max(38, Math.min(76, 52 + energy * 0.16 + safety * 0.05 - hunger * 0.08));
  return {
    x: cr.x * T + 6, y: cr.y * T + 6, shape: SHAPES[cr.id % 4], glyph: GLYPH[act?.type],
    face, walking, phase, bob, squash, hue, sat, light, trust,
    body: `hsl(${hue} ${sat}% ${light}%)`,
    shade: `hsl(${hue} ${Math.max(30, sat - 8)}% ${Math.max(22, light - 18)}%)`,
    step: walking ? Math.sin(phase) * 2 : 0,
  };
}

// Day/night comes only from the existing game clock (minutes in a 1440-tick day).
export function dayNightTint(tick) {
  const minutes = ((tick % 1440) + 1440) % 1440;
  let phase, r, g, b, alpha;
  if (minutes >= 390 && minutes < 450) { // dawn 6:30–7:30
    const t = (minutes - 390) / 60;
    phase = 'dawn'; r = 255; g = 170; b = 110; alpha = 0.22 * (1 - t);
  } else if (minutes >= 450 && minutes < 1050) { // day 7:30–17:30
    phase = 'day'; r = 255; g = 255; b = 255; alpha = 0;
  } else if (minutes >= 1050 && minutes < 1170) { // dusk 17:30–19:30
    const t = (minutes - 1050) / 120;
    phase = 'dusk'; r = 255; g = 130; b = 70; alpha = 0.08 + 0.22 * t;
  } else { // night
    const mid = minutes >= 1170 ? minutes - 1170 : minutes + 270;
    const t = Math.min(1, mid / 180);
    phase = 'night'; r = 40; g = 50; b = 120; alpha = 0.22 + 0.16 * Math.min(1, t);
  }
  return { minutes, phase, r, g, b, alpha };
}

export function prefersReducedMotion() {
  try { return !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

export function drawCreatureCanvas(g, p) {
  g.save();
  g.translate(p.x, p.y + p.bob);
  g.scale(p.face, p.squash);
  g.fillStyle = 'rgba(16,30,34,.4)';
  g.beginPath(); g.ellipse(0, 6.2, 5, 1.6, 0, 0, 7); g.fill();
  g.fillStyle = p.shade;
  if (p.shape === 'diamond') {
    g.beginPath(); g.moveTo(-6, 1); g.lineTo(-9, 4); g.lineTo(-3.5, 4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(6, 1); g.lineTo(9, 4); g.lineTo(3.5, 4); g.closePath(); g.fill();
  } else {
    g.fillRect(-4.2, 3 + p.step, 2.6, 4.2);
    g.fillRect(1.6, 3 - p.step, 2.6, 4.2);
  }
  g.fillStyle = p.body; g.strokeStyle = '#1a2a2e'; g.lineWidth = 1.2; g.beginPath();
  if (p.shape === 'square') { g.moveTo(-5, -2); g.lineTo(5, -2); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); }
  else if (p.shape === 'triangle') { g.moveTo(0, -4); g.lineTo(6.2, 5.5); g.lineTo(-6.2, 5.5); g.closePath(); }
  else if (p.shape === 'diamond') g.ellipse(0, 1.2, 6.2, 4.3, 0, 0, 7);
  else g.ellipse(0, 1, 5.6, 5.1, 0, 0, 7);
  g.fill(); g.stroke();
  g.beginPath();
  if (p.shape === 'triangle') { g.moveTo(1.5, -6.5); g.lineTo(7, -2.2); g.lineTo(0.5, -1.2); g.closePath(); }
  else g.arc(0, -5.1, 3.7, 0, 7);
  g.fill(); g.stroke();
  if (p.shape === 'circle' || p.shape === 'square') {
    g.fillStyle = p.shade; g.beginPath(); g.arc(-2.3, -8, 1.5, 0, 7); g.fill(); g.beginPath(); g.arc(2.3, -8, 1.5, 0, 7); g.fill();
  }
  g.fillStyle = '#f9f3df'; g.fillRect(0.5, -6.3, 2.3, 2.2); g.fillRect(-2.5, -6.3, 2, 2);
  g.fillStyle = '#152e35'; g.fillRect(1.5, -5.7, 1.1, 1.2); g.fillRect(-1.3, -5.7, 1, 1.1);
  g.fillStyle = 'rgba(255,255,255,.38)'; g.fillRect(-2.2, 0.2, 3.2, 1.6);
  g.restore();
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function requestedRenderer() {
  try {
    const q = new URLSearchParams(location.search).get('renderer');
    if (q === 'canvas' || q === '2d') return 'canvas';
    if (q === 'pixi' || q === 'webgl') return 'pixi';
  } catch {}
  return 'auto';
}
