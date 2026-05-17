---
title: "Plan — tariff-7h-followup"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: ai
tags: [plan, payroll, tariff, phase-7h, followup, audit-symmetry, profile-context]
---

# Plan — tariff-7h-followup

> Branch: `feat/payroll-tariff-7h-followup` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll`

## Goal

Close 2 of 3 deferred Phase 7g items. Item 3 (union master table) escalated to separate ADR sortie.

## Source of truth

- Phase 7g handoff (commit `e03045859`) — flagged 3 deferred items
- Code-reviewer report on Phase 7g — `cascade_emit_id` pre-generated at payroll layer, not echoed from cascade; `TariffClient.tsx:53` `actor_id` placeholder uses workspaceId not profileId
- ADR-0356 audit-symmetry (`actor_capability` + `delegated_via` reciprocal)
- ADR-0186 telemetry contract (`actor_id` = profile_id)

## Files to modify

### Item 1: cascade_emit_id real round-trip
- `packages/ai/src/capabilities/cascade/tools.ts` — both tools `bind_workspace_union` + `add_supplement_rule`: pre-generate `cascadeEmitId` via `randomUUID()`, pass as `correlation_id` to cascade emit(), return `cascade_emit_id` in tool result JSON
- `packages/ai/src/capabilities/payroll/tariff-tools.ts` — all 3 payroll tools: read `cascade_emit_id` from cascade tool result (replace currently pre-generated UUID at payroll layer)
- Tests: update tariff-tools tests + cascade tests if they assert on returned shape

### Item 2: TariffClient actor_id real profile_id
- Find existing client-side profile-context hook in apps/web (likely `useProfileContext()` or similar — grep `useProfile\|profile.*context` in `apps/web/src/lib/`)
- If hook exists: import in `apps/web/src/app/dashboard/payroll/tariff/_components/TariffClient.tsx`, replace `actor_id: workspaceId` with real `profile_id` from hook
- If hook DOESN'T exist: page is server component shell → pass profile_id as prop from server to client component (extend page.tsx)
- Verify L-0177 fail-fast: if profile_id unresolvable, render error state (don't silently emit with empty string)

## Out of scope

- Item 3 (union master table) — needs ADR + migration + cascade table FK rewire. Separate sortie.
- New BFF routes
- New telemetry events
- Stage-engine integration changes

## Tasks

- [ ] T1. Read cascade tools.ts emit pattern + payroll tariff-tools cascade result parsing
- [ ] T2. Cascade tools: pre-generate cascadeEmitId, add to result JSON
- [ ] T3. Payroll tools: parse cascade_emit_id from cascade result instead of pre-generating
- [ ] T4. Grep apps/web for client profile context hook pattern
- [ ] T5. TariffClient.tsx: real profile_id with L-0177 fail-fast
- [ ] T6. Update tests for new tool return shape
- [ ] T7. Typecheck + tests + lint pass: web + ai + telemetry + types
- [ ] T8. Code-reviewer sonnet pass
- [ ] T9. Journey + handoff + close-feature

## Acceptance Criteria

- [ ] Cascade tools return `cascade_emit_id` matching the emit's correlation_id
- [ ] Payroll tools read cascade_emit_id from cascade result (no double-generation)
- [ ] BFF audit response now shows the true cascade emit_id (queryable in activity_trail.correlation_id where category='cascade')
- [ ] TariffClient.tsx uses real profile_id (not workspaceId placeholder)
- [ ] L-0177 fail-fast on missing profile context
- [ ] `pnpm turbo typecheck --filter=web --filter=@smartout/ai --filter=@smartout/types --force` pass
- [ ] `pnpm turbo test --filter=@smartout/ai --force` pass
- [ ] Lint 0 errors

## Risks

- **Cascade emit() signature**: existing cascade tools may not pass correlation_id today. Verify pattern in cascade/tools.ts (likely same shape as payroll uuid-before-emit). Mechanical fix.
- **Test fixture breakage**: cascade tool tests + payroll integration tests assert on result JSON. Add `cascade_emit_id` field expectation.
- **Client profile hook**: may not exist as React hook in dashboard layout. Server-component pass-down via page.tsx prop is fallback.
