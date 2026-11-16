// Read-only views of a world for drawing. Copies plain values out; never writes to the world.
import { W, H, land } from './sim.js';
import { isLand } from './lab.js';

export function viewOfEden(s) {
  const E = s.eden;
  return {
    kind: 'eden', w: W, h: H, tick: s.tick, terrainKey: `eden:${+s.bridge}`,
    isLand: (x, y) => land(x, y, s.bridge),
    phase: E.phase,
    tree: { x: E.tree.x, y: E.tree.y }, serpentSpoke: E.serpentSpoke ? { tick: E.serpentSpoke.tick, id: E.serpentSpoke.id } : null,
    springs: E.springs.map(w => ({ x: w.x, y: w.y, name: w.name })),
    food: s.patches.map(p => ({ x: p.x, y: p.y, kind: p.gift ? 'gift' : p.field ? (s.tick < p.readyTick ? 'sown' : 'field') : 'bush', fill: p.capacity ? Math.min(1, p.stock / p.capacity) : 0, stock: p.stock })),
    dangers: [], crossings: [],
    creatures: s.creatures.map(c => ({ id: c.id, x: c.x, y: c.y, alive: c.alive, deathTick: c.death?.tick ?? null, act: c.action?.type ?? null,
      child: E.config && c.eden.mother !== null && (s.tick - c.eden.born) / 1440 < E.config.weanAge,
      led: !!(c.decision?.guided && s.tick - c.decision.tick < 90), clothed: !!c.eden.clothed })),
  };
}

export function viewOfLab(s) {
  const c0 = s.config;
  return {
    kind: 'lab', w: c0.width, h: c0.height, tick: s.tick, terrainKey: `lab:${s.crossingsOpen.join(',')}`,
    isLand: (x, y) => isLand(s, x, y),
    phase: null, tree: null, serpentSpoke: null, springs: [],
    food: s.sources.map(p => ({ x: p.x, y: p.y, kind: p.type === 'garden' ? 'field' : 'bush', fill: p.capacity ? Math.min(1, p.stock / p.capacity) : 0, stock: p.stock })),
    dangers: s.dangers.map(d => ({ x: d.x, y: d.y, r: c0.dangerRadius })),
    crossings: s.crossingsOpen.map(y => ({ x: c0.riverX, y })),
    creatures: s.creatures.map(c => ({ id: c.id, x: c.x, y: c.y, alive: c.alive, deathTick: c.death?.tick ?? null, act: c.action?.type ?? null, child: false, led: false, clothed: false })),
  };
}
