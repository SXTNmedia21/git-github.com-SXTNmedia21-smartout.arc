---
title: "Day-Control Panel as Canonical D6 Admin Surface"
id: ADR_0156
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
---

# ADR-0156: Day-Control Panel as Canonical D6 Admin Surface

**Status:** Proposed
**Date:** 2026-04-19
**Council:** 2026-04-19 (APPROVE WITH CHANGES, unanimous)

## Context and Problem Statement

The admin "Oversikt" route (`adminView === "oversikt"`) renders `OversiktView.tsx` — a mock-data executive roll-up with action queues and weekly KPIs. It is paradigmatically wrong for Smartout's operational model: a shift-based business's day is not an aggregate roll-up, it is a *session* (`department_session`, one per department per day).

The design bundle delivered 2026-04-19 (`DESIGN_DAY_INFORMATION_2026_04_19`) encodes the session-centric model into a 7-tab day-control panel with 10 canonical widgets, explicitly shared between web (authoring/oversight) and mobile (execution). This ADR records the structural decisions needed to wire that panel as the canonical admin surface without violating cascade invariants or creating orphan state.

## Decision Drivers

- Cascade model integrity: D6 Production tables (`department_session`, `session_hook`, `session_task`, `deviation`) are the canonical source for "what happened today"; no parallel UI state may compete.
- ADR-0133 boundary: widgets are shared with mobile; placement must survive the future extraction.
- ADR-0114 boundary: new mutations must be Server Actions; existing TanStack hooks are grandfathered (see ADR-0157).
- UI-vs-DB enum drift: the UI wants 6 phases, DB enum has 5 — this gap must be resolved without a migration or invented state.
- Audit integrity: broadcasts from within a session need provenance; cannot silently drift.

## Considered Options

### Option A — Replace `OversiktView` with `WebDayControl`, session-centric
Delete the executive roll-up paradigm. Pin the admin oversight surface to a `department_session` per dept per day. Widgets live at `apps/web/src/components/day/` with portability discipline, extract to `packages/ui/day-control/` when mobile lands.

### Option B — Keep `OversiktView`, add `WebDayControl` as a new `adminView` variant
Co-existence. Two overlapping admin surfaces (action queue vs day-control). User picks.

### Option C — Full replacement but widgets in `packages/ui/day-control/` from day one
No staging. Extract shared package before the first consumer (mobile) exists.

## Decision Outcome

Chosen option: **A — Replace, with staged widget placement.**

- **Replacement:** `OversiktView.tsx` is deleted in PR 4 of the rollout series; `adminView === "oversikt"` routes to `WebDayControl` (feature-flagged via `NEXT_PUBLIC_DAY_CONTROL_V2` during PR 2/3).
- **Widget placement:** Phase 1 at `apps/web/src/components/day/`. Phase 2 extracts to `packages/ui/day-control/` when mobile consumer is ready. Phase 1 enforces portability discipline: no `next/image`, no `next/link`, no Next-specific hooks, no Supabase access inside widgets.
- **Phase enum derivation:** UI 6-state `(upcoming|active|pending_signoff|closed|missed|locked)` derives from DB 5-state via `derivePhase(session, recon)` helper in `packages/utils/src/cascade/`. `locked` = `closed` + `daily_reconciliation.locked = true`. No migration. No stored UI-only state.
- **Broadcast persistence:** Keep existing `komm` news-channel pattern (persistent, already emits `communication.broadcast_sent`). Broadcast type (`alert|reminder|note`) encoded in `channel_message.metadata.broadcast_type` JSONB. No new column, no new table.
- **KPI source labeling:** Every KPI tile labels its source tier (`live` = D6 read, `snapshot` = C3 `shift_cost_snapshot`, `post-reconciliation` = C1 `daily_reconciliation`). Revenue is post-reconciliation only. No fabricated proxies during `active` phase.

Rejected:
- **Option B** — two overlapping admin surfaces fragments authority, splits audit trail, confuses operators.
- **Option C** — premature abstraction. Extraction cost is near-zero if Phase 1 discipline holds; paying it before the second consumer exists adds build complexity without value (Designer review).

## Rules & Consequences enforced for Agents

- **Good, because** cascade invariants preserved (one canonical surface for D6 admin oversight; no orphan state).
- **Good, because** widget portability discipline preempts drift: mobile gets the same widgets via package extraction when it lands.
- **Good, because** `locked` derivation rule scales: any other UI that needs enriched phase states uses the same helper instead of inventing local state.
- **Bad, because** requires discipline during Phase 1 — any slip (e.g., `next/link` in a widget) costs refactoring at extraction time.
- **Agent Impact:**
  - Botsson capabilities (`operations`, `communication`, `operations_intelligence`) unchanged — same data sources, same tools.
  - Panel mount pins `department_session.id` into `engine_memory` (24h TTL) so Botsson can answer contextual questions ("hvor mange avvik i dag?") without re-fetching.
  - No new agent capabilities introduced.

## Follow-up / tracked items

- Audit: `operations/tools.ts:254` (agent tool `complete_task` bypasses `emit()` registry — direct `engine_event` insert). Separate PR.
- Trigger: `department_session.tasks_total/tasks_completed` are not auto-maintained. PR defers to client-side derivation; long-term decision: add trigger or deprecate columns (tracked, not in this series).
- Extraction: promote `components/day/` → `packages/ui/day-control/` when mobile port is ready.

## References

- Council session 2026-04-19 — `docs/council/COUNCIL-LOG.md`
- Design spec — `DESIGN_DAY_INFORMATION_2026_04_19`
- Implementation spec — `SPEC_WEB_DAY_CONTROL_IMPL_2026_04_19`
- ADR-0114 — Server Actions Canonical Mutation Primitive
- ADR-0133 — Web Composes, Mobile Executes
- ADR-0157 — Server Actions Scope Amendment
- Learning L-0064 — Phase Enum UI-vs-DB Drift
