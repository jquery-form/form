#!/usr/bin/env bash
# Download a jQuery build that npm does not ship (1.7.2 has no dist/) into .jquery/ and verify it.
# Usage: scripts/fetch-jquery.sh 1.7.2   (then JQUERY_FILE=.jquery/jquery-1.7.2.js npx vitest run)
set -euo pipefail

case "${1:-}" in
  1.7.2) sha256=$(echo 1717ea1fde8ceb7584341a24efc85c853083c660a1185968fbf94520f7193de2) ;;
  *) echo "usage: $0 1.7.2" >&2; exit 1 ;;
esac

mkdir -p .jquery
file=".jquery/jquery-$1.js"
curl -fsSL "https://code.jquery.com/jquery-$1.js" -o "$file"
echo "$sha256  $file" | shasum -a 256 -c -
