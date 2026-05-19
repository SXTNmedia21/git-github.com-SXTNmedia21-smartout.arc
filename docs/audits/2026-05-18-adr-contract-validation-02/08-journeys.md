---
title: "Audit Slice 08 — Journeys"
status: done
created: 2026-05-18
updated: 2026-05-18
module: journeys
tags: [audit, journeys, adr-0031, adr-0038, e2e, day-line]
---

# Slice 08: Journeys — ADR-0031 + ADR-0038 Compliance

**Surface audited:** `docs/journeys/`, `packages/ai/src/journey/`, `packages/ai/src/missions/`, `apps/e2e/`
**ADRs:** ADR-0031 (Journey Portal System), ADR-0038 (Journey Agent & Output Generators)
**Focus:** 5 in-flight day-line journeys added 2026-05-18 for ADR-0367

---

## Scope

484 JOURNEY-*.md files exist. This slice audits the 5 active in-flight journeys added today:

- `JOURNEY-day-line-create.md`
- `JOURNEY-day-line-edit-hours.md`
- `JOURNEY-day-line-attach-routine.md`
- `JOURNEY-day-line-employee-view-mobile.md`
- `JOURNEY-day-line-push.md`

---

## ADR-0031 Compliance (1–5 journeys declared per feature, journey portal lifecycle)

| Check | Status | Notes |
|---|---|---|
| 5 journeys declared at feature start (ADR-0367) | PASS | Commit `4c4e9ae7d` adds all 5 in one atomic docs commit before or alongside code |
| Frontmatter present on all 5 | PASS | `title`, `status`, `created`, `updated`, `module`, `tags` all present |
| `status: accepted` on all 5 | PASS | All carry `status: accepted` (not `draft` or `in_progress`) |
| Module tag correct (`daytimeline`) | PASS | Consistent across all 5 |
| ADR cross-references present | PASS | Each doc lists 4–8 relevant ADR refs in header + footer |

---

## ADR-0038 Compliance (happy path, error paths, roles, postconditions)

| Check | Verdict | Notes |
|---|---|---|
| Happy path documented | PASS | All 5 have numbered step sequences |
| Postcondition documented | PASS | All 5 have `**Postcondition:**` section |
| Error paths documented | PASS | All 5 have error-path table with Condition / System behaviour / User sees columns |
| Roles explicit | PASS | Manager (create, edit-hours, attach-routine), Employee (mobile view), Engine (push) — each journey specifies actor in title and preconditions |
| E2E coverage pointer present | PASS | All 5 include `**E2E coverage pointer:**` with spec path and status note |

---

## Findings

### F1 — MEDIUM: E2E path pointers stale in all 5 journey docs

All 5 journey docs list e2e spec paths under `apps/e2e/day-line/` (old flat layout). Actual specs live at `apps/e2e/tests/day-line/` (3 specs) and `apps/e2e/tests/mobile/` (1 spec).

Additionally, pointer filenames for create, edit-hours, and attach-routine include a redundant `day-line-` prefix:

| Journey doc pointer | Actual path |
|---|---|
| `apps/e2e/day-line/day-line-create.spec.ts` | `apps/e2e/tests/day-line/create.spec.ts` |
| `apps/e2e/day-line/day-line-edit-hours.spec.ts` | `apps/e2e/tests/day-line/edit-hours.spec.ts` |
| `apps/e2e/day-line/day-line-attach-routine.spec.ts` | `apps/e2e/tests/day-line/attach-routine.spec.ts` |
| `apps/e2e/day-line/day-line-employee-mobile-view.spec.ts` | `apps/e2e/tests/mobile/day-line-employee-view.spec.ts` |
| `apps/e2e/day-line/day-line-push.spec.ts` | Does not exist yet (correctly marked NOT YET WRITTEN) |

Impact: stale pointers mislead developers navigating from journey doc to spec file. Non-blocking (specs exist and reference the journey doc correctly via `Journey: JOURNEY-day-line-*.md` header comment).

### F2 — LOW: `JOURNEY-day-line-push.md` has no E2E spec (intentional gap, gated)

The push journey explicitly notes `Status: NOT YET WRITTEN — gated on Phase E (push pipeline) merge`. This is intentional and documented. No violation of ADR-0038 (E2E tests are "recommended" not "required" per CLAUDE.md feature closure gates).

No spec exists and none is expected until Phase E merges.

### F3 — OBSERVATION: E2E specs correctly gate on Phase C UI wiring

`create.spec.ts` and `attach-routine.spec.ts` use `test.skip` / graceful degradation patterns when `data-testid` triggers are absent. This is correct practice for pre-phase work — specs exist, run without error, and will activate automatically when UI is wired. Compliant with ADR-0038 intent.

---

## Broader Corpus Check (484 JOURNEY docs)

| Check | Result |
|---|---|
| `packages/ai/src/journey/` | Contains `compile.ts`, `index.ts`, `manifest.ts`, `registry.ts`, `types.ts` — no day-line-specific entries (day-line is not a mission-driven capability; no mission mapping needed) |
| `packages/ai/src/missions/` | No day-line references (correct — day-line is D6 production, not a learning-path mission) |
| Status distribution | 297 `verified`, 131 `done`, 28 `draft`, 11 `in_progress`, 5 `accepted`, 2 `deferred` — healthy ratio |

---

## Summary

| Category | Count |
|---|---|
| PASS | 10 |
| MEDIUM findings | 1 (F1 — stale e2e path pointers in all 5 docs) |
| LOW findings | 1 (F2 — push spec not yet written, intentional) |
| CRITICAL | 0 |

The 5 day-line journeys are structurally compliant with ADR-0031 and ADR-0038. The only actionable gap is the stale e2e path strings in journey doc pointers (F1) — low-effort fix, update `apps/e2e/day-line/` → `apps/e2e/tests/day-line/` and remove redundant `day-line-` filename prefixes in the 4 docs where specs exist.
