// ---------- Layer 3 (terrain): how water runs over any grid of heights ----------
// The same method as today's island (terrain.js, land.js), made to take any grid (rule 12), for the bigger world:
// - hollows are filled by priority-flood (Barnes, Lehman and Mulla 2014), so every drop has a way out, and each
//   square drains to the neighbour the flood reached it from (to the lake or the sea in the end);
// - flow accumulation in upstream-first order (Kahn's topological sort): squares draining through each square and
//   the mean distance their water travels;
// - streams where the catchment passes a channel-start area (an assumption with a range, rule 3).
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// A binary heap of square indices ordered by height (lowest first): sift up after a push, down after a pop.
function siftUp(a, h, k) {
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (h[a[p]] <= h[a[k]]) return;
    [a[p], a[k]] = [a[k], a[p]];
    k = p;
  }
}
function siftDown(a, h, k) {
  for (;;) {
    const l = 2 * k + 1,
      r = l + 1;
    let m = k;
    if (l < a.length && h[a[l]] < h[a[m]]) m = l;
    if (r < a.length && h[a[r]] < h[a[m]]) m = r;
    if (m === k) return;
    [a[m], a[k]] = [a[k], a[m]];
    k = m;
  }
}
function heapOf(h) {
  const a = [];
  return {
    size: () => a.length,
    push: i => (a.push(i), siftUp(a, h, a.length - 1)),
    pop: () => {
      const top = a[0],
        last = a.pop();
      if (a.length) ((a[0] = last), siftDown(a, h, 0));
      return top;
    },
  };
}
// Where each square drains (-1 at an outlet) and the filled surface. outlet[i] = 1 at the sea and the lake.
export function drainage(metres, W, H, outlet) {
  const filled = new Float32Array(metres),
    done = new Uint8Array(W * H),
    down = new Int32Array(W * H).fill(-1),
    q = heapOf(filled);
  for (let i = 0; i < W * H; i++) if (outlet[i]) ((done[i] = 1), q.push(i));
  while (q.size()) {
    const j = q.pop(),
      x = j % W,
      y = (j / W) | 0;
    for (const [ax, ay] of N4) {
      const nx = x + ax,
        ny = y + ay,
        k = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || done[k]) continue;
      done[k] = 1;
      filled[k] = Math.max(filled[k], filled[j] + 1e-5);
      down[k] = j;
      q.push(k);
    }
  }
  return { down, filled };
}
// Squares in an order where each comes after every square that drains into it.
export function upstreamFirst(down) {
  const n = down.length,
    inflows = new Int32Array(n),
    order = [];
  for (let i = 0; i < n; i++) if (down[i] >= 0) inflows[down[i]]++;
  for (let i = 0; i < n; i++) if (!inflows[i]) order.push(i);
  for (let k = 0; k < order.length; k++) {
    const j = down[order[k]];
    if (j >= 0 && --inflows[j] === 0) order.push(j);
  }
  return order;
}
// Catchment (km2) through each square, the mean distance (km) its water travels to it, and the longest such path.
export function accumulate(down, W, tileKm) {
  const n = down.length,
    area = new Float32Array(n).fill(1),
    len = new Float32Array(n),
    longest = new Float32Array(n);
  for (const i of upstreamFirst(down)) {
    const j = down[i];
    if (j < 0) continue;
    const step = Math.hypot((i % W) - (j % W), ((i / W) | 0) - ((j / W) | 0)) * tileKm;
    len[j] += len[i] + area[i] * step;
    area[j] += area[i];
    longest[j] = Math.max(longest[j], longest[i] + step);
  }
  const a2 = tileKm * tileKm;
  return {
    km2: Float32Array.from(area, a => a * a2),
    meanKm: Float32Array.from(len, (l, i) => l / area[i]),
    longestKm: longest,
  };
}
