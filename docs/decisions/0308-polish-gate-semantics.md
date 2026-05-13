---
title: "Polish-Gate Semantics — Measurement, Bypass, Verified-Flip"
id: ADR_0308
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
---

# ADR-0308: Polish-Gate Semantics — Measurement, Bypass, Verified-Flip

**Status:** Proposed
**Date:** 2026-05-14
**Supersedes:** None
**Related:** `smartout-page-polish` skill (SKILL.md), `.husky/pre-commit` lines 245-281

## Context and Problem Statement

The husky pre-commit hook blocks any change to `apps/web/src/app/dashboard/<route>/**` unless a corresponding `.claude/page-polish/<route-slug>.run.yml` has `verified: true`. The hook's only escape valve is the env-var `SKIP_PAGE_POLISH=1`.

What "verified: true" actually means is defined only in the `smartout-page-polish` SKILL.md text — not in any ADR. The skill prescribes an 8-phase workflow with runtime Lighthouse measurement (Phase 1 baseline, Phase 3 retest). When infrastructure problems (Docker daemon down, WSL2 integration off, dev-server can't boot) block measurement, the gate becomes a hard stop with no formal guidance on how to proceed.

Observed pattern (2nd occurrence, 2026-05-14): a polish sortie ships SKILL-prescribed code patterns (`loading.tsx` returns null, AnimatePresence crossfade, `next/dynamic` lazy, deferred queries) but the runtime measurement step is blocked by infrastructure. Three options surface every time:

1. Wait for infra (sortie held open, branch diverges)
2. Pattern-match: flip `verified: true` based on diff inspection alone (silently weakens the gate)
3. Bypass via `SKIP_PAGE_POLISH=1` (honest, but undocumented when acceptable)

## Decision Drivers

- Gate must not be performative. If `verified: true` doesn't mean "measured", the gate is theatre.
- Infrastructure failures (Docker WSL2 off, dev-server can't boot) are real and recurring; sorties can't sit open indefinitely.
- Pattern-match is structural confidence (the code looks right) but ≠ empirical confidence (the code performs right). These are different claims.
- `SKIP_PAGE_POLISH=1` already exists in the hook and surfaces in git history — honest about what happened.
- No single source of truth defines what counts as "measurement" — staging Lighthouse? Local devtools recording? Playwright CDP? CI-run Lighthouse?

## Considered Options

1. **Strict gate, no exceptions.** `verified: true` requires runtime Lighthouse cold + warm meeting checklist thresholds. No commits until measured. Infra failures = sortie held open.
2. **Pattern-match acceptance with `measured_elsewhere: true` field.** New run.yml field allows flipping `verified: true` when diff matches SKILL patterns even without runtime numbers.
3. **Bypass-with-rationale via SKIP_PAGE_POLISH.** Keep gate strict. Document acceptable bypass conditions + required commit-message content. `verified: true` reserved for measured.

## Decision Outcome

**Chosen option: 3 — Bypass-with-rationale via SKIP_PAGE_POLISH.**

`verified: true` means: runtime Lighthouse cold + warm measured against the served code-under-test, and all checklist items in run.yml pass. Nothing else flips this to true. Pattern-match is supplementary evidence, never replacement.

`SKIP_PAGE_POLISH=1` is acceptable when ALL of:

- Infrastructure failure blocks runtime measurement (document the failure mode in commit body)
- The diff implements only SKILL-prescribed patterns (no novel architectural changes masked as polish)
- The run.yml stays `verified: false` until measurement happens
- The commit body contains: (a) the infra failure cited, (b) the SKILL.md section referenced for each pattern, (c) the follow-up plan to re-measure

The sortie stays open until measurement happens. `verified: true` is the close-feature gate, not a per-commit gate.

### Rejected: `measured_elsewhere: true` field

No validator exists for this field. No convention defines what "elsewhere" means (CI? staging? colleague's machine?). Introducing the field would silently lower the bar for every future polish-run with no governance. If staging/CI Lighthouse becomes a legitimate measurement source, a future ADR can extend run.yml with `pre_measured_at` + `evidence_url` + signed-by fields. Until then, the field is noise.

### Rejected: `code_review_only: true` hook escape

Softer than `SKIP_PAGE_POLISH=1` (no env-var to remember, less friction). That softer friction is exactly the wrong direction — bypasses should leave a clear trace in git history (commit author chose to set `SKIP_PAGE_POLISH=1`) rather than a flag in a YAML that ages out of memory.

## Rules & Consequences enforced for Agents

- **Good, because** the gate stays empirical. `verified: true` means measured. Run.yml is never a lie.
- **Good, because** the SKIP_PAGE_POLISH bypass is honest — surfaces in `git log`, can be audited.
- **Good, because** sorties can ship code under infra failure without falsifying their verification state.
- **Bad, because** sorties stay open longer when infra is unstable. Mitigate with weekly `git merge development` into the held branch.
- **Agent Impact:**
  - When polish-gate fires and infra blocks measurement: commit with `SKIP_PAGE_POLISH=1`, include rationale per "SKIP_PAGE_POLISH=1 is acceptable when" list above. Do NOT flip `verified: true`.
  - When flipping `verified: true`: confirm Lighthouse numbers exist in run.yml `speed_test` + `retest` blocks. If any threshold check is `false`, do not flip.
  - When designing new gate semantics: do not add fields to run.yml that lack a validator. Soft fields rot.
  - Code-review for polish-sortie commits: a reviewer seeing `SKIP_PAGE_POLISH=1` in commit body should verify the bypass rationale lists infra cause + SKILL.md citations + re-measure plan.

## Verification

`grep -r "SKIP_PAGE_POLISH=1" "$(git log --all --format=%h)"` reveals every historical bypass. ADR-0308 makes those bypasses readable as a class.

`.claude/page-polish/<route>.run.yml` schema is unchanged — no new fields introduced.

## Open Questions (for future ADR)

- Does a CI-run Lighthouse against the merged-to-development build count as "measurement" for retroactive `verified: true` flip? Probably yes, but the schema for recording it doesn't exist yet.
- Should `apps/e2e/scripts/schedule-perf-baseline.ts`-style Playwright CDP scripts replace Lighthouse for the cold-load LCP measurement, given they run headless without dev-server in the loop? Probably yes for tier-1 polish, no for tier-2 (where TTI + INP matter).
