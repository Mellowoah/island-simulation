// Moist (saturated) Brunt-Vaisala frequency from measured soundings, Durran and Klemp 1982 (J. Atmos. Sci. 39:2152):
// Nm^2 = (g/T)(dT/dz + Gm)(1 + L qs/(Rd T)) - g/(1 + qw) dqw/dz, qw = qs (saturated), layer by layer.
const O = await import('../dist/orographic.js');
const G = 9.81, RD = 287.04, LV = 2.5e6, EPS = 0.622;
const S = { // [p hPa, z m, T C, RH %, dir, spd kt]  (Nairobi 63741, April 2025, weather.cod.edu archive)
  '24 Apr 23Z': [[823,1798,16.6,92,70,5],[794,2102,14.4,98,72,5],[707,3074,9.2,100,79,6],[700,3157,7.4,99,80,6],[663,3602,4.8,100,83,7],[638,3915,2.4,100,86,7],[616,4197,-0.3,69,88,7]],
  '21 Apr 23Z': [[822,1798,17.2,93,80,6],[793,2103,15.2,96,79,6],[663,3595,6.2,99,77,7],[636,3935,3.8,88,76,7],[616,4194,3.2,89,75,7]],
  '20 Apr 00Z': [[822,1798,16.6,89,0,0],[793,2103,15.8,76,359,0],[745,2628,12.0,95,356,1],[663,3594,7.0,88,351,3],[629,4024,5.0,80,349,3],[616,4194,3.6,89,348,4],[588,4569,0.8,92,346,4]],
  '28 Apr 23Z': [[821,1798,18.0,87,120,3],[793,2093,15.4,97,118,3],[716,2948,9.8,97,111,4],[700,3135,9.2,96,110,4]],
};
const qs = (t, p) => { const e = O.satVapourKPa(t); return EPS * e / (p / 10 - e); };
for (const [day, L] of Object.entries(S)) {
  let n2 = 0, dz = 0, wind = [];
  for (let i = 0; i + 1 < L.length; i++) {
    const [p1, z1, t1, rh1, d1, s1] = L[i], [p2, z2, t2, rh2] = L[i + 1];
    if (rh1 < 85 || rh2 < 85) continue; // saturated (cloudy) layers only
    const T = (t1 + t2) / 2 + 273.15, p = (p1 + p2) / 2, q = qs(T - 273.15, p), gm = O.moistAir(T - 273.15, p / 10, 0.0065).gammaM;
    const dTdz = (t2 - t1) / (z2 - z1), dq = (qs(t2, p2) - qs(t1, p1)) / (z2 - z1);
    const N2 = (G / T) * (dTdz + gm) * (1 + LV * q / (RD * T)) - (G / (1 + q)) * dq;
    n2 += N2 * (z2 - z1); dz += z2 - z1; wind.push(`${d1}deg ${(s1 * 0.5144).toFixed(1)}m/s`);
  }
  const N2 = n2 / dz;
  console.log(day, 'saturated depth', dz, 'm; mean Nm^2', N2.toExponential(2), 'Nm', N2 > 0 ? Math.sqrt(N2).toFixed(4) : `imaginary (unstable, ${Math.sqrt(-N2).toFixed(4)})`, '| winds', wind.join(', '));
}
