# Behavior changes on the 4.x line (for release notes)

Collected as the modernization proceeds. Each entry is a change a consumer could notice.

## Phase 6

- **JSON responses are parsed with `JSON.parse`.** The `eval` fallback used when `$.parseJSON` was missing is gone (jQuery 4 removed `$.parseJSON`, which would have left `eval` live on every JSON response). JSON that only `eval` accepted, such as single-quoted strings or unquoted keys, now throws a parse error instead of being evaluated.
- **jQuery 4 compatibility.** `$.trim`, `$.isFunction` and `$.isArray`, which jQuery 4 removed, are replaced with `String.prototype.trim` (applied only to string actions), `typeof x === "function"` and `Array.isArray`. Behavior on jQuery 1.7.2 and later is unchanged.
- **`package.json` has a `files` list** (`dist`, `src`). The published tarball no longer carries tests, docs, CI config or the other repository files. `main`, `module` and `browser` still point at `dist/`.
- **`form.jquery.json` no longer lists the old Grunt, Mocha and Chai `devDependencies`.**

## Phase 9

- **Iframe uploads with `dataType: "script"` now run the response.** The iframe transport returned the script text without evaluating it; it now evaluates it with `$.globalEval`, as `$.ajax` does. Only an explicit `dataType: "script"` does this. Other data types are unchanged.

## Phase 10

- **A `<button>` without a `type` attribute is captured as the submitter (#588).** Its name and value are sent, as in a native submit. Clicks on other elements that only carry a `type="submit"` attribute, and on submit controls that belong to no form, are ignored instead of throwing.
- **`resetForm`, `clearFields`, `fieldValue` and `selected` accept nodes without a tag name (#600).** `resetForm` on the document resets the fields inside it. Text nodes are skipped.
- **The Rails CSRF token is added only to same-origin iframe uploads.** An upload whose `url` or action points to another origin no longer receives the `<meta name="csrf-token">` value. `jquery-ujs` behaves the same way.
- **The Rails CSRF token is sent only with iframe uploads that post the form.** A GET iframe upload used to add the token to the query string.
- **An aborted iframe upload rejects its Deferred and finishes its global events.** `abort()` rejects the returned jqXHR with `(xhr, "aborted", status)`, fires `ajaxComplete` and `ajaxStop`, decrements `$.active` and removes the iframe. Timeouts and server aborts do the same, and their rejection arguments are unchanged. A second `abort()`, an abort after the upload completed, or one from the `success` callback does nothing. An abort while the response is processed (for example from `dataFilter`) completes the upload once.
- **Iframe responses that fail to parse report `parsererror`.** An emulated 2xx status (the `status` attribute on the response body or textarea) used to turn a parse error into `success` with no data. An emulated error status still reports `error`.
- **FormData uploads serialize `data` with the global `$.ajaxSettings.traditional`,** as the other transports already did. `data: {}` no longer adds a field with an empty name.
- **GET urls keep the form data when the `url` option has a fragment.** The query now goes before the fragment; jQuery used to drop it with the fragment. An action that is only a fragment, read raw because a control is named `action`, now submits to the current page instead of throwing on GET or posting to `undefined`.
- **Controls named like form members no longer break serialization or uploads.** A control named `elements` no longer hides the other fields from `formToArray`. Controls named `setAttribute` or `removeAttribute` no longer break the iframe transport, except on jQuery 1.7.2, whose selector engine fails on them first. After an iframe upload, a form with a control named `action` and no `action` attribute keeps having none.
- **An extra field named `hasOwnProperty` no longer breaks iframe uploads,** whether it comes from `data`, `extraData` or the submit button's name.
- **`dist/` files no longer contain `/* eslint */` or `/* global */` comments (#553),** which applied to code concatenated after the plugin.

### Security fixes (4.4.0)

- **The iframe transport builds its hidden inputs and iframe with DOM APIs (GHSA-x8mc-9vpg-2rc8).** Field names, the clicked button's name, the `csrf-param` meta content and `iframeSrc` are no longer parsed as HTML. Array and object `data`/`extraData` values are sent as separate fields, as `$.param` sends them (#597).
- **`resetForm` on a `<label>` resets the control whose id its `for` attribute names (GHSA-8395-7m7x-q7q2).** It used to pass `for` to `$()` as a selector, which matched nothing for a plain id and threw when it matched.
- **`formToArray` with `semantic: true` matches `form="…"` controls by comparing the attribute (GHSA-g7mw-rwc2-4h3g),** so a form id with quotes or brackets no longer throws or adds unrelated fields.
- **`target` inserts only string responses (GHSA-4w39-46xw-8jm2).** If jQuery has parsed the response (JSON or XML), the target is left unchanged, a `debug` message is logged, and `success` is still called.

## Known behavior, not changed

- **`dataType: "script"` on jQuery 4** delivers `undefined` to `success`; jQuery 4 loads async script requests through a script tag. The script still runs. This comes from jQuery, not the plugin.
- **`delegation: true` is not selector-scoped on jQuery 3 and later**, and `ajaxForm` called on an empty selection before DOM ready is dropped. See `selector-context-delegation.md`.
- **No `exports` map** on 4.x so deep paths keep resolving; planned for 5.0.
