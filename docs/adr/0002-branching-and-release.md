# Trunk-based branching and dual release lines

Small maintainer pool: one trunk (**`main`**), no standing `develop` or `next`. Active work is short-lived branches + PRs into `main`. The **v4 line** (compatibility) and **5.0** (breaking) are sequential on that trunk—finish and tag 4.x, then land 5.0 on `main`. Post-5.0 v4 patches use an on-demand **`release/4.x`** cut from the last v4 tag; npm dist-tags are **`latest`** (current major) and **`v4`** (4.x after 5.0). GitHub Actions runs `npm test` on PRs/pushes to `main` and to `release/4.x` when it exists; `main` is protected (PR + one review; required check once Actions lands). Releases are human-tagged `vX.Y.Z` and manually `npm publish`—no publish-from-CI yet. Community/feature PRs wait until coverage is at 100%, then merge only after thorough review.

**Reconcile (done):** merged `develop` into `master`, renamed to `main`, deleted `develop`, pruned stale remotes, closed superseded CI PR #614, updated in-repo `master` links.
