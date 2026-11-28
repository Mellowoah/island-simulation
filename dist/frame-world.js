// The world behind a picture frame, kept in time with the viewer's own day (presentation only: it steps the world;
// it never changes a rule). One world hour passes each real hour, by the viewer's local clock and calendar. The
// world's year starts on 1 November (the short rains, clock.js), so it began at 06:00 on 1 November of its first year.
// On opening it catches up from its start to now (the same seed always gives the same history), then carries on.
// Shared by the frames (frame3d.js; frame.js keeps its own copy until it moves over).
import { createWorld2, stepWorld, living } from './world.js';
import { clockOf, START_HOUR, dateOf } from './clock.js';
import { jdOfTick } from './sun.js';
import { sunVector } from './frame-render.js';

export function frameWorld(seed, born) {
  const s = createWorld2(seed, {}),
    C = clockOf(s),
    w = { s, C, prev: new Map(), seed };
  // Where the world should be now, in ticks (fractional), from the local calendar and clock, so daylight saving
  // and time zones keep the world's hour equal to the viewer's.
  w.target = (now = new Date()) => {
    const days = Math.round(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
        Date.UTC(born.getFullYear(), born.getMonth(), born.getDate())) /
        864e5,
    );
    const hours = days * 24 + now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 - START_HOUR;
    return Math.max(0, hours / C.hours);
  };
  w.frac = () => Math.min(1, Math.max(0, w.target() - s.tick));
  // One tick at a time, keeping where everyone was, so they can be drawn gliding to where they are.
  w.step = () => {
    w.prev = new Map(living(s).map(p => [p.id, [p.x, p.y]]));
    stepWorld(s, 1);
  };
  w.sun = () => sunVector(jdOfTick(s.tick + w.frac(), C.hours));
  w.date = () => dateOf(C, s.tick);
  w.catchUp = (say, done) => catchUp(w, say, done);
  return w;
}
// Catch up from the world's birth to now in slices of two weeks, saying how far it has got, then hand over.
function catchUp(w, say, done) {
  const goal = Math.floor(w.target());
  if (w.s.tick >= goal - 1) return done();
  stepWorld(w.s, Math.min(24 * 14, goal - 1 - w.s.tick));
  say(`The island is catching up to today: ${w.date().label}`);
  setTimeout(() => catchUp(w, say, done), 0);
}
// The season on the grass: the share of it standing dead (straw) in the plants layer, if the world has one.
export function dryness(s) {
  const P = s.plants;
  return P && P.green + P.dead > 0 ? P.dead / (P.green + P.dead) : 0.3;
}
