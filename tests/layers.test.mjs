// The layer rules (dist/layers.js): every file has a layer, imports run downhill, real layers have a gate,
// and every function in a real layer's files is under 30 lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { LAYERS, layerOf, allowed } from '../dist/layers.js';

const D = new URL('../dist/', import.meta.url);
const jsFiles = () => fs.readdirSync(D).filter(f => f.endsWith('.js'));
const importsOf = f => [...fs.readFileSync(new URL(f, D), 'utf8').matchAll(/from\s*'\.\/([a-z0-9-]+\.js)'/g)].map(m => m[1]);

test('L1 every file of the small world belongs to exactly one layer', () => {
  for (const f of jsFiles()) {
    if (f === 'layers.js') continue;
    const owners = Object.entries(LAYERS).filter(([, L]) => L.files.includes(f) || L.real?.includes(f));
    assert.equal(owners.length, 1, `${f} belongs to ${owners.length} layers`);
  }
});

test('L2 downhill only: no file imports from a higher layer', () => {
  for (const f of jsFiles()) {
    if (f === 'layers.js') continue;
    for (const g of importsOf(f)) {
      if (g === 'layers.js') continue;
      assert.ok(allowed(layerOf(f), layerOf(g)), `${f} (${layerOf(f)}) imports ${g} (${layerOf(g)}), a higher layer`);
    }
  }
});

test('L3 a layer is real only with a gate: a passing record whose code hashes match today\'s files', () => {
  for (const [name, L] of Object.entries(LAYERS)) {
    if (L.status !== 'real' || L.rank < 0 || L.rank > 6) continue;
    const rec = JSON.parse(fs.readFileSync(new URL(`../docs/gates/${name}.json`, import.meta.url), 'utf8'));
    assert.equal(rec.pass, true, `${name}: gate record does not pass`);
    for (const f of [...L.files, ...(L.real ?? [])]) {
      const h = crypto.createHash('sha256').update(fs.readFileSync(new URL(f, D))).digest('hex');
      assert.equal(rec.hashes[f], h, `${name}: ${f} changed since its gate; run node tools/gate.mjs ${name}`);
    }
  }
});

test('L4 every function in a real layer\'s files is under 30 lines', () => {
  for (const [, L] of Object.entries(LAYERS)) {
    if (L.status !== 'real' || L.rank < 0 || L.rank > 6) continue;
    for (const f of L.files) {
      const lines = fs.readFileSync(new URL(f, D), 'utf8').split('\n');
      let start = -1;
      lines.forEach((l, i) => {
        if (/^(export )?function /.test(l)) start = i;
        if (start >= 0 && l === '}') { assert.ok(i - start + 1 < 30, `${f}: function at line ${start + 1}`); start = -1; }
      });
    }
  }
});
