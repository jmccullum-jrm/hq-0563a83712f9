#!/usr/bin/env bash
# Usage: bash tests/run.sh  — exits non-zero on any failure.
# Tests private/app.jsx (run `node tools/hq.mjs open` first). Stamps its PUBLISHED_AT
# with the current time (the app's "Updated" label), seals a throwaway copy of the page
# with a test-only password into tests/.build, and drives that copy in headless Chromium.
# Seal the real page afterwards with `node tools/hq.mjs seal`.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$here/.."
app="$repo/private/app.jsx"
[ -f "$app" ] || { echo "private/app.jsx is missing — run: node tools/hq.mjs open"; exit 1; }
stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
sed -i "s/^    const PUBLISHED_AT = '[^']*';/    const PUBLISHED_AT = '$stamp';/" "$app"
grep -q "const PUBLISHED_AT = '$stamp';" "$app" || { echo "could not stamp PUBLISHED_AT"; exit 1; }
echo "Stamped PUBLISHED_AT = $stamp"
[ -d "$here/node_modules" ] || (cd "$here" && npm install --silent --no-audit --no-fund)
node "$here/static.js"
export HQ_TEST_PASSWORD="suite-only-password"
node "$repo/tools/hq.mjs" build "$here/.build" "$HQ_TEST_PASSWORD"
cp "$repo"/*.png "$repo"/icon.svg "$repo"/site.webmanifest "$here/.build/"
python3 -m http.server 8765 --directory "$here/.build" >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
for _ in $(seq 20); do curl -sf -o /dev/null http://127.0.0.1:8765/index.html && break; sleep 0.25; done
node "$here/check.js"
node "$here/askmig.js"
node "$here/boot.js"
echo "SUITE GREEN"
