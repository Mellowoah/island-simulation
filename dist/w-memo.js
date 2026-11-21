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
