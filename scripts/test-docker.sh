#!/usr/bin/env bash
# Run Vitest in Playwright's Linux image (its Firefox build does not start on macOS 27).
# Usage: [JQUERY_FILE=.jquery/jquery-1.7.2.js] scripts/test-docker.sh [vitest args...]
#        [JQUERY_FILE=...] scripts/test-docker.sh --e2e [playwright test args...]
# Defaults to the suite on Chromium, WebKit and Firefox; --e2e runs the end-to-end tests
# (npm run test:e2e) instead, on all three browsers unless --project is given. Node and node_modules are cached in named
# volumes (jquery-form-node, jquery-form-node-modules-<lock hash>); the host's node_modules stays untouched.
set -euo pipefail

playwright=$(sed -n 's/^ *"playwright": "\([0-9.]*\)".*/\1/p' package.json)
image="mcr.microsoft.com/playwright:v$playwright-noble"
node_major=$(cat .nvmrc)
lock_hash=$(shasum -a 256 package-lock.json | cut -c1-12)

runner="vitest run"
if [ "${1:-}" = "--e2e" ]; then
  shift
  runner="playwright test"
elif [ $# -eq 0 ]; then
  set -- --project suite-chromium --project suite-webkit --project suite-firefox
fi

exec docker run --rm --init --ipc=host \
  -v "$PWD":/work -w /work \
  -v jquery-form-node:/opt/node \
  -v "jquery-form-node-modules-$lock_hash":/work/node_modules \
  -e N_PREFIX=/opt/node -e PATH="/opt/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  -e JQUERY_FILE="${JQUERY_FILE:-}" -e JQUERY_FORM_FIREFOX=1 -e RUNNER="$runner" \
  "$image" bash -euo pipefail -c '
    if ! node --version 2>/dev/null | grep -q "^v'"$node_major"'\."; then
      (cd /tmp && npx --yes n '"$node_major"' >/dev/null)
      hash -r
    fi
    if [ ! -f node_modules/.installed ]; then
      npm ci --no-audit --no-fund >/dev/null
      touch node_modules/.installed
    fi
    npx playwright install chromium webkit firefox >/dev/null
    npx $RUNNER "$@"
  ' bash "$@"
