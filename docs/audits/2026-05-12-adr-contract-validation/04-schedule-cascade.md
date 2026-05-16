---
title: Slice 04 — Schedule-Cascade Audit
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, schedule-cascade, adr]
---

# Slice 04 — Schedule-Cascade Audit

## Summary

Top 5 findings ranked by severity:

1. **[SC-01] HIGH** — `useApproveSwap` calls `approve_shift_swap` RPC directly with no authority gate (`gate_action` / `gatedMutation`). C4 authority bypass on admin shift-swap approval.
2. **[SC-02] MEDIUM** — `department_hours_override` (D1 per CLAUDE.md) is absent from `classify.ts` `ENTITY_CLASSIFICATION`. Direct upsert in `use-hours-overrides.ts` is unregistered cascade-input; telemetry and ESLint rule cannot classify it.
3. **[SC-03] MEDIUM** — `WebDayControl.tsx` hardcodes Norwegian day/month arrays (`NORWEGIAN_DAYS`, `NORWEGIAN_MONTHS`) instead of `useTranslation`. Violates i18n mandate and ADR-0156 portability discipline.
4. **[SC-04] MEDIUM** — `OverviewTab.tsx` imports `useRouter` from `next/navigation`. ADR-0156 Phase 1 prohibits Next-specific hooks inside `apps/web/src/components/day/` widgets.
5. **[SC-05] LOW** — `use-shifts.ts` emits `"shift created"` (space-separated) while registry uses `"shift created"` (confirmed match). No misfire — but non-dot-form event name is inconsistent with newer `shift_swap.*` dot-form naming in the same registry.

---

## Findings Table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|---------|
| SC-01 | HIGH | `apps/web/src/app/dashboard/schedule/_hooks/use-shift-swap.ts:224` | ADR-0091, ADR-0204 | `useApproveSwap` calls `supabase.rpc("approve_shift_swap" as never, ...)` with no preceding `gate_action` or `gatedMutation`. Comment explicitly acknowledges: "out of scope for this sortie; tracked separately." Authority gate is C4-mandatory for every schedule_shift mutation path. |
| SC-02 | MEDIUM | `packages/data/src/cascade/classify.ts` (missing entry); `apps/web/src/app/dashboard/schedule/_hooks/use-hours-overrides.ts:67` | ADR-0091 (WP4 ESLint), cascade spec D1 | `department_hours_override` is D1 per CLAUDE.md data model but absent from `ENTITY_CLASSIFICATION`. Direct `.upsert()` is invisible to telemetry dimension classification and the `smartout/no-direct-supabase-write` lint rule. |
| SC-03 | MEDIUM | `apps/web/src/components/day/WebDayControl.tsx:54-75` | ADR-0156 (portability), CLAUDE.md i18n | `NORWEGIAN_DAYS` / `NORWEGIAN_MONTHS` hardcoded string arrays used in `formatDateLabels()`. ADR-0156 portability rule requires no hardcoded locale strings; i18n mandate says no hardcoded Norwegian. |
| SC-04 | MEDIUM | `apps/web/src/components/day/tabs/OverviewTab.tsx:7,61` | ADR-0156 | `import { useRouter } from "next/navigation"` in a day-widget. ADR-0156 Phase 1 explicitly forbids Next-specific hooks (`next/link`, `next/image`, `useRouter`, `useSearchParams`) inside `apps/web/src/components/day/` — portability contract for future `packages/ui/day-control/` extraction. |
| SC-05 | LOW | `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts:110` | ADR-0047 | `event: "shift created"` (space-separated). Registry has it registered as `"shift created"` — no functional break — but inconsistent with dot-form `shift_swap.*` naming. Telemetry event name drift risk for future renames. |

---

## Per-ADR Rollup

| ADR | Files Checked | Compliant | Partial | Violation |
|-----|--------------|-----------|---------|-----------|
| ADR-0032 | `schedule/page.tsx`, `_hooks/*` | ✅ TanStack Query replaced useReducer per ADR-0047 upgrade. ADR-0032 is superseded. | — | — |
| ADR-0047 | `_hooks/use-shifts.ts`, `use-templates.ts`, `use-employee-roster.ts` | ✅ TanStack mutations used throughout; optimistic updates present; `emit()` in `onSuccess`. `dummyEmployees` reference confirmed absent (ADR-0047 bad-because note resolved). | — | — |
| ADR-0091 | `_hooks/use-shift-swap.ts:224`; `_actions/open-session-action.ts`; `_actions/transition-session-action.ts` | ✅ session actions gate via `gateAction`. ✅ `cascade_gate_write` migrations shipped. | ⚠️ `department_hours_override` unregistered in `classify.ts`. | 🔴 `useApproveSwap` — no gate call before RPC (SC-01). |
| ADR-0156 | `components/day/WebDayControl.tsx`; `tabs/OverviewTab.tsx` | ✅ `derivePhase()` helper used for UI 6-state derivation. ✅ `OversiktView.tsx` replacement confirmed. ✅ No `next/link`/`next/image` in WebDayControl root. | ⚠️ Hardcoded Norwegian strings (SC-03). | 🔴 `useRouter` in `OverviewTab.tsx` (SC-04). |
| ADR-0204 | `packages/ai/src/gate/gatedMutation.ts`; `_actions/open-session-action.ts`; `use-shift-swap.ts` | ✅ `gatedMutation.ts` orchestrator exists with real body (gate_action + cascade_gate_write composition, correlation_id logic). ✅ `gate_evaluation` correlation migration shipped (`20260519000001`). ✅ CI script `no-inline-gate-rpc.sh` exists. ✅ Non-governance mutations (D6 session actions) correctly use single-gate `gateAction` — ADR-0204 composition is mandatory only when cascade_gate_write applies (governance entities). | — | 🔴 `useApproveSwap` — D6 schedule_shift mutation with no gate path (SC-01, same root). |

---

## Verified Intentional

| FP | Status |
|----|--------|
| FP-002 (Riksavtalen rates "wrong") | Confirmed not re-flagged. `HOSPITALITY_TARIFF_RATES` labelled "Correct (2024 satser)". Observability gap (no warn/emit on tier-3 fallback) remains a real but separate finding — not duplicated here. |
| FP-003 (useRoster dept filter bug) | Confirmed not re-flagged. `use-roster.ts` uses `position!inner` join, not direct `.eq("department_id")`. |

**New intentional pattern confirmed:**

`open-session-action.ts` uses single-gate `gateAction` (Pathway A only), not `gatedMutation`. This is correct: `department_session` is D6 cascade-input, not governance-gated per `classify.ts`. ADR-0204 dual-gate composition is only mandatory when `isGovernanceGated(entityType) === true`. Single-gate for non-governance entities is working as designed.

---

## In-Progress (Mid-Campaign)

Files in `campaign/daily-operation` (worktree at `~/dev/smartout.ai-daily-operation`):

- SC-01 (`useApproveSwap` gate gap) — comment in `use-shift-swap.ts` explicitly marks this "out of scope for this sortie; tracked separately." If `campaign/daily-operation` is the owning campaign, mark as **in-progress / acknowledged debt**, not a new violation.
- SC-03 and SC-04 (WebDayControl / OverviewTab) — both files are within the daily-operation surface. Severity downgraded to **in-progress** for those campaigns if they have active sub-sorties touching these files. Verify against `feat/sma-302-compose-override-fix` scope before escalating.

`feat/sma-302-compose-override-fix` — compose-override path touches `use-hours-overrides.ts`. SC-02 (`department_hours_override` unregistered in `classify.ts`) is in active campaign scope; mark **in-progress**.
