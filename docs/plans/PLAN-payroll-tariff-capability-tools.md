---
title: "Plan — payroll-tariff-capability-tools"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: MODULE_AGENT_SDK
tags: [plan, payroll, capability, tariff, phase-7f, adr-0356, delegation]
---

# Plan — payroll-tariff-capability-tools

> Branch: `feat/payroll-payroll-tariff-capability-tools` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll` | Module: ai | Started: 2026-05-17

## Goal

Phase 7f execution. Ship 3 payroll capability tools that consume the cascade delegation surface shipped in Sortie 3 (commit `bfcdfc6b5`). Tools wrap `cascade.bind_workspace_union` + `cascade.add_supplement_rule` with payroll-side gate, business validation, and audit-symmetry per ADR-0356 §"Audit symmetry" (actor_capability='payroll' + delegated_via='cascade').

## Source of truth

- **ADR-0356** — Cascade-namespace delegation pattern (`docs/decisions/0356-cascade-namespace-delegation-pattern.md`)
- **ADR-0355** — `workspace_union_binding` table contract
- **ADR-0351** — Tariff-floor TRIGGER pattern (`public.supplement_rule`)
- **ADR-0173** — Frozen-4 capability boundaries (payroll IS one of frozen-4 = correct delegator)
- **ADR-0204** — gatedMutation per-tool authority
- **ADR-0152** — Structured error envelope
- **ADR-0112** — Intent classifier coverage (no enum change needed — payroll already enumerated)

## Tool specs

### payroll.setup_workspace_tariff
First-time tariff binding for a workspace (onboarding "Tariff" step or admin bootstrap).

- **Inputs**: `workspace_id, union_id, law_version, official_effective_date, effective_from?` (default: today)
- **Body**: payroll-side gate via `mutateWithGate` → call `cascade.bind_workspace_union` tool with `caller_capability='payroll'` and `amendment_classifier='INITIAL_BINDING'` → emit `payroll.workspace_tariff_setup` with `delegated_via='cascade'`
- **Returns**: `{workspace_union_binding_id, effective_from}`
- **Errors**: Pass through cascade tool's INVALID_WORKSPACE, MISSING_PROFILE_CONTEXT, AMENDMENT_BLOCKED; add payroll-side TARIFF_ALREADY_BOUND (cannot setup over existing binding — use change_workspace_tariff)
- **Authority**: admin only (workspace-level structural change)
- **Channel**: chat (payroll-adjacent per ADR-0078)

### payroll.change_workspace_tariff
Switch flow when new law_version lands or workspace changes union affiliation.

- **Inputs**: `workspace_id, new_union_id, new_law_version, official_effective_date, effective_from?, reason?`
- **Body**: gate → call `cascade.bind_workspace_union` with `amendment_classifier` derived from delta (TARIFF_REVISION if same union+new version, UNION_CHANGE if different union, ENDRINGSOPPSIGELSE if material impact requiring re-signing per Aml. §14-6) → emit `payroll.workspace_tariff_changed` with old + new binding IDs
- **Returns**: `{old_workspace_union_binding_id, new_workspace_union_binding_id, effective_from, amendment_classifier}`
- **Errors**: Pass through cascade errors; add NO_EXISTING_BINDING (use setup_workspace_tariff instead)
- **Authority**: admin only
- **Channel**: chat

### payroll.add_supplement_override
Workspace-specific supplement (tillegg) above tariff floor.

- **Inputs**: `workspace_id, supplement_type, rate_value, rate_type, paragraf_ref?, match_predicate, name, tariff_rate_table_id?`
- **Body**: gate → call `cascade.add_supplement_rule` with `caller_capability='payroll'` → emit `payroll.supplement_override_added` with `delegated_via='cascade'`
- **Returns**: `{supplement_rule_id}`
- **Errors**: Pass through cascade errors (especially SUPPLEMENT_BELOW_TARIFF_FLOOR with §14-15 ref)
- **Authority**: admin or manager (per ADR-0250 dynamic supplement framework)
- **Channel**: chat

## Files to create/update

### Capability surface (extend existing payroll capability)
- Update `packages/ai/src/capabilities/payroll/tools.ts` — add 3 tools (OR new file imported)
- Update `packages/ai/src/capabilities/payroll/index.ts` — register new tools
- `packages/ai/src/capabilities/payroll/__tests__/tariff-tools.test.ts` — happy path + delegation chain + error pass-through

### Telemetry + authority
- Update `packages/telemetry/src/registry.ts` — 3 new events with `delegated_via: 'cascade'` field
- `supabase/migrations/20260619100000_payroll_tariff_tools_authority_seed.sql` — 3 gate_action seeds (admin for setup/change, admin+manager for override)

### Sortie close
- `docs/journeys/JOURNEY-payroll-tariff-capability-tools.md`
- `docs/handoffs/HANDOFF-payroll-tariff-capability-tools.md`

## Capability composition

Payroll capability already exists (`packages/ai/src/capabilities/payroll/`). NOT creating new capability — extending existing tool list per ADR-0173 frozen-4 (payroll is one of the 4 owners that may delegate).

```typescript
// packages/ai/src/capabilities/payroll/index.ts (extend existing)
export const payrollCapability: CapabilityDefinition = {
  name: 'payroll',
  // ... existing config unchanged ...
  tools: [
    // ... existing tools ...
    setupWorkspaceTariffTool,
    changeWorkspaceTariffTool,
    addSupplementOverrideTool,
  ],
};
```

## Delegation chain (audit-symmetry per ADR-0356)

```
user message
  → intent-classifier picks 'payroll'
  → tool-selector picks setup_workspace_tariff
  → payroll.setup_workspace_tariff runs (gate: payroll authority)
    → calls cascade.bind_workspace_union(caller_capability='payroll')
      → cascade gate (defense-in-depth)
      → gatedMutation (atomic switch RPC)
      → emit cascade.workspace_union_binding_created
        with actor_capability='cascade', delegated_via='payroll'
    ← returns {workspace_union_binding_id, effective_from}
  → emit payroll.workspace_tariff_setup
    with actor_capability='payroll', delegated_via='cascade'
```

Both layers emit. Audit trail shows full chain. Each emit names its OWN capability as `actor_capability` and the OTHER as `delegated_via`.

## Tasks

- [ ] T1. Read Sortie 3 cascade tools (`packages/ai/src/capabilities/cascade/tools.ts`) + payroll capability shape + ADR-0356 §"Audit symmetry"
- [ ] T2. Add 3 tools to payroll capability (new file `tariff-tools.ts` imported into existing tools.ts to keep file size manageable)
- [ ] T3. Wire into payroll capability registry
- [ ] T4. Add 3 telemetry events with delegation fields + interfaces
- [ ] T5. Write + apply authority seed migration `20260619100000`
- [ ] T6. Write tests: happy path delegation chain + error pass-through (minimum 6 tests)
- [ ] T7. Typecheck + tests + lint pass
- [ ] T8. Code-reviewer pass
- [ ] T9. JOURNEY + HANDOFF
- [ ] T10. close-feature

## Acceptance Criteria

- [ ] 3 payroll tools defined, all wrap cascade tools with `caller_capability='payroll'`
- [ ] Both layers emit with audit-symmetry (actor_capability + delegated_via)
- [ ] Authority seed migration applied
- [ ] Tests pass (delegation chain + error pass-through + payroll-side validation)
- [ ] Typecheck + lint passes
- [ ] Code-review approves
- [ ] No ADR-0112 enum drift (payroll already enumerated — verify)
- [ ] Decision log updated (if any new ADR slot used)
- [ ] User journeys written

## Out of scope

- Phase 7e bridge code (`lovsen-client.ts` + BFF routes) — separate parallel sortie
- Onboarding wizard "Tariff" step UI (uses these tools but UI = separate sortie)
- Admin drift inbox UI
- ENDRINGSOPPSIGELSE classifier logic (use simple heuristic now; full logic deferred to amendment-classifier sortie)
- Mobile surface (web-only V1 per ADR-0133 — admin authoring stays web)

## Risks

- **Authority seed drift**: 3 new gate_actions need matching `observer_escalation_hours` + `min_role` per Sortie 3 migration learning. Use existing payroll seed values as template.
- **Telemetry interface drift**: 3 new events with `delegated_via` field need EventCategory + EntityType discriminators. Mirror cascade telemetry interfaces from Sortie 3.
- **Test fixture for cascade tool mock**: Tests must mock cascade tool calls OR run integration test against test DB. Recommend mock at tool-call layer to keep unit test fast.
- **caller_capability validation**: cascade tools require `caller_capability: z.string()` input. Payroll tool MUST pass literal `'payroll'` — if forgotten, runtime validation error (good fail-fast).

## User Journeys

### Journey: Admin sets up first tariff binding during onboarding
**Precondition:** Workspace exists, no `workspace_union_binding` row, admin authenticated, payroll capability authority seeded for admin.

1. Admin → "Vi er NHO Reiseliv-medlem, Riksavtalen 2025" in chat
2. Intent classifier → `payroll` (high confidence — tariff-keyword)
3. Tool selector → `setup_workspace_tariff`
4. Tool calls `cascade.bind_workspace_union(caller_capability='payroll', ...)` → atomic INSERT
5. Botsson responds: "Bundet til Riksavtalen 2025, gjelder fra i dag. Aml. §14-6 godkjent."

**Postcondition:** `workspace_union_binding` row exists, `payroll.workspace_settings.active_union_id` + `active_binding_id` set via cache trigger, both layers emitted (cascade + payroll).

**Error paths:**
- Workspace already bound → TARIFF_ALREADY_BOUND envelope, suggest `change_workspace_tariff`
- Missing profile context → MISSING_PROFILE_CONTEXT (L-0177 fail-fast)
- Admin role missing → gate rejects, Botsson explains authority requirement

### Journey: Admin switches to new law_version
**Precondition:** Existing binding active, new Riksavtalen 2026 published.

1. Admin → "Bytt til Riksavtalen 2026, gjeldende fra 1. juni"
2. Tool → `change_workspace_tariff` with new_law_version='2026'
3. Tool classifies as TARIFF_REVISION (same union, new version)
4. Tool calls `cascade.bind_workspace_union` switch flow (UPDATE old effective_to, INSERT new)
5. Botsson: "Riksavtalen 2026 aktiv fra 1. juni 2026. Gammel binding lukket."

**Postcondition:** Old row has effective_to, new row active, audit chain complete.

**Error paths:**
- No existing binding → NO_EXISTING_BINDING, suggest setup_workspace_tariff
- Material change requiring re-signing → AMENDMENT_BLOCKED (ENDRINGSOPPSIGELSE), Botsson explains

### Journey: Manager adds workspace-specific evening supplement
**Precondition:** Workspace tariff-bound, tariff floor for kveldstillegg = 27% per Riksavtalen §6.

1. Manager → "Legg til 30% kveldstillegg etter kl 22 for våre baransatte"
2. Tool → `add_supplement_override` with rate_value=30, supplement_type='evening'
3. Tool calls `cascade.add_supplement_rule(caller_capability='payroll', ...)`
4. PostgreSQL tariff-floor trigger checks 30 >= 27 → PASS
5. Botsson: "Lagt til. 30% kveldstillegg gjelder for bartenderne."

**Postcondition:** `public.supplement_rule` row exists, audit chain complete.

**Error paths:**
- Below tariff floor (e.g. 25%) → SUPPLEMENT_BELOW_TARIFF_FLOOR with `floor: 27, proposed: 25, aml_ref: '§14-15'` envelope
- Manager role missing on workspace → gate rejects

## Dependencies

- Sortie 3 cascade delegation tools (commit `bfcdfc6b5`) — DONE
- Sortie 2 migration `20260618100000` + `20260618210000` — DONE
- Sortie 1 ADRs 0355 + 0356 — DONE
