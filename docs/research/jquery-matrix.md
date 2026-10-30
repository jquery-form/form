# jQuery version matrix (Phase 6)

The suite (`test/test.js`, 188 tests) runs against the jQuery build named by `JQUERY_FILE`, loaded as a classic script with an appended `export default window.jQuery` (no CommonJS interop). Default is `node_modules/jquery/dist/jquery.js` (3.7.1). CI runs one gating job per entry (`jquery` job in `.github/workflows/ci.yml`); locally: `JQUERY_FILE=node_modules/jquery4/dist/jquery.js npx vitest run --project suite`.

| jQuery | Source                                                        | Result                                 |
| ------ | ------------------------------------------------------------- | -------------------------------------- |
| 1.7.2  | `code.jquery.com`, sha256-pinned by `scripts/fetch-jquery.sh` | 180 passed, 6 expected fail, 2 skipped |
| 3.7.1  | npm `jquery` (latest 3.x)                                     | 182 passed, 6 expected fail            |
| 4.0.0  | npm `jquery4` alias (latest 4.x)                              | 182 passed, 6 expected fail            |

The 1.7.2 build is not on npm as a loadable file (the package has no `dist/`), hence the download.

## What the first matrix run found, and the fixes

The first run failed on 1.7.2 and 4.0.0. Each cause was fixed separately.

- **jQuery 4 removed `$.trim`, `$.isFunction` and `$.isArray`** (119 failures). `src/jquery.form.js` now uses `String.prototype.trim` (guarded by a string check), `typeof x === "function"` and `Array.isArray`.
- **jQuery 4 removed `$.parseJSON`**, which left an `eval` fallback live. The plugin now calls `JSON.parse`; the test for the fallback was removed. Coverage thresholds were re-baselined (same uncovered code, smaller denominator).
- **`dataType: "script"` on jQuery 4** delivers `undefined` to success: jQuery 4 loads async script requests through a script tag (`canUseScriptTag` in `src/ajax/script.js`). The script still runs; the test asserts the returned text only below jQuery 4. Not a plugin bug.
- **`HierarchyRequestError` on 1.7.2** came from the test fixture server sending HTML without a `Content-Type`; 1.7.2 then returns an `XMLDocument` (reproducible with a bare `$.ajax`). The server now labels `.html` fixtures `text/html`, except `iframe-*` files, which rely on browser sniffing.
- **`fieldSerialize` on 1.7.2**: `$.param` encodes a space as `+` before jQuery 3. The test expects `+` below 3 and `%20` from 3 on.
- **The page closed on 1.7.2**: the two "before the DOM is ready" tests fake `$.isReady`, which makes 1.7.2 re-fire its ready handlers. They are skipped below jQuery 3, where the collection has native selector metadata.

## `it.fails` records

All six still behave as recorded on every version. No change to `docs/research/coverage-findings.md`.

## Dependencies

`npm outdated` showed nothing to upgrade: every dev dependency was already at its latest release (vitest 5.0.5, rollup 4.65.0, eslint 10.13.0, prettier 3.9.10, playwright 1.64.1, and so on). `jquery` 3.7.1 is deliberately the 3.x latest; 4.0.0 is held as the `jquery4` alias.
