# Phase 5 coverage gaps

Baseline: 64 tests (59 suite and 5 surface); 35.95% lines, 33.92% branches, 43.10%
functions, and 36.77% statements. Full `npm test` wall time: 2.80 s on Node 26.12.1.

The checklist is ordered by behavioral risk. A checked item has behavior assertions and is covered;
line references are to `src/jquery.form.js` before Phase 5 (the source is not changed in this phase).

## Upload and response handling

- [ ] FormData upload construction, extra-data deep serialization, caller-supplied `formData`, request
      settings, `beforeSend`, and XHR upload progress (lines 340–428).
- [ ] Iframe setup with generated and supplied targets, attribute restoration, extra fields, clicked
      submit controls, CSRF metadata, synchronous/deferred submit, and fallback native submit
      (lines 432–729).
- [ ] Iframe success, timeout, abort, server-abort, parser-error, HTTP-error, global events,
      completion, and cleanup (lines 449–541 and 737–917).
- [ ] Iframe response extraction for HTML, text, JSON, script, XML, textarea, `pre`, body, status,
      headers, `dataFilter`, and parse/evaluation paths (lines 780–967).

## `ajaxSubmit` options and callbacks

- [ ] Empty selections and function, URL shorthand, false URL, omitted options, method/type/action,
      URL cleanup, and default URL handling (lines 107–160).
- [ ] Pre-serialize and validate event vetoes, `beforeSerialize`, functional/object extra data,
      traditional serialization, and `beforeSubmit` veto (lines 165–218).
- [ ] GET/POST query construction, reset/clear callbacks, target replacement, success arrays,
      callback context, missing XHR fallback, error/complete wrappers, notification, and stored jqXHR
      (lines 220–337).
- [ ] Transport selection: ordinary AJAX, FormData, forced iframe, automatic iframe fallback, and
      `closeKeepAlive` (lines 293–325).

## Form values and helpers

- [ ] `formToArray`: empty/non-form collections, semantic and ordinary traversal, external controls,
      filtering, unnamed/disabled controls, arrays, empty/populated files, clicked images, and
      element collection (lines 1110–1208).
- [ ] `fieldValue` and `fieldSerialize`: missing names, unsuccessful controls, empty collections,
      select-one/multiple, disabled options, empty option values, arrays, CRLF normalization, and
      default `successful` behavior (lines 1224–1367).
- [ ] `clearForm`/`clearFields`: all text-like controls, textarea, checkbox/radio, select, file,
      hidden boolean/selector inclusion, and alias behavior (lines 1379–1419).
- [ ] `resetForm`: input, textarea, option, optgroup, single/multiple select, label `for` and nested
      fields, form reset shadowing, and container recursion (lines 1433–1506).
- [ ] `attr2`, `enable`, `selected`, and debug logging helpers (lines 82–93 and 1511–1564).

## `ajaxForm`

- [ ] URL shorthand, omitted options, empty selection, `beforeFormUnbind`, rebinding, canceled submit,
      nested submit-button targets, and `ajaxFormUnbind` (lines 989–1096).
- [ ] Delegated binding and delegated submit/click handling (lines 1002–1030).
- [ ] Image coordinate branches: `offsetX`, jQuery `offset`, and DOM offset fallback; delayed cleanup
      (lines 1055–1091).

## Legacy compatibility branches

Phase 0 requires the v4 line to retain and test legacy behavior where honest simulation is practical.
These entries remain unchecked until simulated or explicitly agreed otherwise.

- [ ] Lines 83–85: jQuery without `$.fn.prop`; simulate the pre-1.6 attribute fallback.
- [ ] Lines 148–150: IE/Trident HTTPS iframe source; simulate the user agent and location only if
      Chromium permits an honest test.
- [ ] Lines 301–319 and 457–461: no File API/FormData and no `prop`; stub feature inputs and verify
      iframe fallback/disabled restoration.
- [ ] Lines 503–506: IE `execCommand("Stop")` iframe abort; recommend documenting for v4 and removing
      in 5.0 if Chromium cannot expose the API honestly.
- [ ] Lines 565–599: IE8 iframe document access fallbacks; recommend removing in 5.0 if property
      stubs cannot exercise them without misrepresenting browser behavior.
- [ ] Lines 697–701 and 767–771: IE `attachEvent`/`detachEvent`; simulate if cheap, otherwise document
      and recommend removal in 5.0.
- [ ] Lines 781–797 and 802–803: IE XMLDocument and Opera delayed-DOM branches; simulate document
      shapes if cheap, otherwise document and recommend removal in 5.0.
- [ ] Lines 922–943: pre-jQuery-1.5 XML/JSON parsing and ActiveX XML; stub jQuery helpers where honest;
      recommend removing ActiveX and eval fallbacks in 5.0.
- [ ] Lines 1006–1016: pre-jQuery-3 selector/context DOM-ready queue; simulate old jQuery metadata if
      possible, otherwise document and recommend redesign/removal in 5.0.
- [ ] Lines 1132–1136: Edge/Trident external-form-control workaround; simulate the user agent.
- [ ] Lines 1351–1355: old-IE option `value` attribute semantics; simulate the attribute shape.
- [ ] Lines 1402–1407: MSIE file-input clone fallback; simulate the user agent.
- [ ] Lines 1491–1497: IE object-valued form reset; simulate the property shape.
- [ ] Lines 1538–1542 and 1560–1564: select-one deselection and Opera `postError`; the former is
      reachable in Chromium, while the latter should be simulated or recommended for 5.0 removal.
