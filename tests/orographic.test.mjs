// Layer 1: rain made by mountains (dist/orographic.js, Smith and Barstad 2004).
import test from 'node:test';
import assert from 'node:assert/strict';
import { moistAir, orographicRate, transfer, satVapourKPa } from '../dist/orographic.js';

// A round hill 1 km high, 10 km wide (Gaussian), centred on a 128 x 96 grid of 1 km squares.
const W = 128,
  H = 96,
  dx = 1000,
  hill = Float64Array.from({ length: W * H }, (_, i) => {
    const x = (i % W) - 50,
      y = Math.floor(i / W) - 48;
    return 1000 * Math.exp(-(x * x + y * y) / (2 * 5 * 5));
  });
const air = { Cw: 0.004, Hw: 2500, U: 10, V: 0, N: 0.005, tauC: 1000, tauF: 1000 };

test('O1 moist air at the foot: FAO-56 saturation 2.338 kPa at 20 C; moist lapse 4-5 K/km; vapour scale height about 2.4 km', () => {
  assert.ok(Math.abs(satVapourKPa(20) - 2.338) < 0.001);
  const m = moistAir(20, 101.3, 0.0065);
  assert.ok(m.gammaM > 0.004 && m.gammaM < 0.005, `${m.gammaM}`);
  assert.ok(m.Hw > 2300 && m.Hw < 2600, `${m.Hw}`);
  assert.ok(Math.abs(m.Cw - (m.rhoS * m.gammaM) / 0.0065) < 1e-15);
});

test('O2 with no delays, no waves and a thin moist layer it is exactly the classical upslope rain Cw U dh/dx', () => {
  const p = { ...air, Hw: 1e-9, N: 0, tauC: 1e-9, tauF: 1e-9 },
    P = orographicRate(hill, W, H, dx, p);
  let worst = 0,
    top = 0;
  for (let y = 30; y < 66; y++)
    for (let x = 32; x < 68; x++) {
      const i = y * W + x,
        X = x - 50,
        Y = y - 48,
        dhdx = 1000 * (-X / 25) * Math.exp(-(X * X + Y * Y) / 50); // m per km
      const want = (p.Cw * p.U * dhdx) / dx;
      worst = Math.max(worst, Math.abs(P[i] - want));
      top = Math.max(top, Math.abs(want));
    }
  assert.ok(worst < 0.01 * top, `max error ${worst} against peak ${top}`);
});

test('O3 the mountains add no water overall: windward rain is balanced by lee drying (net under 0.1% once the area holds it all)', () => {
  // Exact only over an unbounded area: on a small grid some lee drying is carried off the edge. On a 256 x 192 km grid
  // without air waves (whose lee tails reach far) all of it lands on the grid.
  const W2 = 256,
    H2 = 192,
    h = Float64Array.from({ length: W2 * H2 }, (_, i) => {
      const x = (i % W2) - 100,
        y = Math.floor(i / W2) - 96;
      return 1000 * Math.exp(-(x * x + y * y) / 50);
    });
  const P = orographicRate(h, W2, H2, dx, { ...air, N: 0 });
  let sum = 0,
    abs = 0;
  for (const v of P) ((sum += v), (abs += Math.abs(v)));
  assert.ok(Math.abs(sum) < 1e-3 * abs, `net ${sum} against ${abs}`);
});

test('O4 wind from the west: most rain on the windward (west) side, a rain shadow in the lee (east), and delays carry it downwind', () => {
  const row = 48 * W,
    P = orographicRate(hill, W, H, dx, air);
  let wet = 0,
    dry = 0;
  for (let x = 0; x < W; x++) {
    if (P[row + x] > P[row + wet]) wet = x;
    if (P[row + x] < P[row + dry]) dry = x;
  }
  assert.ok(wet < 50 && dry > 50, `wettest x ${wet}, driest x ${dry}, peak at 50`);
  const fast = orographicRate(hill, W, H, dx, { ...air, tauC: 1, tauF: 1 });
  let wetFast = 0;
  for (let x = 0; x < W; x++) if (fast[row + x] > fast[row + wetFast]) wetFast = x;
  assert.ok(wet >= wetFast, `longer delays move the wettest point downwind: ${wetFast} -> ${wet}`);
});

test('O5 the transfer is zero for ridges along the wind; opposite wavenumbers give conjugates, so the rain is a real number', () => {
  assert.deepEqual(transfer(0, 0.001, air), [0, 0]);
  for (const N of [0, 0.005, 0.02]) {
    const a = transfer(0.0007, 0.0003, { ...air, N }),
      b = transfer(-0.0007, -0.0003, { ...air, N });
    assert.ok(Math.abs(a[0] - b[0]) < 1e-18 && Math.abs(a[1] + b[1]) < 1e-18, `N ${N}: ${a} ${b}`);
  }
});

test('O6 wind from a bearing: from the east blows west, from the north blows south; rain shares never go below zero', async () => {
  const { windFrom, rainShare } = await import('../dist/orographic.js');
  const e = windFrom(5, 90),
    n = windFrom(5, 0);
  assert.ok(Math.abs(e.U + 5) < 1e-12 && Math.abs(e.V) < 1e-12 && Math.abs(n.U) < 1e-12 && Math.abs(n.V - 5) < 1e-12);
  assert.deepEqual([...rainShare([0, 2 / 3600, -10 / 3600], 2)], [1, 2, 0]);
});

test('O7 independent check of the air waves: the exact 2-D hydrostatic solution over a bell-shaped ridge (Queney), weighted over the moist layer, matches within 5%', () => {
  // eta(x,z) = h0 a (a cos(lz) - x sin(lz)) / (x^2 + a^2), l = N/U: the classical upstream-tilting mountain wave. With no
  // delays the rain must be Cw U times the integral of d(eta)/dx e^(-z/Hw) dz / Hw (where 1/(1 - i m Hw) comes from).
  const W2 = 512,
    H2 = 256,
    a = 10,
    h0 = 300,
    p = { Cw: 0.004, Hw: 2500, U: 10, V: 0, N: 0.01, tauC: 1e-9, tauF: 1e-9 };
  const h = Float64Array.from({ length: W2 * H2 }, (_, i) => {
    const x = (i % W2) - 256;
    return (h0 * a * a) / (x * x + a * a);
  });
  const P = orographicRate(h, W2, H2, 1000, p),
    l = p.N / p.U,
    A = a * 1000;
  const slope = (X, z) => {
    const c = Math.cos(l * z),
      s = Math.sin(l * z),
      num = h0 * A * (A * c - X * s),
      den = X * X + A * A;
    return (-h0 * A * s * den - num * 2 * X) / (den * den);
  };
  let worst = 0,
    top = 0;
  for (let x = -40; x <= 40; x += 2) {
    let sum = 0;
    for (let z = 2.5; z < 12 * p.Hw; z += 5) sum += slope(x * 1000, z) * Math.exp(-z / p.Hw) * (5 / p.Hw);
    const exact = p.Cw * p.U * sum;
    worst = Math.max(worst, Math.abs(exact - P[128 * W2 + 256 + x]));
    top = Math.max(top, Math.abs(exact));
  }
  assert.ok(worst < 0.05 * top, `max error ${worst / top} of the peak`);
});
