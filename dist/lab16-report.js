// Island Lab 16-bit: end-of-run report. Every number is read from the sim's own counters
// (eden.js / lab.js state, edenMetrics, labMetrics) or from the run's recorded samples. Nothing is estimated.
import { DAY } from './sim.js';
import { edenMetrics } from './eden.js';
import { labMetrics } from './lab.js';
import { PREDICTIONS, THEORY, lineLabel } from './lab16-setup.js';
import { batchMarkdown, batchHTML } from './lab16-batch.js';
import { hardshipEden } from './lab16-run.js';
import { developmentSummary, LIFE_STAGES } from './being.js';
import { ROUTINE_KEYS } from './lab16-run.js';
import { hearingsTotal, habitSpread, curiositySpread, giftEaten, seriesOf } from './lab16-run.js';

export const MARGIN = 0.05; // a difference must be at least 5% of the smaller value to count; smaller gaps count as "no difference"
export const SURVIVAL_YEARS = 3;

const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const r1 = n => Math.round(n * 10) / 10;
const pct = n => `${r1(n)}%`;
const yr = t => r1(t / DAY);

// Facts about one Eden run.
export function summarizeEden(run) {
  const s = run.world, E = s.eden, m = edenMetrics(s), series = run.series;
  const fell = E.fallTick !== null;
  const delib = E.deliberations;
  const before = fell ? [...series].reverse().find(r => r.t <= E.fallTick) : null;
  const last = series.at(-1);
  // Survival of everyone alive at the fall, a fixed number of years later (or as far as the run went).
  const cohortAt = years => { if (!fell) return null; const t = E.fallTick + years * DAY; const row = [...series].reverse().find(r => r.t <= t && r.cohort !== null); return row ? row.cohort : null; };
  const yearsAfter = fell ? (s.tick - E.fallTick) / DAY : 0;
  // Food the creatures gathered from the island itself (not from your help) in the second half of the run, per creature per year.
  let ownLater = null;
  if (run.half && s.tick > run.half.tick) {
    const own = (s.ledger.consumed - run.half.consumed) - (giftEaten(s) - run.half.giftEaten);
    const pops = series.filter(r => r.t >= run.half.tick).map(r => r.pop);
    const years = (s.tick - run.half.tick) / DAY, avgPop = mean(pops);
    ownLater = avgPop ? own / avgPop / years : null;
  }
  // Moving bar (measure only): hardship, each creature's own bar, and the share above their bar.
  const avg = (rows, k) => mean(rows.map(r => r[k]).filter(v => v !== null && v !== undefined));
  const pre = fell ? series.filter(r => r.t <= E.fallTick) : series, post = fell ? series.filter(r => r.t > E.fallTick) : [];
  const alive = s.creatures.filter(c => c.alive);
  const skill = mean(alive.map(c => ((c.skills.a ?? 0) + (c.skills.b ?? 0)) / 2));
  return {
    kind: 'eden', lifeCourse: !!run.setup.lifeCourse, routine: LIFE_STAGES.map(st => { const u = run.routine?.[st.id]; const n = u ? ROUTINE_KEYS.reduce((a, k) => a + u[k], 0) : 0; return n >= 500 ? { stage: st.name, plural: st.plural, ...Object.fromEntries(ROUTINE_KEYS.map(k => [k, u[k] / n * 100])) } : null; }).filter(Boolean),
    oldAge: s.eden.deaths['Old age'] ?? 0, development: run.setup.traitDev ? developmentSummary(s) : null, restoration: !!run.setup.restoration, tempters: run.setup.tempters ?? 0, fallAgain: run.setup.fallAgain !== false, restored: m.restored ?? null,
    hardRestored: mean(alive.filter(c => c.eden.covered).map(hardshipEden)), hardOthers: mean(alive.filter(c => !c.eden.covered).map(hardshipEden)), seed: s.seed, guidanceYears: run.setup.guidanceYears, guidance: run.setup.guidance, help: run.setup.help, years: s.tick / DAY, tick: s.tick,
    start: 24, population: m.population, births: m.births, deaths: m.deaths, deathCauses: m.deathCauses,
    fell, fallYear: fell ? E.fallTick / DAY : null, firstEater: fell ? s.creatures[E.firstEater].name : null,
    hearings: hearingsTotal(s), deliberationsKept: delib.length,
    meanChance: delib.length ? mean(delib.map(d => d.P)) * 100 : null,
    minChance: delib.length ? Math.min(...delib.map(d => d.P)) * 100 : null, maxChance: delib.length ? Math.max(...delib.map(d => d.P)) * 100 : null,
    refusals: delib.filter(d => !d.ate).length,
    guidedShare: m.guidedShare * 100, overrides: m.overrides, decisions: m.decisions,
    yearsAfter, survivalYears: fell ? Math.min(SURVIVAL_YEARS, Math.floor(yearsAfter)) : 0, cohortSize: run.cohort ? run.cohort.length : 0,
    cohortByYear: fell ? Array.from({ length: Math.floor(yearsAfter) + 1 }, (_, k) => cohortAt(k)) : [], cohortEnd: fell ? cohortAt(yearsAfter) : null,
    habitBefore: before ? before.habit : null, habitAfter: last.habit, habitNow: habitSpread(s),
    curiosityBefore: before ? before.curiosity : null, curiosityAfter: curiositySpread(s),
    gifted: s.ledger.gifted, giftEaten: giftEaten(s), ownLater, skill: skill === null ? null : skill * 100,
    hardGuided: avg(pre, 'hard'), hardReleased: avg(post, 'hard'), overGuided: avg(pre, 'over'), overReleased: avg(post, 'over'),
    hardEnd: last.hard ?? null, barEnd: last.bar ?? null, overEnd: last.over ?? null,
    fields: m.fields, clothed: m.clothed, tools: m.tools, food: s.patches.reduce((n, p) => n + p.stock, 0),
  };
}

export function summarizeLab(run) {
  const s = run.world, m = labMetrics(s), rows = seriesOf(run), first = rows[0], lastBar = [...rows].reverse().find(r => r.hard !== null && r.hard !== undefined);
  const firstBar = rows.find(r => r.hard !== null && r.hard !== undefined);
  return { kind: 'lab', talk: run.setup.talk, foodSetting: run.setup.food, regrowth: run.setup.regrowth,
    hardStart: firstBar?.hard ?? null, hardEnd: lastBar?.hard ?? null, barEnd: lastBar?.bar ?? null, overEnd: lastBar?.over ?? null, seed: s.seed, years: s.tick / DAY, days: s.tick / DAY, tick: s.tick, start: s.creatures.length, population: m.alive, deaths: m.deaths,
    trustStart: first ? first.trust : s.config.startTrust, trustEnd: m.trustMean, trustSpread: m.trustSpread, food: m.food,
    sent: m.messages.sent, accepted: m.messages.accepted, falseSent: m.messages.falseSent, verifiedFalse: m.messages.verifiedFalse, verifiedTrue: m.messages.verifiedTrue,
    knowledge: m.knowledgeSpread * 100, falseInfo: s.config.falseInformationRate * 100 };
}

// Compare: does `a` beat `b` in the predicted direction by at least MARGIN of the smaller value?
export function judge(a, b, higherIsBetter) {
  if (a === null || b === null || a === undefined || b === undefined) return { verdict: 'not judged', diff: null };
  const diff = a - b, base = Math.max(Math.min(Math.abs(a), Math.abs(b)), 1e-9);
  const big = Math.abs(diff) >= MARGIN * base && Math.abs(diff) > 1e-9;
  const right = higherIsBetter ? diff > 0 : diff < 0;
  return { verdict: big && right ? 'held' : 'failed', diff, direction: !big ? 'no real difference' : right ? 'predicted direction' : 'opposite direction' };
}

export function twinSetups(setup) {
  return {
    guidance: { ...setup, guidance: setup.guidance >= 1 ? 0.5 : 1 },
    help: { ...setup, help: !setup.help },
  };
}

export function predictionsEden(main, gTwin, hTwin) {
  const out = [];
  // P1 and P2: the run with more years of guidance vs the run with fewer (same seed, same help).
  const [longer, shorter] = main.guidance >= gTwin.guidance ? [main, gTwin] : [gTwin, main];
  const tag = x => `guided ${Math.round(x.guidance * 100)}% of the time`;
  {
    const j = judge(longer.meanChance, shorter.meanChance, false);
    out.push({ id: 'P1', text: PREDICTIONS.P1, ...j,
      measure: 'Average chance of eating each time the deceiver spoke (the sim\'s own figure at each meeting).',
      a: longer.meanChance, b: shorter.meanChance, aLabel: tag(longer), bLabel: tag(shorter), unit: '%',
      why: j.verdict === 'not judged' ? 'The deceiver never spoke in one of the two worlds, so there is nothing to compare.' : null, lines: ['T2', 'T4', 'T7'] });
  }
  {
    const k = Math.min(longer.survivalYears, shorter.survivalYears);
    const a = k >= 1 ? longer.cohortByYear[k] : null, b = k >= 1 ? shorter.cohortByYear[k] : null;
    const j = judge(a, b, true);
    out.push({ id: 'P2', text: PREDICTIONS.P2, ...j,
      measure: `Share of the creatures alive at the fall that were still alive ${k >= 1 ? k : SURVIVAL_YEARS} year${k === 1 ? '' : 's'} later.`,
      a, b, aLabel: tag(longer), bLabel: tag(shorter), unit: '%', years: k,
      why: j.verdict === 'not judged' ? (!longer.fell || !shorter.fell ? 'One of the two worlds never fell during the run, so there is no "after release" to compare.' : 'Less than one full year passed after the fall in one of the worlds. Run longer.') : null, lines: ['T7', 'T5'] });
  }
  {
    const j = main.fell ? { ...judge(main.habitAfter, main.habitBefore, true), verdict: 'not tested' } : { verdict: 'not judged', diff: null };
    out.push({ id: 'P3', text: PREDICTIONS.P3, ...j,
      measure: 'How different the creatures\' own habits are from each other (0 = all alike, 100 = as different as possible), just before the fall vs at the end.',
      a: main.habitAfter, b: main.habitBefore, aLabel: 'after release (end)', bLabel: 'while guided (just before the fall)', unit: ' pts',
      why: !main.fell ? 'No one ate during this run, so there was no release.' : null, builtIn: true, lines: ['T5'] });
  }
  out.push({ id: 'P4', text: PREDICTIONS.P4, verdict: 'not tested', diff: null, measure: 'None available.',
    why: 'This sim does not record what creatures expect their needs to be, so there is nothing to score. It would need a new measure (not a rule change) in a later run.', lines: ['T5'] });
  {
    const [on, off] = main.help ? [main, hTwin] : [hTwin, main];
    const j = judge(on.ownLater, off.ownLater, true);
    out.push({ id: 'P5', text: PREDICTIONS.P5, ...j,
      measure: 'Food the creatures gathered from the island itself in the second half of the run (after your help stopped), per creature per year.',
      a: on.ownLater, b: off.ownLater, aLabel: 'with your help', bLabel: 'without help', unit: ' food',
      why: j.verdict === 'not judged' ? 'The run ended before its second half, so there is no "later" to measure.' : null, lines: ['T8', 'T7'] });
  }
  return out;
}

const verdictWord = v => v === 'held' ? 'HELD' : v === 'failed' ? 'FAILED' : v === 'not tested' ? 'NOT TESTED' : 'NOT JUDGED';
const dUnit = u => u === '%' ? ' percentage points' : u;
const fmt = (n, unit = '') => n === null || n === undefined ? 'n/a' : `${r1(n)}${unit}`;

function storyEden(m) {
  const p = [];
  p.push(`This island (seed ${m.seed}) ran for ${r1(m.years)} years. It began with ${m.start} creatures, each warned by the Creator not to eat from the tree.`);
  p.push(`${m.guidanceYears === 0 ? 'The deceiver could speak from the very start' : `The deceiver was kept silent for the first ${m.guidanceYears === 1 ? 'year' : m.guidanceYears + ' years'}`}. While they were guided, the Creator stepped in on ${pct(m.guidedShare)} of their choices (${m.overrides} of ${m.decisions}); the rest were their own.`);
  if (m.hearings === 0) p.push('The deceiver never got to speak to anyone.');
  else p.push(`The deceiver spoke ${m.hearings} time${m.hearings === 1 ? '' : 's'}. Each time, the creature weighed it and the sim worked out its chance of eating; on average that chance was ${fmt(m.meanChance, '%')} (lowest ${fmt(m.minChance, '%')}, highest ${fmt(m.maxChance, '%')}). They refused ${m.refusals} time${m.refusals === 1 ? '' : 's'}.`);
  if (m.fell) p.push(`In year ${r1(m.fallYear)}, ${m.firstEater} ate from the tree, and everyone was released to their own devices. Of the ${m.cohortSize} creatures alive at that moment, ${fmt(m.cohortEnd, '%')} were still alive at the end.`);
  else p.push('No one ate from the tree during this run, so everyone stayed guided and no one died. (Never eating is allowed: T3.)');
  p.push(`At the end ${m.population} were alive. There were ${m.births} births and ${m.deaths} deaths${m.deaths ? ` (${Object.entries(m.deathCauses).map(([k, v]) => `${v} from ${k.toLowerCase()}`).join(', ')})` : ''}.`);
  if (m.fell) p.push(`After release they tilled ${m.fields} field${m.fields === 1 ? '' : 's'}; ${m.clothed} of the living had made clothing and ${m.tools} had made a tool.`);
  if (m.routine?.length) {
    const own = m.routine.filter(r => r.rest < 85);
    if (own.length) p.push(`How each stage spent its time${m.lifeCourse ? ' (life-stage rules on: sleep need, food need, healing and ageing change with age)' : ' (life-stage rules off: one adult body for all)'}: ${own.map(r => `${r.plural} rested ${fmt(r.rest, '%')}, gathered ${fmt(r.gather, '%')}, travelled ${fmt(r.travel, '%')}, explored ${fmt(r.explore, '%')}, worked ${fmt(r.work, '%')}`).join('; ')}. Young children are carried by their mother, so they are counted as resting. Island has no night: one sim day is a year, so rest stands for sleep as a share of life, not a nightly routine.${m.lifeCourse ? ` ${m.oldAge} died of age.` : ''}`);
  }
  if (m.development) {
    const D = m.development, top = Object.entries(D.shift).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${fmt(v)}`).join(' and ');
    p.push(`Traits developed through life. On average the living moved ${fmt(D.meanShift)} points (of 100) from the traits they were born with; most in ${top}. ${D.pairs ? `Of ${D.pairs} trait comparisons between a living child and its mother, the child had moved closer to her in ${D.closer} (${pct(D.closer / D.pairs * 100)}).` : 'No living child had a living record of its mother.'}`);
  }
  if (m.restored && m.restoration) {
    const R = m.restored;
    p.push(`A way back was open. The Creator called ${R.calls} times; ${R.returned} creature${R.returned === 1 ? '' : 's'} chose to turn back and ${R.calls - R.returned} calls were refused. At the end ${R.living} of the ${m.population} living were restored. The Creator led them on ${pct(R.ledShare * 100)} of their choices and gave bread or water ${R.bread} times. ${R.deathsRestored} restored creature${R.deathsRestored === 1 ? '' : 's'} died.${m.hardRestored !== null && m.hardOthers !== null ? ` At the end, hardship averaged ${fmt(m.hardRestored)} among the restored and ${fmt(m.hardOthers)} among the rest.` : ''}`);
  }
  if (m.restored && m.tempters) p.push(`The deceiver sent ${m.tempters} demon${m.tempters === 1 ? '' : 's'}. They whispered ${m.restored.whispers} times; ${m.fallAgain ? `${m.restored.left} restored creature${m.restored.left === 1 ? ' was' : 's were'} drawn away again` : 'the restored could not be drawn away in this world'}. They forced no one: each creature answered for itself.`);
  if (m.hardEnd !== null && m.hardGuided !== null) p.push(`The moving bar: average hardship (unmet needs, 0 to 100) was ${fmt(m.hardGuided)} while guided${m.fell ? ` and ${fmt(m.hardReleased)} after release` : ''}. Each creature's bar is its own recent average. On average ${fmt(m.overGuided, '%')} of creatures were above their own bar while guided${m.fell ? ` and ${fmt(m.overReleased, '%')} after release` : ''}; at the end the average bar stood at ${fmt(m.barEnd)}.`);
  if (m.help) p.push(`You left ${r1(m.gifted)} food near the start during the first half; ${r1(m.giftEaten)} of it was eaten.`);
  return p;
}

function meaning(preds, m) {
  const by = Object.fromEntries(preds.map(p => [p.id, p]));
  const out = [];
  const say = (id, held, failed, open) => { const v = by[id]?.verdict; out.push(v === 'held' ? held : v === 'failed' ? failed : open); };
  say('P1', 'P1 held: more guidance went with a lower chance of eating when the deceiver spoke. That fits T2 and T4, and leans toward the theory\'s "less likely" for P1, which is still marked proposed.',
    'P1 failed: more guidance did not lower the chance of eating when the deceiver spoke. In this model, the amount of guidance alone did not protect them (T2, T4).',
    'P1 could not be judged in this run.');
  say('P2', 'P2 held: the more-guided world survived the first years after release better. On the open question in T7 (proposed), this run points toward guidance preparing them.',
    'P2 failed: the more-guided world did not survive the first years after release better. On T7 (proposed), this run points toward guidance being good in the moment but not preparing them.',
    'P2 could not be judged in this run.');
  out.push(by.P3?.verdict === 'not judged' ? 'P3 could not be judged because there was no release.' : 'P3 was not tested: habits can only form after release and always start at 0, so "more different after release" is built into the rules. It shows T5 is modelled, not that it is true.');
  out.push('P4 was not tested: the sim has no measure for it yet.');
  say('P5', 'P5 held: help went with more food gathered later from the island itself. Help was not assumed good or bad (T8); this is what happened here.',
    'P5 failed: help did not build later ability to get food in this run, matching what the island tests found before. Help was not assumed good or bad (T8).',
    'P5 could not be judged in this run.');
  out.push(m.restoration ? 'T9 was switched on in this world: a way back, on the biblical reading, with each creature answering the call for itself. Being fed by rule means the restored cannot starve, so "fewer of them starve" is built in. What is open, and worth the batch test, is how many turn back, what happens to the rest, and what the demons change (T11).' : 'T9 was switched off in this world: there was no way back, so this report shows the fall without the Creator\'s response. Turn on "A way back after the fall" to include it.');
  out.push('The moving bar is a measure, not a rule: creatures do not act on it. Because each bar follows its owner\'s own hardship, the share above their bar drifts back toward the same level whatever the conditions. That is how the measure is defined, so it is not evidence by itself; the test is whether a choice (help, guidance) changes it in the batch test.');
  out.push('One matched pair of worlds is weak evidence. Use the batch test below before trusting a pass or a fail.');
  return out;
}

export function buildEdenReport(main, gTwin, hTwin, meta = {}) {
  const preds = predictionsEden(main, gTwin, hTwin);
  return { kind: 'eden', title: `Island Lab report: Eden, seed ${main.seed}`, created: meta.created ?? null, setup: meta.setup ?? null,
    story: storyEden(main), predictions: preds, meaning: meaning(preds, main), main, twins: { guidance: gTwin, help: hTwin },
    method: `Each prediction compares two worlds with the same seed that differ in one choice only, run for the same ${r1(main.years)} years. A prediction holds only if the difference is in the predicted direction and at least ${MARGIN * 100}% of the smaller number; smaller gaps count as "no difference", which counts against it.` };
}

export function buildLabReport(m, meta = {}) {
  const story = [
    `This Lab island (seed ${m.seed}) ran for ${r1(m.days)} days with ${m.start} creatures and ${r1(m.falseInfo)}% false information.`,
    `At the end ${m.population} were alive and ${m.deaths} had died.`,
    `They passed on ${m.sent} pieces of news; ${m.accepted} were believed and ${m.falseSent} were false. Creatures who went to check found ${m.verifiedFalse} told places empty and ${m.verifiedTrue} real.`,
    `Food was set to ${m.foodSetting} per source with regrowth ${m.regrowth}; telling each other was ${m.talk ? 'on' : 'off'}.`,
    ...(m.hardEnd !== null ? [`The moving bar: average hardship went from ${fmt(m.hardStart)} to ${fmt(m.hardEnd)} (0 to 100); at the end ${fmt(m.overEnd, '%')} of creatures were above their own bar, which stood at ${fmt(m.barEnd)} on average.`] : []),
    `Average trust between creatures went from ${fmt(m.trustStart)} to ${fmt(m.trustEnd)} (out of 100). On average each living creature knew ${fmt(m.knowledge, '%')} of the real food sources.`,
  ];
  const preds = Object.entries(PREDICTIONS).map(([id, text]) => ({ id, text, verdict: 'not tested', diff: null, measure: 'None in this world.', why: 'The Lab island has no warning, guidance, deceiver at a tree or release. Use the Eden test to check this prediction.' }));
  return { kind: 'lab', title: `Island Lab report: Lab island, seed ${m.seed}`, created: meta.created ?? null, setup: meta.setup ?? null, story, predictions: preds,
    meaning: ['This world is about trust and rumours. It does not test P1–P5. The closest theory line is T4 (a voice casting doubt on what they were told) when false information is on.'], main: m, twins: null, method: 'Single world; no comparison.' };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function reportMarkdown(r) {
  const L = [`# ${r.title}`, ''];
  if (r.created) L.push(`_Made ${r.created}_`, '');
  L.push(`**Results at a glance:** ${r.predictions.map(p => `${p.id} ${verdictWord(p.verdict).toLowerCase()}`).join(' · ')}`, '');
  L.push('## What happened', '', ...r.story.map(x => `- ${x}`), '', '## Predictions', '');
  for (const p of r.predictions) {
    L.push(`### ${p.id}: ${verdictWord(p.verdict)}`, '', `**Prediction:** ${p.text}`, '', `**Measured:** ${p.measure}`, '');
    if (p.a !== undefined && (p.verdict !== 'not tested' || p.builtIn)) L.push(`- ${p.aLabel}: ${fmt(p.a, p.unit)}`, `- ${p.bLabel}: ${fmt(p.b, p.unit)}`, `- Difference: ${p.diff === null ? 'n/a' : (p.diff > 0 ? '+' : '') + r1(p.diff) + dUnit(p.unit)} (${p.direction ?? 'n/a'})`, '');
    if (p.why) L.push(p.why, '');
    if (p.builtIn) L.push('_Built into the rules, so not a test: habits only start forming after release, and always start at 0._', '');
    if (p.lines) L.push(`Theory lines: ${p.lines.map(lineLabel).join(', ')}`, '');
  }
  L.push('## What this means for the theory', '', ...r.meaning.map(x => `- ${x}`), '');
  if (r.batch) L.push(batchMarkdown(r.batch));
  L.push('## How it was judged', '', r.method, '');
  L.push('## Theory lines referred to', '', ...['T2', 'T3', 'T4', 'T5', 'T7', 'T8', 'T9', 'T11'].map(id => `- **${lineLabel(id)}** ${THEORY[id].replace(/^\[proposed\] /, '')}`), '');
  return L.join('\n');
}

export function reportBodyHTML(r, images = []) {
  const color = v => v === 'held' ? '#7fd88f' : v === 'failed' ? '#ff9a8a' : '#e9d38f';
  const preds = r.predictions.map(p => `<section class="pred"><h3>${p.id} <span class="v" style="color:${color(p.verdict)}">${verdictWord(p.verdict)}</span></h3>
<p><b>Prediction:</b> ${esc(p.text)}</p><p><b>Measured:</b> ${esc(p.measure)}</p>
${p.a !== undefined && (p.verdict !== 'not tested' || p.builtIn) ? `<table><tr><td>${esc(p.aLabel)}</td><td>${fmt(p.a, p.unit)}</td></tr><tr><td>${esc(p.bLabel)}</td><td>${fmt(p.b, p.unit)}</td></tr><tr><td>Difference</td><td>${p.diff === null ? 'n/a' : (p.diff > 0 ? '+' : '') + r1(p.diff) + esc(dUnit(p.unit))} (${esc(p.direction ?? 'n/a')})</td></tr></table>` : ''}
${p.why ? `<p>${esc(p.why)}</p>` : ''}${p.builtIn ? '<p><i>Built into the rules, so not a test: habits only start forming after release, and always start at 0.</i></p>' : ''}${p.lines ? `<p class="m">Theory lines: ${p.lines.map(lineLabel).join(', ')}</p>` : ''}</section>`).join('\n');
  const imgs = images.length ? `<h2>Graphs</h2>${images.map(i => `<figure><img src="${i.src}" alt="${esc(i.title)}" style="max-width:100%;image-rendering:pixelated"><figcaption><b>${esc(i.title)}.</b> ${esc(i.caption)}</figcaption></figure>`).join('')}` : '';
  const glance = `<div class="glance">${r.predictions.map(p => `<span style="color:${color(p.verdict)}">${p.id} ${verdictWord(p.verdict)}</span>`).join('')}</div>`;
  return `<h1>${esc(r.title)}</h1>${r.created ? `<p class="m">Made ${esc(r.created)}</p>` : ''}${glance}
<h2>What happened</h2><ul>${r.story.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>Predictions</h2>${preds}
<h2>What this means for the theory</h2><ul>${r.meaning.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
${r.batch ? batchHTML(r.batch) : ''}${imgs}<h2>How it was judged</h2><p>${esc(r.method)}</p>
<h2>Theory lines referred to</h2><ul>${['T2', 'T3', 'T4', 'T5', 'T7', 'T8', 'T9', 'T11'].map(id => `<li><b>${lineLabel(id)}</b> ${esc(THEORY[id].replace(/^\[proposed\] /, ''))}</li>`).join('')}</ul>
`;
}

export function reportHTML(r, images = []) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:16px;background:#111a2b;color:#f2efe2}h1{font-size:22px}h2{margin-top:26px;font-size:17px;color:#ffe08a}h3{margin:0 0 6px}.pred{border:2px solid #4b5f8f;border-radius:6px;padding:10px 12px;margin:10px 0;background:#18233a}.v{font-family:monospace}table{border-collapse:collapse}td{padding:2px 12px 2px 0}.m{color:#a9b4cf;font-size:14px}</style></head><body>${reportBodyHTML(r, images)}</body></html>`;
}
