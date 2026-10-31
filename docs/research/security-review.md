# Security and architecture review (Phase 8)

A review of `src/jquery.form.js` on `main` (ac911a2, 2026-10-31). It covers response handling, uploads, request construction and dependency exposure. It also settles the 5.0 carry-overs left open by Phases 0 and 6. Line numbers refer to that commit.

This doc only records findings. Fixes are scheduled in the phases of `docs/plans/modernization.md` (Phases 9–12).

## How the review was done

- A line-by-line reading of the source, plus a second independent review that saw only the source, not these findings. Anything it found was checked before being included.
- Each runtime claim was checked with throwaway Vitest browser probes on jQuery 1.7.2, 3.7.1 and 4.0.0. The probes were not committed; Phase 10 turns the confirmed ones into tests.
- Inputs: #604, #554, #464, #353, held PRs #586 and #611, `issue-triage.md`, `coverage-findings.md`, `coverage-gaps.md`, `selector-context-delegation.md`, and two private advisory reports.

"Who controls it" uses four sources:

- the **developer** (plugin options)
- **DOM text** (names, ids and attributes that a site may fill from user content and escape correctly)
- the **server response**
- the **page** (meta tags)

A sink that DOM text can reach matters most, because correct escaping on the server does not protect against it.

## Withheld until the fix is released

Four findings let DOM text, plugin options or a JSON response become executable HTML in the current code. Two of them were reported privately as GitHub security advisories; one of those is also public on drupal.org (#3607794). Their details are kept out of this repository until a fixed 4.x release ships. They will then be published in the advisories, the release notes and this doc.

| #   | Area                                                                       | Reported by                                                           | Severity | Fix in   |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- | -------- |
| W1  | Iframe upload transport: how it builds its iframe and hidden inputs (#604) | Private advisory; same lines as #604's CodeQL alerts                  | High     | Phase 10 |
| W2  | `resetForm` on `<label>` elements                                          | Private advisory; public on drupal.org; overlaps a Phase 5 `it.fails` | High     | Phase 10 |
| W3  | `formToArray` lookup of controls outside the form (`semantic`)             | This review                                                           | Medium   | Phase 10 |
| W4  | `target` with a response that jQuery has already parsed                    | This review                                                           | Medium   | Phase 10 |

## Findings

Ranked by severity, then by who controls the input.

| #   | Finding                                                                   | Who controls it     | jQuery | Severity | Fix in             |
| --- | ------------------------------------------------------------------------- | ------------------- | ------ | -------- | ------------------ |
| 1   | `target` inserts the response as HTML and runs its scripts                | Server response     | All    | Medium   | Phase 11 (opt-in)  |
| 2   | `delegation: true` takes over every form on the page                      | Page                | ≥ 3.0  | Medium   | Phase 11, Phase 12 |
| 3   | The iframe transport renders the response as a same-origin document       | Server response     | All    | Medium   | Docs, Phase 12     |
| 4   | The Rails CSRF token is sent to cross-origin upload URLs                  | Page, developer     | All    | Medium   | Phase 10           |
| 5   | The supported jQuery range includes versions with CVEs the plugin reaches | Consumer            | < 3.5  | Medium   | Docs, Phase 12     |
| 6   | Form fields named like form properties break serialization and uploads    | DOM text            | All    | Low      | Phase 10           |
| 7   | `hasOwnProperty` is called as a method on `extraData`                     | Developer           | All    | Low      | Phase 10           |
| 8   | Robustness: crashes and lost data on unusual input                        | DOM text, developer | Varies | Low      | Phase 10           |
| 9   | #554 "code injection" is a false positive                                 | —                   | —      | Info     | Close #554         |
| 10  | `semantic: true` collects every named element, not only form controls     | DOM text            | All    | Info     | Phase 12           |
| 11  | Options that are URLs or selectors must be trusted                        | Developer           | All    | Info     | Docs               |
| 12  | Supply chain                                                              | —                   | —      | Info     | Release            |

### 1. `target` inserts the response as HTML (#604, #464, PRs #586 and #611)

- **What happens.** Lines 241–254: when `target` is set and `dataType` is not, the success callback calls `$(options.target).html(data)`, or `.replaceWith(data)` with `replaceTarget`. jQuery parses the response as HTML and runs any inline scripts in it. Probes confirmed this on all three versions.
- **Why it isn't a plugin flaw.** This is the documented purpose of `target`. It does what `$.fn.load` does. The response comes from the URL the developer chose, so the risk is a server endpoint that reflects user input without encoding it. The plugin can't tell intended markup from injected markup.
- **What's wrong with PRs #586 and #611.** They escape the response before inserting it, turning every `target` into text. That breaks the option for all its users (#586's last comment makes the same point). Their other change, removing the `eval` JSON fallback, already landed in Phase 6.

**Recommendation: a 4.x opt-in, with no default change in 5.0.**

- **Keep the default.** `target` keeps inserting HTML in 4.x and 5.0. Changing it would break the plugin's most common use for a risk that belongs to the server.
- **The opt-in already exists.** The `dataFilter` option runs before `target` on both the XHR and the iframe transport (confirmed by probes on all three jQuery versions), so `dataFilter: (html) => DOMPurify.sanitize(html)` sanitizes what is inserted. Phase 11 documents this in `docs/options.md` and the README's security notes, and adds a test that pins the order.
- **Sanitizing needs jQuery ≥ 3.5.** On older versions, `.html()` rewrites self-closing tags after sanitizing (CVE-2020-11022/11023) and can bring the danger back. The docs say so, and 5.0's peer range (finding 5) enforces it.
- **No new option.** A dedicated `sanitize` option would duplicate `dataFilter`. Reconsider it only if users ask.
- **Close PRs #586 and #611 with credit**, pointing to this recommendation.

W4 is a related but separate problem, fixed in Phase 10 whatever happens here.

### 2. `delegation: true` takes over every form (#353)

- **What happens.** Lines 1017–1025 delegate from `document` using `this.selector`. jQuery 3.0 removed `.selector`, so the selector is `undefined` and the handler catches **every** form submit on the page (`selector-context-delegation.md`).
- **The security impact is new here.** If the options include `url`, every form on the page posts its fields to that URL. That includes forms the developer never meant to bind, such as a login or payment form. Probes reproduced this on 3.7.1 and 4.0.0; 1.7.2 is scoped correctly.
- **Fix in Phase 11 (additive):** accept `delegation: "<selector>"` and use it as the delegated selector. `true` keeps its current behavior.
- **Fix in Phase 12 (breaking):** a selector is required. Bare `true` logs and does nothing, and the `.selector`/`.context` DOM-not-ready queue (lines 999–1015) is removed.
- **Until then:** the README and `docs/options.md` warn that `delegation: true` is not scoped on jQuery 3 and later.

### 3. The iframe transport renders the response as a same-origin document

- **What happens.** The iframe transport (lines 432–964) posts the form into a hidden iframe and reads the response document. The browser loads that response as a page with the same origin as the parent. Any script in it runs with the parent's privileges before the plugin reads anything.
- **Why the docs' JSON advice is risky.** The docs tell servers to wrap JSON in a `<textarea>`. A JSON value containing `</textarea>` and markup escapes the wrapper.
- **Status codes can be forged.** The first `<textarea>` or `<pre>` and the `status`/`statusText` attributes are trusted (lines 813–840). Injected markup earlier in the document can fake the status.
- **Who reaches this.** Only `iframe: true`, or browsers without FormData, use this transport.
- **Docs (Phase 11).** Iframe responses must be HTML-safe: `text/plain`, or JSON HTML-escaped inside the textarea.
- **5.0 (Phase 12).** The iframe transport runs only when `iframe: true` is set.
- **Possible hardening.** `sandbox="allow-same-origin"` on the generated iframe would block scripts and still let the plugin read the document. It is not yet verified across browsers; evaluate it in Phase 12.

### 4. The CSRF token is sent cross-origin

Lines 602–609 copy `<meta name="csrf-token">` (Rails) into every iframe upload, whatever `url` is. Probes confirmed that a cross-origin `url` receives the token on all three versions.

`jquery-ujs` adds the token only for same-origin requests, and the XHR path here never adds it. Fix: add it only when `url` resolves to the page's origin.

### 5. Dependency exposure

`package.json` declares `"jquery": ">=1.7.2"` as a regular dependency. Consumers can run jQuery versions with known CVEs that the plugin's own calls reach:

- **CVE-2015-9251** (jQuery < 3.0): `$.ajax` with no `dataType` runs a cross-domain `text/javascript` response. The plugin passes no `dataType` unless the user sets one (line 324, and `closeKeepAlive` at line 315).
- **CVE-2019-11358** (jQuery < 3.4): `$.extend(true, …)` with a `__proto__` key pollutes `Object.prototype`. The plugin deep-merges user options three times (lines 152, 377 and 465), so `data` or `extraData` built from `JSON.parse` of untrusted input reaches it.
- **CVE-2020-11022/11023** (jQuery < 3.5): `.html()` with sanitized input can still execute. This affects `target` (finding 1).
- **CVE-2012-6708** (jQuery < 1.9): `$()` treats any string containing a tag as HTML. This widens W2 and W3 on old jQuery.

Being a dependency rather than a peer can also install a second jQuery copy. The plugin would then register on a jQuery the app doesn't use.

- **4.x:** no range change, since compatibility is the 4.x promise. The README states that jQuery ≥ 3.5 is required for the security of `target` and deep options.
- **5.0:** `peerDependencies: { "jquery": ">=3.5.0" }`. Phase 0 planned a peer at `>=3`; this review raises the floor to 3.5.

The plugin itself does no prototype pollution: its own object writes (`s.extraData[n]`) assign primitives, so a `__proto__` name is ignored.

### 6. Field names that shadow form properties

HTML lets a control's `name` shadow the form's own properties and methods. Confirmed on all three versions:

- A field named `elements` makes `form.elements` that one field (line 1115), so `formToArray` serializes only it and drops the rest.
- A field named `setAttribute` makes the iframe transport throw (line 620). The throw happens before the `try`, so the upload never completes.
- `form.clk`, `clk_x` and `clk_y` are expando properties that the same mechanism can shadow.

`submit` and `reset` are already guarded (lines 705–712 and 1485–1489). Form builders that let users name fields make this reachable.

Fix: call `HTMLFormElement.prototype` methods and read `elements` through them, and keep the click state in `$.data` instead of on the form.

### 7. `hasOwnProperty` on `extraData`

Line 669 calls `s.extraData.hasOwnProperty(n)`, and lines 673–674 make the same call on each value. An extra field named `hasOwnProperty` (for example a `data` key) replaces the method. The iframe upload then throws a `TypeError` (confirmed on all three versions).

These are the three `no-prototype-builtins` warnings Phase 3 left for this phase. Fix: `Object.prototype.hasOwnProperty.call`, which also clears the warnings.

### 8. Robustness

Each item below was confirmed by a probe except where marked.

- **Orphan submit control.** The click capture (lines 1048–1065) accepts any element with `type="submit"`, including a `<span>` or an ancestor with no `form` property. It then throws writing `form.clk` (all versions).
- **`#` action plus a field named `action`.** With a GET form, line 144 leaves `url` undefined, and line 221 throws (all versions).
- **`url` with a hash.** On a GET, the query is appended after the fragment (line 221). jQuery 3 and 4 then keep it inside the fragment, and jQuery 1.7.2 strips it. Either way the form data is lost. (The hash cleanup at line 144 only applies to `action`, because a `url` option overrides it in the `$.extend`.)
- **`data: {}` on a FormData upload.** It appends a field with an empty name and the value `undefined` (lines 341–352). Also, `deepSerialize` reads `options.traditional`, not the computed default at line 182 (from reading the code).
- **Context is copied.** The deep `$.extend` copies a plain-object `context`, so `this` in callbacks is a copy, not the object passed in. The existing tests compare by property for this reason. Info only; it changes in Phase 12 if options stop being deep-copied.

### 9. #554 is a false positive

The Fortify report traces `xhr.responseXML` to `setTimeout` at line 910. That `setTimeout` takes a function, so nothing is evaluated.

The real evaluation sinks are already handled:

- **`eval`.** The fallback JSON parser was removed in Phase 6 (`JSON.parse` only).
- **`$.globalEval`** (line 956) only runs for an explicit `dataType: "script"`. In the iframe path, the emulated content type comes from `dataType`, not the server, so a response can't opt itself into evaluation. That condition is currently broken (`coverage-findings.md`) and is fixed in Phase 9.
- **CSP.** `$.globalEval` does not pass a nonce, so `dataType: "script"` over the iframe transport is blocked under a strict CSP. Document this.

#554's other concern, HTML insertion, is finding 1. Close #554 when the 4.x release ships, explaining each point.

### 10. `semantic: true` collects every named element

With `semantic`, `formToArray` walks `getElementsByTagName("*")` (line 1114). That includes `<a name>`, `<img name>`, `<param name value>` and any element with `name`/`value` properties, not only form controls. User content inside a form can therefore add request parameters.

5.0 should limit the walk to form-associated elements (`form.elements` in document order).

### 11. Options that must be trusted

- **`url`, a form's `action`, `iframeSrc`, `closeKeepAlive`, `target` and `iframeTarget` are developer input.** A `javascript:` URL in `url` or `action` runs when the iframe transport submits. That is the same as a native submit. Selector options passed to `$()` are parsed as HTML on jQuery < 1.9 if they contain a tag.
- **No `document.domain` handling remains.** A cross-origin response fails closed: `getDoc` throws, and the transport reports a server abort (lines 644–661).
- **Docs.** List these options as trusted-only in `docs/options.md`.

### 12. Supply chain

- The published tarball holds only `dist/` and `src/` (Phase 6 `files`). There is one runtime dependency, and `npm audit` reports 0 vulnerabilities.
- Releases are tagged and published by hand (ADR-0002).
- Proposal for the 4.x release: publish from GitHub Actions with npm trusted publishing and `--provenance`, so each tarball can be traced to a commit.

## Static analysis (CodeQL)

`.github/workflows/codeql.yml` (added in this phase) runs advanced CodeQL setup:

- Languages `javascript-typescript` and `actions`, with the `security-extended` queries, which include `js/html-constructed-from-input`, the query behind #604.
- It scans `src/` and the workflows. `dist/` is excluded because it is generated from `src/`; tests and the docs site are excluded because they are not shipped.
- It runs on pushes and PRs to `main` and weekly.

Default setup was not used because it cannot exclude `dist/`, where every source alert would appear three more times.

**Visibility.** Alerts are listed only to people with write access. PR annotations, which anyone can read, show only alerts on lines a PR changes. So the advisory fixes are developed in the advisories' private forks.

**After the first `main` analysis,** each alert is reconciled against this doc: it is either a known finding (with its phase), or dismissed with a reason. The open-alert count becomes a row in `docs/metrics.md`.

## Architecture and 5.0 carry-overs

The ADR-0001 dual surface (a module entry plus the classic script-tag, AMD and CommonJS factory builds) is preserved by everything below. Items that touch it are marked **ADR-0001**.

### `exports` map (5.0)

**ADR-0001:** adds an `exports` map without removing any entry or deep path that a 4.x consumer uses.

```json
"exports": {
  ".": {
    "import": "./dist/jquery.form.mjs",
    "default": "./dist/jquery.form.js"
  },
  "./dist/*": "./dist/*",
  "./src/*": "./src/*",
  "./package.json": "./package.json"
}
```

- **`main`, `module` and `browser` stay** for tools that predate `exports`.
- **Script tags and AMD are unaffected**, because they load files by path (CDNs, `bower.json`, `composer.json`). `test/surfaces/manifests.test.js` gains checks that every 4.x deep path still resolves through `exports`.
- **Dual-package hazard.** An app that both `import`s and `require`s the plugin loads it twice. The module registers on import; the CommonJS factory registers when it is called with a jQuery. If both get the same jQuery, the only cost is registering twice. If they get different jQuery copies, each copy gets its own plugin. Document it rather than work around it; the peer dependency (finding 5) makes a single jQuery the normal case.

### Delegation replacement (decides a Phase 0 open question)

Details are in finding 2.

- **4.x:** add `delegation: "<selector>"`.
- **5.0:** a selector is required, and the `.selector`/`.context` paths and the DOM-not-ready queue are removed.
- **Selector-only design.** A new `$.ajaxForm(selector, options)` was considered and rejected, because it adds a second calling convention. A selector-valued option keeps the `$.fn` surface.

### Does `options.iframe` survive into 5.0? (Phase 0 open question)

Yes, as an explicit opt-in only:

- Every browser 5.0 supports has FormData, so automatic iframe fallback and the feature detection go away.
- Users who opt in today (for example with `iframeTarget`) keep working. Once W1 is fixed, it builds its elements with DOM APIs.
- Removing the transport entirely would make 5.0 smaller. Consider it if 4.x deprecation feedback shows nobody needs it.
- It keeps the response caveats of finding 3, and fixes #597 there.

### Source structure and cleanup

These items are sequenced in the plan.

- **Phase 9: coverage to 100%.** Remove the dead branches listed in `coverage-gaps.md`, and refactor where a branch can't be tested.
- **Phase 11: no breaking change.**
  - Split the 1,560-line IIFE into source modules (serialization, field helpers, XHR transport, iframe transport, `ajaxForm` binding). Rollup emits the same three `dist` files.
  - Reduce the complexity hot spots measured by `npm run metrics`: iframe `cb` 62, `ajaxSubmit` 55, `formToArray` 37, `$.fieldValue` 28, `fileUploadIframe` 24.
- **Phase 12: breaking.**
  - Delete the jQuery < 3 and IE/Opera/Edge shims.
  - Remove deprecated API: `clearInputs`, and the `$.fn.attr2` helper leaking onto `$.fn`.
  - Move to ES2015+ syntax.
