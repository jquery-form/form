# Runner and bundler prototype

Throwaway prototype in `prototype/` (own `package.json`, root deps untouched; removed in Phase 3, see git history). Run from `prototype/`: `npm ci && npx playwright install chromium`, then:

- `npm run build`: Rollup build plus the CommonJS contract check (`cjs-check.cjs`). Run this first, because the surface tests load `dist/`.
- `npm run playwright`: the Mocha suite under Playwright Test, plus the surface smoke tests.
- `npm run vitest`: the same suite under Vitest with coverage.
- `npm run vitest:threshold`: exits 1 because coverage is below the 100% line threshold, which shows enforcement works.
- `npm run vitest:probe`: exits 1 on the late-failure probe (`probe/late-failure.js`).

## Decision

- **Runner: Vitest 5 browser mode** (`@vitest/browser-playwright`, `@vitest/coverage-v8`), Chromium. Plain Playwright Test is not added.
- **Bundler: Rollup 4**, `jquery` external, with the classic build wrapped in the existing hand-written UMD header (not Rollup's generic `umd` format). Minify with `@rollup/plugin-terser`.

## What was tested

Same inputs for both runners: the unmodified `test/test.js`, the `#main` fixture markup from `test/test.html`, `test/ajax/*` fixtures, jQuery 3.7.1, plus a shared `prototype/shared/iframe-upload.js` covering the iframe transport (`iframe: true`) and an XHR FormData upload of a real `File`, with an assertion that `uploadProgress` fires. "Unmodified" depends on two shims in `vt/setup.js` for Vitest: `before` is mapped to `beforeAll`, and `window.chai` is set to `{ assert }`.

| | Playwright Test | Vitest browser mode |
| --- | --- | --- |
| Result | 61/61 pass, ~2.8 s wall | 61/61 pass, ~1.2 s wall |
| Line coverage of `src` | 60.4% (monocart) | 60.0% (v8) |
| Dev deps | `@playwright/test`, `monocart-coverage-reports`, `mocha`, `chai` | `vitest`, `@vitest/browser-playwright`, `@vitest/coverage-v8` |
| Glue | 40-line static server, harness page rewrite, a spec that waits on Mocha | Vite middleware for `ajax/*`, 10-line setup file |
| Reporting | One Playwright test wraps the whole Mocha run | Per-test results, watch mode |
| Coverage threshold | Hand-written | Built in (`coverage.thresholds`) |

Why Vitest clears the "clearly justified" bar from Phase 0:

1. **100% coverage enforcement is built in.** `npm run vitest:threshold` fails at 59.96% of lines with a single flag. With Playwright, thresholds, report merging, and per-file filtering are ours to write and maintain.
2. **Fewer deps.** Vitest's `assert` is Chai-compatible and ran `test.js` unchanged (`window.chai = { assert }`), so Mocha and Chai both go. Playwright Test still needs both, since the in-page tests run under Mocha.
3. **It catches late failures.** A probe test that threw only inside an ajax callback failed the Vitest run as an unhandled error. See the finding below.
4. **The iframe concern from Phase 0 is cleared.** Vitest runs tests inside an iframe, and the upload iframe inside it worked.

Playwright itself stays either way: Vitest drives Chromium through it. The decision is about not adding the `@playwright/test` runner and its coverage glue on top.

What Playwright Test still does better: page-level control (`setContent`, import maps, RequireJS). The surface smoke tests in the prototype use it. In Phase 3, do these inside Vitest browser mode by injecting `<script>` elements into the test document. Add `@playwright/test` only if that proves awkward.

## Findings that affect later phases

- **Existing async tests are fire-and-forget.** No test in `test/test.js` uses `done` or returns a promise, so assertions inside `success`/`error` callbacks run after the test has already passed. Under Vitest, those failures surface as unhandled errors (the run still fails, but the error isn't tied to a test). The Phase 4 test rewrite must make each async test return a promise.
- **Rollup's generic UMD would break CommonJS consumers (ADR-0001).** Today `require("jquery-form")` returns a `(root, jQuery)` factory. Rollup `format: "umd"` instead does `module.exports = factory(require("jquery"))`, which throws in Node without a DOM. The prototype keeps the original wrapper via a `renderChunk` plugin and `cjs-check.cjs` asserts that `require` still returns the same 2-argument factory as `src`.
- **AMD module value is `undefined` today**, and the prototype preserves that. Returning jQuery from the AMD module would be a small additive change; decide it in Phase 3.
- **ESM entry:** `import $ from "jquery"; import form from "jquery-form"` registers on the imported jQuery and default-exports it. Verified against jQuery 4's `dist-module` build. jQuery 3 has no ESM build, so ESM consumers on 3.x depend on their bundler's CJS interop. That path is untested; add a bundler-based smoke test for it in Phase 3.
- **Source conversion:** the prototype lifts the factory out of `src/jquery.form.js` by slicing at the text markers `}(function ($) {` and `}));`. A formatting change to `src` (such as the Prettier sweep) silently breaks this. Phase 3 should convert `src` to an ESM module (body unchanged), so Rollup has a real entry and the slicing goes away.
- Minified classic build: 17.1 KB, about the same as the current `dist/jquery.form.min.js` (17.1 KB).
- jQuery version matrix (Phase 6): in Vitest, use per-project `resolve.alias` for `jquery`.
