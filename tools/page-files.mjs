// The files the world page needs: world-app.js and everything it imports, at the page's top level (not under dist/).
// Prints them with a hash so a publish can be checked against the page's file list. Run before every page publish.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const D = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../dist');
const deps = f => [...fs.readFileSync(f, 'utf8').matchAll(/(?:import|export)[^'"]*?from\s*'(\.[^']+)'|import\(\s*'(\.[^']+)'\s*\)/g)].map(m => path.resolve(path.dirname(f), m[1] ?? m[2]));
const need = new Set(), st = [path.join(D, 'world-app.js')];
while (st.length) { const f = st.pop(); if (need.has(f)) continue; if (!fs.existsSync(f)) { console.log('MISSING', path.relative(D, f)); process.exitCode = 1; continue; } need.add(f); st.push(...deps(f)); }
for (const f of [...need].sort()) console.log(path.relative(D, f).padEnd(16), crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12));
