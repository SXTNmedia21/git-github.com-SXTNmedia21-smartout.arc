---
title: "Enforced CI Coverage Mandate and Self-Learning Loop for pnpm ci:local"
id: ADR-0359
status: accepted
layer: decision
created: 2026-05-17
updated: 2026-05-17
---

# ADR-0359: Enforced CI Coverage Mandate and Self-Learning Loop for `pnpm ci:local`

## Context and Problem Statement

`pnpm ci:local` mirrors `.github/workflows/*.yml` against Supabase Local to give a fast green/red signal before opening a PR (skill `local-ci-before-pr`). The first revision shipped 19 gates that pass, fail, warn, or skip — but it had two blind spots:

1. **Coverage opacity** — a "green" result was claimed regardless of whether the suite actually exercised what changed. If a PR added `supabase/functions/**` (which has no local gate) or `packages/ai/src/capabilities/**` (which has multiple specialised gates), `ci:local` ran irrelevant checks and reported success.
2. **Drift opacity** — captured learnings encoded as flags / wrappers (e.g. `--force` on turbo test per L-turbo-cache, `CI=true` per L-jest-OOM, `warn_gate` for `authority-seed-parity` per L-ci-pipe-mask) can silently regress when the script is edited. There is no in-script gate that asserts the encoded fix is still present.

Without enforcement of (1) and (2), the green-marker that gates `gh pr create` via PreToolUse hook becomes a false positive — the exact failure mode the skill exists to prevent.

## Decision Drivers

- The Iron Law of the `local-ci-before-pr` skill: no `gh pr create` until `pnpm ci:local` green. Green must mean **green-on-this-diff**, not green-on-some-diff.
- Captured learnings cost real time (multi-hour debug). Silent regression of an encoded mitigation reverses that investment.
- CI runners cost wall-time + Vercel preview fan-out. Catching coverage gaps before push avoids that cost.
- The skill body and the script must stay synchronized — a learning that is documented in the skill but not encoded in the script is theatre.

## Considered Options

1. **Documentation-only.** Tell developers to run `ci:local` and trust them to know what each gate covers. Skill body lists path→gate mapping for reference.
2. **Coverage-only gate.** Add `coverage-check` as a first gate that diffs HEAD vs `origin/development`, maps each changed path to required gates, and FAILs if any required gate is missing from the run. No drift detection.
3. **Coverage + Drift + Self-Learning loop.** `coverage-check` (diff-aware path→gate enforcement) + `learning-cross-check` (greps the script for captured-learning mitigations and FAILs on missing encoding) + `baseline-check` / `self-learn-write` (writes JSONL row per run, computes baseline, flags duration outliers and flaky gates).

## Decision Outcome

Chosen option: **Option 3 — Coverage + Drift + Self-Learning loop**, because:

- Option 1 has been shown to fail in this codebase repeatedly (council 2026-05-17). Documentation alone is not enforcement.
- Option 2 closes the coverage gap but leaves drift open. Drift is the higher-cost failure mode (rediscovering a learning is more expensive than rediscovering a gap).
- Option 3 closes both gaps and adds self-instrumentation that grows the skill's intelligence over time without code changes per learning (only one grep line per encoded learning).

## Rules & Consequences

### Rules

1. **`coverage-check` runs first** in `scripts/ci-local.sh`. It computes `git merge-base origin/development HEAD`, diffs that against HEAD, and classifies each changed path via a longest-prefix-wins mapping table. Five verdicts: `META` (FAIL — self-modifying), `BLOCK` (FAIL — no local gate, PR-body ack required), `REQUIRE` (collect required gate names; verify at end-of-run), `PAIR` (must move with sibling path), `WARN` (external/no-gate, informational), `SKIP` (doc-only OK).
2. **`learning-cross-check` runs mid-run.** It greps a stripped copy of `ci-local.sh` (function-body removed to avoid self-match) for each captured-learning encoding. Six grep assertions in v1: `--force` on vitest, no `--depth=1` in `git fetch`, `export CI=`, `warn_gate "authority-seed-parity"`, `max-old-space-size=`, `--concurrency=1` on `turbo run build`. FAILs the run if any encoding is absent.
3. **`baseline-check` runs first, after Supabase preflight.** Reads last 20 rows from `.ci-local/runs.jsonl` at current `mapping_version`. Reports avg duration, flaky-gate list, recent FAIL signatures. Never FAILs — informational.
4. **`self-learn-write` runs last.** Appends current run as JSONL row to `.ci-local/runs.jsonl`. Caps log at 200 rows. Computes per-gate and total-run outliers vs last-20 baseline; emits WARN line if total >2× avg or any gate >3× its avg (and >10s absolute).
5. **`COVERAGE_MAPPING_VERSION`** is bumped whenever the path→gate mapping table or the learning-encoding rules change. Older rows in `.ci-local/runs.jsonl` are excluded from baseline math (apples-to-apples).
6. **Marker JSON** (`.git/.ci-local-green-<HEAD_SHA>`) records `head_sha`, `merge_base_sha`, `mapping_version`, `gates_invoked[]`, `timestamp`. PreToolUse hook validates HEAD match. v2b will validate `merge_base_sha` and `mapping_version` too.
7. **Bypass envs are per-invocation only:** `CI_LOCAL_BYPASS=1` for hook, `CI_LOCAL_COVERAGE_BYPASS=1` for fetch failure tolerance, `CI_LOCAL_BYPASS_SELF=1` for META downgrade when intentionally editing the script.
8. **Promotion path:** if the same outlier-class hits 3 different sessions, promote — add a row to the skill body's learning-encoding table, add a grep assertion to `learning_cross_check()`, bump `COVERAGE_MAPPING_VERSION`.

### Good, because

- Diff-aware enforcement closes the false-green failure mode for the marker.
- Captured-learning encodings cannot silently regress without `learning-cross-check` catching it on the next run.
- Outlier surface gives early warning of CI-relevant performance regressions (cold-start spikes, new flaky gates) without false-failing the run.
- The system is self-documenting: `.ci-local/runs.jsonl` is the audit trail; the skill body is the policy; the script is the implementation.
- Mapping table lives in one place (script), referenced once in skill body — drift between the two is impossible because the skill links to the function, not duplicates it.

### Bad, because

- Adds ~250 lines to `scripts/ci-local.sh` and three pseudo-gates. Higher maintenance burden.
- `learning-cross-check` requires manual encoding per learning — new learnings only enforced if someone adds the grep.
- Outlier thresholds (2× total, 3× per-gate) are heuristic; will need tuning.
- Self-modifying script catch-22: first run after editing `ci-local.sh` requires `CI_LOCAL_BYPASS_SELF=1` to clear the META check. Documented in skill but easy to forget.
- Cross-worktree contamination still possible: `.ci-local/runs.jsonl` is per-worktree (because `ROOT="$(cd "$(dirname "$0")/.." && pwd)"`), so baseline math doesn't see runs from sibling worktrees of the same campaign.

### Agent Impact

- **Claude (when running `pnpm ci:local`):** must understand that META violations are informational unless ci-local.sh changed in the diff. Must surface bypass env vars to operator in failure paths.
- **Pontus + future devs:** when editing `scripts/ci-local.sh`, set `CI_LOCAL_BYPASS_SELF=1` for the first run. When adding a new learning, encode its mitigation grep in `learning_cross_check()` and bump `COVERAGE_MAPPING_VERSION`.
- **CI workflows:** unchanged. `coverage-check` and friends are local-only enforcement. GH Actions remains source of truth for accepted-merge gates.
- **Skill (`local-ci-before-pr`):** updated to document Coverage Mandate, Self-Learning Loop, Marker Lifecycle, Bypass envs. Skill body is sync'd 1:1 with this ADR.

### Open / Phase v2b deferred

- Marker JSON validation in hook (currently only HEAD match).
- Bypass paper-trail: `CI_LOCAL_BYPASS_REASON=...` required non-empty; auto-injected `<!-- ci-local: bypassed (reason: X) -->` to PR body.
- Self-consistency check: parse `.github/workflows/*.yml` `paths:` filters and assert mapping has every entry.
- 3rd-occurrence auto-promotion: when an outlier-class appears in 3 different `.ci-local/runs.jsonl` rows, surface a "promote candidate" line.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md` if appropriate.
