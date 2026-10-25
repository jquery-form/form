# Metrics

Before-and-after numbers for the v4 and v5 release announcements. Add a column when a phase changes a metric; don't rewrite past columns.

Machine: Apple Silicon Mac, Node v24.11.0 (baseline).

| Metric | v4.3.0 baseline (2026-10-25) |
| --- | --- |
| Test runner | Mocha 7 in PhantomJS via Grunt |
| Tests | 59 (async tests do not await their assertions) |
| Suite time (`npx grunt mocha`) | 0.81 s in-browser, 7.0 s wall |
| Line coverage of `src` | Not measured by the toolchain (about 60% under the prototype runners) |
| Branch coverage of `src` | Not measured (about 53% under the prototype runners) |
| Coverage enforced | No |
| `dist/jquery.form.min.js` | 17.09 kB min, 6.57 kB gzip |
| `npm audit` | 51 (11 critical, 25 high, 10 moderate, 5 low) |
| Dev dependencies (direct) | 8 |
| jQuery versions tested | 3.5.1 only (from the CDN) |
| CI | Travis and CircleCI configs (inactive) |
| Open issues / PRs | 27 / 8 |

How measured: suite time from Grunt output and `time`; prototype coverage from `prototype/` (`npm run vitest`); gzip via `gzip -c | wc -c`; issue and PR counts via `gh issue list` and `gh pr list`.
