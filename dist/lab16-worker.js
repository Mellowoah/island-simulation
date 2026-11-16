// Runs a matched comparison world off the main thread for the report.
import { runToEnd } from './lab16-run.js';
import { summarizeEden, summarizeLab } from './lab16-report.js';
self.onmessage = e => {
  const { job, setup, endTick } = e.data;
  try {
    let last = 0;
    const run = runToEnd(setup, endTick, p => { if (p - last >= 0.05) { last = p; self.postMessage({ job, progress: p }); } });
    self.postMessage({ job, summary: run.kind === 'lab' ? summarizeLab(run) : summarizeEden(run) });
  } catch (err) { self.postMessage({ job, error: String(err?.message ?? err) }); }
};
