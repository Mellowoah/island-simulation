// Reviewer browser QA (not part of the project; uses a globally installed Playwright + system Chrome).
// Usage: node browser-qa.mjs <base-url> <label>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [base, label] = process.argv.slice(2);
const results = [];
const rec = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok === true ? 'PASS' : ok === false ? 'FAIL' : 'INFO'}  ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const txt = sel => page.locator(sel).innerText();
const wait = ms => page.waitForTimeout(ms);
async function tile(x, y) {
  await page.locator('#world').scrollIntoViewIfNeeded(); await wait(150);
  const box = await page.locator('#world').boundingBox();
  const scale = Math.min(box.width / (36 * 12), box.height / (26 * 12));
  const ox = (box.width - 36 * 12 * scale) / 2, oy = (box.height - 26 * 12 * scale) / 2;
  await page.touchscreen.tap(box.x + ox + (x + .5) * 12 * scale, box.y + oy + (y + .5) * 12 * scale);
}
const toast = async () => (await page.locator('#toast').innerText()).trim();

await page.goto(base + '/index.html');
await page.waitForSelector('#clock');
const c0 = await txt('#clock'); await wait(2500); const c1 = await txt('#clock');
rec('autonomous progression (clock advances with no input)', c0 !== c1, `${c0} → ${c1}`);
await page.screenshot({ path: `shots/${label}-01-start.png` });

await page.tap('#pause'); await wait(400); const p0 = await txt('#clock'); await wait(1500); const p1 = await txt('#clock');
rec('pause stops time', p0 === p1 && (await txt('#status')) === 'PAUSED', `${p0} / ${p1}`);

// Positions from a real save, then tap a creature on the canvas while paused.
await page.tap('#save');
const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('island-save'))).world;
const target = saved.creatures.find(c => c.id !== 0 && saved.creatures.filter(o => Math.hypot(o.x - c.x, o.y - c.y) < 2.2).length === 1) ?? saved.creatures[7];
await tile(target.x, target.y);
await wait(400);
rec('tap selects a creature while paused', (await txt('#name')) === target.name, `tapped ${target.name}, inspector shows ${await txt('#name')}`);

await page.locator('details summary').tap();
const decisionHtml = await page.locator('#decision').innerHTML();
const sel = saved.creatures[target.id].decision;
rec('inspector shows recorded decision with selected option marked', !!sel && decisionHtml.includes('→ ' + sel.selected), sel ? `selected ${sel.selected}` : 'no decision yet');
await page.screenshot({ path: `shots/${label}-02-inspector.png`, fullPage: true });

rec('raw file input stays hidden', !(await page.locator('#file').isVisible()));
rec('lab cancel / return buttons hidden until needed', !(await page.locator('#cancel').isVisible()) && !(await page.locator('#return').isVisible()));
// Distinct sprites: hash the portrait for all 24 creatures.
const hashes = new Set();
for (let i = 0; i < 24; i++) {
  hashes.add(await page.evaluate(() => document.getElementById('portrait').toDataURL()));
  await page.locator('#next').tap(); await wait(30);
}
rec('24 creatures have distinct portraits', hashes.size === 24 ? true : false, `${hashes.size} distinct of 24`);

// Powers.
const food0 = Number(await txt('#food'));
await page.locator('#give').tap();
const land = [13, 13];
await tile(land[0], land[1]); await wait(400);
const food1 = Number(await txt('#food'));
rec('provide food on dry land (paused)', food1 === food0 + 40, `${food0} → ${food1}`);
await tile(0, 0); await wait(300);
rec('provide food on water is refused with a message', (await toast()) === 'Choose dry land.', await toast());
await page.locator('#give').tap();
await page.locator('#bridge').tap(); await wait(300);
rec('open crossing (button then disabled)', await page.locator('#bridge').isDisabled());
await page.locator('#reveal').tap(); await wait(300);
const ev = await txt('#events');
rec('reveal to selected creature recorded in chronicle', /revealed to|already knew/.test(ev), ev.split('\n').slice(0, 2).join(' | '));
await page.screenshot({ path: `shots/${label}-03-powers.png`, fullPage: true });

// Speed and resume.
await page.locator('#speed').tap();
rec('speed toggles to 4×', (await txt('#speed')) === '4×');
await page.tap('#pause'); await wait(400); const s0 = await txt('#clock'); await wait(2000); const s1 = await txt('#clock');
rec('resume at 4× advances time', s0 !== s1, `${s0} → ${s1}`);
await page.tap('#pause'); await page.locator('#speed').tap(); await wait(400);

// Save / load round trip.
await page.tap('#save'); const savedClock = await txt('#clock');
await page.tap('#pause'); await wait(1500); await page.tap('#pause');
await page.tap('#load'); await wait(300);
rec('load restores saved world and pauses', (await txt('#clock')) === savedClock && (await txt('#status')) === 'PAUSED', `${savedClock} vs ${await txt('#clock')}`);

// Export download.
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#export').tap()]);
const exported = fs.readFileSync(await dl.path(), 'utf8');
rec('export produces a save file', JSON.parse(exported).format === 'island-save', dl.suggestedFilename());

// Import malformed JSON → rejected, world unchanged.
const before = await txt('#clock');
await page.setInputFiles('#file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
await wait(300);
rec('malformed import rejected, world kept', (await toast()) === 'Invalid JSON save' && (await txt('#clock')) === before, await toast());

// Import a save that passes 0.1.1 validation but has a dead creature without a death record.
const crash = JSON.parse(exported); crash.world.creatures[0].alive = false; crash.world.creatures[0].death = null;
const errBefore = errors.length;
await page.setInputFiles('#file', { name: 'crash.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(crash)) });
await wait(400);
const t1 = await toast();
await page.tap('#pause'); await wait(400); const k0 = await txt('#clock'); await wait(2000); const k1 = await txt('#clock');
const frozen = k0 === k1;
rec('save with dead creature but no death record: rejected, app keeps running', !frozen && /Invalid or incompatible save/.test(t1), `toast "${t1}"; clock ${k0} → ${k1}; new page errors: ${errors.slice(errBefore).join(' | ') || 'none'}`);
if (frozen) { await page.reload(); await page.waitForSelector('#clock'); }
else await page.tap('#pause');

// Eden dialog.
if ((await txt('#status')) === 'PAUSED') await page.tap('#pause'); // running before opening Eden
await page.locator('#eden').tap(); await wait(300);
const eden = await txt('#edenDialog');
rec('Eden opens as a script, pauses island, nobody has eaten', (await txt('#status')) === 'PAUSED' && eden.includes('No one has eaten'), eden.match(/Paused before action[^\n]*/)?.[0] ?? '');
await page.screenshot({ path: `shots/${label}-04-eden.png` });
await page.locator('#edenDialog .close').tap();

// Help text.
const help = await page.locator('#helpDialog').innerText();
rec('help text makes no access/privacy claim', !/private to your account/.test(help));

// Lab: single seed, inspect, return.
const islandClock = await txt('#clock');
await page.locator('#lab').tap();
await page.locator('#run').tap();
await page.waitForFunction(() => /Completed/.test(document.getElementById('progress').textContent), null, { timeout: 120000 });
const rows = await page.locator('#results tbody tr').count();
rec('lab single-seed run completes', rows === 10, `${rows} branch rows; ${await txt('#progress')}`);
await page.screenshot({ path: `shots/${label}-05-lab.png`, fullPage: true });
await page.locator('[data-inspect="3"]').tap(); await wait(400);
rec('inspect loads branch snapshot', (await txt('#hint')).includes('provision / berry-failure'), await txt('#hint'));
await page.locator('#lab').tap(); await page.locator('#return').tap(); await wait(300);
rec('return restores own island', (await txt('#clock')) === islandClock, `${islandClock} vs ${await txt('#clock')}`);

// Lab: 20-seed pilot in the worker.
await page.locator('#lab').tap();
const t0 = Date.now();
await page.locator('#pilot').tap();
await page.waitForFunction(() => /Completed/.test(document.getElementById('progress').textContent), null, { timeout: 300000 });
rec('lab 20-seed pilot completes in worker', true, `${await txt('#progress')} (${((Date.now() - t0) / 1000).toFixed(0)} s headless desktop CPU)`);
await page.locator('#labDialog .close').tap();

// Visibility: hidden page pauses and writes autosave.
await page.tap('#pause');
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
rec('hidden page pauses', (await txt('#status')) === 'PAUSED');
const hasAuto = await page.evaluate(() => !!localStorage.getItem('island-autosave'));
rec('autosave written on hide', hasAuto);

// Offline reopen via service worker (Chrome, localhost).
await page.reload(); await wait(1500);
await ctx.setOffline(true);
let offlineOk = false;
try { await page.reload({ timeout: 10000 }); await page.waitForSelector('#clock', { timeout: 5000 }); offlineOk = true; } catch {}
rec('reopens offline from service-worker cache (desktop Chrome)', offlineOk);
await ctx.setOffline(false);
const startClock = await txt('#clock');
rec('reopened page restores autosave', !/^D1 · 00:0/.test(startClock) ? true : 'INFO', `clock after reopen ${startClock}`);

rec('page errors during session', errors.length === 0 ? true : 'INFO', errors.join(' | ') || 'none');
fs.writeFileSync(`qa-${label}.json`, JSON.stringify(results, null, 2));
await browser.close();
