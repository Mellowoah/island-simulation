#!/bin/sh
# Commit only if every test passes, nothing has drifted and the page has every file it imports.
# Usage: tools/ship.sh "message"
# The TAP reporter is named explicitly: from Node 23 the default reporter prints "ℹ pass N", not "# pass N",
# and the old script then stopped without saying why (found by the 18 Nov audit).
cd "$(dirname "$0")/.." || exit 1
out=$(node --test --test-reporter=tap tests/*.test.mjs 2>&1)
pass=$(printf '%s\n' "$out" | grep -E "^# pass [0-9]+" | tail -1)
fail=$(printf '%s\n' "$out" | grep -E "^# fail [0-9]+" | tail -1)
echo "$pass"
echo "$fail"
if [ -z "$pass" ] || [ -z "$fail" ]; then
  echo "STOP: could not read the test results, nothing committed"
  exit 1
fi
if [ "$fail" != "# fail 0" ]; then
  printf '%s\n' "$out" | grep -E "^not ok" | grep -v "# TODO"
  echo "STOP: tests failing, nothing committed"
  exit 1
fi
if ! node tools/drift-check.mjs | tail -1 | grep -q "No drift"; then
  node tools/drift-check.mjs | grep -v "^OK"
  echo "STOP: drift, nothing committed"
  exit 1
fi
if node tools/page-files.mjs | grep -q MISSING; then
  node tools/page-files.mjs | grep MISSING
  echo "STOP: the page imports a missing file, nothing committed"
  exit 1
fi
git add -A || exit 1
git commit -qm "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012xN3GUzMmVqX8SdtpbUCK5" || exit 1
git push -q origin HEAD || { echo "STOP: committed but the push failed"; exit 1; }
git log --oneline -1
