---
title: "helpdesk_query capability placement and isolation"
id: ADR_0162
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
---

# ADR-0162: `helpdesk_query` capability placement and isolation

## Context and Problem Statement

The helpdesk feature requires agent tools (open ticket, assign representative, resolve, query queue). Two options surfaced: extend the existing `communication` capability (fewer touchpoints, reuses register/intent-classifier/authority wiring) or create a new `helpdesk_query` capability (isolated allowedChannels, clearer domain). A 2026-04-19 code-trace confirmed `communication.allowedChannels` is undefined (voice permitted by default). Helpdesk desks routinely handle PII (personnummer, lønn, bank details, contract content) — inheriting permissive defaults is unsafe per ADR-0078.

## Decision Drivers

- ADR-0078: PII-handling capabilities MUST declare `allowedChannels = ['chat']`.
- Agent-router (`services/stage-engine/src/core/agent-router.ts:89`) does NOT pass `p_engine_process_id` to `gate_action` for ad-hoc chat — Layer 1 process-channel check is silent, defense-in-depth reduces to Layer 2 (capability) + Layer 3 (tool).
- `gate_action` default-allows capabilities with no `engine_authority_config` row (verified in `20260505110000_unified_authority_gate.sql:155`). New capabilities auto-autonomous until seeded.
- `CapabilityName` union lives in `packages/ai/src/capabilities/types.ts`; intent classifier enum in `packages/ai/src/router/intent-classifier.ts:36-55`; registry in `packages/ai/src/capabilities/registry.ts`.
- Naming precedent: `billing_query`, `operations_intelligence`, `shift_swap` — domain-specific capabilities with explicit constraints.

## Considered Options

1. **Extend `communication` capability** — Add `create_desk_query`, `assign_representative`, `resolve_query`, `get_desk_queue` tools to `packages/ai/src/capabilities/communication/tools.ts`. Reuses existing registration.
2. **New capability `helpdesk_query`** — New directory, new `CapabilityName` union entry, new registry entry, new intent classifier entry, new authority seed migration. Isolated `allowedChannels: ['chat']`.
3. **Shared capability factory / registration helper** — Same outcome as option 2 but a helper reduces boilerplate for future domain-specific capabilities.

## Decision Outcome

Chosen option: **Option 2 — new capability `helpdesk_query`**, with option 3 as follow-up refactor if the registration pattern repeats.

Rationale:
- `communication.allowedChannels` is permissive; inheriting it for PII tools violates ADR-0078.
- Explicit `allowedChannels: ['chat']` at capability definition is the single enforcement point that catches every PII tool regardless of process_id state.
- Naming is consistent with existing `{domain}_query` convention (billing_query, operations_intelligence).
- 5 registration touchpoints are mechanical — they are not a reason to violate security isolation.

## Rules & Consequences

### Required registration touchpoints

1. `packages/ai/src/capabilities/types.ts:5-22` — add `"helpdesk_query"` to `CapabilityName` union.
2. `packages/ai/src/capabilities/registry.ts:18-33` — import + register in `capabilities` record.
3. `packages/ai/src/router/intent-classifier.ts:36-55` + prompt at `:80-99` — add to enum + classifier prompt.
4. New file `packages/ai/src/capabilities/helpdesk-query/index.ts` — export `CapabilityDefinition` with:
   - `allowedChannels: ['chat']` (MANDATORY — blocked in ADR-0163 if missing)
   - `tools` (mutations: create_desk_query, assign_representative, resolve_query, escalate_query)
   - `readOnlyTools` (get_desk_queue, get_query_detail, get_desk_list)
   - `suggestTools` (if any require human confirmation)
5. New migration `NNNNNNNNN_helpdesk_query_authority_seed.sql` — `engine_authority_config` row with `level='suggest'` (or `'confirm'` for PII-sensitive desks), `min_role='manager'`.

### Anti-patterns (explicitly rejected)

- Extending `communication` capability with helpdesk tools.
- Shipping without authority seed migration (default-allow trap per L-0066).
- Leaving `allowedChannels` undefined on `helpdesk_query` (blocked by ADR-0163).
- Skipping intent classifier entry — capability invisible to LLM without it.

### Agent Impact

- Any new PII-handling capability follows this template (isolate, declare allowedChannels, seed authority).
- `communication` capability stays general-purpose chat (briefings, summaries, non-PII messages).
- Future domain capabilities (e.g., `hr_query`, `payroll_query`) follow the same 5-touchpoint pattern.
- Integration test: helpdesk_query capability invoked from voice channel → capability-level rejection (Layer 2), not tool-level (Layer 3).

## Open Questions

- Should `level='suggest'` or `level='confirm'` be default? Council recommends `'confirm'` for resolve/reassign, `'suggest'` for read tools. Migration decides per-tool.
- Does `helpdesk_query` need `min_role='manager'` for all tools, or tool-specific? Recommend tool-specific.

---

> Depends on ADR-0161 accepted. Register in `0000-decision-log.md`.
