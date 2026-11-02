#!/usr/bin/env bash
# Run the suite on Firefox in Playwright's Linux image (its Firefox build does not start on macOS 27).
# Usage: [JQUERY_FILE=.jquery/jquery-1.7.2.js] scripts/test-firefox.sh
# The container gets its own node_modules volume; the host's stays untouched.
set -euo pipefail

image="mcr.microsoft.com/playwright:v1.64.1-noble"
node_major=$(cat .nvmrc)

exec docker run --rm --init --ipc=host \
  -v "$PWD":/work -v /work/node_modules -w /work \
  -e JQUERY_FILE="${JQUERY_FILE:-}" -e JQUERY_FORM_FIREFOX=1 \
  "$image" bash -euo pipefail -c "
    (cd /tmp && npx --yes n $node_major >/dev/null)
    hash -r
    npm ci --no-audit --no-fund >/dev/null
    npx playwright install firefox >/dev/null
    npx vitest run --project suite-firefox
  "
