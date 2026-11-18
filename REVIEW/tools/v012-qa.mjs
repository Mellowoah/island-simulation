// Browser checks for 0.1.2 decisions D1 (restore on open) and D2 (inspection guard), plus lab columns.
import { chromium } from 'playwright';
const base = process.argv[2];
const rec = (n, ok, d = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const txt = s => page.locator(s).innerText(), wait = ms => page.waitForTimeout(ms);
const toast = async () => (await txt('#toast')).trim();

await page.goto(base + '/index.html'); await page.waitForSelector('#clock'); await wait(2500);
rec('fresh open runs live', (await txt('#status')) === 'LIVE');
// Hide the page -> autosave; reopen -> restored, paused, same tick
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const tick = JSON.parse(await page.evaluate(() => localStorage.getItem('island-autosave'))).world.tick;
await page.reload(); await page.waitForSelector('#clock'); await wait(600);
const clock = await txt('#clock');
const expect = `D${Math.floor(tick / 1440) + 1} · ${String(Math.floor(tick % 1440 / 60)).padStart(2, '0')}:${String(tick % 60).padStart(2, '0')}`;
rec('D1 reopen restores the autosaved island, paused', clock === expect && (await txt('#status')) === 'PAUSED', `${clock} vs saved ${expect}; toast "${await toast()}"`);

// Corrupt autosave -> fresh island, bad save kept aside
{ const p2 = await ctx.newPage();
  await p2.addInitScript(() => { if (!sessionStorage.getItem('planted')) { sessionStorage.setItem('planted', '1'); localStorage.setItem('island-autosave', '{"format":"island-save","version":3,"world":{}}'); } });
  await p2.goto(base + '/index.html'); await p2.waitForSelector('#clock'); await p2.waitForTimeout(400);
  const kept = await p2.evaluate(() => [localStorage.getItem('island-autosave-rejected'), localStorage.getItem('island-autosave')]);
  const t = (await p2.locator('#toast').innerText()).trim(), c = await p2.locator('#clock').innerText();
  rec('D1 damaged autosave: fresh island, damaged copy kept aside', c.startsWith('D1 · 00:0') && kept[0] === '{"format":"island-save","version":3,"world":{}}' && kept[1] === null, `clock ${c}; toast "${t}"`);
  await p2.close(); }

// Make a real manual save to protect
await page.tap('#pause'); await page.tap('#save');
const mySave = await page.evaluate(() => localStorage.getItem('island-save'));

// Lab single seed, inspect a branch
await page.locator('#lab').tap(); await page.locator('#run').tap();
await page.waitForFunction(() => /Completed/.test(document.getElementById('progress').textContent), null, { timeout: 120000 });
const head = await txt('#results thead'); const firstRow = await txt('#results tbody tr:nth-child(1)'); const failRow = await txt('#results tbody tr:nth-child(2)');
rec('lab shows Recovered column (n/a for controls, count for disturbed)', head.includes('Recovered') && /n\/a/.test(firstRow) && /\d+ \/ 1/.test(failRow), `${firstRow.replace(/\s+/g, ' ')} | ${failRow.replace(/\s+/g, ' ')}`);
const provRow = await txt('#results tbody tr:nth-child(3)');
rec('lab shows gifted food left at day 10', /left at day 10/.test(provRow), provRow.replace(/\s+/g, ' '));
rec('lab label shows model v3', /model v3/.test(await txt('#progress')), await txt('#progress'));
await page.screenshot({ path: 'shots/v012-lab.png', fullPage: true });
await page.locator('[data-inspect="1"]').tap(); await wait(400);

// Guarded actions
await page.locator('#save').scrollIntoViewIfNeeded(); await page.tap('#save'); await wait(200);
const t1 = await toast(); const after = await page.evaluate(() => localStorage.getItem('island-save'));
rec('D2 Save blocked while inspecting; own save untouched', /Return to your island first/.test(t1) && after === mySave, t1);
await page.tap('#load'); await wait(200); rec('D2 Load blocked while inspecting', /Return to your island first/.test(await toast()));
await page.tap('#import'); await wait(200); rec('D2 Import blocked while inspecting', /Return to your island first/.test(await toast()));
await page.tap('#reset'); await wait(200); rec('D2 New run blocked while inspecting', /Return to your island first/.test(await toast()));
const [dl] = await Promise.all([page.waitForEvent('download'), page.tap('#export')]);
rec('D2 Export while inspecting is named as a branch', dl.suggestedFilename() === 'Island-experiment-branch.json', dl.suggestedFilename());
const autoBefore = await page.evaluate(() => localStorage.getItem('island-autosave'));
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const autoAfter = await page.evaluate(() => localStorage.getItem('island-autosave'));
rec('D2 hiding the page while inspecting does not autosave the branch', autoAfter === autoBefore, autoAfter === autoBefore ? 'autosave unchanged' : 'autosave overwritten');
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
await page.locator('#lab').tap(); await page.locator('#return').tap(); await wait(300);
await page.tap('#save'); await wait(200);
rec('after Return, Save works again', /World saved/.test(await toast()), await toast());
rec('no page errors', errors.length === 0, errors.join(' | ') || 'none');
await browser.close();
