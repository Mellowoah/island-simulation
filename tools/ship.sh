#!/bin/sh
# Commit only if every test passes and nothing has drifted: tools/ship.sh "message"
set -e
cd "$(dirname "$0")/.."
out=$(node --test tests/*.test.mjs 2>&1 | grep -E "^# (pass|fail)")
echo "$out"
echo "$out" | grep -q "^# fail 0$" || { echo "STOP: tests failing, nothing committed"; exit 1; }
node tools/drift-check.mjs | tail -1 | grep -q "No drift" || { echo "STOP: drift, nothing committed"; exit 1; }
node tools/page-files.mjs | grep -q MISSING && { echo "STOP: page imports a missing file"; exit 1; }
git add -A
git commit -qm "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012xN3GUzMmVqX8SdtpbUCK5"
git push -q origin HEAD
git log --oneline -1
