#!/usr/bin/env bash
# Runs every *.test.js against a local static server. Needs node + playwright (npm i -g playwright && npx playwright install chromium).
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-8765}"
export CELEBRATE_URL="http://localhost:$PORT/"

# vendor scripts make runs offline-safe and fast; fetched once, git-ignored
mkdir -p tests/vendor
for f in html2canvas/1.4.1/html2canvas.min.js gif.js/0.2.0/gif.js gif.js/0.2.0/gif.worker.js; do
  base="$(basename "$f")"
  [ -s "tests/vendor/$base" ] || curl -fsSL "https://cdnjs.cloudflare.com/ajax/libs/$f" -o "tests/vendor/$base" || rm -f "tests/vendor/$base"
done

if ! curl -s -o /dev/null "$CELEBRATE_URL"; then
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  sleep 1
fi

pass=0; fail=0
for t in tests/${1:-*}.test.js; do
  echo "=== $t"
  if node "$t"; then pass=$((pass+1)); else fail=$((fail+1)); echo "!!! FAILED: $t"; fi
done
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
