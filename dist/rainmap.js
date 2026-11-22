// ---------- Layer 1 (air): how much rain each place gets in a year ----------
// Rule 17 fallback for rain (save 3 of 3): the mountain-rain physics (orographic.js) does not apply to these rains
// (measured: the saturated air of the long rains is moist-unstable, tools/moist-stability.mjs), so each place's
// yearly rain comes from measurements. Two sources, one slot:
//   1. stations (now): published station figures, rain by height, straight between the measured points that are
//      inputs; the others are held out and used only as checks (checkStations).
//   2. a measured rain map (to come): CHPclim, the Climate Hazards Center's 0.05-degree climatology built from
//      satellite, terrain and station normals; rainShareFromMap takes it as it is.
// Either way the result is each place's share of the island's daily weather chain, whose rain is the Eyasi basin's.
// Known weakness of source 1: in this region which way a slope faces matters more than height (Oettli and
// Camberlin 2005, Clim. Res. 28:199), and this uses height alone. Source 2 has no such limit.
export const RAIN_STATIONS = [
  {
    name: 'Eyasi basin',
    m: 1030,
    mm: [300, 400],
    role: 'input',
    src: 'Karatu District (Wikipedia): Eyasi basin averages 300-400 mm; basin height as sun.js SITE',
  },
  {
    name: 'Mbulu Highlands',
    m: 1900,
    mm: [1000, 1200],
    role: 'input',
    src: 'Mbulu Highlands (Wikipedia): 1000 mm or more on a plateau of 1500-2300 m (mid-height used; upper bound an assumption)',
  },
  {
    name: 'Karatu town',
    m: 1420,
    mm: [900, 1000],
    role: 'check',
    src: 'Karatu District (Wikipedia): Karatu town 900-1000 mm; Karatu town 1,420 m',
  },
  {
    name: 'Karatu highland zone',
    m: 1700,
    mm: [600, 800],
    role: 'check',
    src: 'Karatu District (Wikipedia): highland zone 1400-2000 m receives 600-800 mm (mid-height; disagrees with the town figure)',
  },
  {
    name: 'Ngorongoro crater rim',
    m: 2300,
    mm: [900, 1100],
    role: 'check',
    src: 'climatestotravel: about 1,000 mm around the crater, rim about 2,300 m (range +/-10% an assumption)',
  },
  {
    name: 'Arusha',
    m: 1387,
    mm: [1000, 1200],
    role: 'check',
    src: "climatestotravel: 1,100 mm; infoclimat: station 63789 at 1387 m. On the windward slopes of Meru, outside the island's setting",
  },
];
const mid = s => (s.mm[0] + s.mm[1]) / 2;

// Yearly rain (mm) at height m from the input stations: straight between them, flat beyond the ends.
export function stationRainMm(m, stations = RAIN_STATIONS) {
  const pts = stations.filter(s => s.role === 'input').sort((a, b) => a.m - b.m);
  if (m <= pts[0].m) return mid(pts[0]);
  for (let i = 1; i < pts.length; i++)
    if (m <= pts[i].m)
      return mid(pts[i - 1]) + ((mid(pts[i]) - mid(pts[i - 1])) * (m - pts[i - 1].m)) / (pts[i].m - pts[i - 1].m);
  return mid(pts[pts.length - 1]);
}
// Each place's rain as a share of the basin's (the weather chain's), from heights (m) or from a measured map (mm).
export const BASIN_MM = mid(RAIN_STATIONS[0]);
export const rainShareFromHeights = heights => Float64Array.from(heights, m => stationRainMm(m) / BASIN_MM);
export const rainShareFromMap = (mapMm, basinMm = BASIN_MM) => Float64Array.from(mapMm, v => Math.max(0, v) / basinMm);
// The held-out stations against what a rain source gives at their heights: never used to set anything.
export function checkStations(rainAt = stationRainMm) {
  return RAIN_STATIONS.filter(s => s.role === 'check').map(s => {
    const got = rainAt(s.m);
    return { name: s.name, m: s.m, measured: s.mm, got: Math.round(got), within: got >= s.mm[0] && got <= s.mm[1] };
  });
}
