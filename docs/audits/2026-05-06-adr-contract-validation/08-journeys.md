---
title: "Slice 08 — Journeys ADR/Contract Audit"
status: done
created: 2026-05-06
updated: 2026-05-06
auditor: slice-08
adr_refs: [ADR-0031, ADR-0038]
---

# Slice 08 — Journeys Audit

**Surfaces:** `docs/journeys/`, `packages/ai/src/journey/`, `packages/ai/src/missions/`, `apps/e2e/`
**ADRs verified:** ADR-0031 (Journey Portal System), ADR-0038 (Journey Agent & Output Generators)
**Date:** 2026-05-06

---

## Summary

The journey traceability system is structurally in place but broken in practice. 221 JOURNEY docs exist, 151 E2E specs exist — but fewer than 25 journeys have an explicit E2E link in frontmatter, and the slug→engine_process→spec traceability index that ADR-0031 Phase 3 requires does not exist. P-001, the only Protocol-class journey, is permanently skipped due to missing `data-testid` attributes. The `packages/ai/src/journey/` package has only one file (`compile.ts`) — the registry, manifest, and types files referenced in ADR-0038 do not exist.

---

## Findings

### CRIT-08-01 — `packages/ai/src/journey/` package is a stub (ADR-0038)

**Severity:** HIGH

ADR-0038 requires `packages/ai/src/journey/` to contain the journey agent and output generators. The directory has exactly one file: `compile.ts`. The files `registry.ts`, `manifest.ts`, `types.ts`, and `index.ts` are absent — `ls -la` confirms. The output generators (`generateE2ETest`, `generateOnboardingDoc`, `generateLinearSpec`, `generateBotssonScript`) described in ADR-0038 §Architecture do not appear in this package. The compile.ts file is a pure-function compiler for the engine pipeline — correct per ADR-0031, but ADR-0038 Phase 2 deliverables are not present here.

**Note:** Output generators exist in `apps/e2e/generators/` (3 files: audit-generator, mission-generator, docs-generator), indicating the implementation drifted from the package boundary declared in ADR-0038. This is an architectural placement violation, not a functionality gap.

**Delta from baseline:** Not previously tracked. New finding.

---

### HIGH-08-01 — Journey→E2E traceability is near-zero (ADR-0031 Phase 3)

**Severity:** HIGH

Coverage table:

| Metric | Count | % of 221 |
|--------|-------|----------|
| JOURNEY-*.md files (root, excl. archive) | 221 | — |
| With `e2e_test:` frontmatter field | 59 | 27% |
| With non-null `e2e_test:` (actual spec path) | 25 | 11% |
| With `verified_at:` date | 66 | 30% |
| Status = `verified` | 82 | 37% |
| Status = `done` | 117 | 53% |
| Status = `draft` | 12 | 5% |
| Status = `in_progress` | 6 | 3% |
| Missing `e2e_test:` field entirely | 162 | 73% |

Only 25/221 journeys (11%) have a confirmed E2E spec path in frontmatter. Of the 82 `verified` journeys, 57 carry the label without a linked E2E spec. The baseline stated "190/201 zero E2E coverage" — current count is 196/221 zero coverage (same ratio, count grew with new journeys added since baseline).

**Delta from baseline:** Total JOURNEY count grew from ~201 to 221. Coverage ratio unchanged. Confirmed baseline finding.

---

### HIGH-08-02 — P-001 permanently skipped, no replacement (ADR-0031, ADR-0038)

**Severity:** HIGH

The only Protocol-class E2E test (`apps/e2e/tests/protocol.spec.ts`) is unconditionally skipped:

```ts
test.skip(
  true,
  "P-001 references data-testid attributes (onboarding-hero, onboarding-manual-mode, …)
   that do not yet exist on the onboarding page."
);
```

This skip has no issue reference, no tracking date, and no owner. The protocol runner infrastructure (`apps/e2e/runners/protocol-runner.ts`, `apps/e2e/generators/`) is fully built and functional — but has zero active protocols exercising it. ADR-0038 Phase 3 requires automated test runs triggered by status changes; these cannot run without at least one non-skipped protocol.

**Delta from baseline:** Confirmed existing finding. Still a `test.skip(true, ...)` hardcoded skip.

---

### HIGH-08-03 — No slug→engine_process→JOURNEY traceability index (ADR-0031 Phase 3)

**Severity:** HIGH

ADR-0031 requires journeys to reference engine_process slugs. Only ~10 JOURNEY docs reference `engine_process` in their body text; none use a structured `engine_process:` frontmatter field. The `compile.ts` function uses `journeySlug` as the `process_id`, but there is no index mapping JOURNEY-*.md slugs to runtime engine_process rows. Without this index, it is impossible to know which docs describe active runtime processes and which are orphaned design docs.

Cross-reference: `packages/ai/src/journey/compile.ts` exists and is correct, but it is only invoked programmatically — there is no CI check or registry ensuring JOURNEY docs have corresponding engine_process entries.

**Delta from baseline:** Baseline noted "Engine processes use slug conventions not matching JOURNEY-*.md naming — no traceability index." Confirmed. No index has been created.

---

### MED-08-01 — Missions package covers 6 missions; no traceability to JOURNEY docs

**Severity:** MEDIUM

`packages/ai/src/missions/registry.ts` defines 6 missions: `onboarding-interview`, `landing-demo`, `mr-botsson`, `haccp-inspector`, `shift-assistant`, `botsson-session`. None of these have a corresponding `JOURNEY-*.md` doc describing their user journeys (what the user does, error paths, postconditions). The missions package exports are used by stage-engine and onboarding flows but have no formal journey definition backing them — in violation of the CLAUDE.md mandate that every feature declares journeys.

**Delta from baseline:** Not previously tracked. New finding.

---

### MED-08-02 — 5 JOURNEY docs with `in_progress` status (stale)

**Severity:** MEDIUM

Six journeys carry `in_progress` status:
- `JOURNEY-helpdesk-web.md`
- `JOURNEY-helpdesk-shared-primitives.md`
- `JOURNEY-helpdesk-mobile.md`
- `JOURNEY-handover-migration.md`
- `JOURNEY-e2e-wizard-validation.md`
- `JOURNEY-progressive-channel-schema.md`

These may represent active campaign work (helpdesk sub-sorties are active per git status) or stale docs. Active-campaign filter applies to helpdesk; the others (`handover-migration`, `e2e-wizard-validation`, `progressive-channel-schema`) have no corresponding active branch per `git worktree list` baseline.

**Delta from baseline:** Not previously tracked. 3 of 6 are likely stale.

---

### LOW-08-01 — Frontmatter completeness: 73% missing `e2e_test:` field

**Severity:** LOW

162/221 JOURNEY files have no `e2e_test:` field in frontmatter at all — not even `e2e_test: null`. The field is used by the Journey Portal (ADR-0031) to track test linkage. Files predating the field addition simply lack it, making portal queries unreliable. All JOURNEY docs should carry `e2e_test: null` as a minimum when no test exists.

---

### LOW-08-02 — Non-standard status values in frontmatter

**Severity:** LOW

Two non-standard status values found:
- `ready-for-merge` (hyphenated): `JOURNEY-cascade-gate-write.md`
- `ready_for_merge` (underscored): `JOURNEY-agent-harness.md`

The CLAUDE.md mandated values are `draft | in_progress | review | done | archived`. Neither `ready-for-merge` nor `ready_for_merge` is a valid status. These journeys should transition to `done` post-merge.

---

## Coverage Table

| Journey area | JOURNEY docs | E2E spec linked | Notes |
|---|---|---|---|
| Contracts | ~15 | 8 | Best-covered area |
| Helpdesk | ~12 | 9 | Active campaigns |
| Mobile | ~10 | 5 | In-progress sub-sorties |
| Season/Schedule | ~8 | 3 | Season specs exist |
| Cascade | ~8 | 1 | Only drift-observability |
| Auth | ~6 | 5 | Good coverage |
| Billing | ~8 | 0 | Zero E2E |
| MCP servers | ~8 | 0 | Service-layer tests only |
| Voice/LiveKit | ~6 | 0 | Zero E2E |
| Agent/Harness | ~12 | 3 | Eval-based coverage |
| All others | ~128 | 0 | No coverage |

**Overall E2E coverage: 25/221 = 11%**

---

## ADR Compliance Summary

| ADR | Requirement | Status |
|-----|-------------|--------|
| ADR-0031 Phase 1 | `journey`, `journey_step`, `journey_event`, `journey_test_run` tables | PASS — all in database.types.ts |
| ADR-0031 Phase 1 | 13-status lifecycle + portal UI | PASS — portal at `/platform-admin/journeys/` |
| ADR-0031 Phase 2 | AI wizard at `/platform-admin/journeys/wizard` | PASS — route exists |
| ADR-0031 Phase 3 | Linear sync + automated test runs + traceability index | FAIL — no index, no active protocols |
| ADR-0038 Phase 2 | Output generators in `packages/ai/src/journey/` | FAIL — generators in `apps/e2e/generators/` (placement drift) |
| ADR-0038 | `wizard_session` table | PASS — in database.types.ts |
| ADR-0038 | `packages/ai/src/journey/` registry + types | FAIL — package is a single-file stub |

---

## Delta from 2026-05-02 Baseline

| Baseline claim | Verified? | Current state |
|---|---|---|
| 190/201 journeys zero E2E coverage | YES | 196/221 (ratio unchanged, corpus grew) |
| P-001 permanently skipped on missing data-testid | YES | Hardcoded `test.skip(true, ...)` |
| Engine process slugs don't match JOURNEY naming | YES | No traceability index created |
| Only 1 Playwright Protocol (P-001) | YES | Still only P-001, still skipped |

No regression from baseline. Corpus grew by ~20 journeys with no coverage improvement.

---

## Top 3 Priority Actions

1. **Add `data-testid` to onboarding components and re-enable P-001** — The entire protocol infrastructure is built; one skipped test is the only blocker. Un-skipping P-001 activates audit-generator + mission-generator outputs and starts validating the journey portal end-to-end.

2. **Create a `journey-slug → engine_process_id` traceability index** — Either a frontmatter `engine_process:` field enforced by CI, or a generated `docs/journeys/TRACEABILITY.md`. Without this, the ADR-0031 Phase 3 audit trail is impossible to maintain as journey count grows past 221.

3. **Backfill `e2e_test: null` on the 162 JOURNEY files missing the field** — One grep+sed pass. Enables reliable portal queries and makes the coverage gap quantifiable in the Journey Portal UI rather than requiring external grep to measure.
