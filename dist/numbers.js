// Island base: the largest and smallest of a list, exactly as Math.max and Math.min give them (NaN if any is NaN; 0
// above -0 for max, -0 below 0 for min; -Infinity and Infinity for an empty list), but in a plain loop. Spreading a
// long list into one call overflows the call stack on a large map (rule 12: nothing may break at large sizes).
export function maxOf(a) {
  let top = -Infinity;
  for (const v of a) {
    if (v !== v) return NaN;
    if (v > top || (v === 0 && top === 0 && Object.is(top, -0))) top = v;
  }
  return top;
}
export function minOf(a) {
  let low = Infinity;
  for (const v of a) {
    if (v !== v) return NaN;
    if (v < low || (v === 0 && low === 0 && Object.is(v, -0))) low = v;
  }
  return low;
}
