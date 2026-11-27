---

name: Modernize jquery-form
overview: "Ordered plan: research, working baseline, toolchain and CI, grouped refactor/modernize commits (Prettier, test rewrite), coverage to 100%, then issue triage and architecture review."
todos:

- id: research
content: "Research: test runner, bundler for dual publish, Node 26/tool versions, legacy support floor, issue/PR scan; write findings to docs"
status: completed
- id: grill-branching
content: "Grill-with-docs session: develop vs trunk, main rename, v4/v5 branch and tag strategy; record ADR"
status: completed
- id: branch-reconcile
content: "Merge develop into master, rename master to main, delete develop, prune stale remotes, close #614, protect main, fix master links"
status: completed
- id: prototype
content: "Prototype plain Playwright Test vs Vitest (Vitest only if clearly justified) and Rollup dual build; pick runner and bundler"
status: completed
- id: baseline
content: Install deps, run lint/tests/build on current state, record baseline failures
status: completed
- id: grill-prettier
content: Grill-with-docs session to decide Prettier deviations from defaults; record in config/ADR/GLOSSARY as warranted
status: completed
- id: toolchain-ci
content: "Architecture/CI group: Node pin, runner + coverage, bundler with dual publish, ESLint flat config, GitHub Actions, remove Travis/CircleCI/.editorconfig"
status: completed
- id: ci-instrumentation
content: "Architecture/CI group: time each major CI step, record a CI baseline in docs/metrics.md, list speed-ups"
status: completed
- id: prettier-sweep
content: "Refactor group: Prettier format sweep as its own commit, no behavior changes"
status: completed
- id: test-rewrite
content: "Refactor group: migrate/rename existing tests to BDD names and AAA shape, behavior unchanged"
status: completed
- id: coverage
content: Close coverage gaps to 100% with new tests and enforce threshold in npm test
status: completed
- id: deps-modernize
content: Dependency upgrades, jQuery version matrix, npm audit, manifest checks
status: completed
- id: metrics
content: "Keep docs/metrics.md current: before/after numbers (test time, coverage, test count, bundle size, audit, deps) at each phase and for the v4 and v5 releases"
status: in_progress
- id: triage
content: Triage GitHub issues/PRs via gh into prioritized backlog
status: completed
- id: review
content: Architecture and vulnerability review with findings doc and issues
status: completed
- id: coverage-100
content: "Coverage to 100%: remove dead and over-defensive branches, refactor for testability, raise thresholds"
status: completed
- id: security-fixes
content: "Security and bug fixes: private advisories, review findings, P1 and Phase 5 it.fails bugs"
status: completed
- id: release-4x
content: "Phase 11: release 4.4.0 with Phases 0-10 and the W1-W4 fixes, publish with npm provenance, publish the advisories and release notes"
status: completed
- id: cleanup-4x
content: "Phase 12: 4.x cleanup and rearchitecture without breaking changes (source modules, lower complexity, additive options, deprecations), then a 4.x minor release"
status: completed
- id: hardening-4x
content: "Phase 13: 4.x test hardening (cross-browser suite, serialization oracle against native FormData, end-to-end tests with a real server, published-file tests, a one-off mutation-testing report), then the 4.6.0 release"
status: in_progress
- id: breaking-5
content: "Phase 14: 5.0 with a jQuery >=3.5 peer, exports map, no jQuery <3 or IE/Opera shims, explicit iframe transport and delegation selector"
status: in_progress

---

# Plan: jquery-form revival

Current state: single source `src/jquery.form.js`; tests in `test/test.js` + `test/test.html` (Mocha 6 / Chai 4 via grunt-mocha, PhantomJS); Gruntfile + uglify; Travis and CircleCI config. Last real work was 2020.

Inputs: `docs/agents/coding-standards.md` (workshop targets: Node 26, GitHub Actions, ESLint flat, Prettier near-defaults, `npm test` as single verify command, Conventional Commits 1-3 lines, BDD + AAA tests) and ADR-0001 (dual publish: modern module and classic `$.fn`/UMD/AMD must both be preserved).

## Status and decisions

Phase 0 is complete. See `docs/research/phase-0-decisions.md` (decisions, branching state), `docs/research/tooling-research.md`, and `docs/research/issue-pr-scan.md`. This file is the source of truth for the plan; update it as work proceeds.

- Two release tracks: 4.x (minor, keeps all compatibility, target 100% coverage including legacy branches) then 5.0 (drops legacy jQuery <3 and IE shims, peer dependency, architecture work, TS discussion).
- Plain JS for now. Minimal tooling: Vitest only if clearly justified over plain Playwright Test.
- Runner and bundler settled by prototype (`docs/research/runner-bundler-prototype.md`): Vitest browser mode (Playwright provider, v8 coverage), and Rollup with the classic build kept in the existing UMD wrapper so the CommonJS `(root, jQuery)` factory is preserved. Mocha and Chai are dropped.
- Branching settled in ADR-0002: trunk on `main` (no `develop`/`next`); reconcile is merge `develop`→`master`, rename to `main`, prune, protect; community PRs wait until coverage is 100%.

### Revised order

1. ~~Grill session: branching strategy (and ADR)~~ — done (`docs/adr/0002-branching-and-release.md`)
2. ~~Reconcile branches, rename to~~ `main`~~, prune, protect (per ADR-0002)~~ — done
3. ~~Runner/bundler prototype~~ — done (`docs/research/runner-bundler-prototype.md`)
4. ~~Baseline (Phase 1)~~ — done (`docs/research/baseline.md`)
5. ~~Grill session: Prettier (Phase 2)~~ — done; decisions below
6. ~~Architecture/CI group (Phase 3)~~ — done; decisions below
7. ~~CI instrumentation (Phase 3B)~~ — done (`docs/metrics.md`)
8. ~~Refactor group (Phase 4: Prettier sweep, test rewrite, lint cleanup)~~ — done
9. ~~Coverage (Phase 5)~~ — done at the reachable maximum; see Phase 5 below
10. ~~Dependency modernization (Phase 6)~~ — done
11. ~~Issue triage (Phase 7)~~ — done (`docs/research/issue-triage.md`)
12. ~~Architecture and vulnerability review (Phase 8)~~ — done (`docs/research/security-review.md`)
13. ~~Coverage to 100% (Phase 9)~~ — done; see Phase 9 below
14. ~~Security and bug fixes (Phase 10)~~ — done; the W1–W4 fixes merge in Phase 11
15. 4.4.0 release with the work so far (Phase 11)
16. ~~4.x cleanup and rearchitecture (Phase 12)~~ — done
17. ~~4.5.0 release with Phase 12~~ — done (PR #642)
18. ~~4.x test hardening (Phase 13), then the 4.6.0 release~~ — done (PR #644)
19. 5.0 (Phase 14), then the 5.0 release; 5.x features after

Phase 11 was added on 2026-10-31. The cleanup phase splits `src/jquery.form.js` into modules, which
would move every W1–W4 sink while the fixes are still on a local branch. Releasing first ships the
fixes sooner and lets the refactor start from the fixed code. The phases after it moved up by one.

Phase 13 (4.x test hardening) was added on 2026-11-01, after the Phase 12 characterization sweep
showed how much untested behavior the suite had missed. 5.0 moved to Phase 14.

### Architecture/CI decisions (Phase 3)

- Node 26 pinned by `.nvmrc` and `devEngines` (not `engines`, which would constrain consumers). CI reads `.nvmrc`.
- `src/jquery.form.js` is an ES module: `import jQuery from 'jquery'`, the plugin body byte-identical, `export default jQuery`. Rollup builds `dist/jquery.form.mjs` (module), `dist/jquery.form.js` (classic), and `dist/jquery.form.min.js` plus source map. The classic build re-wraps the body in the original UMD header from `rollup.config.mjs` and restores the `'use strict'` directive Rollup drops from modules.
- Package entries: `main` is `dist/jquery.form.js` (was `src/jquery.form.js`), `module` is `dist/jquery.form.mjs`, `browser` is unchanged. No `exports` map, so deep paths keep resolving. `bower.json`, `composer.json`, and `form.jquery.json` now point at `dist/jquery.form.js`. ADR-0001 flag: anyone deep-requiring `jquery-form/src/jquery.form.js` now gets ESM; the package entries are unaffected.
- `dist/` stays committed; CI fails if it differs from a fresh build. The AMD module still defines no value (unchanged).
- Vitest projects: `suite` (`test/test.js` in Chromium, rewritten in Phase 4B to BDD/AAA with awaited async tests; the `before` and `chai` shims are gone), `surfaces` (script tag, AMD via RequireJS, native ESM with jQuery 4, bundled ESM with CommonJS jQuery 3), `commonjs` (Node `require` returns the 2-argument factory). `test/test.html` is now only the fixture source.
- ESLint keeps the old config's error-level non-style rules for `src` (the body passes all of them) plus `recommended`; `no-prototype-builtins` stays a warning. Warn-level preferences that Grunt hid with `quiet` are dropped. Both rules are on for `test/test.js` again (Phase 4B), and unused `eslint-disable` directives are errors (stale ones in `src` were removed). Three `no-prototype-builtins` warnings remain in `src`; they are left for Phase 8.
- Grunt, Travis, CircleCI, `.editorconfig`, `install/` (Grunt githooks), and `prototype/` are removed.

### Prettier decisions (Phase 2)

- Prettier defaults (2-space indent, double quotes, semicolons, `bracketSpacing`, LF) except `trailingComma: "es5"` (v4 classic build ships source as written; revisit for v5) and `printWidth: 100`. No ADR, no new GLOSSARY terms.
- `.prettierrc.json` holds only those two overrides; Prettier pinned to an exact version in `devDependencies`.
- Format `src/`, `test/test.js`, `test/test.html`, config files, `docs/**/*.md`. `.prettierignore`: `dist/`, `package-lock.json`, `test/ajax/`, `test/img/`, `prototype/`, `node_modules/`. Root Markdown (`README.md` etc.) is left out of the sweep.
- ESLint drops all stylistic rules and adds `eslint-config-prettier`; Prettier owns formatting. Which non-style rules survive is a Phase 3 decision.
- Phase 3 adds config, `.prettierignore`, and `format` / `format:check` scripts without wiring the check into `npm test`. The Phase 4A sweep commit runs `format` and adds `format:check` to `npm test`.
- After the sweep, a separate `chore` commit adds `.git-blame-ignore-revs` with the sweep SHA, and `CONTRIBUTING.md` documents `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

### Model recommendations

Each remaining step gets the cheapest model that fits it: a strong reasoner where a mistake breaks consumers or hides bugs, and a fast or long-context model where the work is mechanical or mostly reading.

| Step                                            | Model             | Why                                                                                                                                                                                                       |
| ----------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline (Phase 1)                              | Composer 2.5      | Run commands and record output; little judgement needed.                                                                                                                                                  |
| Grill: Prettier (Phase 2)                       | Claude Sonnet 5.5 | Conversational trade-off discussion; moderate depth, many turns.                                                                                                                                          |
| Architecture/CI group (Phase 3)                 | Claude Opus 5.5   | Multi-part toolchain work: converting `src` to ESM, keeping the ADR-0001 contract (CommonJS factory, AMD, script tag) in the build, and CI. A mistake here breaks consumers.                              |
| CI instrumentation (Phase 3B)                   | Claude Sonnet 5.5 | Workflow edits, a timing script, and recording numbers; the analysis is already in `docs/research/ci-first-run.md`.                                                                                       |
| Prettier sweep (Phase 4A)                       | Composer 2.5      | Mechanical: run the formatter, verify, commit.                                                                                                                                                            |
| Test rewrite (Phase 4B)                         | Claude Sonnet 5.5 | Many similar edits; converting fire-and-forget async tests to promises needs care but follows a repeated pattern.                                                                                         |
| Coverage to 100% (Phase 5)                      | GPT-5.6 Sol       | Deep branch-by-branch reasoning, simulating legacy browsers and old jQuery, iframe transport edge cases.                                                                                                  |
| Dependency modernization (Phase 6)              | Claude Sonnet 5.5 | Routine upgrades plus a version matrix; moderate judgement on breaking changes.                                                                                                                           |
| Issue triage (Phase 7)                          | Gemini 4 Argon    | Long-context reading of many issues and PRs; classification more than deep reasoning.                                                                                                                     |
| Architecture and vulnerability review (Phase 8) | Claude Opus 5.5   | Security analysis (XSS, script eval, iframe parsing, prototype pollution) where missed findings are costly.                                                                                               |
| Coverage to 100% (Phase 9)                      | GPT-5.6 Sol       | Same branch-by-branch reasoning as Phase 5; each deletion must be proven dead on every supported jQuery and browser.                                                                                      |
| Security and bug fixes (Phase 10)               | Claude Opus 5.5   | Security fixes on a local branch until release; a weak fix reopens an XSS.                                                                                                                                |
| 4.4.0 release (Phase 11)                        | Claude Opus 5.5   | Disclosure order and publishing can't be undone; the merge, tag, npm publish and advisories must land in one sitting.                                                                                     |
| 4.x cleanup and rearchitecture (Phase 12)       | Claude Opus 5.5   | Module split under the ADR-0001 build contract; behavior must not change.                                                                                                                                 |
| 4.x test hardening (Phase 13)                   | Claude Opus 5.5   | Test design across browsers, an oracle against native `FormData`, and a real server; findings must be told apart from deliberate Phase 12 changes.                                                        |
| 5.0 (Phase 14)                                  | Claude Opus 5.5   | Breaking changes, `exports` map and peer dependency; consumer-facing design decisions. Steps 0 and 4 use Claude Sonnet 5.5 (docs, and the mechanical formatter and syntax sweep); the rest use Opus (W6). |

## Commit grouping principle

Commits are ordered and batched in three kinds, so the history stays reviewable. Do not mix kinds within a commit, and keep each group contiguous.

1. **Architecture / CI group**: toolchain, runner, bundler, CI, lint config, packaging.
2. **Refactor / modernize group**: Prettier sweep, then test rewrite (rename to BDD/AAA). No behavior changes.
3. **Behavior group**: new coverage tests, fixes, dependency upgrades.

Rationale for order: the harness must exist first so the test rewrite is verified by a running suite; the format sweep follows so the test rewrite is written already formatted; coverage tests come last so new tests are written in the final style.

## Phase 0: Research (no code changes; findings written to a markdown file under `docs/`)

- Test runner fit: Playwright vs Vitest browser mode vs Karma for iframe upload, FormData, XHR progress, and coverage of a UMD file.
- Bundler for dual publish: Rollup / esbuild / tsup for ESM + UMD output, AMD compatibility, `$.fn` registration on import. Also decide JS vs TS (coding-standards leaves it open).
- Confirm Node 26 exists and which ESLint, Prettier, jQuery 3.x/4 versions are compatible. Fall back to current LTS if it does not.
- Legacy support floor: audit browser shims in the source, jQuery 1.7.2 minimum viability, and which branches to test versus remove.
- Check `CONTRIBUTING.md` and ESLint config for `.editorconfig` dependencies.
- `gh issue list` scan for open items that touch the public API or packaging and so affect sequencing.
- Output: recommendations for runner, bundler, language, support floor.

## Phase 1: Baseline

- `npm ci`, lint, tests, `grunt` on the current tree. Record failures and whether `dist/` matches a fresh build.
- Output: how-to-run note and known-failures list.

## Phase 2: Grill session on Prettier

- Run a grill-with-docs session (grilling + domain-modeling skills) to decide where to deviate from the near-defaults (print width, quote style for HTML strings, trailing commas, legacy-style constructs, `dist/`, docs and fixture ignores).
- Record decisions in `.prettierrc` rationale, and an ADR if the decision is significant. Update `coding-standards.md` if the workshop table changes. Create `GLOSSARY.md` only if terms resolve.

## Phase 3: Architecture / CI group

- Pin Node (`.nvmrc`, `engines`), install the chosen runner with coverage, and add the static server for `test/ajax` fixtures.
- Chosen bundler producing both module and classic UMD builds (ADR-0001), with smoke tests of each surface (module import, script tag, AMD).
- ESLint flat config, Prettier config (settings from Phase 2), `npm test` running lint + tests + coverage.
- GitHub Actions workflow; remove Travis, CircleCI and `.editorconfig`; retire Grunt if the bundler replaces it.
- Existing tests keep passing, unmodified, in the new runner (port only what the runner requires).
- Convert `src` to an ESM module (body unchanged) as the Rollup entry; delete `prototype/` once the real config lands.

## Phase 3B: CI instrumentation

Goal: know where CI time goes before optimizing it. Measure first; change nothing for speed in this phase.

- Split the single `npm test` CI step into named steps (`npm run lint`, `npm run build`, `vitest run --coverage`) so GitHub reports each duration. `npm test` stays the one local command; a CI check confirms the steps still match its script.
- Time the setup steps already separate in the log: checkout, `setup-node` (record npm cache hit or miss), `npm ci`, `playwright install --with-deps chromium` (split download from system deps if `--with-deps` dominates), and the `dist` diff.
- Have Vitest write a JSON report (`--reporter=json --outputFile`) and upload it as an artifact, to get per-file and per-test durations and startup (browser launch, transform, import) separately from test time.
- Add a final step that writes a step-duration table to `$GITHUB_STEP_SUMMARY`, so each run shows its own breakdown without opening logs.
- Add `scripts/ci-timings.sh`, which pulls step start and end times with `gh run view <id> --json jobs` and prints a table. Run it on at least 5 runs with a warm cache and 1 cold, and record the median and spread per step in `docs/metrics.md`, plus queue time and total wall time.
- Unblock first: the first run (PR #625) stalled in `npx playwright install --with-deps chromium` because apt downloaded unneeded fonts from a slow mirror; the libraries Chromium needs were already on the runner (`docs/research/ci-first-run.md`). Drop `--with-deps` so CI can go green, then take the baseline.
- Then compare three browser setups on warm and cold runs:
  - Run the job in the official Playwright container (`container: mcr.microsoft.com/playwright:v<version>-noble`), which ships the browsers and system dependencies. Pin the tag to the exact `playwright` version in `package-lock.json`, and keep the two in step with Dependabot or a CI check. Measure the image pull time, and confirm `setup-node` and the npm cache behave inside the container.
  - Cache `~/.cache/ms-playwright` keyed on the Playwright version, and on a hit run only `npx playwright install-deps chromium`, or skip it if the runner image already has the libraries.
  - Use the Chrome already on GitHub's `ubuntu-latest` image (Vitest instance `channel: "chrome"`), with no browser download. The browser version then drifts with the runner image, so weigh that against reproducibility.
- Output: a CI baseline column in `docs/metrics.md` and a ranked list of candidate speed-ups with expected savings, for example caching Playwright browsers keyed on the Playwright version, skipping `--with-deps` on a cache hit, running lint in parallel with the browser job, `concurrency` cancelling superseded PR runs, and `paths-ignore` for docs-only changes. Apply candidates later as separate `ci` commits, each re-measured against the baseline.

Baseline (`docs/metrics.md`, 6 warm runs and 1 cold, job wall time about 31 s, queue 3 s). Speed-up candidates, ranked by expected saving; none are applied yet:

1. Use the Chrome already on the runner (`channel: "chrome"`): removes the Chromium install, about 8 s (26% of wall time). Costs reproducibility, since the browser version follows the runner image.
2. Cache `~/.cache/ms-playwright` keyed on the Playwright version: applied. Warm wall time fell from 31 s to 27 s (the restore costs about 3 s); the first run after a Playwright bump costs about 5 s more (`docs/research/ci-browser-setups.md`). Concurrency cancel and `paths-ignore` are also applied.
3. `concurrency` cancelling superseded PR runs, plus `paths-ignore` for docs-only changes: no change to a single run, but it avoids the runs that stalled or finished for nothing. The stalled first run burned 9 minutes.
4. Node setup: `setup-node` takes about 6.5 s, mostly the Node 26 download. The npm cache saves little: a cold `npm ci` was 2 s against 1 s warm. Test dropping `cache: npm` (at most a second or two) before keeping it.
5. Not worth doing at this size: running lint in parallel (lint, format, and build total about 2.5 s), and the Playwright container (the image pull would likely cost more than the 8 s install). Measure the container only if candidates 1 and 2 are rejected.

## Phase 4: Refactor / modernize group

- Commit A: Prettier sweep only (separate commit, no behavior change).
- Commit(s) B: rewrite/rename existing tests to BDD names and AAA shape, grouped by area. Behavior and assertions unchanged, except async tests must return promises (today their callback assertions run after the test has passed). Drop the `before`/`chai` shims in `test/setup.js` and re-enable the two ESLint rules turned off for `test/test.js`.
- Each commit is verified by `npm test`.

## Phase 5: Coverage to 100%

- Generate the coverage report; list uncovered branches (iframe fallback, FormData/progress, `ajaxSubmit` option variants, `formToArray`/`fieldValue` edge cases, `resetForm`/`clearForm`, `semantic`).
- Write tests per gap, ordered by risk, in BDD/AAA style. Branches that only exist for unsupported browsers are removed or explicitly documented per the Phase 0 support-floor decision, not silently excluded.
- Enforce a 100% threshold in `npm test` and CI.

Status: done on `phase-5-coverage`. 100% was not reachable without source changes: 22 branches and
1 function are dead or contradictory (listed with reasons in `docs/research/coverage-gaps.md`).
Decision: enforce thresholds at the reachable maximum (98.14% lines, 96.41% branches, 98.27%
functions, 98.17% statements) and reach 100% when 5.0 removes or fixes those branches. No
`/* v8 ignore */` comments were added. Bugs found along the way are recorded as `it.fails` tests in
`docs/research/coverage-findings.md`.

## Phase 6: Dependency modernization

- Upgrade remaining dev deps, run a jQuery version matrix (floor from Phase 0, 3.x, 4.x), `npm audit`, and verify `bower.json`, `composer.json`, `form.jquery.json` manifests and `main`/`browser`/exports entries.

Status: done on `phase-6-deps`. No dev dependency had an upgrade available and `npm audit` reports
0 vulnerabilities. The matrix (1.7.2, 3.7.1, 4.0.0) runs in CI and all three gate merges after
fixes for jQuery 4 removals in `src/` and for test-harness issues (`docs/research/jquery-matrix.md`).
Manifests were aligned and are checked by `test/surfaces/manifests.test.js`; an `exports` map is
deferred to 5.0 (it would break deep imports on 4.x). Coverage thresholds were re-baselined after the
`eval` fallback was removed. The `.selector`/`.context` delegation bug was investigated and is
documented, not fixed (`docs/research/selector-context-delegation.md`); consumer-visible changes are
listed in `docs/research/4x-behavior-changes.md`.

## Phase 7: Issue triage

- Pull open issues/PRs with `gh` (see `docs/agents/issue-tracker.md`); categorize bug, security, feature, support, duplicate, stale; reproduce bugs as failing tests; propose labels/closures. Output a prioritized backlog.

Status: backlog and dispositions in `docs/research/issue-triage.md`. P0 done: `SECURITY.md` with
GitHub private vulnerability reporting (enabled), and the callback and compatibility docs corrected.
Open-issue bugs #553, #588, #597 and #600 are recorded as `it.fails`; P1 fixes and the 4.x and 5.0
releases are planned after all phases. PRs were triaged, not worked: #612, #601, #583, #599 and #587
closed; #611, #586 and #557 held. Issue comments, labels and closures were posted on 2026-10-30,
leaving 12 open issues and 3 open PRs.

## Phase 8: Architecture and vulnerability review

- Review `src/jquery.form.js`: response handling (script/html eval, XSS, iframe parsing), uploads (`target`/iframe, `document.domain`), request construction (URL building, data serialization, prototype pollution), dependency exposure.
- Identify improvements while preserving the ADR-0001 dual surface (module format, shim removal, API surface, deprecation path). Output a findings doc and ranked issues.
- 5.0 carry-overs from Phase 6: add an `exports` map (deferred from 4.x; check deep imports and the dual surface), and settle the `.selector`/`.context` replacement for `ajaxForm` delegation and the DOM-not-ready queue (`docs/research/selector-context-delegation.md`).

Status: done. Findings, the `target` recommendation and the 5.0 carry-overs are in
`docs/research/security-review.md`.

- Four XSS findings (W1–W4) are withheld from the repository until the fixed 4.x release ships. Two of them are private advisories, and one of those is public on drupal.org.
- CodeQL advanced setup runs on `main` and PRs (`.github/workflows/codeql.yml`).
- `npm run metrics` records source size and complexity. The v4.3.0 and Phase 8 baselines are in `docs/metrics.md`.

The phases below run in order. Each records a before-and-after metrics column and keeps `npm test`, the jQuery matrix and CodeQL green.

## Phase 9: Coverage to 100% (4.x, no compatibility change)

- Remove the dead and over-defensive branches listed in `docs/research/coverage-gaps.md`:
  - the `|| ""` fallbacks
  - the always-true `serializedData[i]` and `if (a)` checks
  - the always-present `s.success`
  - the `|| []` fallback
  - the dead XML branch and the `toXml` fallback, which is dead even on jQuery 1.7.2 because it has `$.parseXML`
- Restructure the iframe timeout path so its branches are reachable.
- Make explicit `dataType: "script"` authoritative in the iframe transport. This fixes its `it.fails`.
- Refactor for testability where a branch needs it. For the IE-on-HTTPS `javascript:false` default, either move the decision into a small helper the suite can drive, or add an HTTPS test project. Pick the cheaper option.
- Raise the coverage thresholds to 100%. Add no `/* v8 ignore */` comments.

Status: done. Coverage is 100% on lines, branches, functions and statements, and `npm test`
enforces it. Each removed branch and the reason it was dead are in `docs/research/coverage-gaps.md`.

- The timeout path was simplified, not restructured: the `timedOut` flag was never read while true, so
  it is gone. The outer `catch` in the iframe callback is reached by a stubbed IE8 access denial.
- For `javascript:false`, the helper option was cheaper and avoids a second test project. The HTTPS
  check reads `document.URL`, which the suite can redefine.
- Explicit `dataType: "script"` now evaluates iframe responses (`docs/research/4x-behavior-changes.md`).
- The CodeQL baseline on `main` is 3 open alerts in `src/` (alerts 1, 4 and 7).

## Phase 10: Security and bug fixes (4.x)

- W1–W4 from `security-review.md`. There are no private advisory forks: the fixes stay on a local
  branch until release day.
- Four draft advisories exist: the two accepted reports (severity high) and W3 and W4 (severity
  medium). CVEs were requested for all four on 2026-10-31. Reporters are not invited as
  collaborators beyond their own reports. Set `patched_versions` on each before publishing.
- A custom CodeQL query that catches W1–W4, which the built-in queries miss. It must flag them before
  the fixes and pass after. Keep it private until the fixed release ships, since it reveals the sinks.
- The review's findings 4, 6, 7 and 8. Fixing finding 7 also clears the three `no-prototype-builtins` warnings.
- The P1 bugs #588, #597, #600 and #553, and the remaining Phase 5 `it.fails` records: label lookup, iframe parsererror overwrite, double completion and pending Deferred on abort.
- Each `it.fails` becomes an `it`, and coverage stays at 100%.

Status: done. The public fixes merged in PR #632 (eff1ea9): findings 4, 6, 7 and 8, #588, #600 and
#553, and the iframe parsererror, double-completion and abort records. Coverage stays at 100%.

- The W1–W4 fixes, the custom CodeQL query, the label record and #597 are on a local branch, verified
  on `main` at eff1ea9. They merge in Phase 11.
- Decisions: an aborted upload also fires `ajaxComplete` and `ajaxStop`, and the `clk` expandos stay
  on the form until 5.x.
- `npm audit` now reports 6 moderate advisories in dev dependencies only (`minimatch` via ESLint,
  GHSA-g3hv-75wg-m249); the runtime dependency has none.

## Phase 11: 4.4.0 release

A minor release of Phases 0–10 and the W1–W4 fixes. It changes no API; the consumer-visible changes
are in `docs/research/4x-behavior-changes.md`.

Status (2026-11-07): released without waiting for CVE IDs, which were still unassigned. The W1–W4
details are now in `security-review.md` and the behavior changes in `4x-behavior-changes.md`.

- 4.4.0 is on npm from a06a0c8 (PR #639), with provenance. The four advisories are published with
  `patched_versions` 4.4.0; GHSA-x8mc and GHSA-8395 carry the CVSS 3.1 vector
  `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` (6.1, Medium) instead of the drafted High.
- Release notes are on the `v4.4.0` GitHub release. #604, #554, #553, #588, #597, #600, #616 and #618
  are closed; the drupal.org comment is posted. CodeQL alerts 1 and 4 are fixed and alert 7 is
  dismissed, so `main` has no open alerts.
- Left: step 9 when the CVE IDs arrive. Done since: PR #640; the README and site CDN snippets on
  jsDelivr (PR #641, then 4.5.0 in PR #643); a Packagist webhook. The cdnjs alternative snippet
  moved to the 4.6.0 docs cleanup (Phase 13).

Prepare in public (normal PRs, nothing about W1–W4):

- A release workflow (`.github/workflows/release.yml`) that publishes a `v*` tag to npm with npm
  trusted publishing, which adds provenance. It needs `id-token: write`, and it runs `npm test`
  before publishing.
- On npmjs.com, the maintainer adds that workflow as the trusted publisher for `jquery-form`. Then
  set publishing access to require 2FA and disallow tokens, and review the package's maintainer list.
- Review the four draft advisories: text, affected range (`<= 4.3.0`), credits, and any reviewer
  comments on the CVE requests. Don't wait for the CVE IDs (see Release train).
  - Reviewed 2026-11-07: GitHub has left no comments and assigned no CVEs. Rudloff is credited and
    accepted on both reports, and is a collaborator as their author (we invited no one). Their one
    comment points to the public drupal.org issue.
  - "Found during the Phase 8 security review" in GHSA-g7mw and GHSA-4w39 now reads "Found during a
    maintainer security review" (2026-11-07).
- Trial run of `release.yml` on `main` passed on 2026-11-06 (run 42311458706). The trusted publisher
  is set up on npmjs.com with publish permission only, not dist-tag. Publishing requires 2FA and
  disallows tokens, and the inactive maintainers were removed (2026-11-07).
- Merge the `docs-site-internal-docs` PR. The docs site served `docs/plans/`, `docs/research/`,
  `docs/agents/`, `docs/adr/` and `docs/metrics.md`; it now excludes them, so `security-review.md`
  isn't published on the site when the W1–W4 details move into it. After the merge, check that
  `https://jquery-form.github.io/form/plans/modernization/` returns 404.
  - The same PR (#636) unblocks docs-only PRs: `ci.yml` no longer uses `paths-ignore` on pull
    requests, and a `changes` job makes the required `test` and jQuery jobs skip their slow steps.
    When `phase-13` rebases onto it, `ci.yml` will conflict: keep the step gating on `test` and
    the jQuery matrix, and skip the new browser and end-to-end jobs with a job-level
    `if: needs.changes.outputs.code == 'true'` (they aren't required checks, so a skipped job is
    fine there).
- Check that the custom CodeQL query pack resolves its `codeql/javascript-all` dependency in Actions,
  since it couldn't be run there before release day.

Release day, in one sitting:

1. Rebase the local fix branch on `main`. Run `npm test`, the jQuery matrix, the probes, and the
   custom CodeQL query on `main` and on the branch.
2. On that branch:
   - Bump the version to 4.4.0 in `package.json`, `package-lock.json`, `form.jquery.json` and the
     `src` header, and rebuild `dist`.
   - Add the W1–W4 entries to `4x-behavior-changes.md`.
   - Move the W1–W4 details into `security-review.md`.
   - Update this plan, `coverage-findings.md` and `issue-triage.md`.
   - Add a 4.4.0 column to `docs/metrics.md`.
3. Push the branch, open the PR and merge it once CI and CodeQL pass.
4. Tag `v4.4.0` on the merge commit and push the tag. The workflow publishes to npm. Check
   `npm view jquery-form`, the provenance badge, jsDelivr, cdnjs (git autoupdate) and Packagist.
5. Set `patched_versions` to `4.4.0` on the four advisories and publish them. GitHub then publishes
   the GitHub Advisory Database entries, which feed `npm audit` and Dependabot. The CVE requests
   stay open and GitHub adds the IDs to the published advisories when it assigns them.
6. Publish the GitHub release notes, written from `4x-behavior-changes.md` but not copied: follow the
   public-text rule in `docs/agents/coding-standards.md` (no phases, no internal IDs such as `W1` or
   `D-09`, no links to `docs/research/`). Cite the GHSA IDs and say the CVE IDs are pending. The same
   rule applies to the issue and drupal.org comments in step 7.
7. Comment on and close #604, #554, #553, #588, #597, #600, #616 and #618. Comment on drupal.org
   #3607794. Credit Rudloff for W1 and W2.
   - Check that CodeQL alerts 1 and 4 closed. Dismiss alert 7 (`iframeTarget`) as "won't fix",
     linking finding 11 in `security-review.md`: the option is a developer-supplied selector.
8. Delete the local fix branch. Keep the probe copies until the modernization project ends: they
   keep checking the W1–W4 fixes through the 5.0 refactors.
9. When GitHub assigns the CVE IDs, add them to the 4.4.0 release notes, `security-review.md`,
   `4x-behavior-changes.md` and the drupal.org issue. Don't request IDs from another CNA meanwhile;
   a second request can produce duplicate CVEs.

## Release train: 4.4.0, 4.5.0, 4.6.0

Decided on 2026-11-06: ship without waiting for CVE IDs. The four CVE requests had no IDs and no
GitHub activity after 6 days, one finding is already public on drupal.org, and the GHSA IDs alone
drive `npm audit`, Dependabot and OSV. What waits for the CVEs: scanners that read only NVD, and the
CVE references in our own docs (Phase 11, step 9).

The local branches are stacked: `phase-10-advisories` (the W1–W4 fixes) is in `phase-12`, which is
in `phase-13`, which is in `phase-14`. So until the advisories are published:

- Push none of those branches and open no PR from them. Each one reveals the W1–W4 fixes.
- Public PRs to `main` stay limited to work that names no W1–W4 sink.

The order:

1. **4.4.0** (Phase 11). Done 2026-11-07, and the stacked branches are rebased (backups under
   `refs/backup/pre-4.4.0/`). Release day as above. Afterwards, rebase `phase-12` on `main` with
   `git rebase --onto main phase-10-advisories phase-12` if the fix commits were rebased or squashed
   on the way in, then rebase `phase-13` and `phase-14` the same way onto the new tips.
2. **Soak 4.4.0 for about a week** (until about 2026-11-14). Watch issues, npm downloads and the CDN builds. A regression goes
   out as 4.4.1 from `main` before 4.5.0, and `phase-12` rebases on it.
3. **4.5.0** (Phase 12). Push `phase-12` and open its PR; this is the first CI and CodeQL run for
   those commits, so leave time for fixes. Run the custom CodeQL query. Bump, tag and publish the
   same way as 4.4.0, without the advisory steps. Close PR #557 and the issues Phase 12 fixed.
   Done 2026-11-10 (PR #642, released three days into the 4.4.0 soak with no new issues); #545
   and #541 closed, #353 left open for 5.0.
4. **Soak 4.5.0 for a day or two** (decided 2026-11-10: 4.4.0 drew no issues, comments or
   regressions in its first three days). Release 4.6.0 once 4.5.0 shows no engagement either.
5. **4.6.0** (Phase 13). `npm test` on `phase-13` runs `suite-webkit`, so the release `verify` job
   now installs `chromium webkit` with `--with-deps`, as `ci.yml` does. Push `phase-13`; its
   Firefox, WebKit and end-to-end CI jobs run for the first time. Rehearse `release.yml` with
   `workflow_dispatch` on the branch before tagging, then release the same way as 4.5.0.
   - `phase-13` renames the matrix checks to `jQuery <version> on <browser>`, so the required checks
     on `main` (`jQuery 1.7.2`, `jQuery 3.7.1`, `jQuery 4.0.0`) never report and the PR stays
     blocked. Update branch protection to the new names (or a subset, such as the Chromium ones)
     when the PR's first run shows them.
   - Done 2026-11-14: `main` requires `test` and the nine `jQuery <version> on <browser>` checks.
     The end-to-end checks stay optional until they have a few weeks of clean runs (about
     2026-12-05); then add the nine `e2e on jQuery <version> on <browser>` checks too.
   - `ubuntu-latest` moved to 26.04 on 2026-11-14 and the Playwright cache restored a 24.04 WebKit
     that could not load its libraries. The cache keys now include the runner image (`ImageOS`).
   - Done 2026-11-26 (PR #644, merge commit a94d7c1, tag `v4.6.0`). The flaky-test fixes and the
     mutation testing came first; CI passed without a rerun. npm has 4.6.0 with provenance, and
     jsDelivr, cdnjs and Packagist serve it; the CDN SRI hashes match the published file. #544 is
     closed.
6. **5.0** (Phase 14) after 4.6.0. Cut `release/4.x` from the 4.6.0 tag first (ADR-0002).

Each release adds its column to `docs/metrics.md` and its section to the GitHub release notes.

## Phase 12: 4.x cleanup and rearchitecture (no breaking change)

Status (local `phase-12` branch): the test split and the characterization sweep are done; the form
members slice is done (`src/form-members.js`, see `docs/research/4x-behavior-changes.md`); the
Submission refactor is done (options, submission and transport modules, no behavior change). The
submission fixes are done (D-09, D-06, D-18, D-02, D-04, D-01, #541, and `requestFormat: "json"`
for #545; close PR #557 on release day). The iframe lifecycle slice is done (response reader, form post and
lifecycle modules behind the iframe adapter; D-08, D-07, D-16, D-22, D-21, D-33). The successful
controls slice is done (`src/successful-controls.js` behind formToArray and `$.fieldValue`; SER-18,
SER-24, D-34, D-03, D-28, the disabled fieldset and form owner spec alignment, D-26). The submitter
slice is done (`src/submitter.js`; controls named `clk`, `SubmitEvent.submitter`, file names in
GET uploads). The ajaxForm binding slice is done (`src/ajax-form.js`, `delegation: "<selector>"`,
`ajaxFormUnbind(selector)`, the `delegation: true` warning). The deprecation warnings, the
`target` sanitizing, trusted-options and iframe-response docs, and the remaining fixes (D-12, D-13,
D-15, D-19, D-25, the FormData `beforeSend` veto) are done; IFR-122/123 were left `it.fails` and
are fixed in Phase 13.
Phase 12 shipped as 4.5.0 on 2026-11-10 (PR #642), three days into the 4.4.0 soak with no new
issues. CodeQL alert 10 (the `target` lookup, moved by the module split) was dismissed as "won't
fix"; 4.6.0 removes the lookup. The custom CodeQL canary flagged every reopened W1–W4 sink.

- First, split `test/test.js` into one file per area under `test/suite/`. Move tests only: names and
  bodies stay the same, and the test-name list before and after must match.
- Then pin current behavior with characterization tests, area by area, before any refactor. Bugs
  found this way become `it.fails` records that describe the wanted behavior.
- Split `src/jquery.form.js` into source modules: serialization, field helpers, XHR transport, iframe transport, `ajaxForm` binding. Rollup emits the same `dist` files, and the surface tests prove ADR-0001 still holds.
- Lower the complexity hot spots that `npm run metrics` reports.
- Additive options and docs:
  - `delegation: "<selector>"`
  - the `target` sanitizing recipe with `dataFilter`, and the trusted-options list
  - iframe response requirements
  - a clear error on jQuery slim (#541)
- Decide on the JSON body (#545, PR #557).
- Deprecation warnings (under `debug`, and in the docs) for everything Phase 14 removes.
- Phase 10 observations: the iframe `beforeSend` veto never fires `ajaxStop` (fixed by the iframe
  lifecycle slice), and controls named `ownerDocument` or `getElementsByTagName` still shadow
  those form members (fixed by the form members slice).
- Run the custom CodeQL query on every refactor branch, so moved code can't reopen a W1–W4 sink.

Phase 12 ships on its own as 4.5.0, the same way as Phase 11 but without the advisory steps. A separate
release lets consumers stay on 4.5.0 if they depended on a behavior Phase 13 changes, however much it
looked like a bug.

## Phase 13: 4.x test hardening (no breaking change)

The Phase 12 sweep found about 70 bugs that 100% coverage had not caught. This phase adds kinds of
tests the suite does not have yet, so that 5.0 starts from a stronger contract. It runs on the local
`phase-13` branch, which starts after the 4.5.0 cut on `phase-12`.

Status: done, and released as 4.6.0 on 2026-11-26 (PR #644). All five kinds of tests
are in place and pass on Chromium, WebKit and Firefox with jQuery 1.7.2, 3.7.1 and 4.0.0; no
`it.fails` remain. The mutation score went from 91.67% to 94.34%. The new WebKit, Firefox and
end-to-end CI jobs ran for the first time on the PR and pass. The `release.yml` rehearsal on the
branch passed on 2026-11-14 (run 43600588779), and the version bump is in.

Before the merge (2026-11-26): the flaky iframe abort test and a timeout test that raced a slow
response now wait on events, and the XSS tests check that no payload HTML is parsed. The suite
passed 60 matrix runs in Docker (10 normal and 10 on 1 CPU per jQuery version, 3 browsers each) and
a run with every fixture delayed 1 s. Mutation testing (`docs/research/mutation-testing-4.6.0.md`)
covered the lines changed since v4.5.0, 21 hand-written mutants (the W1–W4 sinks, timers, event
order) and the whole source on three jQuery versions. It added 12 tests; every survivor left is
debug text, old-browser code or equivalent. CI on #644 is green without a rerun.

- Run the suite on Firefox and WebKit as well as Chromium (Vitest browser instances), locally and in
  CI.
- Oracle tests for serialization: generate varied forms and compare `formToArray` with the browser's
  own `new FormData(form)`. Each difference is a pinned 4.x quirk, recorded for 5.0, or a bug.
- End-to-end tests with Playwright Test and a small Node server that parses multipart and urlencoded
  bodies, through all three transports: what actually reaches the server.
- Published-file tests: load the `dist` files the way consumers do (script tag, AMD, ESM, CommonJS)
  with several jQuery versions and run a smoke set of behaviors through each.
- A one-off mutation-testing report (Stryker, local only) to find where the suite is weakest, then
  tests for those gaps.
- Every new test runs against both the 4.4.0 code and the Phase 12 code. A test that passes on both
  is a contract 5.0 must keep or break on purpose. A test that passes only on Phase 12 must match an
  entry in `docs/research/4x-behavior-changes.md`; otherwise it is reported as a bug or an
  undocumented change.

Fixes in 4.6.0 (each in `docs/research/4x-behavior-changes.md`, Phase 13):

- Lone surrogates become U+FFFD instead of throwing `URIError`: in form fields (`formSerialize`,
  `fieldSerialize`, urlencoded bodies, the iframe submitter), and in `data` and `extraData` keys and
  values on every transport.
- Spaces encode as `+` on every jQuery version.
- An iframe response that cannot be parsed rejects with `parsererror`, and an error status that
  also fails to parse reports its `statusText` (IFR-122/123, the last `it.fails`).
- The iframe upload leaves out a clicked button disabled by its fieldset.
- Packaging: no `browser` field (bundlers get the module build; `jsdelivr` and `unpkg` name the
  minified build), `LICENSE-MIT` published, and the CommonJS factory uses the window it is given.
- Docs: a Deprecations section in `docs/api.md` listing each warning and its replacement.
- `target` and `iframeTarget` strings are only selectors (`$(document).find()`), never parsed as
  HTML. Decided on 2026-11-08: alert 7 had been dismissed as "won't fix" under finding 11, but
  unlike `url` or `iframeSrc` this risk is not inherent, and the fix keeps every selector's result.
  It goes in 4.6.0, not 4.5.0, in case a consumer relied on an HTML string. Closes CodeQL alert 10,
  the alert 7 lookup reopened by the 4.5.0 module split (it shows on PR #642).
- Dev only (not in the published package): an npm `overrides` entry pins `minimatch` to 11.0.4
  for Dependabot alert 97 (CVE-2026-118764, through eslint, which still requires `minimatch@^10`
  and has no patched 10.x). Remove the override once eslint allows minimatch 11. The same commit
  went to `main` early in PR #638, after Dependabot reopened the alert there as alert 98; the
  `phase-13` rebase drops its copy as already applied.

Docs, README and repository cleanup, with 4.6.0. Decided on 2026-11-10. Everything lands as
commits on `phase-13` and ships in the 4.6.0 PR, so the stacked branches rebase once. Only the
`package.json` items change the published package.

README (a landing page; the docs site is the one reference):

- Cut the API, Options and Utility Methods sections and link to the docs site pages instead.
  Keep overview, installation, quick start, compatibility, security, contributing and license.
- Add Installation and Usage: `npm install jquery-form`, the module import (it registers the
  plugin and needs jQuery importable), the CommonJS `(root, jQuery)` factory, and a script tag
  after jQuery.
- Point Download at npm, the CDN and the release tag, not at `dist/` on `main`, which will hold
  5.0 code once Phase 14 lands.
- Rewrite File Uploads (it says "As of today (March 2012)"): FormData by default, `iframe: true`
  as the fallback, and fix its XMLHttpRequest Level 2 link (the URL is wrapped in quotes).
- Compatibility: name the tested browsers (Chromium, Firefox and WebKit), and say that 5.0 will
  need jQuery 3.5 or later, linking #629.
- Add a cdnjs snippet back as the alternative to jsDelivr, once cdnjs serves the current version.
  Check its sha384 against the published `dist/jquery.form.min.js` first.
- Switch `http://` links that have an `https://` version.
- Bump the CDN snippets in `README.md` and `docs/index.md` to 4.6.0 with the new SRI hash.

Docs site:

- `docs/_layouts/default.html`: remove the html5shiv script (its Google Code URL is a 404), the
  IE conditional comment, the `X-UA-Compatible: chrome=1` meta (Chrome Frame), and the Universal
  Analytics block, which never renders because `_config.yml` sets no `google_analytics`.
- `docs/index.md`: add npm installation to the Quick Start, next to the CDN snippet.
- `docs/faq.md`: point "Run unit tests" at `CONTRIBUTING.md` instead of the 3.x test page on
  malsup.com, and replace the `view-source:` progress demo link.
- Checked every malsup.com link on 2026-11-10. All serve content except
  `jquery.malsup.com/form/` (an empty page; `CONTRIBUTORS.md` now links `malsup.com/jquery/form/`).
  The FAQ comparison and code-sample links and the examples' progress demos point at the docs
  site instead; the demo endpoints stay, over https, until the 5.0 examples rewrite.

Package metadata (in the 4.6.0 package):

- `license`: `(LGPL-2.1-or-later OR MIT)` instead of the deprecated SPDX `LGPL-2.1+`; the same in
  `bower.json`, `composer.json` and `form.jquery.json`. Same terms.
- `homepage`: the docs site, https://jquery-form.github.io/form/.

Repository:

- Replace `.github/issue_template.md` (it asks for a "LoadJSON" version) with an issue form that
  asks for the plugin, jQuery and browser versions, and a `config.yml` that sends security
  reports to `SECURITY.md`.
- Add `.github/dependabot.yml` version updates for GitHub Actions and grouped npm dev
  dependencies (only alerts are on today).
- Keep `CODE_OF_CONDUCT.md` at Contributor Covenant 1.4 (decided 2026-11-10, reversing the 2.1
  update planned the same day). 2.1 needs a private reporting contact, the project has no email
  address, and GitHub has no private conduct channel to maintainers: private vulnerability
  reporting is for security issues, and "Report content" goes to GitHub, not to the maintainer.
  Revisit if the project gets a contact address.
- Delete the root `_config.yml`; Pages builds from `/docs`. Fix the broken headings in
  `CONTRIBUTORS.md`.
- Close #544 at the release: both items it lists are resolved, and #353 tracks the rest.

Release Phase 13 as 4.6.0, the same way as 4.5.0. Fixes found here go in 4.6.0, not 4.5.0. Cut `release/4.x` when 5.0 lands (ADR-0002).

## Phase 14: 5.0 (breaking)

Status: steps 0-8 are done. `5.0.0-beta.1` is on npm on `next` (2026-11-27, release run 45936197202,
with provenance; `latest` stays 4.6.0), from the `v5.0.0-beta.1` tag on the tip of PR #646
(`5349abd`). The PR stays open until 5.0.0, at least two weeks later; merge it with a merge commit
so the beta tag's commit stays in `main`'s history.

Rebased once onto `main` after the 4.6.0 merge (B3), on 2026-11-26; the old tip is
`refs/backup/pre-4.6.0-rebase/phase-14`. 47 commits remain: the metrics dedupe commit came out empty,
since `main`'s table has no duplicate columns. The 4.6.0 tests were adapted where 5.0 changes the
behavior they pin: an HTML string passed to `selectorOption` throws a selector syntax error instead of
matching nothing, and the iframe read-error test stubs `contentDocument` now that `getDoc` reads only
that. The `.git-blame-ignore-revs` entry for the trailing-comma sweep points at its new SHA.
After the rebase, `npm test`, the suite on jQuery 3.5.0, 3.7.1 and 4.0.0 in Chromium, WebKit and
Firefox, and the end-to-end tests pass.

Work runs on the local branch `phase-14`, in the worktree `form-phase-14`. The branch is guarded like `phase-13` and is not pushed. After v4.6.0 is tagged and merged to `main`, rebase `phase-14` onto `main` once (B3). The migration guide `docs/migrating-to-5.md` gets an entry for each change, written in the same commit as the change (R3). Release as `5.0.0-beta.N` on the `next` dist-tag, at least two weeks before 5.0.0, and cut `release/4.x` from v4.6.0 just before the merge (R1, R2).

Platform (P1-P5):

- jQuery moves from `dependencies` to `peerDependencies: { "jquery": ">=3.5.0" }`, with no upper bound. `bower.json` and `composer.json` get the same range.
- The jQuery matrix is 3.5.0 (the floor, the devDependency alias `jquery35` = `npm:jquery@3.5.0`, like `jquery4`), 3.7.1 and 4.0.0. 1.7.2 leaves.
- On jQuery < 3.5, `ajaxSubmit` and `ajaxForm` throw `jquery.form 5 needs jQuery 3.5 or later; this is <version>` before any event. Nothing throws at load (X2).
- The browser floor follows jQuery 4: current Chrome, Edge, Firefox (and ESR) and Safari. Syntax is ES2020 (Chrome/Edge 80+, Firefox 78+, Safari 14+), enforced by `ecmaVersion: 2020` in the ESLint `src` block and a lint pass over `dist/`. `SubmitEvent.submitter` stays feature-detected.
- No transpile: `dist` is the source as written, wrapped. Prettier drops `trailingComma: "es5"` for the default `"all"`. The format sweep is its own `style:` commit, added to `.git-blame-ignore-revs`, and `docs/agents/coding-standards.md` loses "revisit for v5".
- Syntax modernization comes after the removals, as one mechanical `refactor:` commit (`no-var`, `prefer-const`, safe `object-shorthand`). No arrow conversion where `this` or `arguments` is used, no module restructuring, no behavior change, the rules stay on for `src`.
- CI browsers (current Playwright Chromium, WebKit and Firefox) are newer than the floor. The syntax lint guarantees the floor and the README names it. No old-browser CI and no `engines` field.

Packaging (K1-K5, ADR-0003):

- The `exports` map is:

  ```json
  {
    ".": {
      "module": "./dist/jquery.form.mjs",
      "import": "./dist/jquery.form.mjs",
      "default": "./dist/jquery.form.js"
    },
    "./dist/*": "./dist/*",
    "./package.json": "./package.json"
  }
  ```

  `main`, `module`, `jsdelivr` and `unpkg` stay. Node `import "jquery-form"` now loads the `.mjs` (it needs a DOM at import) instead of the CommonJS factory, so the dual-package hazard applies. `manifests.test.js` checks that every key resolves.

- The `module` condition comes first, so bundlers that read `exports` resolve both `import` and `require` to the module build, as `module` did in 4.x. Node ignores it (`require` gets the `.js`, `import` the `.mjs`), so the hazard is limited to Node projects. A test resolves with `--conditions=module` (K1a, decided at the step 5 review).

- `src` is no longer published: there is no `./src/*` key, and `src` leaves `files` (the source map embeds `sourcesContent`). Deep `jquery-form/src/...` imports move to `dist/jquery.form.mjs`.
- Every classic surface stays as it is (ADR-0001 holds): the script-tag global, anonymous AMD with no value, and the CommonJS `(root, jQuery)` factory including its `require('jquery')(root)` branch. The files are `jquery.form.js`, `jquery.form.min.js` with its map, and `jquery.form.mjs`.
- New ADR-0003 "5.0 package surface": peer `>=3.5.0`; the `exports` allowlist (adding a key is minor, removing one is major); `src` unpublished; no transpile and an ES2020 floor; the dual-package hazard is accepted and documented. It extends ADR-0001 and lands with the packaging commit.
- Keep `bower.json` and `composer.json`, changing only the jQuery range. Delete `form.jquery.json` (plugins.jquery.com has been read-only since 2014).

Removals (X1-X6):

- jQuery < 3 paths (X1): `hasProp` (and `createIframeTransport`'s `hasProp` parameter), `$.fn.attr2`, `$sel.selector` and `.context` and the DOM-not-ready queue in `ajaxForm`, the `typeof jQuery.fn.on` and `typeof jQuery.fn.offset` checks, `deprecateOldJQuery`, and the `legacy-jquery` suite file (`?without-prop` reload). The internal `forms.property` reader stays, for form-member shadowing.
- IE, Opera and EdgeHTML shims (X3): `attachEvent`/`detachEvent`, `execCommand("Stop")`, the `javascript:false` iframe src and its `MSIE|Trident` sniff, the `MSIE` file-input clone in `clearFields`, the option `attributes.value.specified` shim, the `Edge|Trident` sniff in successful-controls, `window.opera.postError` in `log`, the Opera empty-body retry in the iframe response, and the IE8 fallbacks in `getDoc` (keep one path). `navigator` leaves the classic root shadowing if nothing else uses it. One grouped guide entry.
- Deprecated API (X4): delete `$.fn.clearInputs` and `$.fn.attr2`. The `closeKeepAlive` option is ignored like any unknown `$.ajax` option. The dead `datetime` leaves the `clearFields` type list (no guide entry). Each guide entry points at the replacement in the `docs/api.md` Deprecations section.
- `enable` and `selected` stay, unchanged and not deprecated (X5).
- Remove `deprecate()` and its tests once nothing calls it. Reintroduce it in 5.x if needed (X6).

Iframe transport (I1-I3, I6):

- The iframe transport stays in 5.0 as an explicit opt-in (`iframe: true`). Removal is decided for 6.0 with real feedback (I1).
- It runs only with `iframe: true`. The `fileapi`/`formdata` detection is deleted, so files and multipart always use FormData. `iframe: false` is the default and a no-op. The "chosen automatically" deprecation goes (I2).
- Iframe `.done` and `.then` receive `(data, "success", xhr)` with the parsed data, like `success`, `ajaxSuccess` and `$.ajax`. They used to receive `responseText` (I3).
- The iframe rejection arguments stay as in 4.x and are documented in `docs/options.md`: an abort rejects `(xhr, "aborted", status)` where `$.ajax` gives `(jqXHR, "canceled", …)`, and a `beforeSend` veto rejects with no arguments (I4a).
- Feedback on a possible 6.0 removal goes through issue #629, the migration guide, `docs/options.md`, the beta and release notes, and the Phase 14 PR description. Each says: "the iframe transport is kept in 5.0 and may be removed in 6.0; if you use `iframe: true`, comment on #629 with your use case" (I6). The user posts anything on GitHub.

Delegation (L1-L3):

- `delegation: true` throws from `ajaxForm`: `jquery.form: delegation needs a selector in 5.0, e.g. delegation: "form.ajax"`. It does not warn and fall back to native submits (L1).
- A non-empty string is the selector, as before. `""` and any truthy non-string throw. Other falsy values mean no delegation (L2).
- Remove `bindDelegated`, the always-on `warnUnscoped` warning and the `closestMatch` fallback walk. `ajaxFormUnbind()` and `ajaxFormUnbind(selector)` are unchanged, and the selection is still ignored when a selector is given. The docs example is `$(document).ajaxForm({ delegation: "form.ajax" })`, noting that any selection works (L3).

Serialization and spec gaps (N1-N11). Every "match native" item deletes its class from the oracle and e2e allowlists and lands with a test that fails on 4.6.0 and a guide entry:

- Native tree order in every mode: `form=` controls outside the form sit at their document position (D-17, SEM-ORDER), and a clicked image's coordinates sit at the image's position (IMG-ORDER) (N1).
- Candidates are submittable elements only (`button`, `input`, `select`, `textarea`), and a form owns what the HTML spec says. Non-form subjects (fieldset, div, document) still collect submittable descendants in tree order (N2).
- Remove the `semantic` option fully (code, `docs/options.md`, README). Passing it is ignored like any unknown option, with no error. The guide says 5.0 always serializes in native tree order, which `semantic: true` approximated (N3).
- A clicked image sends only `name.x` and `name.y`; the `name=value` pair is dropped (IMG-VALUE, N4). An unnamed clicked image sends `x` and `y` (IMG-UNNAMED, N5).
- `input` and `textarea` with `dirname="x"` send `x=ltr` or `x=rtl`, from `el.matches(":dir(rtl)")` where supported, else `getComputedStyle(el).direction` (N7).
- A hidden `_charset_` input sends `"UTF-8"` (N8).
- FormData uploads send an empty file input as `new File([], "", { type: "application/octet-stream" })`. `formSerialize` and urlencoded bodies keep `name=`. PHP sees an empty `$_FILES` entry (error 4) instead of a `$_POST` field (N9).
- Iframe submitter fields are in tree order: the hidden input goes right after the submitter, with the submitter's `form` attribute when it is outside the form. The e2e IFRAME-SUBMITTER normalization goes (N10). Two side effects are accepted and named in the guide: a `data` or `extraData` key named like the submitter now sends both fields, as XHR does, and `extraData` seen by ajax events and callbacks no longer holds the submitter field (N10a).
- A non-form subject (a `div` or the document) keeps 4.x for an image button that was not clicked: it still sends `name=value`. A kept-contract test pins it (N2a).
- Kept as in 4.x:
  - SUBMIT-LABEL: a clicked `<input type=submit>` without a `value` still sends `""` until 5.x, because the native label is localized and cannot be read from script. `new FormData(form, submitter)` fixes it in 5.x. The oracle keeps the class with a 5.x note (N6).
  - FILES-MULTIPART (a file input makes the body multipart without `enctype`) and the GET action's query being kept. Both stay allowlisted and pinned, and `docs/options.md` names them as deliberate (N11).
- No 4.x warnings for these changes. The guide gets one "What your server receives" section with before and after request bodies (N12).

Field values and selector options (F1, F3):

- `formToArray`, `formSerialize`, `fieldSerialize` and `ajaxSubmit` use the internal successful-controls module. `$.fieldValue` and `$.fn.fieldValue` stay public readers with the same results, but replacing `$.fieldValue` no longer changes what is sent. The extension point is jQuery `valHooks`. The guide has a `valHooks` example. 4.6.0 warns about the override under `debug` (F2).
- Selector options never parse HTML. A string `target` goes through `jQuery.find(target)`, a string `iframeTarget` through `jQuery.find(iframeTarget, ownerDocument)`, and a string `includeHidden` through `jQuery.filter(includeHidden, [el]).length`. Elements and jQuery objects pass through. Positional pseudos in `includeHidden` test the element alone. This removes the HTML parsing of selector options that `security-review.md` finding 11 describes, including the `iframeTarget` lookup behind CodeQL alert 7, and the trusted-options note for finding 11 narrows to `url`, `action` and `iframeSrc`.

Docs examples and FAQ (added 2026-11-10, after the 4.5.0 release). Done 2026-11-26, before the beta:
`docs/examples.md` is rewritten for the 5.0 API with no demo server (each example names the
response it expects, and the PHP snippets escape their output), and `CONTRIBUTING.md` describes
`release.yml`, the `src` modules and the WebKit install. Step 7 updated the README for the peer dependency; its jQuery 4 line now names 4.x users.

- `docs/examples.md` posts to Mike Alsup's demo scripts on malsup.com (`dummy.php`,
  `json-echo.php` and others) and loads `submit.gif` from there. Replace them
  with examples that need no third-party server, or document the expected response instead.
- Rewrite the examples for the 5.0 API: jQuery 3.5 or later, `delegation: "<selector>"`,
  `iframe: true` for uploads without `FormData`, and no deprecated methods.
- Replace the retired `docs.jquery.com/Plugins` link in the examples. 4.6.0 replaces every
  malsup.com documentation link (FAQ comparison, unit tests, code samples, progress demos) with
  the docs site's own pages, drops the README pointer to the malsup.com docs for 3.51 and older,
  and loads the demo endpoints over https until this rewrite.
- README: the jQuery 4 compatibility notes, which change with the peer dependency.
- `CONTRIBUTING.md` (deferred from 4.6.0 by the user, with or after 5.0 as part of a larger docs
  revamp): the Releases section still says maintainers publish by hand and CI does not publish
  (`release.yml` publishes from a tag with provenance), the workflow says to edit
  `src/jquery.form.js` (now split into modules), and setup installs only Chromium although
  `npm test` also runs WebKit.

Steps, one sub-agent per step, each reviewed by the main session before the next (W1):

0. Plan and guide skeleton on `phase-14` (docs): this section and `docs/migrating-to-5.md` with its table header.
1. F2 on `phase-13` (4.6.0): the `$.fieldValue` override warning, docs and the 4.6.0 release-notes draft. Then rebase `phase-14` onto it.
2. Platform floor: peer `>=3.5.0`, the K5 ranges, delete `form.jquery.json`, the 3.5.0/3.7.1/4.0.0 matrix (CI, `scripts/fetch-jquery.sh`, Docker), and the X2 version error.
3. Removals: X1, X3, X4 with X6, L1-L3 and I2, one commit per group, each with its guide entry.
4. Syntax: the Prettier sweep (P3), the `refactor:` commit (P4), and `ecmaVersion: 2020` on `src` and `dist` (P2).
5. Packaging: K1-K4 (`exports`, `src` unpublished, ADR-0003) and the published-file tests (each `exports` key, Node `import` resolves to the `.mjs`).
6. Behavior changes, one commit each: I3, F1, F3, N1 with N2 and N3, N4 with N5, N7, N8, N9, N10.
7. Docs and drafts: README, `docs/options.md`, `docs/api.md` (the I6 iframe feedback note, the N11 deliberate quirks), the complete guide, the notes-folder drafts (revised #629 body, I6 texts, 5.0 beta release notes), the "5.0" metrics column and the plan status.
8. Final verification: all checks on the tip and the W3 run against 4.6.0.

Steps 0-8 are done. Step 8 (2026-11-26, on the rebased tip):

- All per-commit checks pass: lint, Prettier, build with `dist` unchanged, both Vitest runs with 100%
  coverage, the suite on jQuery 3.5.0, 3.7.1 and 4.0.0 in Chromium, WebKit and Firefox, and
  `npm run test:e2e` on the same nine combinations.
- W3: the 5.0 suite against the 4.6.0 build (`v4.6.0` source with the 5.0 tests) fails 123 tests,
  and `diagnostics.test.js` does not load (it imports `requireJQuery35`). The set is the same on all
  three jQuery versions, and every failure maps to a guide entry. The 70 oracle failures come from
  the six allowlist classes 5.0 drops (CHARSET, DIRNAME, IMG-VALUE, IMG-UNNAMED, IMG-ORDER, SEM-ORDER)
  and the removed `semantic` comparison. The other 986 tests pass on both builds: kept contracts.
- Stryker over `src/*.js` on jQuery 3.7.1: 95.51% (1969 mutants, 88 survived), above the 94.34% floor. After the architecture review changes: 95.51% again (1967 mutants, 88 survived, none in the new code), and the floor is raised to 95.0%.
- The 5.0 metrics column is re-measured.
- The CodeQL canary (CodeQL 2.27.6, the version CI uses; the canary script was rebuilt because the
  Phase 12 copy was lost) scans `src` as the CodeQL workflow does, with `security-extended` and the repo's
  query pack. The 5.0 source has no results from either. Each reopened sink is flagged: both W1
  sinks, W2, W3 (the 4.x form-id selector injected, since 5.0 has no such code), W4, and
  `selectorOption` parsing HTML (by `security-extended`'s unsafe jQuery plugin query, as alerts 7 and
  10 were).

Before the 5.0 release:

- ~~Merge the test helpers `countParsedHTML` and `countHtmlParsed`~~ — done 2026-11-26: one async
  `countParsedHTML(run, marker)` in `test/suite/helpers.js` hooks `jQuery.parseHTML` and
  `jQuery.htmlPrefilter` (a parse inside `parseHTML` counts once), counts only strings containing
  `marker` when one is given, and returns `{ count, error }`. Tests that expect no error assert it.
- ~~An architecture review with the improve-codebase-architecture skill~~ — done 2026-11-26. It
  ranked seven candidates. Because `src` is no longer published (K3), the module layout is internal:
  a restructure can land in any 5.x minor without a guide entry, so only a change to what is sent
  had to be settled before the beta. Done before the beta:
  - The submitter's `dirname` field comes from the same rule on both wires. `submitterFields`
    moved from `submitter.js` to `successful-controls.js`, and it and `addCandidate` share
    `withDirname`. Before this, an `iframe: true` upload dropped a clicked submit input's
    direction, which the XHR transport sent (an N7 gap). A test fails on 4.6.0, and the guide's
    `dirname` entry names the iframe case.
  - `filtering` on an iframe upload: pinned by a kept-contract test (the browser posts the form's
    own controls, as in 4.x) and documented in `docs/options.md` under `filtering` and `iframe`,
    with the `beforeSubmit` fields-array case that was already pinned.
  - The field helpers (`fieldSerialize`, `fieldValue`, `clearForm`, `clearFields`, `resetForm`,
    `enable`, `selected`) moved from `jquery.form.js` to `src/field-helpers.js`. The entry still
    registers them on `$.fn` in the same order, and they still call each other through `$.fn`.
    The `dist` wrappers and exports are unchanged; only the code order inside changed.

  Deferred to 5.x (listed under 5.x below, with reasons).

- ~~A polish pass over the public docs~~ — done 2026-11-26 (user's request). README: a "New in
  5.0" section, current copy and code style, 4.x pointers in one Compatibility bullet. Site: the
  migration guide is in the menu; the API page documents `formToArray`, `enable`, `selected`,
  `$.fieldValue` and debug output; Form Fields replaces the dead demo with a results table
  (computed with the built plugin); the FAQ and Getting Started are rewritten; `options.md` gains
  `includeHidden`, describes `dataType` as parsing, not evaluating, and drops the internal
  `extraData` from Trusted options. `SECURITY.md`: 5.x supported, 4.x "best effort" with no set
  period (user's decision, no concrete guarantee), and the guide says the same.
- ~~Publish betas on `next`~~ — done 2026-11-26. `release.yml` picks the dist-tag in the verify
  job: a pre-release goes to `next`, a stable version of a lower major than `latest` to
  `v<major>`, anything else to `latest`; a stable version below `latest` in the same major fails
  the job. The publish job runs `npm publish --tag`. Checked on eight version pairs locally; the
  first real run is the beta. The version is `5.0.0-beta.1` (`package.json`, the lockfile, the
  `src` banner and `dist`).
- When `release/4.x` is cut from `v4.6.0` (R2), cherry-pick the `release.yml` dist-tag commit onto
  it first. Its copy publishes with a plain `npm publish`, which would move `latest` back to 4.x.
- ~~Beta release~~ — `5.0.0-beta.1` published 2026-11-27; checked: dist-tags, the `>=3.5.0` peer
  dependency, the SLSA provenance attestation, and the published `dist` byte-for-byte against the tag.
  Left: post the #629 body and the release notes (drafts at the root of the `form` checkout).
  Steps as done, by the user unless noted: remove the `do-not-push` guard, push `phase-14` and
  open the Phase 14 PR with the I6 text (Claude can do these on the user's word); post the
  revised #629 body and the beta notes; push the `v5.0.0-beta.1` tag on the PR tip and approve
  the `npm` environment. Then `npm dist-tag ls jquery-form` must show `latest: 4.6.0` and
  `next: 5.0.0-beta.1`. Later betas bump to `5.0.0-beta.N` the same way.
- At the 5.0.0 release (not the beta): point the README and `docs/index.md` CDN snippets at
  5.0.0, with SRI hashes checked against the published `dist/jquery.form.min.js`.

Test rules:

- The oracle drops each allowlist class that an N item changes. CRLF, USV, SUBMIT-LABEL and the N11 quirks stay. E2E runs on jQuery 3.5.0, 3.7.1 and 4.0.0, with IFRAME-SUBMITTER and EMPTY-FILE removed. The published-file tests gain `exports` cases, Node `import` resolving to the `.mjs`, and a failing deep `src` import, and the 1.7.2 cases go. One local Stryker run at step 8 must not score below 94.34%. From the architecture review on, a local Stryker run over `src/*.js` on the Chromium suite with jQuery 3.7.1 must not score below 95.0% before a release, and a run over the changed `src` lines (`MUTATE_RANGES`, as in `docs/research/mutation-testing-4.6.0.md`) leaves no survivor that is not killed by a new test or listed as equivalent. The ignored probe copies are kept (W2).
- This replaces the Phase 13 rule that every new test passes on both builds. Every behavior change has at least one test that fails on the 4.6.0 build (the `phase-13` tip, in a detached worktree removed afterwards) and a guide entry. At step 8 the whole 5.0 suite runs against that build. Every failure maps to a guide entry. A test that passes on both is a kept contract. Removed or edited tests are named in commit bodies (W3, R4).

Per-commit checks (W4):

- Lint and Prettier (probes excluded), build, both Vitest runs, the jQuery matrix (3.5.0 and 4.0.0 through `JQUERY_FILE`), and the CodeQL canary.
- Per step: `npm run test:e2e` and Docker Firefox.
- Metrics: a "5.0" column in `docs/metrics.md` at step 7, measured the same way. The supported jQuery row reads 3.5.0-4.0.0.

Out of 5.0 (W5): `SubmitEvent.submitter`, `new FormData(form, submitter)`, type declarations and the promise API stay in 5.x.

## 5.x

- Use `SubmitEvent.submitter` instead of the click-capture `clk` properties. It replaces the capture that #588 fixed in 4.4.0.
- Use `new FormData(form, submitter)`. It also gives the browser's default submit label for a clicked `<input type=submit>` without a `value` (N6).
- Ship type declarations generated from JSDoc, and keep the source in plain JS.
- Add a promise-friendly API alongside chaining.

Architecture, from the 2026-11-26 review (none of these changes what is sent, so none blocks 5.0):

- Capture the submitter once in `prepare` and carry it in the Submission, so serialization and
  both transports take it as an argument instead of reading the 100 ms store. Do it with
  `SubmitEvent.submitter`, which needs the same seam. The iframe path still reads the submitter's
  value as `el.value`, while XHR reads it through `valueOf` (`valHooks`); settle that here.
- A request-encoding module: the fields, `data` and the submitter go in, and one wire comes out
  (urlencoded body or URL query, JSON, FormData, the iframe's hidden inputs). Today four modules
  each build a wire (`submission.js` `extraQuery`/`queryPairs`/`jsonBody`/`encode`,
  `successful-controls.js` `urlencode`, `xhr-transport.js` `deepSerialize`/`sendFormData`,
  `iframe-post.js`), `wellFormed` is called at five sites, and `defineKey` duplicates `setKey`.
  The oracle could then check every wire. Deferred because `new FormData(form, submitter)`
  reshapes this module; doing it first would mean doing it twice.
- A transport seam with two adapters, XHR and iframe: settings merged once (written three times
  now), a payload from the encoding module, and `chooseTransport` reading the collected fields
  instead of querying the DOM again. `sendAjax` goes. Depends on the encoding module. Risk: the
  `options` object `form-submit-notify` receives shows the transports' writes (the FormData path
  sets `options.data = null`), so a change there is observable and needs a guide entry. The
  promise API would sit at this seam.
- Remove the one-adapter seams: `createSubmission(forms, serialization)`,
  `createIframeTransport(forms)` and `createSuccessfulControls()` each have one adapter, and no test
  substitutes them. Fold `formAttribute` and `formProperty` into `form-members.js` (X1 keeps the
  property reader) and import directly. Low risk, low value; a companion to the field-helpers move.
- Only if 6.0 keeps the iframe transport (I1): deepen `iframe-post.js` (seven exports, one caller
  that runs the save, set, add, submit and restore sequence) into one post operation.
- Not planned: separating the derived request from the caller's `options` object. `prepare`,
  `deliver` and the transports write to it, and `beforeSubmit`, the events and
  `submission.test.js` observe those writes. It would break callers for little gain.

## Metrics (throughout)

- `docs/metrics.md` is the committed record of before-and-after numbers, used for the v4 and v5 release announcements.
- The before column is the v4.3.0 baseline. Add a column whenever a phase changes a metric (at minimum after Phase 3, Phase 5, Phase 6, each 4.x release, and 5.0).
- Track: test count, suite wall time, full `npm test` time, coverage (lines, branches, functions, statements), minified and gzipped size, `npm audit` counts, number of dev deps, supported jQuery versions tested, CI duration, and open issues and PRs.
- Measure the same way each time, and note the command and machine in the file.

## Conventions throughout

- Conventional Commits, 1-3 lines, no trailers.
- Edit source, never `dist/`.
- Flag any change that contradicts ADR-0001 explicitly.
