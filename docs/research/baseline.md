# Phase 1 baseline

Taken on `main` at the runner/bundler prototype commit, Node v24.11.0.

## How to run (current Grunt toolchain)

- `npm ci`
- `npx grunt lint`: ESLint 7.2.0 (via `grunt-eslint` 23.0.0, resolved from `"*"`), legacy `.eslintrc.js`, `src/**/*.js` only.
- `npx grunt mocha`: Mocha in PhantomJS against `test/test.html`. That page loads jQuery 3.5.1 from `code.jquery.com`, so the tests need network access.
- `npx grunt uglify` (or `npx grunt` for lint + test + build): writes `dist/jquery.form.min.js` and its source map.

## Results

| Check    | Result                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------- |
| `npm ci` | Passes. `npm audit`: 51 vulnerabilities (5 low, 10 moderate, 25 high, 11 critical), all in dev tooling. |
| Lint     | Passes, no findings.                                                                                    |
| Tests    | 59 passing.                                                                                             |
| Build    | Passes; output is byte-identical to the committed `dist/`.                                              |

## Known issues

- On every task, Grunt warns `Local Npm module "grunt-githooks" not found`: the Gruntfile loads it, but it isn't in `devDependencies`. This is harmless.
- The 59 passing tests overstate what's verified. The async tests assert inside callbacks after the test has finished (see [runner-bundler-prototype.md](runner-bundler-prototype.md)).
- Tests depend on the jQuery CDN and on PhantomJS, which has been abandoned since 2018.
