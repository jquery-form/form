# Mutation testing before the 4.6.0 merge

Plan written 2026-11-26, before PR #644 merges. It builds on the Phase 13 Stryker run, which was
one local pass over `src/*.js` against the Chromium suite on jQuery 3.7.1. That run had 2151 mutants
and moved the score from 91.67% to 94.34%. Timeouts counted as detected, and neither the config nor
the report was kept.

## Why run it again

- The Phase 13 run used one browser and one jQuery version. Code that runs only on jQuery 1.7.2
  (`hasProp`, the `.selector` queue, `jQuery.clean`) or only on jQuery 4 was never mutated against
  the tests that reach it, so its survivors are unknown.
- Timeouts counted as detected. A mutant that changes a timer, such as deleting `clearTimeout` or
  changing the 100 ms cleanup delay, usually shows up as a timeout. Those are the bugs a
  fixed-sleep test misses, and the 2026-11-26 audit found one: "should clear a pending timeout after
  a successful response" passed with `clearTimeout` deleted.
- 4.6.0 changes 133 source lines since v4.5.0, most of them in `src/successful-controls.js` (lone
  surrogates, `+` encoding, the fieldset submitter) and `src/options.js` (`target` as a selector
  only). Those lines ship in this release and were mutated only once.
- Stryker does not generate the mutants that matter most here: reopening a W1–W4 sink, or
  reordering the callback and global events.

## Preconditions

1. The flaky-test fixes from 2026-11-26 are in. A flaky test counts a mutant as killed when it
   isn't, and it fails the dry run. Before Stryker starts, the full matrix must pass 10 times in a
   row in Docker, and the delayed-fixture run (`FIXTURE_DELAY=1000`) must pass.
2. Stryker stays out of `package.json`. Install it with `npx` and keep `stryker.config.mjs`
   untracked next to `vitest.probe.config.mjs`. Record the exact command and versions in this file,
   so the next run can be compared with this one.

## Step 1: diff-scoped run (blocks the merge)

Mutate only the lines changed since v4.5.0. Use Stryker's `mutate` line ranges, generated from
`git diff -U0 v4.5.0..release-4.6.0 -- src`.

- Run against the suite on Chromium with jQuery 1.7.2, 3.7.1 and 4.0.0: three runs, one per
  `JQUERY_FILE`. A mutant survives only if it survives all three.
- Report timeouts separately, not as detected. Rerun each timeout once with a 3× timeout factor.
  One that still times out is a real infinite loop (killed). One that finishes is a survivor.
- Exit criterion: every mutant on a changed line is killed, or is listed below as equivalent with a
  one-line reason. A survivor becomes a BDD/AAA test that fails on the mutant. If writing that test
  exposes a bug, fix it in 4.6.0 and add it to `docs/research/4x-behavior-changes.md`.

## Step 2: hand-written mutants (blocks the merge)

These come from the bugs this project has already shipped or nearly shipped. Each one is a patch,
applied alone, and the suite must fail on every one. Keep them as a script next to the CodeQL canary
(`phase-12-codeql-canary.sh` in the notes folder) so later phases can rerun them.

Security sinks. Each test must fail synchronously through `countHtmlParsed`, not just through an
`onerror` flag:

- W1: build the iframe hidden inputs, the submitter field and the CSRF field from HTML strings.
  Also set `iframeSrc` through markup.
- W2: `resetForm` on a label looks up `$(this.htmlFor)` instead of `getElementById`. Checked
  2026-11-26: both label tests fail with `expected 1 to equal +0`.
- W3: `formToArray` builds a selector from the form `id`.
- W4: `target` inserts a parsed JSON response with `.html()`.
- 4.6.0: `target` and `iframeTarget` go back to `$(string)` instead of `$(document).find(string)`.

Timing and lifecycle:

- Delete `clearTimeout(timeoutHandle)` in `iframe-lifecycle.js`. Checked 2026-11-26: the rewritten
  timeout test fails.
- Set the cleanup delay (100 ms) and the post delay (10 ms) to 0, and to 1000.
- Swap `complete` with `endGlobalEvents()`, and `success` with `ajaxSuccess`.
- Let a second `abort()` complete again (drop the `xhr.aborted` guard).
- Skip `frame.release()` on the timeout path.

Serialization, against the oracle:

- Drop the U+FFFD replacement for lone surrogates.
- Encode spaces as `%20` on every jQuery version.
- Post a submitter that a disabled fieldset contains.

## Step 3: whole-source run across browsers (does not block the merge)

All of `src/*.js`, the same as Phase 13, on the three jQuery versions in Chromium. Then rerun only
the survivors on WebKit and Firefox (in Docker). That separates "no test covers it" from "only
another engine's path covers it". Compare with 94.34% and record per-file scores in
`docs/metrics.md`. Any survivor in W1–W4 code blocks 5.0, not 4.6.0, unless it is a real bug.

## Step 4: survivors against the published files (does not block the merge)

The suite imports `src`. Survivors from step 3 that touch packaging behavior (the UMD wrapper, the
CommonJS factory's window, `'use strict'` restoration) also get a run through
`npm run build && npm run test:e2e` and the surface tests. Use Stryker's command runner, limited to
those mutants, since a full e2e run per mutant is too slow.

## Ground rules

- No `// Stryker disable` comments in `src`. The classic build ships the source as written, so
  equivalent mutants are listed in this file instead.
- Every new test follows `docs/agents/coding-standards.md` (BDD + AAA) and waits on events, not
  fixed sleeps. Kills that depend on a timer race don't count. Rerun any new test under
  `FIXTURE_DELAY=1000`.
- Test commits are `test:` commits on `phase-13` and ship in PR #644. A source fix is a `fix:`
  commit, with its entry in the behavior-changes log.

## Merge checklist for #644

- [ ] Flaky-test fixes committed and pushed; CI green on all nine required checks without a rerun
- [ ] Step 1: no unexplained survivor on lines changed since v4.5.0
- [ ] Step 2: every hand-written mutant fails the suite
- [ ] Any fixes from steps 1–2 in `4x-behavior-changes.md`, the release notes and `docs/metrics.md`
- [ ] User merges #644 and approves the npm environment

## Equivalent mutants

None recorded yet.

## Results

Not run yet.
