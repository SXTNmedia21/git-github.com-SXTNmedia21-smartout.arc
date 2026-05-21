---
title: Slice 04 — schedule-cascade Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, schedule-cascade, adr]
---

# Slice 04 — schedule-cascade

**Scope:** `apps/web/src/app/dashboard/schedule/`, `apps/web/src/lib/cascade/`,
`packages/ai/src/industry/`, `apps/web/src/components/day/`.
**ADRs in scope:** 0032, 0047, 0091, 0156, 0204 (+ contextual 0099, 0134, 0366, 0367).
**Anchor:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`.
**Method:** code-trace, every claim has file:line evidence.
**Baseline:** 2026-05-18-02 slice 04 (4 findings: ADR-0366 oklch ban FAIL, shift_session UI absent,
duty_leader SA emit unverified, framework-rule stubs).

---

## Summary (top 5)

1. **F-04-01 MEDIUM** — `NoteEditDialog.tsx:89` direct `supabase.from("session_note").insert()` inside
   `components/day/` widget, missing `emit()`. Violates ADR-0156 portability + ADR-0134 telemetry.
2. **F-04-02 MEDIUM** — `pin-day-control-context.ts:35` Server Action writes `engine_memory` with no
   `emit()`. ADR-0134 telemetry-on-mutation violation.
3. **F-04-03 LOW** — `OverviewTab.tsx:7` `useRouter` from `next/navigation` inside `components/day/tabs/`
   widget. ADR-0156 portability discipline forbids `next/*` in day widgets (mobile extraction breakage).
4. **F-04-04 LOW** — Event names use whitespace not dot-namespacing: `"session duty_leader_updated"`
   (`update-department-session-action.ts:137`), `"change_proposal approved"` / `"rejected"`
   (`agent-proposals-context.tsx:131,152,205`). Drifts from ADR-0367 Rule 10 convention.
5. **F-04-05 LOW** — `industry/loader.ts:76-78` silent tier-3 fallback on DB error/empty rates,
   no `emit`/warn. Carry-over from baseline (FP-002 carve-out: rates labelling is fine; observability
   gap is real).

---

## Findings table

| ID | Sev | File:line | ADR | Evidence |
|---|---|---|---|---|
| F-04-01 | MEDIUM | `apps/web/src/components/day/NoteEditDialog.tsx:89` | 0156, 0134 | Direct `supabase.from("session_note").insert(...)` in widget; no emit; no `gateAction` (session_note is `leaf` so gate not required, but emit is) |
| F-04-02 | MEDIUM | `apps/web/src/app/dashboard/_actions/pin-day-control-context.ts:35` | 0134 | `engine_memory.insert` without `emit()` after success |
| F-04-03 | LOW | `apps/web/src/components/day/tabs/OverviewTab.tsx:7,45,123` | 0156 | `useRouter` + `router.push(task.href)` inside day-widget violates Phase 1 portability ("no Next-specific hooks") |
| F-04-04 | LOW | `update-department-session-action.ts:137`; `agent-proposals-context.tsx:131,152,205` | 0367 R10 (style) | Event names `session duty_leader_updated`, `change_proposal approved/rejected` use whitespace; modern dot-namespacing per ADR-0367 Rule 10 |
| F-04-05 | LOW | `packages/ai/src/industry/loader.ts:76-78` | 0091 obs | Tier-3 fallback returns hardcoded package silently on DB error/empty — no observability emit |
| F-04-06 | LOW | `apps/web/src/lib/cascade/evaluate-framework-rules.ts:128-138, 140-143` | 0091 | `sunday_holiday_shift` only checks Sunday (holiday branch stubbed); `split_shift_gap` returns null. No `// TODO ADR-XXXX` deferral marker (carry-over) |
| F-04-07 | INFO | `apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx:204-209` | 0134 | `approveAllProposals` emits inside loop without H2 boot guard; `approveProposal` (line 129) does guard. Inconsistency only — guard absent inside `approveAllProposals` will throw on empty-string IDs |
| F-04-08 | INFO | `apps/web/src/lib/cascade/get-tariff-context.ts:28-78` | 0032 | Loader fetches from DB inside `lib/cascade/` — by design (caller passes client); name flag for future reviewers — this is a context-loader, not a pure derivation, and that distinction is not documented in `lib/cascade/index.ts` |

---

## Per-ADR rollup

| ADR | Compliant | Partial | Violation |
|---|---|---|---|
| 0032 Schedule local state | apps/dashboard/schedule | — | — |
| 0047 Schedule DB persistence | All schedule `_hooks/` mutation hooks (emit() in onSuccess) | — | — |
| 0091 C4 gate placement | `update-department-session-duty-leader`, `signoff-session`, `toggle-session-task`, `day-line/*` capabilities all route through `gateAction`/`gate_action` | `evaluate-framework-rules.ts` (2 stub cases) | — |
| 0156 Day-Control canonical surface | `WebDayControl.tsx`, `derivePhase`, `derive-day-line-status` clean; tabs route to Server Actions | `OverviewTab.tsx` (useRouter); `NoteEditDialog.tsx` (direct DB) | — |
| 0204 Composition orchestrator | All per-capability `gate.ts` files (incl. `day-line/gate.ts`) whitelisted per `scripts/ci/no-inline-gate-rpc.sh:30-42`; no inline `gate_action`/`cascade_gate_write` outside allowlist | — | — |
| 0099 gate_action mandatory | `day-line/tools.ts:141,268,440` fail-closed; `update-department-session-action.ts:113` | — | — |
| 0134 Telemetry coverage | `use-shifts` 8 emits, `use-day-content` 6 emits, `use-templates`, `use-absences`, `agent-proposals-context` 3 emits, `update-department-session-action.ts:136` emit | `agent-proposals-context.tsx:204-209` (no boot guard) | `NoteEditDialog.tsx:89`, `pin-day-control-context.ts:35` (no emit) |
| 0366 OKLCH literal ban | `components/day/SaveTemplateDialog`, `SavedTimelinesDropdown`, `ApplyTemplateDialog`, `SlotPicker`, `TimelineTab`, `schedule/_components/shift-employee-tag`, `shift-task-tag`, `week-grid`, `shift-ghost-tag` all use `var(--slot-*-bg)` / `var(--tag-*-bg)` semantic tokens; **0 `oklch(` literals** in surface (verified `grep -rn "oklch(" apps/web/src/components/day/ apps/web/src/app/dashboard/schedule/ apps/web/src/lib/cascade/`). Baseline FAIL → **resolved**. | — | — |
| 0367 D6 tri-layer | `useDayLines` reads `day_line` with workspace+date scope (`use-day-lines.ts:69-70`); `day-line/tools.ts` 4 tools shipped with bare names, `gateDayLineAction` on every mutation, ADR-0240 delegation to `task.create_session` + `applyTemplate`, Pattern B audit-symmetry fields emitted (`actor_capability` + `delegated_via`) | `shift_session` schema-present, no UI consumer in `apps/web/src/` outside types (in-progress per council) | — |

---

## Verified intentional (NOT findings)

- **FP-002** Hospitality tariff numeric values — labels say "2025-mellomoppgjør (effective 2025-04-01)"
  (`hospitality.ts:74-77`). DB is runtime SoT. Labels correct.
- **FP-003** `useRoster` department filter — historical; current code uses `position!inner` join.
- **ADR-0204 §3 grep allowlist** — Per-capability `gate.ts` (incl. `day-line/gate.ts`) explicitly
  whitelisted by `scripts/ci/no-inline-gate-rpc.sh:30-42`. Not a violation. Per-cap thunks await SS-5
  migration to orchestrator.
- **Cascade purity** — `apps/web/src/lib/cascade/get-tariff-context.ts` loads from DB but the pure
  derivation functions (`resolve-tariff-rate`, `evaluate-framework-rules`, `derive-day-line-status`,
  `compute-proposal-preview`, `resolve-hours`) take pre-loaded inputs. Pipeline boundary intact.
- **`schedule_shift`/`schedule_absence`/`schedule_template` direct writes** — Per
  `packages/data/src/cascade/classify.ts:32-72`, none of these are `governance` — they are
  `cascade-input` or `leaf`. ADR-0091 does not apply. ADR-0047 grandfathered direct supabase
  writes with audit triggers + emit in `onSuccess` (verified across all hooks).
- **Baseline finding #3 (duty_leader SA emit unverified)** — RESOLVED. `update-department-session-action.ts:136-153`
  has explicit `emit()` after gated write. No drift.

---

## In-progress (mid-campaign)

- **`shift_session` UI layer** — ADR-0367 v1.1 tri-layer model: `department_session → day_line → shift_session`.
  `day_line` is wired (`use-day-lines.ts`, `day-line/tools.ts`). `shift_session` schema exists
  (`database.types.ts:18763` per baseline) but no UI consumer in `apps/web/`. Council 2026-05-18
  approved as multi-strip wiring + dialogs in-flight. Not a regression.
- **`session_hook` UNIQUE constraint** — ADR-0367 Rule 1b mandates Phase A migration adds
  `uq_session_hook_template (workspace_id, department_id, hook_type)`. Did not verify migration
  presence in this slice — out of scope (db-rls-telemetry slice owns supabase/migrations/).
- **F-04-04 dot-namespacing migration** — Two whitelisted legacy event names with whitespace
  (`session duty_leader_updated`, `change_proposal approved/rejected`). Registry contains them
  (`registry.ts:1041, 11301`). Migration to dot-namespacing is style drift, not a shipping bug.

---

## Delta vs 2026-05-18 baseline

| Baseline finding | Status |
|---|---|
| ADR-0366 oklch literals in 9 files | **RESOLVED** — all converted to `var(--slot-*)` / `var(--tag-*)` semantic tokens |
| shift_session UI absent | **Unchanged (in-progress)** |
| duty_leader SA emit unverified | **RESOLVED** — emit verified at `update-department-session-action.ts:136-153` |
| Framework-rule stub annotation | **Unchanged** — `evaluate-framework-rules.ts:128-143` carry-over (F-04-06) |
| **NEW F-04-01** session_note widget DB write | New — predates baseline but not previously flagged |
| **NEW F-04-02** pin-day-control engine_memory no emit | New — predates baseline but not previously flagged |
| **NEW F-04-03** OverviewTab useRouter | New — portability gap not previously flagged |
| **NEW F-04-04** event-name whitespace | New style-drift |

---

**Counts:** CRITICAL 0 | HIGH 0 | MEDIUM 2 | LOW 4 | INFO 2.
No shipping blockers in scope. Two MEDIUM telemetry/portability gaps (F-04-01, F-04-02)
worth bundling into a small remediation sortie alongside dot-namespacing cleanup (F-04-04).
