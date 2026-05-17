---
title: "Journey — payroll-tariff-bff"
status: verified
feature: tariff-bff
updated: 2026-05-17
created: 2026-05-17
module: web
tags: [journey, payroll, tariff, bff, phase-7e]
---

# Journey — payroll-tariff-bff

> Phase 7e Track 1. BFF wrappers for Phase 7f payroll capability tools.

## Journey: Admin POSTs tariff setup from web UI

**Precondition:** Admin authenticated, workspace exists, no active tariff binding.

1. Web client → POST `/api/payroll/tariff/setup` with `{union_id, law_version, official_effective_date}`
2. BFF `resolvePayrollAuth()` derives workspace_id from JWT (ADR-0151)
3. BFF validates request with `setupTariffRequestSchema`
4. BFF channel-guards `chat` (ADR-0078)
5. BFF invokes `setupWorkspaceTariffTool` with synthetic AgentToolContext
6. Tool delegates to `cascade.bind_workspace_union(caller_capability='payroll', amendment_classifier='BOOTSTRAP')`
7. Cascade atomic RPC INSERT
8. Both layers emit (ADR-0356 audit-symmetry)
9. BFF returns `{ok:true, data:{workspace_union_binding_id, effective_from, union_id, law_version}, audit:{payroll_emit_id, cascade_emit_id, actor_capability:'payroll', delegated_via:'cascade'}}`

**Postcondition:** workspace_union_binding row + cache columns + audit chain.

**Error paths:**
- Missing JWT → 401 UNAUTHORIZED envelope
- Body workspace_id mismatch → CROSS_WORKSPACE_BLOCKED (ADR-0151 defense)
- Workspace already bound → TARIFF_ALREADY_BOUND
- Cascade INVALID_WORKSPACE / MISSING_PROFILE_CONTEXT pass through

## Journey: Admin POSTs tariff change

**Precondition:** Existing active binding.

1. POST `/api/payroll/tariff/change` with `{new_union_id, new_law_version, official_effective_date, reason?}`
2. BFF derives workspace, invokes `changeWorkspaceTariffTool`
3. Tool calls amendment-classifier (T5) → UP|MATERIAL|ENDRINGSOPPSIGELSE
4. Cascade atomic switch RPC (UPDATE old + INSERT new in single TX)
5. Both layers emit, BFF returns `{old_id, new_id, amendment_classifier, old_law_version, new_law_version}`

**Error paths:** NO_EXISTING_BINDING, AMENDMENT_BLOCKED (ENDRINGSOPPSIGELSE).

## Journey: Manager POSTs supplement override

**Precondition:** Workspace tariff-bound.

1. POST `/api/payroll/tariff/supplement` with supplement spec
2. BFF invokes `addSupplementOverrideTool` → cascade.add_supplement_rule
3. PostgreSQL tariff-floor trigger validates
4. Both layers emit, BFF returns `{supplement_rule_id}`

**Error paths:** SUPPLEMENT_BELOW_TARIFF_FLOOR with `aml_ref:'§14-15', floor, proposed` passes through.

## Journey: Read current tariff (admin page + mobile)

**Precondition:** Any role with workspace access.

1. GET `/api/payroll/tariff/current`
2. BFF derives workspace, reads `workspace_union_binding` + enriches via `lovsen-client.ts` for paragraf references
3. Returns `{is_bound, union_id, union_name, law_version, effective_from, paragraf_references[]}`

**Error paths:** UNAUTHORIZED if no JWT.

## Known contract gaps (Phase 7g)

- `union_id` UUID schema vs tool enum mismatch
- `supplement_type` UX labels vs DB classification lossy mapping
- `rate_type` `fixed_per_shift` unreachable
- Audit emit IDs are correlation UUIDs not activity_trail row IDs
- `old_law_version` is proxy placeholder
- lovsen-client TS copy lives at both `apps/web/src/lib/tariff/` and `services/lovsen-nho-reiseliv-mcp/src/lib/`
