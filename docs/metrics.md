# Metrics

Before-and-after numbers for the v4 and v5 release announcements. Add a column when a phase changes a metric; don't rewrite past columns.

Machine: Apple Silicon Mac, Node v24.11.0 (baseline), Node v26.12.1 (Phase 3 onward).

| Metric                    | v4.3.0 baseline (2026-10-25)                                          | Phase 3 toolchain (2026-10-25)                                   |
| ------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Test runner               | Mocha 7 in PhantomJS via Grunt                                        | Vitest 5 browser mode (Chromium via Playwright)                  |
| Tests                     | 59 (async tests do not await their assertions)                        | 64: the same 59, unmodified, plus 5 publish-surface smoke tests  |
| Suite time                | 0.81 s in-browser, 7.0 s wall (`npx grunt mocha`)                     | 0.53 s in-runner, 0.9 s wall (`npx vitest run`)                  |
| Full `npm test`           | Not defined                                                           | 1.5 s wall (lint, build, tests, coverage)                        |
| Line coverage of `src`    | Not measured by the toolchain (about 60% under the prototype runners) | 35.4%                                                            |
| Branch coverage of `src`  | Not measured (about 53% under the prototype runners)                  | 33.9%                                                            |
| Coverage enforced         | No                                                                    | No (reported on every run)                                       |
| `dist/jquery.form.min.js` | 17.09 kB min, 6.57 kB gzip                                            | 17.18 kB min, 6.57 kB gzip                                       |
| `npm audit`               | 51 (11 critical, 25 high, 10 moderate, 5 low)                         | 0                                                                |
| Dev dependencies (direct) | 8                                                                     | 15                                                               |
| jQuery versions tested    | 3.5.1 only (from the CDN)                                             | 3.7.1 (suite and surfaces), 4.0.0 (ESM surface only)             |
| CI                        | Travis and CircleCI configs (inactive)                                | GitHub Actions (duration recorded after the first run on `main`) |
| Open issues / PRs         | 27 / 8                                                                | 27 / 8                                                           |

How measured: suite time from runner output and `time`; coverage from `npm test` (v8); gzip via `gzip -c | wc -c`; issue and PR counts via `gh issue list` and `gh pr list`.

The prototype coverage figures included two extra upload tests (iframe transport and XHR FormData) that are not in `test/test.js`; the Phase 3 numbers cover the existing suite only.
