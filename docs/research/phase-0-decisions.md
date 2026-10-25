# Phase 0 decisions

Inputs: [tooling-research.md](tooling-research.md), [issue-pr-scan.md](issue-pr-scan.md).

## Decided

- **Language:** plain JS for now. TypeScript is discussed as part of the v5 architecture work.
- **Two release tracks:**
  - **4.x (minor release):** keep all current compatibility (jQuery >=1.7.2, legacy shims, `options.iframe`). Covers tooling, CI, tests, 100% coverage of existing branches, jQuery 4 compatibility through changes that still work on old jQuery (the #599 style of native replacements), and low-risk bug fixes.
  - **5.0 (major release):** prepared after 4.x. Drops legacy jQuery (<3) and IE/Opera shims, deletes dead branches, makes `jquery` a peer dependency, adds an `exports` map, and carries the larger architectural improvements.
- **Test runner:** Vitest browser mode (Playwright provider, v8 coverage), chosen by prototype; see [runner-bundler-prototype.md](runner-bundler-prototype.md).

## Confirmed by prototype

- **Bundler:** Rollup 4 (ESM + classic UMD, jquery external), confirmed by prototype. The classic build keeps the hand-written UMD wrapper because Rollup's generic UMD changes the CommonJS export. esbuild has no UMD or AMD output.
- **Node:** target Node 26 (LTS from 2026-10-28). Local is v24.11.0, which is the minimum for some tools.

## Consequences for the plan

- 100% coverage on 4.x means testing legacy branches: old jQuery in the test matrix, and tests that simulate old-browser feature detection. On 5.0, coverage gets simpler by deleting those branches.
- Add a prototype step before the architecture/CI group (runner and bundler choice).
- Land #599-style jQuery 4 fixes early on 4.x.
- #614 and #583 are superseded by our CI and lint config. Choose between the competing XSS PRs #611 and #586 before writing security tests. #557/#545 (JSON body) is a feature decision. Add `SECURITY.md` early (#580, #624).
- Some claims in the tooling research are tagged unverified; check them when used.

## Still open

- What replaces the `this.selector` / `.context` delegation path in `ajaxForm` (on 4.x and on 5.0).
- Whether `options.iframe` survives into 5.0.

## Added after review

- **Minimal tooling.** Keep dependencies and maintenance low. If Playwright is used anyway, Vitest needs a concrete justification before it is added alongside it. The runner prototype compares Playwright Test (plain) against Vitest on that basis, and only adds Vitest if it clearly wins.
- **100% coverage target applies to the v4 branch**, with legacy branches tested, not deleted.

## Repo and branching work to add to the plan

Current state (checked locally): default branch is `master`. `master` is 7 commits ahead of `develop` and carries v4.3.0 (`package.json` 4.3.0, tag `v4.3.0`, plus CDN/Travis commits). `develop` is at 4.2.2 plus the agent docs commit. Stale remote branches: `feature-testing`, `functional-testing`, `zhangciwu-post-json-body`.

Proposed steps, to be settled in a grill session before acting:

1. **Reconcile first:** merge `master` into `develop` so no released work is lost, before any modernization commits.
2. **Rename `master` to `main`** (GitHub rename keeps redirects); update local and remote tracking, CI, badges, docs and CDN/links that reference `master`.
3. **Decide the role of `develop`:** either drop it in favor of trunk-based work on `main` with short-lived branches, or keep it as an integration branch for the next release. Fewer long-lived branches means less upkeep.
4. **Version lines for v4 and v5:**
   - `main` carries the current development line (4.x until 5.0 is ready, then 5.x).
   - A `v4` maintenance branch (or a tag-only approach) is created at the last 4.x release so patches can be cut later without ongoing effort. Because v4 maintenance will be light, an on-demand `release/4.x` branch cut from the final v4 tag is enough.
   - 5.0 work happens on a `next` (or `v5`) branch until release, then becomes `main`.
5. **Housekeeping:** prune or archive stale remote branches, set branch protection and required CI checks on `main`, and use npm dist-tags (`latest` for 5.x, `v4` for 4.x patches).
6. Document the strategy in `CONTRIBUTING.md` and an ADR.

Ordering: reconcile branches and rename to `main` first (before the architecture/CI group, so the new GitHub Actions workflow targets the right branch), then pick the v4/v5 strategy before the first release.
