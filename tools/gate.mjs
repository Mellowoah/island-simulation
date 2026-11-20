// The layer gate: node tools/gate.mjs <layer> [islands=6] [years=3]
// A layer may become real (dist/layers.js) only if this passes. It runs the layer's own tests, then the same
// islands with the layer as a stand-in (before) and as real (after), each island in its own process, and checks:
// no alarms, water books balanced, deaths not meaningfully up (paired by island), and the layer's real-world
// pattern. It writes docs/gates/<layer>.json with the result and a hash of every file of the layer, so a later
// change to those files voids the gate (tests/layers.test.mjs).
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { LAYERS } from '../dist/layers.js';
import { PATTERNS, TESTS } from './gate-patterns.mjs';

const root = new URL('..', import.meta.url).pathname;
const [name, islands = 6, years = 3] = [process.argv[2], +(process.argv[3] ?? 6), +(process.argv[4] ?? 3)];
const L = LAYERS[name];
if (!L) throw new Error(`no layer ${name}`);

function runTests() {
  if (!TESTS[name]) return 'no tests listed';
  const out = execFileSync('node', ['--test', '--test-reporter=tap', ...TESTS[name]], { cwd: root, encoding: 'utf8' });
  const fail = +out.match(/^# fail (\d+)/m)[1];
  if (fail) throw new Error(`${name}: ${fail} test(s) failing`);
  return out.match(/^# pass \d+/m)[0];
}

const runIsland = (seed, cfg) => new Promise((ok, no) => {
  const p = spawn('node', ['tools/gate-run.mjs', String(seed), String(years), JSON.stringify(cfg)], { cwd: root });
  let out = '';
  p.stdout.on('data', d => (out += d));
  p.on('close', code => (code ? no(new Error(`island ${seed} failed`)) : ok(JSON.parse(out))));
});

const deathsOf = r => Object.values(r.deaths).reduce((a, b) => a + b, 0);
const booksOk = r => Math.abs(r.books.soil) < 1e-3 && Math.abs(r.books.holes) < 1e-2 && Math.abs(r.books.ground) < 1e-3 && Math.abs(r.books.channels ?? 0) < 1e-3;

function judge(before, after) {
  const fails = [];
  after.forEach((r, i) => {
    if (r.alarms) fails.push(`island ${r.seed}: ${r.alarms} alarms`);
    if (!booksOk(r)) fails.push(`island ${r.seed}: water books off`);
  });
  const dB = before.reduce((a, r) => a + deathsOf(r), 0) / before.length, dA = after.reduce((a, r) => a + deathsOf(r), 0) / after.length;
  if (dA > Math.max(dB * 1.2, dB + 2)) fails.push(`deaths up: ${dB.toFixed(1)} before, ${dA.toFixed(1)} after (per island)`);
  const pat = PATTERNS[name] ? PATTERNS[name](after) : { ok: true, detail: 'no pattern listed' };
  if (!pat.ok) fails.push(`pattern: ${pat.detail}`);
  return { fails, deaths: { before: dB, after: dA }, pattern: pat.detail };
}

const hashes = Object.fromEntries([...L.files, ...(L.real ?? [])].map(f =>
  [f, crypto.createHash('sha256').update(fs.readFileSync(`${root}dist/${f}`)).digest('hex')]));
const tests = runTests();
const seeds = Array.from({ length: islands }, (_, i) => i + 1);
const [before, after] = await Promise.all([
  Promise.all(seeds.map(k => runIsland(k, { layers: { [name]: 'stand-in' } }))),
  Promise.all(seeds.map(k => runIsland(k, { layers: { [name]: 'real' } }))),
]);
const v = judge(before, after);
const rec = { layer: name, pass: v.fails.length === 0, date: new Date().toISOString().slice(0, 10), islands, years,
  tests, deaths: v.deaths, pattern: v.pattern, fails: v.fails, hashes,
  toggle: L.toggle ?? 'none: this layer was wired before the gate existed, so before and after run the same code' };
fs.mkdirSync(`${root}docs/gates`, { recursive: true });
fs.writeFileSync(`${root}docs/gates/${name}.json`, JSON.stringify(rec, null, 1) + '\n');
console.log(rec.pass ? `GATE PASSED: ${name}` : `GATE FAILED: ${name}\n- ${v.fails.join('\n- ')}`);
console.log(`deaths per island ${v.deaths.before.toFixed(1)} -> ${v.deaths.after.toFixed(1)}; ${v.pattern}`);
process.exitCode = rec.pass ? 0 : 1;
