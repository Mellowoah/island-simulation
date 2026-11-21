// Island: per-person memos for speed. Some sums a person's choices need change only when the person learns a new
// place or their skills change; those changes bump a version here, and a memo is reused only while its versions still
// match. Kept outside the person (a WeakMap), so the saved world and its fingerprint are untouched.
// checkMemos(true) makes every memo be worked out fresh as well and compared, throwing on any difference (tests).
const VER = new WeakMap();
let CHECK = false;
export const checkMemos = on => (CHECK = !!on);
export const checkingMemos = () => CHECK;
export function versionOf(p) {
  let v = VER.get(p);
  if (!v) VER.set(p, (v = { places: 0, skills: 0 }));
  return v;
}
export const placesChanged = p => void versionOf(p).places++;
export const skillsChanged = p => void versionOf(p).skills++;

// ---------- news: which of a teller's places can be news to a hearer ----------
// When a tells b about every place a knows, b ends up holding each at least as fresh as a does (b's entries only
// ever get fresher: own looks are dated now, news is taken only when fresher). So the next time a tells b, only
// places a has written since can be news. Each write to a map of places is logged with a running number; for each
// teller and hearer the number at their last telling is kept. Places are still visited in the teller's own order
// (the order they first learned them), so everything happens exactly as with the full loop.
let SEQ = 0;
const LOG_KEEP = 4096; // writes kept per person; a telling older than that goes back to the full loop
const META = new WeakMap(), // map of places -> { log: [seq, order, ...], ord: id -> order learned, ids: order -> id, cut }
  TOLD = new WeakMap(); // teller's map -> (hearer's map -> seq at their last telling)
function metaOf(places) {
  let m = META.get(places);
  if (!m) {
    m = { log: [], ord: new Map(), ids: [], cut: SEQ };
    for (const id in places) m.ord.set(id, m.ids.push(id) - 1);
    META.set(places, m);
  }
  return m;
}
export function placeWritten(p, id) {
  const m = metaOf(p.places);
  if (!m.ord.has(id)) m.ord.set(id, m.ids.push(id) - 1);
  m.log.push(++SEQ, m.ord.get(id));
  if (m.log.length > 4 * LOG_KEEP) {
    m.log.splice(0, m.log.length - 2 * LOG_KEEP);
    m.cut = m.log[0] - 1;
  }
}
const allIds = places => {
  const out = [];
  for (const id in places) out.push(id);
  return out;
};
function changedSince(m, told) {
  let i = m.log.length - 2;
  while (i >= 0 && m.log[i] > told) i -= 2;
  const n = (m.log.length - 2 - i) / 2,
    ords = new Int32Array(n);
  for (let j = 0; j < n; j++) ords[j] = m.log[i + 2 + 2 * j + 1];
  ords.sort(); // numeric for a typed array
  const out = [];
  for (let j = 0; j < n; j++) if (j === 0 || ords[j] !== ords[j - 1]) out.push(m.ids[ords[j]]);
  return out;
}
// The ids to look at when a tells b, in a's own order; also records this telling.
export function newsIds(a, b) {
  const m = META.get(a.places),
    pairs = TOLD.get(a.places) ?? TOLD.set(a.places, new WeakMap()).get(a.places),
    told = pairs.get(b.places);
  const ids = !m || told === undefined || told < m.cut ? allIds(a.places) : changedSince(m, told);
  if (CHECK) {
    const news = id => !b.places[id] || b.places[id].t < a.places[id].t,
      want = allIds(a.places).filter(news).join(),
      got = ids.filter(news).join();
    if (want !== got) throw new Error(`news shortcut missed places: ${a.name} to ${b.name}`);
  }
  pairs.set(b.places, SEQ);
  return ids;
}
