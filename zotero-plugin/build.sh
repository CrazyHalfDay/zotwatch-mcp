#!/usr/bin/env bash
# Package the plugin into zotwatch.xpi (an .xpi is just a zip).
# Usage: bash build.sh   ->   build/zotwatch.xpi
set -euo pipefail
cd "$(dirname "$0")"

OUT="build/zotwatch.xpi"
mkdir -p build
rm -f "$OUT"

zip -r -X "$OUT" \
  manifest.json \
  bootstrap.js \
  prefs.js \
  content \
  locale \
  -x '*/.*' >/dev/null

echo "Built $OUT"
echo "Install in Zotero 7: Tools → Plugins → gear → Install Plugin From File…"
