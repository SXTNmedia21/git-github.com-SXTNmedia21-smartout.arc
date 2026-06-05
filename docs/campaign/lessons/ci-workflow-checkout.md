---
topic: ci-workflow-checkout
status: active
updated: 2026-05-31T09:58:46Z
created: 2026-05-31T09:58:46Z
supersedes:
---

# Decision lesson — ci-workflow-checkout

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.

---

## Decision

`.github/workflows/test.yml` MUST:

1. checkout with `fetch-depth: 0` — the suite asserts on git tags (test-f7 T93.7
   counts 6 phase tags v0.2.0..v1.0.0 via `git tag -l`). Default shallow
   checkout fetches no tags → `actual: 0` → fail.
2. trigger on BOTH `main` and `development` (push + pull_request) — development is
   the integration branch; CI must validate it BEFORE promotion, not only on main.
3. allow `timeout-minutes: 25` — real suite ≈9:37 wall once paths resolve; nested
   regression (see [[test-suite-regression-nesting]]) leaves thin headroom under 15.

## Why

CI ran only on main, so the [[plugin-dir-resolution]] fix on development was never
CI-exercised — Pontus kept seeing main red while development was green locally. And
two CI-only failures are invisible to local runs (local clone has full history+tags):
shallow/tagless checkout breaks tag asserts, and the runtime only appears once the
$HOME path bug stops fast-failing. These are environment-portability decisions, same
class as plugin-dir-resolution: never assume the local environment's git depth, tag
availability, or $HOME layout holds in CI.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T09:58:46Z — initial: fetch-depth:0 (tags for T93.7) + run on development + timeout 15→25 in test.yml
