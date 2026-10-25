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
    status: pending
  - id: prettier-sweep
    content: "Refactor group: Prettier format sweep as its own commit, no behavior changes"
    status: completed
  - id: test-rewrite
    content: "Refactor group: migrate/rename existing tests to BDD names and AAA shape, behavior unchanged"
    status: pending
  - id: coverage
    content: Close coverage gaps to 100% with new tests and enforce threshold in npm test
    status: pending
  - id: deps-modernize
    content: Dependency upgrades, jQuery version matrix, npm audit, manifest checks
    status: pending
  - id: metrics
    content: "Keep docs/metrics.md current: before/after numbers (test time, coverage, test count, bundle size, audit, deps) at each phase and for the v4 and v5 releases"
    status: in_progress
  - id: triage
    content: Triage GitHub issues/PRs via gh into prioritized backlog
    status: pending
  - id: review
    content: Architecture and vulnerability review with findings doc and issues
    status: pending
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
2. ~~Reconcile branches, rename to `main`, prune, protect (per ADR-0002)~~ — done
3. ~~Runner/bundler prototype~~ — done (`docs/research/runner-bundler-prototype.md`)
4. ~~Baseline (Phase 1)~~ — done (`docs/research/baseline.md`)
5. ~~Grill session: Prettier (Phase 2)~~ — done; decisions below
6. ~~Architecture/CI group (Phase 3)~~ — done; decisions below
7. CI instrumentation (Phase 3B), on the first green CI run of PR #625
8. Refactor group (Phase 4), then coverage (Phase 5), and so on

### Architecture/CI decisions (Phase 3)

- Node 26 pinned by `.nvmrc` and `devEngines` (not `engines`, which would constrain consumers). CI reads `.nvmrc`.
- `src/jquery.form.js` is an ES module: `import jQuery from 'jquery'`, the plugin body byte-identical, `export default jQuery`. Rollup builds `dist/jquery.form.mjs` (module), `dist/jquery.form.js` (classic), and `dist/jquery.form.min.js` plus source map. The classic build re-wraps the body in the original UMD header from `rollup.config.mjs` and restores the `'use strict'` directive Rollup drops from modules.
- Package entries: `main` is `dist/jquery.form.js` (was `src/jquery.form.js`), `module` is `dist/jquery.form.mjs`, `browser` is unchanged. No `exports` map, so deep paths keep resolving. `bower.json`, `composer.json`, and `form.jquery.json` now point at `dist/jquery.form.js`. ADR-0001 flag: anyone deep-requiring `jquery-form/src/jquery.form.js` now gets ESM; the package entries are unaffected.
- `dist/` stays committed; CI fails if it differs from a fresh build. The AMD module still defines no value (unchanged).
- Vitest projects: `suite` (unmodified `test/test.js` in Chromium; `test/setup.js` maps `before` and `chai.assert`), `surfaces` (script tag, AMD via RequireJS, native ESM with jQuery 4, bundled ESM with CommonJS jQuery 3), `commonjs` (Node `require` returns the 2-argument factory). `test/test.html` is now only the fixture source.
- ESLint keeps the old config's error-level non-style rules for `src` (the body passes all of them) plus `recommended`; `no-prototype-builtins` stays a warning. Warn-level preferences that Grunt hid with `quiet` are dropped. `test/test.js` turns off `no-unused-vars` and `no-constant-binary-expression` until the Phase 4 test rewrite. Unused `eslint-disable` comments in `src` are not reported; remove them in Phase 4.
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

| Step                                            | Model             | Why                                                                                                                                                                          |
| ----------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline (Phase 1)                              | Composer 2.5      | Run commands and record output; little judgement needed.                                                                                                                     |
| Grill: Prettier (Phase 2)                       | Claude Sonnet 5.5 | Conversational trade-off discussion; moderate depth, many turns.                                                                                                             |
| Architecture/CI group (Phase 3)                 | Claude Opus 5.5   | Multi-part toolchain work: converting `src` to ESM, keeping the ADR-0001 contract (CommonJS factory, AMD, script tag) in the build, and CI. A mistake here breaks consumers. |
| CI instrumentation (Phase 3B)                   | Claude Sonnet 5.5 | Workflow edits, a timing script, and recording numbers; the analysis is already in `docs/research/ci-first-run.md`.                                                          |
| Prettier sweep (Phase 4A)                       | Composer 2.5      | Mechanical: run the formatter, verify, commit.                                                                                                                               |
| Test rewrite (Phase 4B)                         | Claude Sonnet 5.5 | Many similar edits; converting fire-and-forget async tests to promises needs care but follows a repeated pattern.                                                            |
| Coverage to 100% (Phase 5)                      | GPT-5.6 Sol       | Deep branch-by-branch reasoning, simulating legacy browsers and old jQuery, iframe transport edge cases.                                                                     |
| Dependency modernization (Phase 6)              | Claude Sonnet 5.5 | Routine upgrades plus a version matrix; moderate judgement on breaking changes.                                                                                              |
| Issue triage (Phase 7)                          | Gemini 4 Argon    | Long-context reading of many issues and PRs; classification more than deep reasoning.                                                                                        |
| Architecture and vulnerability review (Phase 8) | Claude Opus 5.5   | Security analysis (XSS, script eval, iframe parsing, prototype pollution) where missed findings are costly.                                                                  |

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

## Phase 4: Refactor / modernize group

- Commit A: Prettier sweep only (separate commit, no behavior change).
- Commit(s) B: rewrite/rename existing tests to BDD names and AAA shape, grouped by area. Behavior and assertions unchanged, except async tests must return promises (today their callback assertions run after the test has passed). Drop the `before`/`chai` shims in `test/setup.js` and re-enable the two ESLint rules turned off for `test/test.js`.
- Each commit is verified by `npm test`.

## Phase 5: Coverage to 100%

- Generate the coverage report; list uncovered branches (iframe fallback, FormData/progress, `ajaxSubmit` option variants, `formToArray`/`fieldValue` edge cases, `resetForm`/`clearForm`, `semantic`).
- Write tests per gap, ordered by risk, in BDD/AAA style. Branches that only exist for unsupported browsers are removed or explicitly documented per the Phase 0 support-floor decision, not silently excluded.
- Enforce a 100% threshold in `npm test` and CI.

## Phase 6: Dependency modernization

- Upgrade remaining dev deps, run a jQuery version matrix (floor from Phase 0, 3.x, 4.x), `npm audit`, and verify `bower.json`, `composer.json`, `form.jquery.json` manifests and `main`/`browser`/exports entries.

## Phase 7: Issue triage

- Pull open issues/PRs with `gh` (see `docs/agents/issue-tracker.md`); categorize bug, security, feature, support, duplicate, stale; reproduce bugs as failing tests; propose labels/closures. Output a prioritized backlog.

## Phase 8: Architecture and vulnerability review

- Review `src/jquery.form.js`: response handling (script/html eval, XSS, iframe parsing), uploads (`target`/iframe, `document.domain`), request construction (URL building, data serialization, prototype pollution), dependency exposure.
- Identify improvements while preserving the ADR-0001 dual surface (module format, shim removal, API surface, deprecation path). Output a findings doc and ranked issues.

## Metrics (throughout)

- `docs/metrics.md` is the committed record of before-and-after numbers, used for the v4 and v5 release announcements.
- The before column is the v4.3.0 baseline. Add a column whenever a phase changes a metric (at minimum after Phase 3, Phase 5, Phase 6, the 4.x release, and 5.0).
- Track: test count, suite wall time, full `npm test` time, coverage (lines, branches, functions, statements), minified and gzipped size, `npm audit` counts, number of dev deps, supported jQuery versions tested, CI duration, and open issues and PRs.
- Measure the same way each time, and note the command and machine in the file.

## Conventions throughout

- Conventional Commits, 1-3 lines, no trailers.
- Edit source, never `dist/`.
- Flag any change that contradicts ADR-0001 explicitly.
