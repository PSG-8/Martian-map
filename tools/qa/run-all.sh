#!/usr/bin/env bash
# iLab@home checker: runs the site locally with a fake database and tests it in a real browser on many phones.
# Usage (from anywhere):  tools/qa/run-all.sh          quick checks (~6 min)
#                         tools/qa/run-all.sh full     + every screen on 20 phones/tablets/computers (~45 min on 4 cores)
# Needs Node and Playwright with Chromium. Reports land in tools/qa/out/ (not committed).
set -u
cd "$(dirname "$0")/../.."
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
export QA_BASE="${QA_BASE:-http://localhost:5055/}"
if ! curl -s -o /dev/null "$QA_BASE"; then
  npx -y serve -l 5055 . > /dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  for i in $(seq 1 30); do curl -s -o /dev/null "$QA_BASE" && break; sleep 1; done
fi
mkdir -p tools/qa/out
fail=0
run(){ echo; echo "== $1"; shift; if [ "$1" = env ]; then "$@"; else node "$@"; fi 2>&1 | tee -a tools/qa/out/report.txt | grep -E "FAIL|PASS [0-9]|OK [0-9]|BLANK|problems|issues|GROUP|SQUEEZED" ; return "${PIPESTATUS[0]}"; }
: > tools/qa/out/report.txt
run "Back button (app Back + phone Back, every account)"  tools/qa/backtest.js || fail=1
run "Damaged saved data / storage blocked (in-app browsers)" tools/qa/storechk.js || fail=1
run "Security screens (email password, log out everywhere, owner card)" tools/qa/v56sec.js || fail=1
run "Every menu item, every account, phone + laptop"      tools/qa/menutest.js || fail=1
run "Every button on every screen (owner, phone + desktop)" tools/qa/clicksweep.js leader || fail=1
run "Squeezed text (one word per line) at 320/384 px, every screen" env WIDTHS=320,384 node tools/qa/squeeze.js || fail=1
if [ "${1:-}" = "full" ]; then
  for g in 0 1 2; do node tools/qa/devmatrix.js $g 3 > tools/qa/out/devices_$g.log 2>&1 & done; wait
  tail -n 1 tools/qa/out/devices_*.log
  echo "Device details: tools/qa/out/devices/result_*.json (+ a screenshot for every problem)"
fi
echo; echo "Full log: tools/qa/out/report.txt"
exit $fail
