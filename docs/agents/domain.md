# Domain docs

How agents consume this repo's domain documentation when exploring or changing behavior.

This repo is a **single context**: one glossary at the root, system-wide ADRs under `docs/adr/`. There is no `GLOSSARY-MAP.md` and no per-package glossaries.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root (when present)
- **`docs/adr/`** — ADRs that touch the area you're about to work in (e.g. publish surface, packaging)

If a file or directory doesn't exist yet, **proceed silently**. Don't flag absence; don't suggest creating glossary/ADR files upfront. `/domain-modeling` (via `/grill-with-docs` and related flows) creates them lazily when terms or decisions actually resolve.

## Use the glossary's vocabulary

When your output names a domain concept (issue title, refactor proposal, hypothesis, test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept isn't in the glossary yet: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (dual publish surface), but worth reopening because…_
