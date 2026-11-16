// Island Lab 16-bit renderer (Canvas2D, nearest-neighbour). Draws a read-only view (lab16-view.js).
// It keeps its own animation cache (drawn positions, facing) and never writes to the world.
// Art: Kenney "Tiny Town" and "Tiny Dungeon" (CC0). Water, sand, serpent, springs, bridge and icons are
// drawn here in code (CC0, see CREDITS.md). Without the art sheets it falls back to flat pixel tiles.
export const T = 16;
export const HEROES = [84, 85, 86, 87, 88, 96, 97, 98, 99, 100, 109, 110, 111, 112]; // Tiny Dungeon people
const TILE = { grass: 0, tuft: 1, flower: 2, pine: 27, tree: 16, oak: 16, bush: 5, sprout: 17, mush: 29, dirt: 40, fruitTree: 15, stone: 43 };
const DTILE = { chest: 89, grave: 64, spider: 122 };
const PAL = { deep: '#2459a8', water: '#2f6fc4', shallow: '#3f8fd8', hi: '#9fd4ff', foam: '#eaf7ff', sand: '#e8cf8f', sandDot: '#d2ae68', sandEdge: '#c0954f',
  grass: '#6abe4a', grassDark: '#4f9a3a', outline: '#1d1a2a', plank: '#b7783f', plankDark: '#7a4a26' };

export const hash2 = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 1274126177) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const SERPENT = [
  '................', '.........kkk....', '........kGGGk...', '.......kGwkGk...', '.......kGGGGGk..', '........kkGGk.r.', '..........kGk...', '...kkkk...kGk...',
  '..kGGGGk.kGGk...', '.kGgggGGkGGk....', '.kGgkkgGGGk.....', '.kGGk.kGGk......', '..kGGkkGGk......', '...kGGGGGk......', '....kkkkk.......', '................'];
const SPAL = { k: '#16241a', G: '#4fa83a', g: '#e7d35a', w: '#ffffff', r: '#d23a3a' };
const ICONS = {
  rest: ['kkkk...', '...k...', '..k....', '.k..kkk', 'kkkk..k', '.....k.', '....kkk'],
  drink: ['...b...', '..bbb..', '.bbbbb.', '.bbwbb.', 'bbbbwbb', '.bbbbb.', '..bbb..'],
  gather: ['....g..', '...g...', '.rrrrr.', 'rrwrrrr', 'rrrrrrr', '.rrrrr.', '..r.r..'],
  explore: ['..yyy..', '..yyy..', '..yyy..', '..yyy..', '.......', '..yyy..', '..yyy..'],
  work: ['.kkkk..', '.kkkkk.', '..k.kk.', '...k...', '...k...', '...k...', '...k...'],
};
const IPAL = { k: '#2a2230', b: '#3f9be8', w: '#ffffff', g: '#3c9a3c', r: '#d9443a', y: '#ffd84a' };
const ACT_ICON = { rest: 'rest', drink: 'drink', gather: 'gather', eat: 'gather', findFood: 'gather', explore: 'explore', cultivate: 'work', craft: 'work', investigate: 'explore' };

function paintMap(g, rows, pal, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const c = pal[rows[y][x]]; if (c) { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); } }
}

export function createPixelRenderer({ makeCanvas, town = null, dungeon = null, reducedMotion = false } = {}) {
  const art = !!(town && dungeon);
  const cache = new Map(); // id -> { x, y, face, moving } in art pixels (presentation only)
  let baked = null;
  const sprites = {};
  const mk = (w, h, paint) => { const c = makeCanvas(w, h), g = c.getContext('2d'); if (g) { g.imageSmoothingEnabled = false; paint(g); } return c; };
  sprites.serpent = mk(16, 16, g => paintMap(g, SERPENT, SPAL));
  for (const [k, rows] of Object.entries(ICONS)) sprites[k] = mk(7, 7, g => paintMap(g, rows, IPAL));

  const town16 = (g, i, dx, dy) => { if (art) g.drawImage(town, (i % 12) * T, Math.floor(i / 12) * T, T, T, dx, dy, T, T); };
  const dung16 = (g, i, dx, dy, flip = false) => {
    if (!art) return;
    if (flip) { g.save(); g.translate(dx + T, dy); g.scale(-1, 1); g.drawImage(dungeon, (i % 12) * T, Math.floor(i / 12) * T, T, T, 0, 0, T, T); g.restore(); }
    else g.drawImage(dungeon, (i % 12) * T, Math.floor(i / 12) * T, T, T, dx, dy, T, T);
  };

  function waterTile(g, x, y, f, shallowSides) {
    const px = x * T, py = y * T;
    g.fillStyle = shallowSides.any ? PAL.shallow : PAL.water; g.fillRect(px, py, T, T);
    if (!shallowSides.any) { g.fillStyle = PAL.deep; for (let i = 0; i < 3; i++) g.fillRect(px + Math.floor(hash2(x, y, i) * 14), py + Math.floor(hash2(x, y, i + 9) * 14), 2, 1); }
    // moving wave crests
    g.fillStyle = PAL.hi;
    for (let i = 0; i < 2; i++) {
      const wy = py + 3 + i * 8 + Math.floor(hash2(x, y, 20 + i) * 3), wx = px + ((Math.floor(hash2(x, y, 30 + i) * 16) + f * 2) % 13);
      g.fillRect(wx, wy, 3, 1); g.fillRect(wx + 1, wy - 1, 1, 1);
    }
    // foam along shores
    g.fillStyle = PAL.foam;
    const foam = (fx, fy, w, h) => g.fillRect(fx, fy, w, h);
    for (let i = 0; i < T; i += 2) {
      const on = ((i >> 1) + f) % 3 !== 0;
      if (!on) continue;
      if (shallowSides.n) foam(px + i, py, 2, 1);
      if (shallowSides.s) foam(px + i, py + T - 1, 2, 1);
      if (shallowSides.w) foam(px, py + i, 1, 2);
      if (shallowSides.e) foam(px + T - 1, py + i, 1, 2);
    }
  }
  function sandEdges(g, x, y, sides) {
    const px = x * T, py = y * T;
    const strip = (sx, sy, w, h) => { g.fillStyle = PAL.sand; g.fillRect(sx, sy, w, h); };
    if (sides.n) strip(px, py, T, 4); if (sides.s) strip(px, py + T - 4, T, 4); if (sides.w) strip(px, py, 4, T); if (sides.e) strip(px + T - 4, py, 4, T);
    g.fillStyle = PAL.sandDot;
    for (let i = 0; i < 4; i++) { const dx = Math.floor(hash2(x, y, 40 + i) * 16), dy = Math.floor(hash2(x, y, 50 + i) * 16);
      if ((sides.n && dy < 4) || (sides.s && dy > 11) || (sides.w && dx < 4) || (sides.e && dx > 11)) g.fillRect(px + dx, py + dy, 1, 1); }
  }
  function grassTile(g, x, y, f) {
    const px = x * T, py = y * T, r = hash2(x, y, 1);
    if (art) {
      const base = r < 0.05 ? TILE.flower : r < 0.35 ? TILE.tuft : TILE.grass;
      if (base === TILE.tuft && f % 2 === 1) { town16(g, TILE.grass, px, py); g.save(); g.beginPath(); g.rect(px, py, T, T); g.clip(); town16(g, TILE.tuft, px + 1, py); g.restore(); }
      else town16(g, base, px, py);
    } else {
      g.fillStyle = PAL.grass; g.fillRect(px, py, T, T); g.fillStyle = PAL.grassDark;
      for (let i = 0; i < 3; i++) g.fillRect(px + Math.floor(hash2(x, y, 60 + i) * 14) + (f % 2), py + Math.floor(hash2(x, y, 70 + i) * 14), 1, 2);
    }
  }
  function bridgeTile(g, x, y) {
    const px = x * T, py = y * T;
    g.fillStyle = PAL.plankDark; g.fillRect(px, py + 1, T, T - 2);
    g.fillStyle = PAL.plank; for (let i = 0; i < 4; i++) g.fillRect(px + 1, py + 2 + i * 3.5 | 0, T - 2, 2);
  }

  function bake(view) {
    const W = view.w, H = view.h, isLand = view.isLand, frames = [];
    const crossing = new Set(view.crossings.map(c => c.y * W + c.x));
    const busy = [...view.food, ...view.springs, ...view.dangers, ...(view.tree ? [view.tree] : []), ...view.crossings];
    const nearBusy = (x, y) => busy.some(b => Math.abs(b.x - x) + Math.abs(b.y - y) <= 2);
    const decor = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isLand(x, y) || crossing.has(y * W + x) || nearBusy(x, y)) continue;
      const allLand = isLand(x - 1, y) && isLand(x + 1, y) && isLand(x, y - 1) && isLand(x, y + 1);
      const r = hash2(x, y, 7);
      if (allLand && r < 0.035) decor.push({ x, y, i: TILE.tree });
    }
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(W * T, H * T), g = c.getContext('2d');
      if (!g) { frames.push(c); continue; }
      g.imageSmoothingEnabled = false;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const L = isLand(x, y), isX = crossing.has(y * W + x);
        if (!L || isX) {
          const sides = { n: isLand(x, y - 1) && !crossing.has((y - 1) * W + x), s: isLand(x, y + 1) && !crossing.has((y + 1) * W + x), w: isLand(x - 1, y), e: isLand(x + 1, y) };
          sides.any = sides.n || sides.s || sides.w || sides.e;
          waterTile(g, x, y, f, sides);
          if (isX) bridgeTile(g, x, y);
        } else {
          grassTile(g, x, y, f);
          const sides = { n: !isLand(x, y - 1), s: !isLand(x, y + 1), w: !isLand(x - 1, y) && !crossing.has(y * W + x - 1), e: !isLand(x + 1, y) && !crossing.has(y * W + x + 1) };
          if (sides.n || sides.s || sides.w || sides.e) sandEdges(g, x, y, sides);
        }
      }
      for (const d of decor) {
        if (art) town16(g, d.i, d.x * T, d.y * T);
        else { g.fillStyle = '#2e6b34'; g.fillRect(d.x * T + 3, d.y * T + 1, 10, 11); g.fillStyle = '#6b4226'; g.fillRect(d.x * T + 7, d.y * T + 12, 2, 3); }
      }
      frames.push(c);
    }
    return { key: view.terrainKey + ':' + art, frames, W, H };
  }

  // Integer pixel scale for a canvas that is cssW CSS pixels wide on a screen with this devicePixelRatio.
  function layout(view, cssW, dpr = 1) {
    const k = Math.max(1, Math.floor(cssW * dpr / (view.w * T) + 0.03)); // integer scale that fits (a hair of slack for rounding)
    return { k, width: view.w * T * k, height: view.h * T * k, cssWidth: view.w * T * k / dpr, cssHeight: view.h * T * k / dpr };
  }

  function presentPos(c, now) {
    const tx = c.x * T, ty = c.y * T + (c.child ? 4 : 0) + 0;
    let p = cache.get(c.id);
    if (!p) { p = { x: tx, y: ty, face: 1, moving: false, t: now }; cache.set(c.id, p); }
    const dt = Math.max(0, Math.min(100, now - p.t)); p.t = now;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > T * 3 || reducedMotion) { p.x = tx; p.y = ty; p.moving = false; }
    else if (d > 0.01) { const step = Math.min(d, dt * T / 160); p.x += dx / d * step; p.y += dy / d * step; p.moving = true; if (Math.abs(dx) > 0.5) p.face = dx < 0 ? -1 : 1; }
    else p.moving = false;
    return p;
  }

  function draw(g, view, { selected = null, now = 0, k = 1, zoom = false, width, height } = {}) {
    if (!g) return;
    if (!baked || baked.key !== view.terrainKey + ':' + art) baked = bake(view);
    const s = k * (zoom ? 2 : 1), cw = width ?? view.w * T * k, ch = height ?? view.h * T * k;
    const vw = cw / s, vh = ch / s;
    let camX = 0, camY = 0;
    if (zoom) {
      const sel = view.creatures[selected] ?? view.creatures.find(c => c.alive);
      const p = sel ? (cache.get(sel.id) ?? { x: sel.x * T, y: sel.y * T }) : { x: view.w * T / 2, y: view.h * T / 2 };
      camX = Math.round(Math.min(Math.max(p.x + 8 - vw / 2, 0), view.w * T - vw)); camY = Math.round(Math.min(Math.max(p.y + 8 - vh / 2, 0), view.h * T - vh));
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = PAL.deep; g.fillRect(0, 0, cw, ch);
    g.setTransform(s, 0, 0, s, -camX * s, -camY * s);
    const f = reducedMotion ? 0 : Math.floor(now / 320) % 4;
    g.drawImage(baked.frames[f], 0, 0);
    // danger zones (Lab)
    for (const d of view.dangers) {
      g.fillStyle = 'rgba(150,30,40,0.22)';
      for (let y = -d.r; y <= d.r; y++) for (let x = -d.r; x <= d.r; x++) if (Math.abs(x) + Math.abs(y) <= d.r && view.isLand(d.x + x, d.y + y)) g.fillRect((d.x + x) * T, (d.y + y) * T, T, T);
      if (art) dung16(g, DTILE.spider, d.x * T, d.y * T); else { g.fillStyle = '#7a2230'; g.fillRect(d.x * T + 4, d.y * T + 4, 8, 8); }
    }
    // springs
    for (const w of view.springs) {
      const px = w.x * T, py = w.y * T;
      g.fillStyle = '#7d7f8c'; g.fillRect(px + 1, py + 3, 14, 11); g.fillStyle = '#5a5c68'; g.fillRect(px + 1, py + 12, 14, 2);
      g.fillStyle = PAL.shallow; g.fillRect(px + 3, py + 5, 10, 7); g.fillStyle = PAL.hi; g.fillRect(px + 4 + (f % 3) * 2, py + 7, 3, 1); g.fillRect(px + 9 - (f % 2) * 2, py + 10, 2, 1);
    }
    // food
    for (const p of view.food) {
      const px = p.x * T, py = p.y * T;
      if (p.kind !== 'sown') { g.fillStyle = PAL.outline; g.fillRect(px + 1, py + 15, 14, 2); g.fillStyle = p.fill > 0.3 ? '#7fd88f' : p.fill > 0.1 ? '#ffd84a' : '#ff6a5a'; g.fillRect(px + 1, py + 15, Math.max(1, Math.round(14 * Math.min(1, p.kind === 'gift' ? p.stock / 200 : p.fill))), 2); }
      if (p.kind === 'gift') { if (art) dung16(g, DTILE.chest, px, py); else { g.fillStyle = '#a0632f'; g.fillRect(px + 3, py + 5, 10, 8); } }
      else if (p.kind === 'field' || p.kind === 'sown') {
        if (art) town16(g, TILE.dirt, px, py); else { g.fillStyle = '#b07a45'; g.fillRect(px, py, T, T); }
        g.fillStyle = '#8a5a30'; for (let i = 0; i < 4; i++) g.fillRect(px + 1, py + 2 + i * 4, 14, 1);
        if (p.kind === 'field') { const n = Math.round(p.fill * 6); g.fillStyle = '#5fbf3a'; for (let i = 0; i < n; i++) g.fillRect(px + 2 + (i % 3) * 5, py + 1 + Math.floor(i / 3) * 8, 2, 3); g.fillStyle = '#f0d34a'; for (let i = 0; i < n; i++) g.fillRect(px + 2 + (i % 3) * 5, py + 1 + Math.floor(i / 3) * 8, 2, 1); }
      } else {
        if (art) town16(g, TILE.bush, px, py); else { g.fillStyle = '#3f8f3a'; g.fillRect(px + 2, py + 3, 12, 11); }
        const n = Math.round(p.fill * 6);
        for (let i = 0; i < n; i++) { const bx = px + 3 + (i % 3) * 4, by = py + 4 + Math.floor(i / 3) * 4; g.fillStyle = '#7a1020'; g.fillRect(bx, by, 3, 3); g.fillStyle = '#ff3d55'; g.fillRect(bx, by, 2, 2); g.fillStyle = '#ffd0d8'; g.fillRect(bx, by, 1, 1); }
        if (p.fill < 0.06) { g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(px + 2, py + 3, 12, 11); }
      }
    }
    // graves of the dead (newest 60)
    const dead = view.creatures.filter(c => !c.alive).sort((a, b) => (b.deathTick ?? 0) - (a.deathTick ?? 0)).slice(0, 60);
    for (const c of dead) { if (art) dung16(g, DTILE.grave, c.x * T, c.y * T); else { g.fillStyle = '#9aa0b0'; g.fillRect(c.x * T + 5, c.y * T + 4, 6, 9); } cache.delete(c.id); }
    // living creatures and the tree, painted back to front
    const items = view.creatures.filter(c => c.alive).map(c => ({ y: c.y + (c.child ? 0.1 : 0), c }));
    if (view.tree) items.push({ y: view.tree.y, tree: true });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.tree) {
        const px = view.tree.x * T, py = view.tree.y * T;
        g.fillStyle = 'rgba(20,40,20,0.35)'; g.fillRect(px - 4, py + 13, 24, 3);
        if (art) g.drawImage(town, (TILE.fruitTree % 12) * T, Math.floor(TILE.fruitTree / 12) * T, T, T, px - 8, py - 16, T * 2, T * 2); else { g.fillStyle = '#d9822b'; g.fillRect(px + 2, py, 12, 12); g.fillStyle = '#6b4226'; g.fillRect(px + 7, py + 12, 2, 4); }
        if (view.phase === 'guided') {
          g.drawImage(sprites.serpent, px + 9, py - 4);
          if (view.serpentSpoke && view.tick - view.serpentSpoke.tick < 120) {
            g.fillStyle = '#fff'; g.fillRect(px + 18, py - 24, 15, 9); g.fillRect(px + 20, py - 15, 3, 2);
            g.fillStyle = PAL.outline; g.fillRect(px + 21, py - 20, 2, 2); g.fillRect(px + 25, py - 20, 2, 2); g.fillRect(px + 29, py - 20, 2, 2);
          }
        }
        continue;
      }
      const c = it.c, p = presentPos(c, now), bob = p.moving && !reducedMotion ? (Math.floor(now / 140) % 2) : 0;
      const x = Math.round(p.x) + (c.child ? 6 : 0), y = Math.round(p.y) - bob;
      g.fillStyle = 'rgba(10,20,30,0.35)'; g.fillRect(x + 3, Math.round(p.y) + 14, 10, 2);
      if (art) {
        if (c.child) { g.drawImage(dungeon, (HEROES[c.id % HEROES.length] % 12) * T, Math.floor(HEROES[c.id % HEROES.length] / 12) * T, T, T, x + 2, y + 4, 12, 12); }
        else dung16(g, HEROES[c.id % HEROES.length], x, y, p.face < 0);
      } else { g.fillStyle = `hsl(${(c.id * 47) % 360} 60% 60%)`; g.fillRect(x + 4, y + 3, 8, 11); g.fillStyle = PAL.outline; g.fillRect(x + 5, y + 5, 2, 2); g.fillRect(x + 9, y + 5, 2, 2); }
      if (c.covered) { g.fillStyle = '#fff7c2'; g.fillRect(x + 5, y - 2, 6, 1); g.fillRect(x + 4, y - 1, 1, 1); g.fillRect(x + 11, y - 1, 1, 1); } // restored: a small halo
      if (c.led && !reducedMotion) { g.fillStyle = Math.floor(now / 200) % 2 ? '#ffe680' : '#fff7c2'; g.fillRect(x + 7, y - 4, 2, 2); g.fillRect(x + 3, y - 1, 1, 1); g.fillRect(x + 12, y - 2, 1, 1); }
      if (c.id === selected) {
        g.fillStyle = '#ffe14d';
        for (const [cx, cy, w, h] of [[x - 1, y - 1, 4, 1], [x - 1, y - 1, 1, 4], [x + 13, y - 1, 4, 1], [x + 16, y - 1, 1, 4], [x - 1, y + 16, 4, 1], [x - 1, y + 13, 1, 4], [x + 13, y + 16, 4, 1], [x + 16, y + 13, 1, 4]]) g.fillRect(cx, cy, w, h);
        const icon = sprites[ACT_ICON[c.act]];
        if (icon) { g.fillStyle = '#fff'; g.fillRect(x + 4, y - 11, 9, 9); g.drawImage(icon, x + 5, y - 10); }
      }
    }
    for (const t of view.tempters ?? []) { const px = t.x * T, py = t.y * T; g.fillStyle = 'rgba(30,10,40,0.75)'; g.fillRect(px + 4, py + 4, 8, 9); g.fillRect(px + 3, py + 7, 10, 4); g.fillStyle = '#ff4a4a'; g.fillRect(px + 5, py + 6, 2, 1); g.fillRect(px + 9, py + 6, 2, 1); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    return { camX, camY, scale: s };
  }

  // Map a tap (canvas pixels) to the nearest living creature id within 1.5 tiles, or null.
  function pick(view, px, py, info) {
    const ax = px / info.scale + info.camX, ay = py / info.scale + info.camY;
    let best = null;
    for (const c of view.creatures) { if (!c.alive) continue; const p = cache.get(c.id) ?? { x: c.x * T, y: c.y * T }; const d = Math.hypot(p.x + 8 - ax, p.y + 8 - ay); if (d < T * 1.5 && (!best || d < best.d)) best = { id: c.id, d }; }
    return best ? best.id : null;
  }
  return { draw, layout, pick, art, bakeFor: v => (baked = bake(v)) };
}

export function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('Could not load ' + src)); i.src = src; });
}
