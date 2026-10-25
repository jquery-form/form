# Phase 5 coverage gaps

Baseline: 64 tests (59 suite and 5 surface); 35.95% lines, 33.92% branches, 43.10%
functions, and 36.77% statements. Full `npm test` wall time: 2.80 s on Node 26.12.1.

Current: 194 tests (188 passing and 6 expected failures that record bugs; see
`coverage-findings.md`); 98.14% lines, 96.26% branches, 98.27% functions, and 98.17% statements.

The checklist is ordered by behavioral risk. A checked item has behavior assertions and is covered;
line references are to `src/jquery.form.js` before Phase 5 (the source is not changed in this phase).
Items with remaining lines point to [Not reachable without source changes](#not-reachable-without-source-changes).

## Upload and response handling

- [x] FormData upload construction, extra-data deep serialization, caller-supplied `formData`, request
      settings, `beforeSend`, and XHR upload progress (lines 340–428). Line 369 remains.
- [x] Iframe setup with generated and supplied targets, attribute restoration, extra fields, clicked
      submit controls, CSRF metadata, synchronous/deferred submit, and fallback native submit
      (lines 432–729). Line 453 remains.
- [x] Iframe success, timeout, abort, server-abort, parser-error, HTTP-error, global events,
      completion, and cleanup (lines 449–541 and 737–917). Lines 762, 777, 854, and 870 remain.
- [x] Iframe response extraction for HTML, text, JSON, script, XML, textarea, `pre`, body, status,
      headers, `dataFilter`, and parse/evaluation paths (lines 780–967). Lines 841 and 962 remain.

## `ajaxSubmit` options and callbacks

- [x] Empty selections and function, URL shorthand, false URL, omitted options, method/type/action,
      URL cleanup, and default URL handling (lines 107–160). Lines 141 and 150 remain.
- [x] Pre-serialize and validate event vetoes, `beforeSerialize`, functional/object extra data,
      traditional serialization, and `beforeSubmit` veto (lines 165–218).
- [x] GET/POST query construction, reset/clear callbacks, target replacement, success arrays,
      callback context, missing XHR fallback, error/complete wrappers, notification, and stored jqXHR
      (lines 220–337).
- [x] Transport selection: ordinary AJAX, FormData, forced iframe, automatic iframe fallback, and
      `closeKeepAlive` (lines 293–325).

## Form values and helpers

- [x] `formToArray`: empty/non-form collections, semantic and ordinary traversal, external controls,
      filtering, unnamed/disabled controls, arrays, empty/populated files, clicked images, and
      element collection (lines 1110–1208). Line 1134 remains.
- [x] `fieldValue` and `fieldSerialize`: missing names, unsuccessful controls, empty collections,
      select-one/multiple, disabled options, empty option values, arrays, CRLF normalization, and
      default `successful` behavior (lines 1224–1367).
- [x] `clearForm`/`clearFields`: all text-like controls, textarea, checkbox/radio, select, file,
      hidden boolean/selector inclusion, and alias behavior (lines 1379–1419).
- [x] `resetForm`: input, textarea, option, optgroup, single/multiple select, label `for` and nested
      fields, form reset shadowing, and container recursion (lines 1433–1506).
- [x] `attr2`, `enable`, `selected`, and debug logging helpers (lines 82–93 and 1511–1564).

## `ajaxForm`

- [x] URL shorthand, omitted options, empty selection, `beforeFormUnbind`, rebinding, canceled submit,
      nested submit-button targets, and `ajaxFormUnbind` (lines 989–1096).
- [x] Delegated binding and delegated submit/click handling (lines 1002–1030).
- [x] Image coordinate branches: `offsetX`, jQuery `offset`, and DOM offset fallback; delayed cleanup
      (lines 1055–1091).

## Legacy compatibility branches

Phase 0 requires the v4 line to retain and test legacy behavior where honest simulation is practical.

- [x] Lines 83–85: jQuery without `$.fn.prop`; the suite reloads the plugin while `prop` is removed.
- [ ] Lines 148–150: IE/Trident HTTPS iframe source. The user agent is simulated, but the HTTPS
      result cannot be reached (see line 150 below).
- [x] Lines 301–319 and 457–461: no `prop` iframe re-enabling, under the reloaded plugin.
- [x] Lines 503–506: IE `execCommand("Stop")` iframe abort.
- [x] Lines 565–599: IE8 iframe document access fallbacks, by stubbing the frame's `contentWindow`
      and `contentDocument` to throw or be missing.
- [x] Lines 697–701 and 767–771: IE `attachEvent`/`detachEvent`, including IE's initial blank-page
      `onload`, by stubbing the methods on a supplied iframe.
- [x] Lines 781–797 and 802–803: IE `XMLDocument` (a response script sets it) and Opera delayed DOM
      (a stubbed `window.opera` and fake timers to exhaust the retries).
- [ ] Lines 922–943: pre-jQuery-1.5 XML parsing and ActiveX XML are dead code (see lines 922–933
      below); the `$.parseJSON` fallback is covered.
- [x] Lines 1006–1016: pre-jQuery-3 selector/context DOM-ready queue, by restoring `.selector`
      metadata and stubbing `$.isReady`.
- [x] Lines 1132–1136: Edge/Trident external-form-control workaround. Line 1134 remains.
- [x] Lines 1351–1355: old-IE option `value` attribute semantics.
- [x] Lines 1402–1407: MSIE file-input clone fallback.
- [x] Lines 1491–1497: form reset shadowed by a control named `reset`.
- [x] Lines 1538–1542 and 1560–1564: select-one deselection and Opera `postError`.

## Not reachable without source changes

These 22 branches and 1 function are what keep coverage below 100%. Each was checked against the
source. None can be covered by a test without editing `src/`, adding a `/* v8 ignore */` comment, or
faking a browser state that no real browser produces.

| Line | Uncovered branch                                          | Why it cannot be reached                                                                                                                                                                                                     |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 141  | `\|\| ""` after `window.location.href`                    | `location.href` is never empty in a browser, and `window.location` cannot be redefined.                                                                                                                                      |
| 150  | `"javascript:false"` result                               | Needs an IE user agent on an HTTPS page. The user agent can be stubbed, but the test page is `http://localhost` and `location` cannot be faked. Running the suite over HTTPS would reach it, but only for this ternary.      |
| 150  | `\|\| ""` after `window.location.href`                    | Same as line 141.                                                                                                                                                                                                            |
| 369  | `if (serializedData[i])` false                            | `deepSerialize` always returns two-element arrays, which are truthy.                                                                                                                                                         |
| 453  | `if (a)` false                                            | The only caller passes the `formToArray` result, which is always an array.                                                                                                                                                   |
| 762  | `if (!timedOut)` false                                    | `timedOut` is set immediately before `cb(CLIENT_TIMEOUT_ABORT)`, which aborts first; later `cb` calls return at the `xhr.aborted` check.                                                                                     |
| 777  | `if (timedOut)` true (`throw "timeout"`)                  | Same as line 762.                                                                                                                                                                                                            |
| 841  | XML `else if` true and its `xhr.responseText` operand     | `xhr.responseXML` is assigned the response document (always truthy) two lines earlier, so `!xhr.responseXML` is always false.                                                                                                |
| 854  | `err` and `status` operands in the outer `catch`          | The outer `try` only throws through the unreachable `throw "timeout"` (line 777); real response documents do not throw on the property reads inside it.                                                                      |
| 870  | `if (s.success)` false                                    | `ajaxSubmit` always installs a `success` wrapper before calling the iframe transport.                                                                                                                                        |
| 922  | fallback `function (s, doc)` when `$.parseXML` is missing | The fallback is only called from line 842, which is unreachable (line 841). V8 counts a function-literal operand only when it runs.                                                                                          |
| 923  | `toXml` fallback function (the uncovered function)        | Same as line 922.                                                                                                                                                                                                            |
| 925  | `if (window.ActiveXObject)` both branches                 | Inside the unreachable `toXml` fallback.                                                                                                                                                                                     |
| 933  | both ternary results and three `&&` operands              | Inside the unreachable `toXml` fallback.                                                                                                                                                                                     |
| 962  | `$.globalEval` branch                                     | The emulated `content-type` equals `s.dataType`, so it only contains `javascript` when the type is `javascript`, but the branch also requires the type to be `script` or empty. Recorded as a bug in `coverage-findings.md`. |
| 1134 | `\|\| []` fallback                                        | `els` is always an array from `$.makeArray` of `form.elements` or `getElementsByTagName("*")`.                                                                                                                               |

One more uncovered branch is not in the plugin source. Line 1, column 83, is Vite's CommonJS
interop wrapper (`__esModule ? default : module`) for `import jQuery from "jquery"`, because jQuery
3.7.1 ships only CommonJS. Aliasing `jquery` to a two-line ESM re-export in the suite project
removes it; that was verified and then reverted pending a decision.

Options for reaching 100% (none applied):

1. Fix the dead and contradictory branches in `src/` (several are the recorded bugs), as a 4.x
   source change outside Phase 5.
2. Add `/* v8 ignore */` comments to the lines above in `src/`.
3. Enforce thresholds at the current honest values, and reach 100% when the branches are removed in
   5.0.
