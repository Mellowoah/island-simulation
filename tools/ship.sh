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
node tools/layers-report.mjs || exit 1
git add -A || exit 1
git commit -qm "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012xN3GUzMmVqX8SdtpbUCK5" || exit 1
git push -q origin HEAD || { echo "STOP: committed but the push failed"; exit 1; }
# No lost lines: what GitHub now holds must equal this commit exactly, file for file and line for line
# (Robert, 19 Nov: GitHub has limits; never lose a line of code).
branch=$(git rev-parse --abbrev-ref HEAD)
git fetch -q origin "+refs/heads/$branch:refs/remotes/origin/$branch" || { echo "STOP: could not read back from GitHub"; exit 1; }
[ "$(git ls-remote origin "refs/heads/$branch" | cut -f1)" = "$(git rev-parse HEAD)" ] || { echo "STOP: GitHub's branch is not at this commit"; exit 1; }
if [ "$(git rev-parse HEAD^{tree})" != "$(git rev-parse "origin/$branch^{tree}")" ]; then
  echo "STOP: GitHub's copy differs from this commit"; git diff --stat HEAD "origin/$branch"; exit 1
fi
files=$(git ls-files | wc -l); lines=$(git ls-files -z | xargs -0 cat 2>/dev/null | wc -l)
echo "GitHub matches this commit exactly: $files files, $lines lines"
git log --oneline -1
