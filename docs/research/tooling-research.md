# Tooling research (modernization)

Date: 2026-10-25. Versions come from `npm view` (npm registry) run on this date. Local node: v24.11.0.
Constraints: `docs/agents/coding-standards.md`, `docs/adr/0001-dual-publish-surface.md`.
Confidence note: claims marked **(unverified)** were not confirmed against a primary source in this pass.

## 3. Versions (read first)

| Item | Finding | Source |
| --- | --- | --- |
| Node 26 | Exists. Current is v26.12.1 (2026-10-21). Schedule: v26 starts 2026-05-05, **LTS 2026-10-28**, maintenance 2027-10-20, EOL 2029-04-30. | https://nodejs.org/dist/index.json , https://raw.githubusercontent.com/nodejs/Release/main/schedule.json |
| Node 24 "Krypton" | Active LTS since 2025-10-28 (latest v24.22.1), maintenance 2026-10-20, EOL 2028-04-30. | same |
| Node 22 "Jod" | Maintenance since 2025-10-21, EOL 2027-04-30. | same |
| Node 25 | EOL 2026-06-01. | same |
| Node 27 | Alpha 2026-10-28, LTS 2027-10-20. | same |
| ESLint | 10.13.0, node `^20.19.0 \|\| ^22.13.0 \|\| >=24` (node 24.11 OK). Flat config. | `npm view eslint` |
| Prettier | 3.9.10, node >=14. | `npm view prettier` |
| jQuery | **4.0.0 is `latest`** (beta tag 4.0.0-rc.2). 3.x is critical-fixes-only per jQuery README. | `npm view jquery dist-tags`; https://github.com/jquery/jquery#version-support |
| Playwright Test | @playwright/test 1.64.1, node >=20. | `npm view @playwright/test` |
| Vitest | 5.0.5, node `^22.12 \|\| ^24 \|\| >=26`; `@vitest/browser-playwright` and `@vitest/coverage-v8` 5.0.5. | `npm view vitest` |
| Karma | 6.4.4 (last on npm `latest`), node >=10. | `npm view karma` |
| @web/test-runner | 1.0.0, node >=22. | `npm view @web/test-runner` |
| Rollup / esbuild / Vite | 4.65.0 (>=18) / 0.28.2 (>=18) / 8.3.5 (`^20.19 \|\| >=22.12`). | `npm view` |
| tsdown / tsup | tsdown 0.23.2, tsup 9.0.0 (both node `^22.18 \|\| ^24.11 \|\| >=26`; local 24.11.0 just satisfies). | `npm view` |
| c8 / monocart | c8 12.0.0; monocart-coverage-reports 3.1.0 (node >=22.15). | `npm view` |

Implication: Node 26 target is valid and becomes LTS 2026-10-28 (3 days out). Every candidate tool supports Node 26. Set `engines.node` to `>=24` (or `^24 || >=26`) rather than only 26 unless a reason exists; CI can pin `26`.

## 1. Test runner

Needs: real browser, iframe upload (form targets an iframe), FormData, XHR `upload.onprogress`, local fixture server (`test/ajax/*`), 100% coverage of a plain UMD file.

| Option | Fit | Notes |
| --- | --- | --- |
| **Playwright Test** | Best fit for fixture server + real network behavior | `webServer` config starts a static/ajax server; runs real Chromium/Firefox/WebKit; coverage API is Chromium-only (https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/api/class-coverage.md). Tests run in Node driving the page, so existing in-page Mocha tests do not run as-is. Coverage needs glue (page.coverage + `v8-to-istanbul`/c8/monocart), threshold enforced by you. |
| **Vitest browser mode** (provider `@vitest/browser-playwright`) | Best fit for migrating tests that run *in the page* | Tests execute inside real browser (Chrome DevTools Protocol in browsers); v8 or istanbul coverage with thresholds built in; v8 uses AST remapping so reports match Istanbul (https://raw.githubusercontent.com/vitest-dev/vitest/main/docs/guide/coverage.md; browser guide https://raw.githubusercontent.com/vitest-dev/vitest/main/docs/guide/browser/index.md). Docs recommend Playwright provider. Vitest 5 requires Vite-based pipeline; fixture endpoints can be served via Vite `server.middlewares`/plugin or a side server **(unverified: exact API in v5)**. Browser mode loads test code in an iframe-based runner by default **(unverified for v5)** – nested upload iframes should still work but check. |
| Karma | Works but dead-ends | 6.4.4 is last; project is deprecated (announcement: https://github.com/karma-runner/karma#karma-is-deprecated-and-is-no-longer-maintained **(unverified URL)**). Do not adopt. |
| @web/test-runner | Credible | 1.0.0, real browsers via Playwright launcher, in-page tests with Mocha supported, coverage via V8 -> istanbul reports. Smaller community; fixture server needs middleware plugin. https://modern-web.dev/docs/test-runner/overview/ **(unverified in this pass)** |
| WebdriverIO | Heavy | Skip. `wdio-cli` on npm `latest` is a 2018 alpha tag (misleading); real package is `@wdio/cli` (not checked). |

**Recommendation: Vitest browser mode + Playwright provider + `@vitest/coverage-v8`** with 100% thresholds, because (a) tests stay in-page like today (92-ish Mocha `it` blocks across `test/test.js`: 94 `it(` matches), so jQuery/DOM/iframe code runs unchanged; (b) coverage thresholds are first-class; (c) one tool for CI. Fallback: Playwright Test if the Vitest browser iframe harness conflicts with iframe-upload tests; then use `webServer` + page coverage.

Migration sketch:
1. `chai` stays: `import { expect } from "chai"` (or use Vitest's `expect`, which is Chai-compatible for most assertions).
2. Mocha `describe/it/before/after/beforeEach` map 1:1 to Vitest (`beforeAll/afterAll`; swap `before`->`beforeAll`). Mocha `this.timeout()` / `done` callbacks: `done` is not supported in modern Vitest; convert to promises.
3. Replace `test/test.html` fixture DOM with `document.body.innerHTML` setup in `beforeEach` (or keep HTML fixtures via `?raw` imports).
4. Serve `test/ajax/*` through a Vite plugin middleware or a small Node server started in `globalSetup`.
5. Import source via `import "../src/jquery.form.js"` after `jquery` (UMD CommonJS-branch interop with Vite: jquery 4 is `type: module` with `exports`, so UMD branch sees `module.exports`; verify the factory path at lines 26-45).
6. Remove Grunt, PhantomJS, grunt-mocha, mocha.
7. Rename tests to BDD "when X, it should Y" and AAA per standards.

## 2. Bundler (ESM + classic UMD/IIFE)

Requirement: ESM entry, plus a classic file that registers `$.fn.ajaxForm` etc. with AMD (`define(['jquery'])`) and script-tag global `jQuery`; jQuery must be **external** (peer), never bundled.

| Option | Verdict |
| --- | --- |
| **Rollup** 4.65 | Native `output.format: "umd"` with `name`, `globals: { jquery: "jQuery" }`, `external: ["jquery"]`; also `esm`, `iife`, `amd`. Mature; minify via `@rollup/plugin-terser`. Docs: https://rollupjs.org/configuration-options/#output-format , https://rollupjs.org/configuration-options/#output-globals |
| esbuild 0.28 | Formats only `esm`, `cjs`, `iife`; **no UMD/AMD**. Would require a banner/footer hack. https://esbuild.github.io/api/#format |
| tsdown 0.23 / tsup 9 | tsdown (Rolldown-based) documents `umd`/`iife` formats **(unverified)**; tsup (esbuild-based) has no UMD. tsup is in maintenance transition toward tsdown **(unverified)**. Both TS-first; overkill for plain JS. |
| Vite 8 library mode | `build.lib.formats` includes `es`, `cjs`, `umd`, `iife`; delegates to Rolldown/Rollup in v8 **(unverified)**; UMD/IIFE builds need `rollupOptions.external` + `output.globals`. Good if already using Vite for Vitest. https://vite.dev/guide/build.html#library-mode |

**Recommendation: Rollup.** Simplest way to produce a true UMD (AMD + CJS + global) file with `jquery` external. Alternative: keep the hand-written UMD wrapper in `src/` as the single source (it already does AMD/CJS/global at lines 26-45) and copy/minify it to `dist/`, with a thin ESM wrapper file that imports `jquery` and the source. That avoids a build for the classic artifact but ESM would need a conversion step anyway; Rollup handles both.

`package.json` conventions (proposal):
```json
{
  "type": "module",
  "main": "./dist/jquery.form.umd.cjs",
  "module": "./dist/jquery.form.mjs",
  "unpkg": "./dist/jquery.form.min.js",
  "jsdelivr": "./dist/jquery.form.min.js",
  "exports": {
    ".": { "import": "./dist/jquery.form.mjs", "require": "./dist/jquery.form.umd.cjs", "default": "./dist/jquery.form.mjs" },
    "./dist/*": "./dist/*",
    "./package.json": "./package.json"
  },
  "peerDependencies": { "jquery": ">=3.0.0" },
  "files": ["dist", "src"]
}
```
Notes: Node's conditional exports docs https://nodejs.org/api/packages.html#conditional-exports ; put `types` first if TS added. Today `jquery` is a hard `dependency`; for a plugin it should be a `peerDependency` (otherwise duplicate jQuery instances break `$.fn` registration). jquery 4 itself ships `exports` with `import`/`node`/`module` conditions (`npm view jquery@4.0.0 exports`), and is `"type":"module"` so ESM wrapper must `import $ from "jquery"`. Keep the existing `browser` field replaced by `unpkg`/`jsdelivr`/`exports`.

## 4. jQuery compatibility

Minimum realistic test matrix: **3.x latest (3.7.1 line; confirm via `npm view jquery@3 version`) and 4.0.0**. jQuery 1.x/2.x are unsupported per jQuery README (https://github.com/jquery/jquery#version-support); `>=1.7.2` is not testable on modern Chromium/Playwright without effort and is not worth keeping. Suggest peer range `>=3.0.0` (or `>=3.5.0` for security fixes) and drop 1.7-era branches. This is a breaking change -> major version bump (decision for the owner).

Removed in jQuery 4 (jQuery Migrate 4 warnings list "is removed"): `$.parseJSON`, `$.isNumeric`, `$.type`, `$.isFunction`, `$.isWindow`, `$.nodeName`, `$.isArray`, `$.trim`, `$.now`, `$.camelCase`, `$.unique`, `toggleClass(bool)` — https://raw.githubusercontent.com/jquery/jquery-migrate/main/warnings.md . Still deprecated-but-present in 4.0: `$.proxy`, `bind`, `expr[':']`/`expr.filters`, event shorthands (`.click()`, `.submit()`...) (same page). `.size()` was removed in 3.0 (3.x migrate warnings: https://raw.githubusercontent.com/jquery/jquery-migrate/3.x-stable/warnings.md). `.selector`/`.context` were deprecated in 1.7/1.10 and removed in 3.0 **(unverified in this pass)**. jQuery 4 dropped IE<11 and publishes slim builds (`jquery/slim`, no ajax/effects) — slim has **no `$.ajax`**, so the plugin cannot work with slim (`npm view jquery@4.0.0 exports` lists `./slim`). Verify IE support statement at https://jquery.com/browser-support/ **(unverified)**.

Usage in `src/jquery.form.js` that breaks on jQuery 4:

| Line | Code | Fix |
| --- | --- | --- |
| 162 | `$.trim(action)` | `String(action).trim()` |
| 209 | `$.isFunction(options.data)` | `typeof === "function"` |
| 271 | `$.isArray(options.success)` | `Array.isArray` |
| 925 | `$.parseJSON \|\| function...` | `JSON.parse` (the fallback already saves it, but is a dead branch) |
| 988 | `$.isFunction($.fn.on)` | always true on >=1.7; delete |
| 1126 | `$.isFunction(filtering)` | `typeof` |
| 992, 1011-1012 | `this.selector`, `this.context` | undefined on 3+/4; delegation by selector (`options.delegation`) and the "DOM not ready, queue ajaxForm" path (lines 990-1005) already do nothing useful; needs redesign (e.g. require explicit selector option) — **behavior change** |
| 1013, 1024, etc. | `.on/.off`, `.prop`, `.attr`, `.data`, `$.event.trigger` | OK in 4 (`$.event.trigger` is internal-ish but present; tests will confirm) |
| 344 | `.removeData('jqxhr').data(...)` | OK |
| 1081-ish `ajaxFormUnbind` | `.off(...)` | OK |
| 28-45 | UMD wrapper `require('jquery')` | OK; jQuery 4 `exports` provides a node wrapper that needs a window (same pattern already handled) |

## 5. Legacy shims affecting 100% coverage

Line numbers from current `src/jquery.form.js` (1540 lines). Best option for 100%: delete the branch (preferred) or `/* v8 ignore */`/`/* istanbul ignore */` only when it is genuinely unreachable in the target browsers.

| Lines | Shim | Why it hurts coverage | Suggested action |
| --- | --- | --- | --- |
| 22 | `/* global ActiveXObject */` | lint hint for IE | remove with 914-918 |
| 98-99 | `feature.fileapi`, `feature.formdata` detection | in modern browsers always true; false branch unreachable | assume true; drop `feature` |
| 101, 108-110, 458 | `hasProp = !!$.fn.prop` fallback to `.attr` | `prop` exists since 1.6 | remove |
| 139, 168-171 | `isMsie` UA sniff; `javascript:false` iframe src for https | needs IE UA | use `about:blank` |
| 316-337 | `fileAPI` false => `shouldUseFrame` iframe fallback; `options.iframe` forced-iframe | the iframe path is only needed w/o FormData; but `options.iframe` is public API | decision: keep iframe mode only if `options.iframe: true` still supported (see open question) |
| 374-440 | FormData XHR path, `uploadProgress` (401-416, `xhr.upload` check) | real-browser testable; keep | keep; test with a real server |
| 472-535 | iframe transport setup (`iframeTarget`, `$io`, abort via `execCommand('Stop')` 504-509) | `execCommand('Stop')` is IE-only | remove 504-509 branch |
| 560-600 | iframe `contentWindow` / `contentDocument` / `.document` fallbacks (578-594) | alternative branches unreachable in modern engines | collapse to `contentWindow.document` |
| 688-690 | `io.attachEvent` (IE<9) vs `addEventListener` | dead branch | remove |
| 751-800 | iframe response handling: `doc.XMLDocument`, Opera retry (775-785), `xhr.responseXML = doc.XMLDocument ?...` (771, 793) | IE/Opera only | remove Opera/XMLDocument parts |
| 914-918 | `window.ActiveXObject` / `Microsoft.XMLDOM` for `toXml` | IE only | use `DOMParser` |
| 925-928 | `$.parseJSON ||` fallback | dead on 4, jQuery 3 has it | `JSON.parse` |
| 1115 | `/(Edge\|Trident)\//.test(navigator.userAgent)` in `formToArray` form-attribute handling | legacy Edge/IE UA | remove; verify `form=` attribute works in modern browsers |
| 1157 | `feature.fileapi && el.type === 'file'` | always true | simplify |
| 1379 | `/MSIE/.test(navigator.userAgent)` in `clearFields` file input (clone/replace) | IE only | `$(this).val('')` |
| 1536-1538 | `window.opera.postError` in `log()` | Opera Presto | remove |
| 1534-1535 | `window.console && window.console.log` guard | always true | simplify |
| 988, 990-1005 | `$.isFunction($.fn.on)`; `this.selector` queue | see §4 | redesign/removal |

Estimate: roughly 12-15 branches/blocks (~60-80 lines) are legacy; removing them is the only practical way to reach 100% without ignore pragmas. Note `.selector` branch (990-1005) is a behavior change on jQuery 3+, where `this.selector` is already undefined: the `o.s` guard means it is silently skipped today.

## Recommendations

1. Node: CI on 26 (LTS 2026-10-28) with 24 in the matrix; `engines.node: ">=24"`.
2. Runner: Vitest 5 browser mode (`@vitest/browser-playwright`, `@vitest/coverage-v8`, 100% thresholds). Fallback Playwright Test.
3. Bundler: Rollup 4 (ES + UMD + minified UMD; `jquery` external, global `jQuery`). Make `jquery` a peerDependency (`>=3`).
4. Test against jQuery 3.x latest and 4.0.0 (matrix via aliases or devDependency override).
5. First commit: tooling/Prettier sweep only (per coding standards); second: remove legacy shims and jQuery-4-removed APIs; third: runner migration; then bundler/exports.
6. Prune legacy shims (§5) before enforcing 100% coverage; avoid ignore pragmas.
7. `npm test` = lint + build (maybe) + `vitest run --coverage`.

## Open questions

- Is dropping jQuery <3 and legacy IE/Opera acceptable (major version 5.0)? Is the jQuery Migrate path out of scope?
- Keep `options.iframe` / iframe transport as a supported feature (needed for non-FormData scenarios, e.g. cross-origin-ish file uploads/JSON-in-iframe responses) or remove it? It is the largest coverage and maintenance cost (lines ~460-910).
- What replaces `this.selector` delegation/DOM-ready queue in `ajaxForm` (lines 988-1025)?
- Language: stay JS (ES5 source → ES2020+?) or TS? Does the source stay ES5 for the classic build (affects Rollup+Babel/terser targets)?
- Should `ajaxSubmit`'s 100% threshold apply to branches too, or lines/statements only?
- Is Vitest 5 browser mode's tests-in-iframe harness compatible with the iframe upload tests, and can it serve `test/ajax` fixtures? Prototype before committing.
- Verify the **(unverified)** items above (tsdown UMD, Vite 8 library mode UMD, `.selector` removal version, WTR docs, Karma deprecation notice).
