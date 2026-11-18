// Runs one experiment variant (same definitions as tests/run-experiments.mjs) so long batches can be done in pieces.
import fs from 'node:fs';
import { runSeed, aggregate, PLAN } from '../../dist/experiment.js';
const variants = { 'baseline': {}, 'no-learning': { learning: 0 }, 'low-exploration': { exploration: 4 }, 'high-exploration': { exploration: 12 }, 'low-regeneration': { regenA: .144, regenB: .128 }, 'high-regeneration': { regenA: .216, regenB: .192 }, 'rule-policy': { policy: 'rule' } };
const name = process.argv[2], config = variants[name], count = 20;
if (!config) throw Error('unknown variant ' + name);
fs.mkdirSync('results', { recursive: true });
const rows = []; for (let i = 0; i < count; i++) rows.push(...runSeed(PLAN.seeds[i], config, false));
fs.writeFileSync(`results/${name}.json`, JSON.stringify({ plan: PLAN, config, seeds: PLAN.seeds.slice(0, count), rows }));
console.log(name, count, 'seeds completed');
