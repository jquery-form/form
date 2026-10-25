# First CI run

The first GitHub Actions run of the Phase 3 toolchain: [PR #625](https://github.com/jquery-form/form/pull/625), [run 40224691569](https://github.com/jquery-form/form/actions/runs/40224691569). It was cancelled after 8.5 minutes, before `npm test` started.

Runner image: `ubuntu24` release 20261012.334.

## Step timings

| Step                                                       | Duration                   |
| ---------------------------------------------------------- | -------------------------- |
| Set up job                                                 | 1 s                        |
| `actions/checkout@v7`                                      | 1 s                        |
| `actions/setup-node@v7` (Node 26 from `.nvmrc`, npm cache) | 6 s                        |
| `npm ci`                                                   | 2 s                        |
| `npx playwright install --with-deps chromium`              | over 8 min 40 s, cancelled |
| `npm test`, `dist` check                                   | not reached                |

## Why the Playwright step stalled

`--with-deps` runs `apt-get update` and then `apt-get install` for Chromium's system packages.

- `apt-get update` took 11 s.
- Every library Chromium needs was already on the runner image; the log reports each one as "already the newest version".
- The remaining work was 25.9 MB of archives: 9 new packages, mostly fonts (`fonts-wqy-zenhei`, `fonts-unifont`, `fonts-freefont-ttf`, `fonts-ipafont-gothic`, `fonts-tlwg-loma-otf`, `xfonts-*`), and 8 upgrades (`libglib2.0`, `libnss3`, `xvfb`).
- Downloads from `azure.archive.ubuntu.com` ran at roughly 30–80 KB/s. For example, `fonts-wqy-zenhei` (7.5 MB) took 2 min 43 s. When cancelled, apt was on package 11 of 17, and the Chromium download had not started.

The fonts render CJK and other scripts, which this suite never displays. The step's cost was a slow package mirror, not anything the tests need.

## Implications

- To get a green baseline, drop `--with-deps` and run `npx playwright install chromium`. The runner image already has the libraries, and the browser comes from Playwright's CDN rather than the Ubuntu mirror. This is a fix to get CI running, not a measured optimization.
- Any setup that relies on `apt` during the job carries this mirror risk. Phase 3B compares setups that avoid it: the Playwright container image, a cached browser, and the Chrome preinstalled on the runner.
- One run is one data point. Mirror speed varies, so Phase 3B measures several runs before choosing.
