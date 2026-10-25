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
    status: pending
  - id: baseline
    content: Install deps, run lint/tests/build on current state, record baseline failures
    status: pending
  - id: grill-prettier
    content: Grill-with-docs session to decide Prettier deviations from defaults; record in config/ADR/GLOSSARY as warranted
    status: pending
  - id: toolchain-ci
    content: "Architecture/CI group: Node pin, runner + coverage, bundler with dual publish, ESLint flat config, GitHub Actions, remove Travis/CircleCI/.editorconfig"
    status: pending
  - id: prettier-sweep
    content: "Refactor group: Prettier format sweep as its own commit, no behavior changes"
    status: pending
  - id: test-rewrite
    content: "Refactor group: migrate/rename existing tests to BDD names and AAA shape, behavior unchanged"
    status: pending
  - id: coverage
    content: Close coverage gaps to 100% with new tests and enforce threshold in npm test
    status: pending
  - id: deps-modernize
    content: Dependency upgrades, jQuery version matrix, npm audit, manifest checks
    status: pending
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
- Branching settled in ADR-0002: trunk on `main` (no `develop`/`next`); reconcile is merge `develop`→`master`, rename to `main`, prune, protect; community PRs wait until coverage is 100%.

### Revised order

1. ~~Grill session: branching strategy (and ADR)~~ — done (`docs/adr/0002-branching-and-release.md`)
2. ~~Reconcile branches, rename to `main`, prune, protect (per ADR-0002)~~ — done
3. Runner/bundler prototype
4. Baseline (Phase 1)
5. Grill session: Prettier (Phase 2)
6. Architecture/CI group (Phase 3), then refactor group (Phase 4), then coverage (Phase 5), and so on

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

## Phase 4: Refactor / modernize group
- Commit A: Prettier sweep only (separate commit, no behavior change).
- Commit(s) B: rewrite/rename existing tests to BDD names and AAA shape, grouped by area. Behavior and assertions unchanged.
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

## Conventions throughout
- Conventional Commits, 1-3 lines, no trailers.
- Edit source, never `dist/`.
- Flag any change that contradicts ADR-0001 explicitly.
