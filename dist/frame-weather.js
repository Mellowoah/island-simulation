// The frame's weather. Presentation only: the world never reads any of it. Two skies:
// - Winterhaven, the island's lake country: the live weather at Winter Haven, Florida, the Chain of Lakes city
//   (Open-Meteo, the city centre, refreshed every 15 minutes). Named by Robert, 27 Nov.
// - everywhere else: the world's own sky for the day, the same day the world is living (weather.js rain,
//   atmosphere.js sunshine and wind). The world has no wind direction, so its clouds drift from the east.
// Weather codes: WMO 4677 as Open-Meteo gives them (https://open-meteo.com/en/docs).

export const WINTER_HAVEN = { name: 'Winterhaven', place: 'Winter Haven, FL', lat: 28.0222, lon: -81.7329 };
const EVERY = 15 * 60 * 1000;

// What a weather code looks like, and its words.
export function kindOfCode(c) {
  if (c >= 95) return ['storm', 'thunderstorm'];
  if (c >= 85 || (c >= 71 && c <= 77)) return ['snow', 'snow'];
  if (c >= 80) return ['rain', 'showers'];
  if (c >= 61) return ['rain', c >= 65 ? 'heavy rain' : 'rain'];
  if (c >= 51) return ['drizzle', 'drizzle'];
  if (c >= 45) return ['fog', 'fog'];
  if (c === 3) return ['cloud', 'overcast'];
  if (c === 2) return ['cloud', 'partly cloudy'];
  return ['clear', c === 1 ? 'mostly clear' : 'clear'];
}
// A sky from Open-Meteo's "current" block: cloud cover 0..1, rain in mm an hour, wind m/s, drift direction.
export function liveSky(cur) {
  if (!cur || cur.weather_code == null) return null;
  const [kind, words] = kindOfCode(cur.weather_code),
    perHour = 3600 / (cur.interval || 900);
  return {
    kind,
    words,
    cover: Math.max(kind === 'clear' ? 0 : 0.3, (cur.cloud_cover ?? 0) / 100),
    rain: (cur.precipitation ?? 0) * perHour,
    wind: (cur.wind_speed_10m ?? 10) / 3.6,
    from: cur.wind_direction_10m ?? 90,
    tempF: cur.temperature_2m,
  };
}
// The world's own sky today: cloud is the sunshine it does not get; on a wet day the day's rain falls.
export function worldSky(W) {
  if (!W?.air) return null;
  const cover = Math.min(1, Math.max(0, 1 - W.air.sunshine)),
    rain = W.wet ? W.rain / 8 : 0; // the day's rain falling over about 8 hours
  const kind = rain > 0 ? 'rain' : cover > 0.55 ? 'cloud' : 'clear';
  return { kind, words: kind, cover, rain, wind: W.air.wind, from: 90 };
}
// The live sky, fetched now and every 15 minutes; keeps the last good one if a fetch fails.
// ?wx=code,cover%,mm/h,km/h,deg,F sets it by hand (for checking the drawing without the network).
export function followLive(onSky, place = WINTER_HAVEN, q = new URLSearchParams(location.search)) {
  if (q.get('wx')) {
    const [c, cc, p, w, d, t] = q.get('wx').split(',').map(Number);
    const cur = { weather_code: c, cloud_cover: cc, precipitation: p, interval: 3600, wind_speed_10m: w };
    return onSky(liveSky({ ...cur, wind_direction_10m: d, temperature_2m: t }));
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    '&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m' +
    '&temperature_unit=fahrenheit&timezone=auto';
  const get = () =>
    fetch(url)
      .then(r => r.json())
      .then(j => onSky(liveSky(j.current)))
      .catch(() => {}); // offline: the last sky stays
  get();
  setInterval(get, EVERY);
}
// Where Winterhaven is: the middle of the lake, and a reach that takes in its shores.
export function lakeCountry(regionAt, w, h) {
  let n = 0,
    sx = 0,
    sy = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (regionAt(x, y) === 'lake') ((n += 1), (sx += x + 0.5), (sy += y + 0.5));
  if (!n) return null;
  return { x: sx / n, y: sy / n, r: 2.4 * Math.sqrt(n / Math.PI) + 6 };
}
