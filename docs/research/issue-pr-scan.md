# Open issue / PR scan (sequencing for tooling/test modernization)

Scanned 2026-10-25 via read-only `gh` (27 open issues, 9 open PRs). Sources: issue/PR text and diffs only.

Tags: **API** public-API/behavior change · **PKG** packaging/build/module-format · **SEC** security · **JQ** jQuery-3/4 compat · **DOCS** · **STALE** support-question/stale

## Open PRs

| #   | Title                                     | Summary                                                                                                                                                      | Tag           | State                                                                                                                                |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 614 | Add GitHub Actions workflow for testing   | Adds `.github/workflows/ci.yml` (Node 10, npm@5, `grunt test`) and swaps Travis badge (fixes #615).                                                          | PKG           | Mergeable, but pins obsolete Node 10/npm 5/actions v2; **overlaps planned CI work**                                                  |
| 612 | new                                       | One-line change that corrupts a header comment ("Alsupoooooo").                                                                                              | STALE         | Mergeable, junk; close                                                                                                               |
| 611 | fix: security fix for XSS                 | Rewrites `parseJSON` fallback and HTML-encodes `data` before `.html()`; also rebuilds dist, pins jquery `1.11.0-beta3`, rewrites package-lock (+3578/-2241). | SEC, API, PKG | Mergeable, but unmergeable in practice: pins jQuery, regenerates dist, encoding changes `target` behavior                            |
| 601 | Scantist ...                              | Only edits `package.json` (dependency bumps).                                                                                                                | PKG           | Mergeable, stale (2022); superseded by modernization                                                                                 |
| 599 | Improve jQuery 3 compatibility            | Replaces `$.trim/$.isFunction/$.isArray` with natives; closes iframe tag; small (+6/-6).                                                                     | JQ            | Mergeable, small, **overlaps planned jQuery-compat work**; fixes the jQuery 4 hard breaks in #616                                    |
| 587 | docs: fix typo                            | Typo fix, "incompatiblity".                                                                                                                                  | DOCS          | Mergeable, trivial                                                                                                                   |
| 586 | XSS fix (huntr.dev)                       | Wraps `data` in text-encoded HTML before `.html()` target insert; mis-indented, ternary-as-statement.                                                        | SEC, API      | Mergeable but changes behavior (HTML responses become escaped text); overlaps #611                                                   |
| 583 | Linting                                   | 14 files, +1576/-2411: fixes ESLint issues, config, tests, Gruntfile.                                                                                        | PKG           | Reported mergeable, but from 2021 and touches nearly every file; **will conflict with #599, #611, #586, #557 and any modernization** |
| 557 | Add support for post json body (fix #545) | Adds JSON body option in `src/jquery.form.js`, README, tests.                                                                                                | API           | **CONFLICTING**                                                                                                                      |

## Open issues

| #   | Title                                       | Summary                                                                 | Tag       |
| --- | ------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| 624 | Security policy                             | Asks for SECURITY.md / private reporting channel.                       | SEC, DOCS |
| 618 | How to make it work on vite                 | User cannot load plugin under vite (needs inject/require transforms).   | PKG       |
| 617 | Old versions in NPM?                        | Asks to publish older versions to npm for unpkg/licensing attribution.  | PKG       |
| 616 | New release jQuery 4 support?               | Drupal asks for a release with #599 applied for jQuery 4 beta.          | JQ, PKG   |
| 615 | Travis badge broken                         | README badge dead; fixed by #614.                                       | DOCS, PKG |
| 610 | Messages from ME to ME                      | Unclear/off-topic.                                                      | STALE     |
| 607 | "Unsafe jQuery plugin" CodeQL               | CodeQL XSS alert, screenshots only.                                     | SEC       |
| 604 | Unsafe HTML constructed from library input  | CodeQL alert at iframe construction (lines ~482, ~672).                 | SEC       |
| 600 | TagName in Element undefined                | `resetForm` errors on elements without `tagName`.                       | API (bug) |
| 598 | Data Process Display in Progress            | Support question about progress display.                                | STALE     |
| 597 | "data" option not sending arrays            | Array/object values in `data` option not sent.                          | API (bug) |
| 590 | multiple file                               | Support question.                                                       | STALE     |
| 589 | onReady event                               | Feature request.                                                        | API       |
| 588 | `<button>` with no type does not send value | Default-submit buttons omit their value.                                | API (bug) |
| 584 | Trouble with custom-post-type filters       | WordPress support question.                                             | STALE     |
| 582 | WebSocket option?                           | Feature request.                                                        | API       |
| 580 | Potential Vulnerability                     | Snyk requests private contact; no details.                              | SEC       |
| 568 | Access form from error callback             | Support/feature question.                                               | STALE     |
| 554 | Fortify SCA code injection                  | Scanner flags `responseXML`/`responseText` use (~line 812).             | SEC       |
| 553 | Enable and disable `consistent-this` rule   | Lint config.                                                            | PKG       |
| 548 | Delegation option bug?                      | Question/possible bug.                                                  | STALE     |
| 547 | JSON data from error responses              | Support question.                                                       | STALE     |
| 545 | Post JSON within request body               | Feature request: `contentType: 'application/json'` sends JSON; PR #557. | API       |
| 544 | Full jQuery 3 compatibility                 | Tracking issue for removed jQuery 3 APIs (#541, #353, ...).             | JQ        |
| 541 | Incompatible with jQuery 3 slim             | `jqXHR.success` removed.                                                | JQ        |
| 525 | uploadProgress not working in Edge          | Legacy-browser bug.                                                     | STALE     |
| 353 | `.selector` property removed                | jQuery 3 removal.                                                       | JQ        |

## Highlights

- **Packaging / public API:** #616, #618, #617, #544/#541/#353, #545/#557 (new JSON-body option), #588, #597, #600. #611 and #586 also change observable behavior for `target` HTML insertion.
- **Security cluster:** #604, #607, #611, #586, #580, #554, #624. All are scanner or private-contact reports. No concrete exploit is demonstrated in the text. The only fixes are #611 and #586, which overlap and are both behavior-changing. #580 and #624 need a SECURITY.md or contact channel, not code.
- **Overlap with planned work:** #614 (CI) is outdated but mergeable; #583 (lint) is large and stale; #599 (jQuery 3 compat) is small and mergeable.
- **Mergeable vs. not:** Mergeable per GitHub: #614, #612, #611, #601, #599, #587, #586, #583. Conflicting: #557. Practically stale or junk: #612, #601, #587, #611, #583.

## Sequencing implications

1. Merge #599 first (or re-implement it). It is the smallest change and unblocks jQuery 3/4 compatibility (#616, #544, #541, #353) before any test infrastructure is built on it.
2. Do not merge #583 as-is. It rewrites 14 files and conflicts with everything else. Redo linting from the modernization config instead and close it.
3. Treat #614 as a template only. Node 10, npm 5 and actions v2 are obsolete, so replace it with the modernized CI (and fix #615 with it).
4. Decide the module format and package entry points (#618 vite, #617 npm versions, #616 release) before choosing the test runner and bundling setup. They determine how tests import the plugin.
5. Settle the jQuery support matrix (3.x and 4.x minimum, slim build) before modernizing tests. Test fixtures need to run against the declared versions.
6. Pick a single XSS approach before writing security tests. #611 and #586 conflict and both change `target` insertion semantics; #611 also pins jQuery to 1.11.0-beta3 and rebuilds dist, so reject it as written.
7. Add SECURITY.md (#624, #580) early. It is a docs-only change and gives security reports a private channel before more public CodeQL-style issues pile up.
8. Decide the JSON-body feature (#545/#557) before locking the public API and tests. #557 conflicts and needs a rebase and design review.
9. Write characterization tests for the open bugs (#588, #597, #600) and fix them after the test harness exists. They are behavior changes and should not be mixed into the tooling migration.
10. Close or triage the rest: #612, #601, #587 (merge or close), and the support-question issues #598, #590, #584, #568, #548, #547, #610, #525.
