# Behavior changes on the 4.x line (for release notes)

Collected as the modernization proceeds. Each entry is a change a consumer could notice.

## Phase 6

- **JSON responses are parsed with `JSON.parse`.** The `eval` fallback used when `$.parseJSON` was missing is gone (jQuery 4 removed `$.parseJSON`, which would have left `eval` live on every JSON response). JSON that only `eval` accepted, such as single-quoted strings or unquoted keys, now throws a parse error instead of being evaluated.
- **jQuery 4 compatibility.** `$.trim`, `$.isFunction` and `$.isArray`, which jQuery 4 removed, are replaced with `String.prototype.trim` (applied only to string actions), `typeof x === "function"` and `Array.isArray`. Behavior on jQuery 1.7.2 and later is unchanged.
- **`package.json` has a `files` list** (`dist`, `src`). The published tarball no longer carries tests, docs, CI config or the other repository files. `main`, `module` and `browser` still point at `dist/`.
- **`form.jquery.json` no longer lists the old Grunt, Mocha and Chai `devDependencies`.**

## Known behavior, not changed

- **`dataType: "script"` on jQuery 4** delivers `undefined` to `success`; jQuery 4 loads async script requests through a script tag. The script still runs. This comes from jQuery, not the plugin.
- **`delegation: true` is not selector-scoped on jQuery 3 and later**, and `ajaxForm` called on an empty selection before DOM ready is dropped. See `selector-context-delegation.md`.
- **No `exports` map** on 4.x so deep paths keep resolving; planned for 5.0.
