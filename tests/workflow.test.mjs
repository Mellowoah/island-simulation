// The live site's workflow must parse as YAML (an unquoted "Island: the small world" once stopped it running).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('WF1 every workflow name with a colon is quoted', () => {
  for (const f of fs.readdirSync(new URL('../.github/workflows/', import.meta.url))) {
    const first = fs.readFileSync(new URL('../.github/workflows/' + f, import.meta.url), 'utf8').split('\n')[0];
    const value = first.replace(/^name:\s*/, '');
    if (/: /.test(value)) assert.ok(/^["'].*["']$/.test(value), `${f}: quote the name`);
  }
});
