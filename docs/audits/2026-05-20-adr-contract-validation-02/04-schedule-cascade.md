---
title: "Slice 04 — schedule-cascade Audit (2026-05-20 run 02)"
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, schedule-cascade, adr, 0032, 0047, 0091, 0156, 0204]
---

# Slice 04 — schedule-cascade

**Scope:** `apps/web/src/app/dashboard/schedule/`, `apps/web/src/lib/cascade/`,
`packages/ai/src/industry/`, `apps/web/src/components/day/WebDayControl.tsx`.
**ADRs in scope:** 0032, 0047, 0091, 0156, 0204 (+ contextual 0099, 0134, 0366, 0367).
**Anchor:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`.
**Baseline:** `docs/audits/2026-05-20-adr-contract-validation/04-schedule-cascade.md` (8 findings).
**Method:** code-trace against each ADR, every claim has file:line evidence.
**Auditor model:** claude-sonnet-4-6 (read-only).

---

## Summary

Delta vs same-day baseline: **1 finding aggravated** (F-04-03 scope expanded), **7 carry-over**, **0 new closures**. Net count unchanged at 8 findings.

**Top 3:**

1. **F-04-01 MEDIUM** — `NoteEditDialog.tsx:89` direct `supabase.from("session_note").insert()` inside `components/day/` widget, no `emit()`. Violates ADR-0156 portability (no Supabase access in widgets) + ADR-0134 telemetry-on-mutation.
2. **F-04-02 MEDIUM** — `pin-day-control-context.ts:35` Server Action inserts into `engine_memory` with no `emit()` after success. ADR-0134 violation.
3. **F-04-03 LOW (AGGRAVATED)** — `OverviewTab.tsx:7` carries `useRouter` from baseline. New: `use-day-timeline-scope.ts:20` (`useRouter` + `useSearchParams`) is now consumed inside `components/day/` by `ScopeFilterPill.tsx:60`, `TimelineTopBar.tsx:65`, and `tabs/TimelineTab.tsx:118` — introduced by commit `ea8292772` (2026-05-18). ADR-0156 Phase 1 portability rule: "no Next-specific hooks in day widgets." Indirect import via hook does not change the violation: mobile extraction will break.

---

## Findings table

| ID | Sev | Status | File:line | ADR | Evidence |
|---|---|---|---|---|---|
| F-04-01 | MEDIUM | OPEN (carry-over) | `apps/web/src/components/day/NoteEditDialog.tsx:89` | 0156, 0134 | Direct `supabase.from("session_note").insert(...)` in widget; zero `emit()` imports in file; `session_note` is `leaf` in `classify.ts:38` (gate not required) but telemetry is always required |
| F-04-02 | MEDIUM | OPEN (carry-over) | `apps/web/src/app/dashboard/_actions/pin-day-control-context.ts:35` | 0134 | `engine_memory.insert` returns `{ ok: false }` on error but on success just returns `{ ok: true }` with no `emit()` call; grep confirms zero `from '@smartout/telemetry'` in file |
| F-04-03 | LOW | AGGRAVATED | `apps/web/src/components/day/tabs/OverviewTab.tsx:7,45,123`; `apps/web/src/components/day/ScopeFilterPill.tsx:60`; `apps/web/src/components/day/TimelineTopBar.tsx:65`; `apps/web/src/components/day/tabs/TimelineTab.tsx:118` | 0156 | Baseline: `OverviewTab` imports `useRouter` directly. New (commit `ea8292772`): three additional day-widget files consume `useDayTimelineScope` which wraps `useRouter`+`useSearchParams` from `next/navigation`. ADR-0156 §48: "no Next-specific hooks" in Phase 1 widgets. |
| F-04-04 | LOW | OPEN (carry-over) | `apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx:131,205` | 0367 R10 | Event names `"change_proposal approved"` / `"change_proposal rejected"` use whitespace separators; ADR-0367 Rule 10 convention is dot-namespaced (`change_proposal.approved`). `approveAllProposals` loop also emits the whitespace-delimited form. |
| F-04-05 | LOW | OPEN (carry-over) | `packages/ai/src/industry/loader.ts:76-78` | 0091 obs | Tier-3 fallback: `catch { return base; }` and `if (rates.length === 0) return base` both return hardcoded rates silently — no `emit()` / `console.warn`. Operator has no signal that workspace/platform tariff rows are missing and fallback fired. |
| F-04-06 | LOW | OPEN (carry-over) | `apps/web/src/lib/cascade/evaluate-framework-rules.ts:56-125` | 0091 | `checkRule` returns `null` without explicit `// TODO ADR-XXXX` deferral markers on at least 6 `return null` branches. `sunday_holiday_shift` and `split_shift_gap` rule types silently return null (unimplemented). Baseline characterisation confirmed: stubs, not regressions. |
| F-04-07 | INFO | OPEN (carry-over) | `apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx:180-210` | 0134 | `approveProposal` (line 129) has H2 boot guard `if (workspaceId.length > 0 && profileId.length > 0)`. `approveAllProposals` (line 204) emits INSIDE loop with `nonEmpty()` directly — no boot guard. `nonEmpty()` throws on empty string; during the boot window this kills the entire approve-all handler. |
| F-04-08 | INFO | OPEN (carry-over) | `apps/web/src/lib/cascade/get-tariff-context.ts:28-78` | 0032 | Context-loader makes DB calls inside `lib/cascade/` — by design per caller-passes-client pattern; not documented in `lib/cascade/index.ts` export block. No ADR violation, flag for reviewers. |

---

## Per-ADR rollup

| ADR | Compliant | Partial | Violation |
|---|---|---|---|
| 0032 Schedule local state | `apps/dashboard/schedule` — full TanStack Query migration confirmed; no `useReducer` schedule state remaining | — | — |
| 0047 Schedule DB persistence | All `schedule/_hooks/` mutation hooks have `emit()` in `onSuccess`; `schedule_shift` / `schedule_absence` / `schedule_day_*` direct writes confirmed grandfathered per ADR-0047 | — | — |
| 0091 C4 gate placement | `update-department-session-duty-leader`, `signoff-session`, `toggle-session-task`, `day-line/*` capability tools route via `gateAction`; `cascade_gate_write` not called inline outside allowed paths | `evaluate-framework-rules.ts` (6 implicit null stubs, F-04-06) | — |
| 0156 Day-Control canonical surface | `WebDayControl.tsx` clean — no Next.js imports; `derivePhase` + `derive-day-line-status` pure helpers; `DayLineCreateSheet` delegates to Server Action via capability | `OverviewTab.tsx` (direct `useRouter`); `ScopeFilterPill`, `TimelineTopBar`, `TimelineTab` (indirect via `useDayTimelineScope`); `NoteEditDialog.tsx` (direct Supabase write + no emit) | — |
| 0204 Composition orchestrator | `day-line/tools.ts` uses `gateDayLineAction` which is whitelisted per `scripts/ci/no-inline-gate-rpc.sh`; no inline `gate_action`/`cascade_gate_write` outside allowlist found in scope | — | — |
| 0099 gate_action mandatory | `day-line/tools.ts:141,268,440` fail-closed on gate error; `update-department-session-action.ts` gates via `gateAction` RPC | — | — |
| 0134 Telemetry coverage | `use-shifts` 8 emits; `use-day-content` 6 emits; `use-shift-swap` 6 emits; `agent-proposals-context` emits in `approveProposal` + `approveAllProposals` | `agent-proposals-context.tsx:204` (no boot guard in all-approve loop, F-04-07) | `NoteEditDialog.tsx:89` (no emit, F-04-01); `pin-day-control-context.ts:35` (no emit, F-04-02) |
| 0366 OKLCH literal ban | `grep -rn "oklch(" apps/web/src/components/day/ apps/web/src/app/dashboard/schedule/ apps/web/src/lib/cascade/` returns 0 hits. **RESOLVED** from prior baseline. Commit `7728c81d9` cleared all literals. | — | — |
| 0367 D6 tri-layer | `useDayLines` reads `day_line`; `day-line/tools.ts` 4 tools shipped; `DayLineStrip`/`DayLineStripHeader`/`TimelineTopBar`/`AggregatedDayLineList` wired; `derivePhase` updated for stack-of-strips | `shift_session` UI consumer absent (in-progress, council-approved) | — |

---

## Verified intentional (NOT findings)

- **FP-002 tariff rates** — `hospitality.ts:74-77` labels say "2025-mellomoppgjør (effective 2025-04-01)". DB is runtime SoT. Labels correct. Observability gap in `loader.ts` tier-3 fallback is a REAL finding (F-04-05), not a rate-accuracy issue.
- **FP-003 `useRoster` department filter** — historical. Current code uses `position!inner` join. Not re-flagged.
- **ADR-0204 §3 per-capability `gate.ts` allowlist** — `day-line/gate.ts` is explicitly whitelisted by `no-inline-gate-rpc.sh:30-42`. Not a violation.
- **`schedule_shift` direct writes** — `classify.ts:52` marks `schedule_shift` as `cascade-input`, not `governance`. ADR-0091 C4 gate does not apply. ADR-0047 grandfathered TanStack hooks with audit triggers + emit in `onSuccess`. Verified across `use-shifts.ts` (8 emits).
- **`session_note` direct write in `NoteEditDialog`** — `classify.ts:38` marks `session_note` as `leaf`. Gate (ADR-0204/0091) is NOT required. Missing `emit()` is still a real finding under ADR-0134.
- **Baseline duty_leader SA emit** — RESOLVED. `update-department-session-action.ts:136-153` confirmed `emit()` after gated write.
- **`get-tariff-context.ts` DB calls** — caller-passes-client pattern; pure derivation functions take pre-loaded inputs. Pipeline boundary intact (F-04-08 is documentation-gap only).

---

## In-progress (mid-campaign, not regressions)

- **`shift_session` UI layer** — ADR-0367 tri-layer: `department_session → day_line → shift_session`. `day_line` wired; `shift_session` has schema (`database.types.ts`) but no UI consumer in `apps/web/`. Council 2026-05-18 approved phased delivery. Not a regression.
- **F-04-04 event name dot-namespacing** — Two legacy event names (`change_proposal approved/rejected`) with whitespace. Registry has them. Low-friction fix (rename constant + registry update). No runtime breakage.
- **F-04-03 extraction-time breakage** — Not a runtime bug today; breakage materialises when `components/day/` is extracted to `packages/ui/day-control/` for mobile. ADR-0156 requires discipline NOW to keep extraction cheap.

---

## Delta vs baseline

| Finding | Baseline status | This run status |
|---|---|---|
| F-04-01 NoteEditDialog emit | OPEN MEDIUM | OPEN MEDIUM (unchanged) |
| F-04-02 pin-day-control-context emit | OPEN MEDIUM | OPEN MEDIUM (unchanged) |
| F-04-03 ADR-0156 useRouter | OPEN LOW (OverviewTab only) | OPEN LOW **AGGRAVATED** (4 day-widget files) |
| F-04-04 event name whitespace | OPEN LOW | OPEN LOW (unchanged) |
| F-04-05 loader tier-3 silent fallback | OPEN LOW | OPEN LOW (unchanged) |
| F-04-06 evaluate-framework-rules stubs | OPEN LOW | OPEN LOW (unchanged) |
| F-04-07 approveAllProposals boot guard | OPEN INFO | OPEN INFO (unchanged) |
| F-04-08 cascade context-loader docs | OPEN INFO | OPEN INFO (unchanged) |
| ADR-0366 OKLCH literals | **CLOSED** (baseline) | CONFIRMED CLOSED |
