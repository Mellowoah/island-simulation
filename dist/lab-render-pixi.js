// PixiJS v8 lab renderer. Draws only what the simulation has, plus decorative land, water and light.
// It reads the world and never writes to it. Static land is baked to a canvas texture (one quad a
// frame). Moving marks and creatures are painted to a canvas sprite so the path renderer is not used.
import { isLand } from './lab.js';
import { TILE } from './lab-render.js';
import { hash, creaturePresentation, dayNightTint, prefersReducedMotion, drawCreatureCanvas, GLYPH } from './lab-look.js';

export const PIXI_VERSION = '8.23.0';
export const PIXI_CDN = 'https://cdn.jsdelivr.net/npm/pixi.js@8.23.0/dist/pixi.min.mjs';

async function loadPixiLib() {
  try { return await import('./vendor/pixi.min.mjs'); }
  catch (err) {
    console.warn('Vendored PixiJS failed, trying the pinned CDN', err);
    return await import(PIXI_CDN);
  }
}

function canvasTexture(Texture, w, h, paint, resolution = 2) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * resolution));
  c.height = Math.max(1, Math.round(h * resolution));
  const ctx = c.getContext('2d');
  ctx.scale(c.width / w, c.height / h);
  paint(ctx);
  return Texture.from(c);
}

function paintPalm(ctx, px, py, hv) {
  const lean = (hv - 0.5) * 2, topX = px + 6 + lean, topY = py + 2;
  ctx.fillStyle = 'rgba(42,74,32,.35)';
  ctx.beginPath(); ctx.ellipse(px + 6, py + 10, 4.8, 1.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a5a32'; ctx.fillRect(px + 5.1 + lean * 0.2, py + 3, 2, 8);
  ctx.fillStyle = '#c48a4a'; ctx.fillRect(px + 5.5 + lean * 0.2, py + 3, 0.7, 8);
  const fronds = [[-8, 4], [-6, -2], [-2, -7], [2, -7], [6, -2], [8, 4]];
  fronds.forEach(([dx, dy], i) => {
    ctx.fillStyle = i % 2 ? '#2f8a45' : '#4bb35a';
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + dx * 0.5, topY + dy * 0.3 - 1.5, topX + dx, topY + dy);
    ctx.quadraticCurveTo(topX + dx * 0.35, topY + dy * 0.15, topX, topY);
    ctx.fill();
  });
  ctx.fillStyle = '#2d6a38'; ctx.beginPath(); ctx.arc(topX, topY, 1.4, 0, 7); ctx.fill();
}

function paintBush(ctx, px, py, hv) {
  ctx.fillStyle = 'rgba(42,74,36,.3)';
  ctx.beginPath(); ctx.ellipse(px + 6, py + 9, 5, 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3d8a40'; ctx.beginPath(); ctx.ellipse(px + 4, py + 6, 3.4, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4aa04c'; ctx.beginPath(); ctx.ellipse(px + 8, py + 6.5, 3.2, 2.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#67b85a'; ctx.beginPath(); ctx.ellipse(px + 6, py + 4.5, 2.8, 2.6, 0, 0, 7); ctx.fill();
  if (hv > 0.9) { ctx.fillStyle = '#e0556a'; ctx.beginPath(); ctx.arc(px + 5, py + 5, 0.8, 0, 7); ctx.fill(); }
  if (hv > 0.95) { ctx.fillStyle = '#e0556a'; ctx.beginPath(); ctx.arc(px + 8, py + 6, 0.7, 0, 7); ctx.fill(); }
}

function bakeLandTexture(Texture, world) {
  const c = world.config, T = TILE, W = c.width * T, H = c.height * T;
  const taken = new Set([
    ...world.sources.map(p => p.y * c.width + p.x),
    ...world.dangers.map(p => p.y * c.width + p.x),
  ]);
  return canvasTexture(Texture, W, H, ctx => {
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (!isLand(world, x, y)) continue;
      const px = x * T, py = y * T, hv = hash(x, y);
      if (x === c.riverX) {
        ctx.fillStyle = '#e8d49a'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#9a9688'; ctx.beginPath(); ctx.roundRect(px + 2, py + 3, 3.5, 3.2, 1); ctx.fill();
        ctx.fillStyle = '#8a8680'; ctx.beginPath(); ctx.roundRect(px + 7, py + 6, 3.5, 3.2, 1); ctx.fill();
        continue;
      }
      const seaShore = !isLand(world, x + 1, y) || !isLand(world, x - 1, y) || !isLand(world, x, y + 1) || !isLand(world, x, y - 1);
      const riverEdge = (x + 1 === c.riverX) || (x - 1 === c.riverX);
      if (seaShore && !riverEdge) {
        ctx.fillStyle = hv > 0.5 ? '#f3e2b0' : '#ead49a'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(255,246,210,.8)'; ctx.fillRect(px + 1, py + 2, 4, 1.2);
        if (hv > 0.7) { ctx.fillStyle = '#d2c48a'; ctx.beginPath(); ctx.arc(px + 8, py + 8, 0.8, 0, 7); ctx.fill(); }
      } else {
        ctx.fillStyle = hv > 0.5 ? '#7dce66' : '#6fc15c'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = hv > 0.5 ? '#8ed872' : '#62b352'; ctx.fillRect(px + 1, py + 1, 3, 2);
      }
    }
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (!isLand(world, x, y) || x === c.riverX || taken.has(y * c.width + x)) continue;
      const seaShore = !isLand(world, x + 1, y) || !isLand(world, x - 1, y) || !isLand(world, x, y + 1) || !isLand(world, x, y - 1);
      const riverEdge = (x + 1 === c.riverX) || (x - 1 === c.riverX);
      if (seaShore && !riverEdge) continue;
      const px = x * T, py = y * T, hv = hash(x + 17, y + 31);
      if (hv > 0.91 && Math.abs(x - c.riverX) > 2) paintPalm(ctx, px, py, hv);
      else if (hv > 0.82 && Math.abs(x - c.riverX) > 1) paintBush(ctx, px, py, hv);
      else if (hv > 0.5) {
        ctx.fillStyle = '#3d7a3a'; ctx.fillRect(px + 3, py + 7, 1, 3);
        ctx.fillStyle = '#9ad56a'; ctx.fillRect(px + 3, py + 6, 2, 2);
        if (hv > 0.68) {
          ctx.fillStyle = '#3d7a3a'; ctx.fillRect(px + 7, py + 6, 1, 4);
          ctx.fillStyle = '#cce07a'; ctx.fillRect(px + 7, py + 5, 2, 2);
        }
      }
    }
    for (const d of world.dangers) {
      for (let y = d.y - c.dangerRadius; y <= d.y + c.dangerRadius; y++) for (let x = d.x - c.dangerRadius; x <= d.x + c.dangerRadius; x++) {
        if (Math.abs(x - d.x) + Math.abs(y - d.y) > c.dangerRadius || !isLand(world, x, y)) continue;
        const px = x * T, py = y * T;
        ctx.fillStyle = 'rgba(150,60,45,.30)'; ctx.fillRect(px, py, T, T);
        ctx.strokeStyle = 'rgba(110,30,20,.75)'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(px, py + T); ctx.lineTo(px + T, py);
        ctx.moveTo(px, py + T / 2); ctx.lineTo(px + T / 2, py);
        ctx.moveTo(px + T / 2, py + T); ctx.lineTo(px + T, py + T / 2);
        ctx.stroke();
      }
    }
  }, 2);
}

function shorePoints(world) {
  const T = TILE, out = [];
  const { width, height } = world.config;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!isLand(world, x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isLand(world, x + dx, y + dy)) continue;
      out.push({ x: x * T + 6 + dx * 6, y: y * T + 6 + dy * 6, k: hash(x * 13 + dx, y * 17 + dy) });
    }
  }
  return out;
}

export async function createPixiRenderer(canvas, opts = {}) {
  const { Application, Sprite, TilingSprite, Texture } = await loadPixiLib();
  const makeTex = (w, h, paint, resolution = 2) => canvasTexture(Texture, w, h, paint, resolution);
  const app = new Application();
  const resolution = opts.resolution ?? Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
  await app.init({
    canvas,
    width: 864,
    height: 528,
    resolution,
    antialias: true,
    background: 0x156a86,
    preference: 'webgl',
    autoDensity: false,
    hello: false,
  });
  app.ticker.stop();

  const waterTex = makeTex(32, 32, ctx => {
    ctx.fillStyle = '#1b7ca3'; ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(58,160,196,0.55)' : 'rgba(43,142,182,0.55)';
      ctx.fillRect(0, 3 + i * 4, 32, 2);
      ctx.fillStyle = 'rgba(143,212,234,0.28)';
      ctx.fillRect((i * 7) % 32, 4 + i * 4, 12, 1);
    }
  });
  const nightTex = makeTex(2, 2, ctx => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 2, 2); }, 1);

  const water = new TilingSprite({ texture: waterTex, width: 864, height: 528 });
  const land = new Sprite();
  land.width = 864; land.height = 528;
  const dynCanvas = document.createElement('canvas');
  dynCanvas.width = 864 * 2; dynCanvas.height = 528 * 2;
  const dctx = dynCanvas.getContext('2d', { alpha: true });
  const dynTex = Texture.from(dynCanvas);
  const marks = new Sprite(dynTex);
  marks.width = 864; marks.height = 528;
  const night = new Sprite(nightTex);
  night.width = 864; night.height = 528;
  night.alpha = 0;
  app.stage.addChild(water, land, marks, night);

  let cacheKey = '', shores = [], landTex = null;

  function render(_unused, world, selected, now = 0) {
    if (!world) return 'pixi';
    const c = world.config, T = TILE;
    const key = `${world.seed},${c.width},${c.height},${world.crossingsOpen.join('.')}`;
    if (key !== cacheKey) {
      if (landTex) landTex.destroy(true);
      landTex = bakeLandTexture(Texture, world);
      land.texture = landTex;
      shores = shorePoints(world);
      cacheKey = key;
    }

    const reduced = prefersReducedMotion();
    const t = reduced ? 0 : now;
    water.tilePosition.x = t / 45;
    water.tilePosition.y = Math.sin(t / 900) * 3;

    const g = dctx;
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, 864, 528);
    // Shoreline foam and river shimmer, on the water side of the land.
    for (const s of shores) {
      const phase = reduced ? 0.2 : Math.sin(now / 280 + s.k * 12);
      g.fillStyle = `rgba(245,251,255,${0.28 + 0.4 * (0.5 + 0.5 * phase)})`;
      g.beginPath(); g.ellipse(s.x, s.y, 4.2 + phase * 1.1, 1.8 + phase * 0.35, 0, 0, 7); g.fill();
    }
    for (let y = 2; y < c.height - 2; y++) {
      if (isLand(world, c.riverX, y)) continue;
      if (!isLand(world, c.riverX - 1, y) && !isLand(world, c.riverX + 1, y)) continue;
      const offset = reduced ? 2 : Math.floor(now / 280 + y) % 6;
      g.fillStyle = 'rgba(198,238,248,0.55)';
      g.fillRect(c.riverX * T + 2 + offset, y * T + 4, 4, 1.4);
    }
    for (const p of world.sources) {
      const x = p.x * T + 6, y = p.y * T + 6, f = p.stock / p.capacity;
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(x, y + 1, 8, 0, 7); g.fill();
      if (p.type === 'garden') {
        g.fillStyle = '#7a5230'; g.fillRect(x - 6, y - 5, 12, 10);
        g.fillStyle = '#9fd070'; for (let i = 0; i < Math.round(f * 4); i++) g.fillRect(x - 5 + i * 3, y - 4, 2, 8);
      } else {
        g.fillStyle = '#2e6a3a'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
        g.fillStyle = '#e0556a'; for (let i = 0; i < Math.round(f * 6); i++) g.fillRect(x - 4 + (i % 3) * 3, y - 3 + Math.floor(i / 3) * 4, 2, 2);
      }
      g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath();
      g.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.stroke();
    }
    const sel = world.creatures[selected];
    if (sel?.alive) for (const kn of sel.knowledge) {
      g.strokeStyle = kn.verified ? 'rgba(255,255,255,.85)' : 'rgba(255,230,140,.95)';
      g.lineWidth = 1; g.setLineDash(kn.verified ? [] : [3, 2]);
      g.strokeRect(kn.x * T - 2, kn.y * T - 2, T + 4, T + 4);
    }
    g.setLineDash([]);
    for (const m of world.messages.slice(-14)) {
      const age = world.tick - m.tick; if (age > 45) continue;
      const a = world.creatures[m.from], b = world.creatures[m.to];
      if (!a || !b) continue;
      g.strokeStyle = m.accepted ? `rgba(255,255,255,${Math.max(0, 0.9 - age / 60)})` : 'rgba(255,255,255,.18)';
      g.lineWidth = m.accepted ? 2 : 1;
      g.beginPath(); g.moveTo(a.x * T + 6, a.y * T + 6); g.lineTo(b.x * T + 6, b.y * T + 6); g.stroke();
    }
    g.font = 'bold 9px system-ui, sans-serif'; g.textAlign = 'center';
    for (const cr of world.creatures) {
      if (!cr.alive) continue;
      const p = creaturePresentation(cr, world, now);
      drawCreatureCanvas(g, p);
      if (p.glyph) {
        g.fillStyle = 'rgba(20,34,40,.85)'; g.fillRect(p.x + 3, p.y - 13, 9, 9);
        g.fillStyle = '#fff'; g.fillText(p.glyph, p.x + 7.5, p.y - 5.5);
      }
      if (cr.id === selected) {
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath();
        g.arc(p.x, p.y, 10 + Math.sin(now / 250), 0, 7); g.stroke();
      }
    }
    dynTex.source.update();

    const tint = dayNightTint(world.tick);
    night.tint = (tint.r << 16) + (tint.g << 8) + tint.b;
    night.alpha = tint.alpha;
    night.blendMode = tint.phase === 'day' ? 'normal' : 'multiply';

    app.render();
    return 'pixi';
  }

  render.dispose = () => { try { app.destroy(false, { children: true, texture: true }); } catch {} };
  render.engine = 'pixi';
  render.app = app;
  return render;
}
