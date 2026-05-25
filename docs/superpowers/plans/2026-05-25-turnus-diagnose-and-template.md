---
title: Plan — Turnus diagnose + template (Phase 1)
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: schedule
tags: [plan, capability, scheduler, phase-1, mr-botsson]
---

# Plan — Turnus diagnose + template (Phase 1)

## Context

Council 2026-05-25 Phase 1 (post-pre-work C1/C2/C3 closure). Manager opens schedule for empty week → currently silent dead-end. Botsson should explain WHY (diagnose) + offer fix (template apply). Two new capabilities, BOTH delegate to existing cascade per ADR-0356 (no new schema if reuse possible).

## Scope

### In

**Capability 1: `diagnose_turnus_disabled` (read-only, chat+voice)**
- Inputs: `{ workspace_id, planning_cycle_id?, target_week_iso? }` (workspace_id server-derived per ADR-0151)
- Reads: planning_cycle (D1), department_operating_hours (D1), employment_contract (D2), framework_rule (D3), season_budget + day_factor + hour_factor (D4), workspace config (D5)
- Returns structured `{ ready: bool, missing: Array<{dimension: "D1"|"D2"|...|"D6", reason: string, fix_hint: string}> }`
- No gate_action — pure read

**Capability 2: `timeline_template` (chat-only, write via gate)**
- Tool 1: `list_week_templates({ workspace_id })` — lists past planning_cycles + named templates
- Tool 2: `apply_week_template({ source_cycle_id, target_cycle_id, department_id })` — writes change_proposal kind='scheduler_template_apply' OR 'scheduler_bundle' (Track A decides)
- mutateWithGate per ADR-0204, fail-fast L-0177
- Chat-only per ADR-0288 (irreversible C4 act)

**Mission wire-in:**
- Intent classifier enum: `diagnose_turnus`, `apply_week_template`, `list_week_templates`
- System prompt prose for mr-botsson (when each intent fires)
- Tool registration in mr-botsson mission

### Out (defer V2)

- Empty-state UI CTA on `/dashboard/schedule` (frontend-designer sortie)
- Voice view-tool mirror for diagnose (mobile/voice-agent extension)
- Named templates UI (templates are derived from past cycles V1, not user-named)
- `workspace.timezone` column reuse (uses C2's hardcoded Europe/Oslo via `osloWeekdayFromDateStr`)

## Track decomposition

See main session orchestration plan. Tracks A→{B,C,D}→E→F sequenced with parallel B/C/D mid.

## Acceptance criteria

1. `pnpm --filter @smartout/ai typecheck` PASS
2. `pnpm --filter @smartout/ai test packages/ai/src/capabilities/scheduler/__tests__/` 35+10 NEW = 45 PASS
3. Intent classifier accepts 3 new intents; system-prompt updated
4. LIVE E2E: diagnose returns valid missing-list on demo workspace ✓
5. LIVE E2E: apply_week_template writes real change_proposal row ✓
6. Zero regressions in 35/35 scheduler existing tests
7. HANDOFF written

## Decisions to make (track owners)

- **Track A:** Is `week_template` a new table, a view, or derived from past `planning_cycle` rows? Decides Tracks B+C schema reads.
- **Track C:** New `change_proposal.kind` value `scheduler_template_apply` OR reuse `scheduler_bundle`? ADR consequence either way.
- **Track D:** mr-botsson mission intent slot — collision with existing `propose_plan`? L-0147 outsider-renumber risk.
- **Track B:** Diagnose voice-channel — confirm ADR-0288 allows read-only diagnostics on voice (likely yes).

## Out-of-scope (explicit)

- No frontend changes (no `apps/web/src/app/dashboard/schedule/` edits)
- No new RLS policies (read-only diagnose reuses existing; template-apply gated via mutateWithGate)
- No migration unless Track A forces
- No e2e Playwright spec (Node-script live E2E only, per C1 pattern)
