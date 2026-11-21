// ---------- Layer 1 (air): rain made by mountains ----------
// The linear theory of orographic precipitation (Smith, R. B. and Barstad, I. 2004, J. Atmos. Sci. 61: 1377-1391).
// Moist air pushed up a slope condenses (the classical upslope source, Cw times the wind along the slope); the cloud
// water takes a time tauC to turn into rain and the rain a time tauF to fall, so it drifts downwind meanwhile; the
// air's own waves (buoyancy N, the moist stability) and the depth of the moist layer (Hw) spread the source in height.
// Descending lee air evaporates cloud and rain: negative values, the rain shadow. Solved exactly in Fourier space:
//   P^(k, l) = Cw i sigma h^(k, l) / ((1 - i m Hw)(1 + i sigma tauC)(1 + i sigma tauF)),   sigma = U k + V l,
//   m = sign(sigma) sqrt((N^2 - sigma^2) / sigma^2 (k^2 + l^2))   (imaginary where sigma^2 > N^2: decaying waves).
// The answer is the mountains' addition to the rain rate (kg/m2/s = mm/s); the caller adds the background rate and
// keeps it from going below zero. It takes any height grid, so the air layer needs no map of its own (the water layer
// hands it the land's). Constants: Rd 287.04, Rv 461.5, cp 1004, L 2.5e6, g 9.81 (standard values).
const G = 9.81,
  RD = 287.04,
  RV = 461.5,
  CP = 1004,
  LV = 2.5e6,
  EPS = RD / RV;

// Saturation vapour pressure, kPa, at t deg C (FAO-56 eq. 11, the Tetens form)
export const satVapourKPa = t => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
// The moist air at the foot of the mountains: moist-adiabatic lapse rate (K/m, standard formula), saturated vapour
// density (kg/m3), and Smith and Barstad's condensation factor Cw = rho_s Gamma_m / gamma (kg/m3) and water-vapour
// scale height Hw = Rv T^2 / (L gamma) (m), where gamma is the air's actual lapse rate (K/m).
export function moistAir(tC, pKPa, lapse) {
  const T = tC + 273.15,
    es = satVapourKPa(tC),
    r = (EPS * es) / (pKPa - es);
  const gammaM = (G * (1 + (LV * r) / (RD * T))) / (CP + (LV * LV * r * EPS) / (RD * T * T)),
    rhoS = (es * 1000) / (RV * T);
  return { gammaM, rhoS, Cw: (rhoS * gammaM) / lapse, Hw: (RV * T * T) / (LV * lapse) };
}

// In-place radix-2 complex FFT of length n (a power of two); inverse divides by n.
function fft1(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j], im[i], im[j]] = [re[j], re[i], im[j], im[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = ((inverse ? 2 : -2) * Math.PI) / len,
      wr = Math.cos(a),
      wi = Math.sin(a);
    for (let i = 0; i < n; i += len)
      for (let k = 0, cr = 1, ci = 0; k < len / 2; k++, [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr]) {
        const p = i + k,
          q = p + len / 2,
          xr = re[q] * cr - im[q] * ci,
          xi = re[q] * ci + im[q] * cr;
        [re[q], im[q], re[p], im[p]] = [re[p] - xr, im[p] - xi, re[p] + xr, im[p] + xi];
      }
  }
  if (inverse) for (let i = 0; i < n; i++) ((re[i] /= n), (im[i] /= n));
}
// 2-D FFT of an nx x ny grid stored row by row: every row, then every column.
function fft2(re, im, nx, ny, inverse) {
  const rr = new Float64Array(nx),
    ri = new Float64Array(nx),
    cr = new Float64Array(ny),
    ci = new Float64Array(ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) ((rr[x] = re[y * nx + x]), (ri[x] = im[y * nx + x]));
    fft1(rr, ri, inverse);
    for (let x = 0; x < nx; x++) ((re[y * nx + x] = rr[x]), (im[y * nx + x] = ri[x]));
  }
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) ((cr[y] = re[y * nx + x]), (ci[y] = im[y * nx + x]));
    fft1(cr, ci, inverse);
    for (let y = 0; y < ny; y++) ((re[y * nx + x] = cr[y]), (im[y * nx + x] = ci[y]));
  }
}
const pow2 = n => 2 ** Math.ceil(Math.log2(n));
const wave = (i, n, dx) => (2 * Math.PI * (i < n / 2 ? i : i - n)) / (n * dx); // wavenumber of FFT index i

// Smith and Barstad's transfer function at one wavenumber (k, l): multiplies h^ to give P^ (complex, as [re, im]).
export function transfer(k, l, p) {
  const s = p.U * k + p.V * l;
  if (s === 0) return [0, 0];
  const K2 = k * k + l * l,
    q = ((p.N * p.N - s * s) / (s * s)) * K2;
  const [ar, ai] = q >= 0 ? [1, -Math.sign(s) * Math.sqrt(q) * p.Hw] : [1 + Math.sqrt(-q) * p.Hw, 0]; // 1 - i m Hw
  let [dr, di] = [ar, ai];
  for (const tau of [p.tauC, p.tauF]) [dr, di] = [dr - di * s * tau, di + dr * s * tau]; // times (1 + i sigma tau)
  const d2 = dr * dr + di * di; // Cw i sigma / d
  return [(p.Cw * s * di) / d2, (p.Cw * s * dr) / d2];
}
// The mountains' addition to the rain rate (mm/s) on a W x H grid of heights (m) with squares dx m wide, for the
// moist air and wind p = { Cw, Hw, U, V (m/s, toward +x east and +y south), N (1/s), tauC, tauF (s) }. The grid is
// padded to twice its size with the base height so the Fourier solution does not wrap around.
export function orographicRate(heights, W, H, dx, p, base = 0) {
  const NX = pow2(2 * W),
    NY = pow2(2 * H),
    re = new Float64Array(NX * NY),
    im = new Float64Array(NX * NY);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) re[y * NX + x] = heights[y * W + x] - base;
  fft2(re, im, NX, NY, false);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const n = j * NX + i,
        [tr, ti] = transfer(wave(i, NX, dx), wave(j, NY, dx), p);
      [re[n], im[n]] = [re[n] * tr - im[n] * ti, re[n] * ti + im[n] * tr];
    }
  fft2(re, im, NX, NY, true);
  const out = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = re[y * NX + x];
  return out;
}

// Wind from a compass bearing (degrees, where it blows from, as weather reports give it) as map velocities: U toward
// the east (+x), V toward the south (+y). Wind from the east blows west: U = -speed.
export function windFrom(speed, fromDeg) {
  const a = (fromDeg * Math.PI) / 180;
  return { U: -speed * Math.sin(a), V: speed * Math.cos(a) };
}
// Each place's rain as a share of the background (the rain the weather brings with no mountains): the background
// rate plus the mountains' addition, never below zero, over the background (rates in mm/h; oro in mm/s).
export function rainShare(oro, backgroundMmH) {
  const out = new Float64Array(oro.length);
  for (let i = 0; i < oro.length; i++) out[i] = Math.max(0, backgroundMmH + oro[i] * 3600) / backgroundMmH;
  return out;
}
