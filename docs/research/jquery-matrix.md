# jQuery version matrix (Phase 6)

The suite (`test/test.js`, 189 tests) runs against the jQuery build named by `JQUERY_FILE`, loaded as a classic script with an appended `export default window.jQuery` (no CommonJS interop). Default is `node_modules/jquery/dist/jquery.js` (3.7.1). CI runs one job per entry (`jquery` job in `.github/workflows/ci.yml`); locally: `JQUERY_FILE=node_modules/jquery4/dist/jquery.js npx vitest run --project suite`.

| jQuery | Source                                                        | Result                                       | Gates merges |
| ------ | ------------------------------------------------------------- | -------------------------------------------- | ------------ |
| 1.7.2  | `code.jquery.com`, sha256-pinned by `scripts/fetch-jquery.sh` | fails, run aborts (about 149 of 189 reached) | No           |
| 3.7.1  | npm `jquery` (latest 3.x)                                     | 183 passed, 6 expected fail                  | Yes          |
| 4.0.0  | npm `jquery4` alias (latest 4.x)                              | 119 failed, 64 passed, 6 expected fail       | No           |

The 1.7.2 build is not on npm as a loadable file (the package has no `dist/`), hence the download.

## 4.0.0: `$.trim` and `$.isFunction` were removed

100 tests fail with `$.trim is not a function` (`src/jquery.form.js:140`, in the URL normalization of every `ajaxSubmit`), 15 with `$.isFunction is not a function` (lines 193, 1003, 1142), and 4 more follow from those (`beforeSerialize called` assertion, 6 timeouts of `ajaxForm` clicks). Fix, on 4.x, is the planned #599-style native replacement (`String.prototype.trim`, `typeof x === "function"`), which still works on 1.7.2. Not applied: `src/` is off limits in Phase 6.

## 1.7.2: two failures, then the page is lost

- `fieldSerialize` returns `choice=a+b&choice=c`, not `choice=a%20b&choice=c`: 1.7.2 `$.param` encodes spaces as `+`. A test expectation difference, not a plugin bug.
- `ajaxSubmit` with `target` and an iframe response throws `HierarchyRequestError` from `jQuery.clean` (`src/jquery.form.js:250`, `$(target).html(data)` with a `#document`); the test then times out and the browser connection closes, so about 40 later tests never run. Results beyond that point are unknown.

## `it.fails` records

On 3.7.1 all six behave as recorded. On 4.0.0 they still count as expected failures, but the plugin fails earlier (`$.trim`), so that proves nothing about the bugs themselves. No change to `docs/research/coverage-findings.md`.

## Dependencies

`npm outdated` showed nothing to upgrade: every dev dependency was already at its latest release (vitest 5.0.5, rollup 4.65.0, eslint 10.13.0, prettier 3.9.10, playwright 1.64.1, and so on). `jquery` 3.7.1 is deliberately the 3.x latest; 4.0.0 is held as the `jquery4` alias.
