// Fit one number by cross-entropy on the calibration patterns: node tools/fit.mjs <name> <v1,v2,...> [islands] [years]
// Runs tools/score.mjs at each value on the same seeds (paired) and fits a parabola through the best three.
import { execFileSync } from 'node:child_process';
const [name, list, islands = '4', years = '5'] = process.argv.slice(2), vals = list.split(',').map(Number), rows = [];
for (const v of vals) { const out = execFileSync('node', ['tools/score.mjs', islands, years, `--set=${name}:${v}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); rows.push([v, +out.match(/Score: ([\d.]+)/)[1]]); console.log(`${name} = ${v}: ${rows.at(-1)[1]} nats`); }
const i = rows.reduce((b, r, k) => r[1] < rows[b][1] ? k : b, 0);
if (i > 0 && i < rows.length - 1) { const [[x1, y1], [x2, y2], [x3, y3]] = [rows[i - 1], rows[i], rows[i + 1]]; const d = (x1 - x2) * (x1 - x3) * (x2 - x3), A = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / d, B = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / d; console.log(`parabola minimum: ${(-B / (2 * A)).toPrecision(3)}`); }
else console.log(`best at the edge of the grid (${rows[i][0]}): widen it`);
