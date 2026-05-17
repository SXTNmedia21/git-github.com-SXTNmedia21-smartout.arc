---
title: "Plan — cascade-delegation-tools"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: MODULE_AGENT_SDK
tags: [plan, cascade, delegation, capability, payroll, lovsen, phase-7d, adr-0356]
---

# Plan — cascade-delegation-tools

> Branch: `feat/payroll-cascade-delegation-tools` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll` | Module: ai | Started: 2026-05-17

## Goal

Sortie 3 of 3 in Phase 7d-followup execution. Ship cascade-namespace delegation tools per ADR-0356 to unblock Phase 7f payroll capability tools. Creates new `cascade` capability with 2 delegation tools (`bind_workspace_union` + `add_supplement_rule`) per ADR-0173 frozen-4 cross-namespace write defense. Mirrors ADR-0240 journey_authoring → journey.publish_mission delegation precedent.

## Source of truth

- **ADR-0356** — Cascade-namespace delegation pattern (`docs/decisions/0356-cascade-namespace-delegation-pattern.md`)
- **ADR-0355** — `workspace_union_binding` table contract (`docs/decisions/0355-workspace-union-binding-lifecycle-and-cache-trigger.md`)
- **ADR-0173** — Frozen-4 capability boundaries (enforced via delegation)
- **ADR-0240** — Journey delegation precedent
- **ADR-0204** — gatedMutation per-tool authority
- **ADR-0152** — Structured error envelope

## Files to create

### Capability surface
- `packages/ai/src/capabilities/cascade/index.ts`
- `packages/ai/src/capabilities/cascade/tools.ts` (2 delegation tools)
- `packages/ai/src/capabilities/cascade/gate.ts`
- `packages/ai/src/capabilities/cascade/__tests__/tools.test.ts`

### Registry + telemetry + auth
- Update `packages/ai/src/capabilities/registry.ts` — add `cascade` entry
- Update `packages/telemetry/src/registry.ts` — 2 new events
- `supabase/migrations/20260618200000_cascade_capability_authority_seed.sql`

### Sortie close
- `docs/journeys/JOURNEY-cascade-delegation-tools.md` (status:verified)
- `docs/handoffs/HANDOFF-cascade-delegation-tools.md` (status:done)

## Tool specs per ADR-0356

### cascade.bind_workspace_union
- Inputs: `workspace_id, union_id, law_version, effective_from, amendment_classifier, derivation_snapshot_id?`
- Body: L-0177 ctx-derive → cross-workspace block → gate_action `cascade.bind_workspace_union` → gatedMutation (switch flow UPDATE old `effective_to`, INSERT new row) → emit `cascade.workspace_union_binding_created` with `delegated_via: ctx.callerCapability`
- Returns: `{workspace_union_binding_id, effective_from}`
- Errors: INVALID_WORKSPACE, MISSING_PROFILE_CONTEXT, AMENDMENT_BLOCKED (MATERIAL/ENDRINGSOPPSIGELSE)

### cascade.add_supplement_rule
- Inputs: `workspace_id, supplement_type, rate_value, rate_type, tariff_rate_table_id?, paragraf_ref?, match_predicate, name`
- Body: L-0177 ctx-derive → workspace-match → gate_action `cascade.add_supplement_rule` → gatedMutation INSERT to `public.supplement_rule` (NOT `payroll.supplement_rule` per ADR-0351 amended code-trace authority) → catch tariff-floor trigger PostgreSQL exception → transform to ADR-0152 structured envelope (`code: 'SUPPLEMENT_BELOW_TARIFF_FLOOR', aml_ref: '§14-15', floor, proposed`) → emit `cascade.supplement_rule_added` with `delegated_via`
- Returns: `{supplement_rule_id}`
- Errors: INVALID_WORKSPACE, MISSING_PROFILE_CONTEXT, SUPPLEMENT_BELOW_TARIFF_FLOOR

## Capability definition

```typescript
export const cascadeCapability: CapabilityDefinition = {
  name: 'cascade',
  defaultAuthority: 'autonomous',  // caller already gated per ADR-0356
  toolAuthPattern: 'direct_admin',
  allowedChannels: ['chat'],  // payroll-adjacent PII per ADR-0078
  emitPrefix: 'cascade',
  tools: [bindWorkspaceUnionTool, addSupplementRuleTool],
  readOnlyTools: [],
  suggestTools: [],
};
```

Document `defaultAuthority='autonomous'` rationale: delegation tools assume caller already passed its own authority gate per ADR-0356 §"Gate convention". Independent gate on delegation tool is cross-namespace defense, not double-confirmation.

## Tasks

- [ ] T1. Read ADR-0356 + ADR-0355 + `journey/tools.ts:publishMissionTool` reference + `payroll/index.ts` pattern + `20260519160000_payroll_capability_authority_seed.sql` seed pattern
- [ ] T2. Create `cascade/{index.ts, tools.ts, gate.ts}` per spec
- [ ] T3. Register `cascade` in capability registry
- [ ] T4. Add 2 telemetry events
- [ ] T5. Write + apply authority seed migration `20260618200000`
- [ ] T6. Write tests (happy path INSERT + below-floor error envelope)
- [ ] T7. Typecheck + tests pass
- [ ] T8. Code-reviewer pass
- [ ] T9. JOURNEY + HANDOFF
- [ ] T10. close-feature

## Acceptance Criteria

- [ ] `cascade` capability defined per ADR-0356
- [ ] 2 delegation tools with gatedMutation + emit + L-0177 fail-fast
- [ ] Authority seed migration applied
- [ ] Tests pass for both tools
- [ ] Typecheck passes
- [ ] Code-review approves

## Out of scope

- Phase 7f capability tools (separate sortie)
- Phase 7e bridge code (lovsen-client.ts + BFF routes)
- Onboarding wizard "Tariff" step UI
- Admin drift inbox UI

## Risks

- **defaultAuthority='autonomous' on delegation tool: MEDIUM** — relies on caller having already gated. Enforce via ctx.callerCapability presence check.
- **Cross-workspace write via body-supplied workspace_id: HIGH if not guarded** — L-0177 fail-fast pattern.
- **Tariff-floor trigger raises PostgreSQL exception** — must catch + transform to ADR-0152 envelope. Test coverage required.
- **APPEND-ONLY trigger blocks switch flow** — switch must UPDATE old `effective_to` via SAME mutation flow that allows that exception. Transaction-atomic.
