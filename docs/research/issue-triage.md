# Issue and PR triage (Phase 7)

Read 2026-10-29 via `gh` (27 open issues, 8 open PRs; read only, nothing labeled, commented on or
closed). Builds on `issue-pr-scan.md` (Phase 0), now updated with what Phases 3–6 landed on `main`.
Labels, issue closures and comments are proposals until posted.

## Decisions (2026-10-29)

- **P0 is done in this phase:** `SECURITY.md` (private reporting through GitHub Security Advisories)
  and the docs fix. Private vulnerability reporting is enabled in the repository settings.
- **P1 is on hold.** Bug fixes and the 4.x and 5.0 releases are planned after all phases finish; the
  P1 bugs stay recorded as `it.fails` tests until then.
- **PRs are triaged, not worked.** PRs #612, #601, #583, #599 and #587 are closed with comments;
  the rest are held.

Categories: **bug**, **security**, **feature**, **support**, **duplicate**, **stale**, plus
**fixed on main** (resolved by merged work, waiting for a 4.x release).

## Prioritized backlog (work to do)

| Pri | Item                                                                                                                                                                                                                                                                                                                                                                         | Issues / PRs                     | Target           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------- |
| P0  | Add `SECURITY.md` and turn on GitHub private vulnerability reporting (a repo setting). A reporter opened #624 on 2026-10-24 and is holding a report.                                                                                                                                                                                                                         | #624, #580                       | Done (Phase 7)   |
| P0  | Fix the docs: `success`/`error` are marked "Deprecated due to jQuery 3 Slim", which is wrong (jQuery deprecated the `jqXHR.success()`/`.error()` methods, not the options); `error` already receives `$form` as its 4th argument; slim has no AJAX at all; the README "Compatibility" and "Pull Requests Needed: jQuery 3" sections are stale (tested: 1.7.2, 3.7.1, 4.0.0). | #568, #547, #541, #544, PR #587  | Done (Phase 7)   |
| P1  | Release 4.x from `main`. It resolves the jQuery 4 breaks, the vite/ESM import (`module` entry registers the plugin on import), the CI badge and the unminified `dist` file.                                                                                                                                                                                                  | #616, #618, #615, #553 (part)    | 4.x release      |
| P1  | Bug: a `<button>` with no `type` is not captured as the submitter, so its name/value is not sent. Reproduced.                                                                                                                                                                                                                                                                | #588                             | 4.x fix          |
| P1  | Bug: the iframe transport writes each `data`/`extraData` value into one hidden input, so arrays arrive as `"a,b"` and objects as `[object Object]`. The XHR and FormData paths are correct. Reproduced.                                                                                                                                                                      | #597                             | 4.x fix          |
| P1  | Bug: `resetForm` (and `clearFields`) throw on nodes without `tagName` (document, text nodes). Reproduced.                                                                                                                                                                                                                                                                    | #600                             | 4.x fix          |
| P1  | Remove the `/* eslint consistent-this */` comment that ships in `dist/jquery.form.js` and leaks into concatenated vendor bundles.                                                                                                                                                                                                                                            | #553                             | 4.x fix          |
| P2  | Security review of `target` HTML insertion, iframe construction from options, and response handling; pick one approach (escaping changes `target` semantics, so it may be a 5.0 change or an opt-in).                                                                                                                                                                        | #604, #607, #554, PRs #586, #611 | Phase 8          |
| P2  | Phase 5 bugs already recorded as `it.fails` (no GitHub issues yet): label `for` crash, iframe parsererror overwritten, abort completes twice, abort leaves the Deferred pending, iframe `script` not evaluated. See `coverage-findings.md`.                                                                                                                                  | none                             | 4.x fixes        |
| P3  | Delegation not scoped on jQuery ≥ 3 (`.selector` removed); needs an explicit selector option or removal.                                                                                                                                                                                                                                                                     | #353, #548, #544                 | 5.0 design       |
| P3  | Feature: send the form as a JSON body. Additive; PR #557 conflicts and needs a design review first.                                                                                                                                                                                                                                                                          | #545, PR #557                    | 4.x minor or 5.0 |
| P3  | Fail with a clear message on jQuery slim (no `$.ajax`) instead of a `TypeError`.                                                                                                                                                                                                                                                                                             | #541                             | 5.0              |

## Bugs reproduced as tests

Added as `it.fails`, in the Phase 5 style; each fails for the reported reason on
jQuery 1.7.2, 3.7.1 and 4.0.0.

| Issue | Test                                                                              | Observed failure                                       |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| #588  | `ajaxForm should capture a button without a type attribute`                       | `form.clk` is `undefined`                              |
| #597  | `iframe upload transport should submit array extraData values as separate fields` | submitted `[["tags", "a,b"]]`, not two `tags[]` fields |
| #600  | `resetForm should skip nodes without a tag name`                                  | `TypeError` reading `toLowerCase` of `undefined`       |
| #600  | `clearForm should skip nodes without a tag name` (`clearFields`)                  | `TypeError` reading `toLowerCase` of `undefined`       |
| #553  | `dist files should not ship file-wide ESLint configuration comments` (surfaces)   | `/* eslint consistent-this … */` found in both builds  |

Not reproduced: #541 (needs a slim-build test harness; deferred with the 5.0 item), #525 (EdgeHTML upload progress; that browser is retired), #548 is #353 (already an
`it.fails`), #590 is server-side naming (see below).

## Proposed issue dispositions

| #   | Category      | Proposed labels              | Action                                                                                                     |
| --- | ------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 624 | security      | `security`                   | Keep open until `SECURITY.md` and private reporting exist; then reply with the channel and close.          |
| 618 | fixed on main | `Focus: Package Manager`     | Comment that the next release's `module` entry registers on import; close on release.                      |
| 617 | stale         | `wontfix`                    | Close: 3.x predates npm publishing; point to tagged files via jsDelivr's GitHub CDN.                       |
| 616 | fixed on main | `enhancement`                | Comment that jQuery 4 is tested and gating on `main`; close on release.                                    |
| 615 | fixed on main | `documentation`              | Close now: the README badge is GitHub Actions on `main`.                                                   |
| 610 | stale         | `invalid`                    | Close: site spam, not a plugin issue.                                                                      |
| 607 | security      | `security`, `duplicate`      | Close as duplicate of #604 (same CodeQL class); track in #604.                                             |
| 604 | security      | `security`                   | Keep open as the scanner-report tracker; resolve in Phase 8.                                               |
| 600 | bug           | `bug`                        | Keep; fix in 4.x.                                                                                          |
| 598 | support       | `question`                   | Close: server-side processing progress is outside the plugin (needs polling or streaming from the server). |
| 597 | bug           | `bug`, `upload`              | Keep; retitle to the iframe transport case; fix in 4.x.                                                    |
| 590 | support       | `question`, `upload`         | Close with the answer: name the input `files[]` so the server receives every file.                         |
| 589 | feature       | `wontfix`                    | Close: `ajaxForm` binds synchronously, so code after the call can show the button.                         |
| 588 | bug           | `bug`                        | Keep; fix in 4.x.                                                                                          |
| 584 | support       | `invalid`                    | Close: WordPress question, not about the plugin.                                                           |
| 582 | feature       | `wontfix`                    | Close: WebSocket transport is outside a form-to-AJAX plugin.                                               |
| 580 | security      | `security`, `duplicate`      | Close as duplicate of #554 (per the huntr/Snyk comments), pointing to `SECURITY.md`.                       |
| 568 | support       | `question`, `documentation`  | Close: `error` already receives `$form` as its 4th argument; covered by the docs fix.                      |
| 554 | security      | `security`                   | Keep; Phase 8 decides (scanner taint report on iframe response handling).                                  |
| 553 | bug           | `trivial`                    | Keep until the comment is removed; the unminified `dist` file it asked for exists on `main`.               |
| 548 | duplicate     | `duplicate`                  | Close as duplicate of #353.                                                                                |
| 547 | support       | `question`, `documentation`  | Close: `error` gets the jqXHR (`responseJSON`/`responseText`); not deprecated. Covered by the docs fix.    |
| 545 | feature       | `feature`                    | Keep; decide 4.x vs 5.0 with #557.                                                                         |
| 544 | feature       | `enhancement`                | Keep as the jQuery-compat tracker; update the body: removed-API work done, delegation (#353) remains.      |
| 541 | feature       | `enhancement`                | Keep; reframe as "fail clearly on slim" (slim excludes AJAX, so it cannot be supported).                   |
| 525 | stale         | `not reproducible`, `upload` | Close: EdgeHTML is retired; reopen with a Chromium-based reproduction.                                     |
| 353 | bug           | `bug`                        | Keep; 5.0 design (see `selector-context-delegation.md`).                                                   |

Proposed new label: `security` (none exists). `fixed on main` needs no label; a comment plus closing
on release is enough.

## Proposed PR dispositions (not to be worked)

| #   | Decision                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 612 | Close: junk edit to a header comment.                                                                                                               |
| 601 | Close: dependency bumps superseded by Phase 3/6 (`npm audit` 0).                                                                                    |
| 583 | Close with thanks: lint work superseded by the Phase 3/4 toolchain.                                                                                 |
| 599 | Close with credit: the same `$.trim`/`$.isFunction`/`$.isArray` replacements landed in Phase 6. Its `<iframe ...></iframe>` change goes to Phase 8. |
| 587 | Close with credit: the typo sits in the "Deprecated" lines the docs fix removes.                                                                    |
| 586 | Hold for Phase 8; likely close in favour of the chosen XSS approach.                                                                                |
| 611 | Hold for Phase 8; unmergeable as written (pins jQuery 1.11.0-beta3, regenerates `dist` and the lockfile).                                           |
| 557 | Hold: needs a design decision on #545 and a rebase.                                                                                                 |

## Counts if all proposals are applied

Issues: 27 open → 13 after the 14 closures proposed now → 11 after the release closes #616 and #618 → 10 once #624 has its channel. PRs: 8 open → 3 held (5 closures).
