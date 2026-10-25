# CI browser setups

Three ways to provide a browser in CI, measured against the current setup (`npx playwright install chromium`). Run [40226824629](https://github.com/jquery-form/form/actions/runs/40226824629) on the scratch branch `ci-experiment` (since deleted): four parallel jobs, each running checkout, `setup-node`, `npm ci`, the browser setup, and `npx vitest run`. Attempts 2–7 are warm and attempts 1 and 8 are cold (caches deleted). Job wall time, in seconds:

| Setup                                               | Warm median (min–max) | Cold   | Notes                                                                 |
| --------------------------------------------------- | --------------------- | ------ | --------------------------------------------------------------------- |
| Baseline: `playwright install chromium`             | 29 (23–32)            | 32, 29 | Install step 7–10 s on every run                                      |
| Cache `~/.cache/ms-playwright`, keyed on Playwright | 22 (20–29)            | 34, 31 | Install becomes a no-op on a hit; the cache restore costs about 3 s   |
| Runner Chrome (`channel: "chrome"`)                 | 28.5 (24–33)          | 24, 30 | No install, but Vitest takes 12 s against 2–3 s (slower Chrome start) |
| Playwright container (`v1.64.1-noble`)              | 51.5 (44–60)          | 47, 55 | Container initialization alone is 26–39 s                             |

## Findings

- **Cache wins**, saving about 7 s (24%) on a hit. A cold run is as slow as the baseline plus the cache save, so the first run after a Playwright bump pays about 3 s extra.
- **Runner Chrome is not faster.** It saves the 8–10 s install but loses it back in a slower Vitest run, and its version follows the runner image. Not worth the drift.
- **The container is the slowest.** The image pull costs more than the install it replaces.
- Limits: whole-second timestamps, one runner image, 6 warm runs. The cache job skipped lint, format, and build, which are unaffected by browser setup.

## Recommendation

Adopt the Playwright browser cache as a later `ci:` commit, and re-measure it in the real workflow against the Phase 3B baseline. Drop the container and runner-Chrome options.
