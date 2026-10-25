# Coding standards

Agent-facing standards for changing this repo. The modernization plan also reads this file as its requirements input.

Until tooling lands, this doc is the target source of truth. After it lands, **config and scripts win**: ESLint, Prettier, `package.json`, and CI encode the same rules; prefer looking them up over restating them here.

Human PR/process stays in `CONTRIBUTING.md`.

## Workshop

| Concern      | Target                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime / CI | **Node 26**; **GitHub Actions** runs `npm test`. Travis and CircleCI are obsolete.                                                              |
| Lint         | **ESLint** (flat config) — correctness and quality                                                                                              |
| Format       | **Prettier** near-defaults (2-space indent, double quotes, semicolons) with `printWidth: 100` and `trailingComma: "es5"`. No `.editorconfig`.   |
| Verify       | **`npm test`** — the one command agents run. Runner is whatever the repo ships; do not assume Mocha, Vitest, or Playwright by name.             |
| Publish      | **Dual surface**: modern module entry **and** classic browser/`$.fn` (UMD or equivalent) so existing script-tag and AMD consumers keep working. |
| Bundler      | Chosen by the modernization plan; must support the dual surface above.                                                                          |
| Language     | **Deferred** to the modernization plan (JS vs TS). Agents match whatever landed (`package.json`, `tsconfig` if any, source layout).             |

### Prettier overrides

- `printWidth: 100`: 2-space indent and nested jQuery callbacks make 80 wrap too often; 100 is close to the existing code.
- `trailingComma: "es5"`: the v4 classic build ships source as written for old browsers, so no trailing commas in call arguments. Revisit for v5.

## Commits

Use **[Conventional Commits](https://www.conventionalcommits.org/)**. Each message is **1–3 lines** total (subject plus at most a short body). Prefer the type that matches the change (`fix`, `feat`, `docs`, `test`, `chore`, `refactor`, `ci`, `build`). Omit `Co-authored-by` and similar trailers.

## Tests

- **Names:** BDD-style — behavior in plain language (`describe` / `it` or the runner's equivalent), e.g. when X, it should Y.
- **Shape:** **AAA** in each example — Arrange, Act, Assert as distinct steps (blank line or clear grouping between them).

## When changing code

1. Read this doc (and the configs it points at once they exist).
2. Edit **source**, not built artifacts. Treat `dist/` (or the successor build output) as generated.
3. Preserve the **classic `$.fn` plugin surface** and the **modern module** entry when touching packaging or the public API (see ADR-0001).
4. Match the **landed** language and patterns in the tree you are in.
5. Add or update tests with BDD names and AAA shape when behavior changes.
6. Run **`npm test`**. Done when it passes for the change you made.
7. Commit with Conventional Commits, 1–3 lines.

## For the modernization plan

Encode the workshop table in real config and scripts. Open decisions left to that plan: **language (JS vs TS)**, **bundler**, **test runner** (current Mocha/Chai browser tests may migrate; this doc only requires `npm test`).

**Style adoption:** land the Prettier (and related format) sweep in a **separate commit** from behavioral or API changes, so review stays readable.
