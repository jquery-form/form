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

## Step 3: whole-source run across browsers (blocks the merge, decided 2026-11-26)

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

- [x] Flaky-test fixes committed and pushed; CI green on all nine required checks without a rerun
- [x] Step 1: no unexplained survivor on lines changed since v4.5.0
- [x] Step 2: every hand-written mutant fails the suite, apart from the equivalents below
- [x] Step 3: every whole-source survivor killed or listed as equivalent
- [ ] Any fixes from steps 1–2 in `4x-behavior-changes.md`, the release notes and `docs/metrics.md`
- [ ] User merges #644 and approves the npm environment

## Equivalent mutants

Each one sends the same request and runs the same callbacks as the real code.

Step 1 (`src/successful-controls.js` unless noted):

- `deprecateFieldValueOverride` with the key `""` instead of `"fieldValue-override"`: no other
  deprecation uses that key, so it still warns once.
- `setKey` with `writable: false` or `configurable: false`: the copy goes straight to `$.param`,
  which only reads it.
- `wellFormedData` starting its array copy as `["Stryker was here"]`: the loop overwrites index 0,
  and an empty array is returned unchanged.
- `wellFormedData` with `changed` forced true (three mutants): it returns a copy where the original
  would do, and `$.param` serializes both the same.
- `wellFormedData` with `if (isArray)` forced false: the object branch walks the array with `for…in`
  into the array copy, so the result is the same array.
- `urlencodedFields` always building a new `{ name, value }`: `$.param` reads only those two keys.

Step 2:

- The cleanup delay (100 ms) set to 0, and the post delay (10 ms) set to 0. Both still defer to a
  later task, and callbacks and promise handlers run before either timer. Making them longer is
  caught.

## Results

Run on 2026-11-26 with Stryker 10.1.1 and `@stryker-mutator/vitest-runner` 10.1.1, installed with
`npm i --no-save`. The config is the untracked `stryker.config.mjs` and `vitest.stryker.config.mjs`
(the suite on Chromium, coverage off, `coverageAnalysis: "perTest"`, concurrency 4). Commands:

```sh
# one file:start-end per added hunk
git diff -U0 v4.5.0..HEAD -- src | awk '/^\+\+\+ b\//{f=substr($2,3)}
  /^@@/{split($3,a,","); s=substr(a[1],2); n=(a[2]==""?1:a[2]); if(n>0) print f":"s"-"(s+n-1)}' > ranges.txt
JQUERY_FILE=<build> MUTATE_RANGES=ranges.txt STRYKER_LABEL=step1-<version> npx stryker run
```

### Step 1

132 mutants on the changed lines. The first pass left 12 survivors and 5 timeouts on all three jQuery
versions. The timeouts are hangs (a rejection that never comes, an infinite loop, a throw inside a
callback), so they count as detected. Three survivors were real gaps and got tests:

| Mutant                                                                                      | Test added                                                             |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `iframe-lifecycle.js`: clear `errMsg` for every error status, not only `parsererror`        | an error status whose document fails to read reports the read error    |
| `options.js`: `selectorOption` returning a non-empty set for HTML, and an empty log message | `test/suite/options.test.js`                                           |
| `successful-controls.js`: a file field's string value sent as `undefined`                   | `urlencode` sends the file name a browser without the File API reports |

The second pass leaves only the equivalent mutants above.

### Step 2

21 hand-written mutants, each run on Chromium with jQuery 1.7.2, 3.7.1 and 4.0.0. The first pass
caught 18. All four W1–W4 sinks and both 4.6.0 `target` mutants fail the suite. Two survivors were
gaps and got tests:

- The click window cut from 100 ms to 0: a submit inside the window, after a later task, must still
  send the clicked button (fake timers, so the test does not race).
- `target` and `iframeTarget` looked up with `$(value)` instead of `.find()` were caught only on
  jQuery 1.7.2. The lookup must use the form's own document.

With those, 19 of 21 are caught. The other two are the equivalent delays above.

### Step 3

All of `src/*.js` (2223 mutants on jQuery 3.7.1), on Chromium with jQuery 1.7.2, 3.7.1 and 4.0.0.
Each run took about 11 minutes. Scores, with timeouts counted as detected:

| jQuery | Score  | Killed | Timeout | Survived | No coverage | Errors |
| ------ | ------ | ------ | ------- | -------- | ----------- | ------ |
| 3.7.1  | 94.30% | 1959   | 127     | 126      | 0           | 11     |
| 1.7.2  | 93.26% | 1943   | 120     | 128      | 21          | 11     |
| 4.0.0  | 94.11% | 1951   | 128     | 130      | 0           | 14     |

The 3.7.1 score matches Phase 13's 94.34%, which was measured on the same version before the 4.6.0
fixes added mutants. Counting a mutant as detected when any version detects it, and adding the test
below, the score is 94.50%. Every remaining survivor is listed below.

Timeouts. 108 mutants timed out on all three versions. A rerun with a 3× timeout factor gave 48
clean kills (slow tests, not hangs) and 60 real hangs: infinite loops (`i--`, `k >= length`) and
emptied functions that leave an upload that never settles. None of them hides a survivor.

Engines. The 123 mutants that no version detected were rerun on WebKit with jQuery 3.7.1. WebKit
detected only three, all in `unlisten`, and the test below detects those on Chromium too, so no
survivor depends on the engine. Firefox was not rerun: it starts only in Docker on this machine,
and WebKit showed no difference from Chromium.

One gap got a test: after an upload into a supplied `iframeTarget`, the plugin must remove the load
listener it added. Removing nothing, or removing with the wrong capture flag, survived because the
`life.done()` guard hides the leaked listener on the next upload into the same frame.

The other 120 survivors:

- 32 change only debug text or a deprecation ID: `log(...)` and `refuse(...)` messages, and the
  first argument of `deprecate(...)`, where any distinct ID warns once just the same.
- 26 are in code that only old browsers or old jQuery reach, which 5.0 deletes: the Opera retry, IE
  `attachEvent`/`detachEvent` and `execCommand("Stop")`, `doc.XMLDocument`, the `MSIE|Trident` and
  `Edge|Trident` sniffs, `hasProp`, the `Element.prototype.closest` fallback, the form-member
  prototype list, and the `contentWindow`/`contentDocument` fallbacks.
- 62 are equivalent:
  - `.off("")` with a handler, in place of `.off("submit.form-plugin")` and the click type
    (`ajax-form.js` 77, 78, 113, 114): jQuery treats an empty event type as every type, so the
    handler is still removed. A stale `delegated` entry is harmless for the same reason.
  - Guards that a later guard repeats: `start()` returning true after a veto, and the emptied
    `if (!life.start())` (`post()` checks `life.done()` again); the `life.done()` check in the load
    callback (`settle` checks `xhr.aborted`); `stopTimer` and `clearTimeout` on a server abort (the
    timer's `abort` finds the upload done).
  - Copies that only `$.param` or `jQuery.extend` read: `writable` and `configurable` in `setKey` and
    `defineKey`, `wellFormedData` copying when nothing changed, `urlencodedFields` always copying, a
    shallow instead of a deep `$.extend` of the settings, and a seeded `extraInputs` array.
  - Anchors dropped from regexes that only ever see valid values: input types in `clearFields` and
    `resetForm`, tag names in `rUnsubmittable`, and `get` in `isGet` and the GET check.
  - The iframe mock's `content-type` mirrors `dataType`, so the `ct` and `xml` mutants in `httpData`
    and the `dataType` fallback text in `readResponse` change nothing.
  - Browser behavior that makes a branch redundant: setting `option.selected` already deselects the
    other options of a single select (`selected()`), `form.elements` already includes `form=`
    controls, and an empty `method` attribute is GET.
  - Values never read: the image point for a non-image submitter, the `tagName` fallback for nodes
    without one, `submission.controls` being nulled after use, a `complete` callback list built
    without a callback, `useCapture` on the upload progress listener, `includeHidden` branches that
    an inner check repeats, `extraData` checked before a `for…in`, and `fieldValue` skipping an empty
    array that merges to nothing.

### Commands

```sh
# step 3: the whole source, then the all-version timeouts again with a 3x timeout factor
JQUERY_FILE=<build> STRYKER_LABEL=step3-<version> npx stryker run
MUTATE_RANGES=timeouts.txt STRYKER_TIMEOUT_FACTOR=3 STRYKER_LABEL=step3t-<version> npx stryker run
# survivors on WebKit; ranges are whole lines, since exact-column ranges miss some mutants
STRYKER_BROWSER=webkit MUTATE_RANGES=survivor-lines.txt STRYKER_LABEL=step3w-3.7.1 npx stryker run
```
