---
title: "Lovsen Capability Authority — C4 authority seed for `legal` capability"
id: ADR_0259
status: accepted
accepted_at: 2026-04-29
layer: decision
created: 2026-04-29
updated: 2026-05-06
module: MODULE_AGENT_SDK
tags: [lovsen, c4, authority, capability, adr, p1-s0]
related_adrs: [ADR-0024, ADR-0078, ADR-0249, ADR-0256, ADR-0257]
---

# ADR-0259: Lovsen Capability Authority

> **Amendment 2026-05-06 (S5a):** Capability string corrected from `industry_intelligence.lovsen_query` to `legal` throughout. ADR-0249 (registered same day) formalized the capability as the fifth registered capability named `legal`. Migration `20260520130000_legal_capability_authority_seed.sql` ships `capability='legal'` — that is the production-authoritative string. Any consumer resolving gate_action against `industry_intelligence.lovsen_query` falls through to default-allow (L-0066 CVE class). This amendment aligns ADR-0259 text with the shipped migration and ADR-0249 naming. See audit 2026-05-06 finding H-01 (slice 09).

## Context and Problem Statement

Lovsen answers legal questions that may have material consequences: dismissal validity, contract compliance, salary obligations. A confident answer is not the same as an authorized action. The C4 governance model (Cascade Core, ADR-0024 — Contract System Architecture) requires an explicit authority level before any Botsson capability can commit or recommend a committed action. Without a seeded `engine_authority_config` row for the `legal` capability, `gate_action` falls through to the default-allow branch — a CVE-class gap (per ADR-0189 pattern, L-0066). Additionally, ADR-0078 (Engine Process Channel Restriction) forbids voice channels for PII-handling operations; legal advice contains quasi-PII (employment relationship details, salary, dismissal cause) and must be restricted to `chat` channel only.

## Decision Drivers

- "Confident ≠ Authorized": Lovsen may have HØY confidence but the question may require a human-reviewed response before the manager acts — confidence level does not grant authorization
- ADR-0078 channel restriction: voice is forbidden for quasi-PII content (legal advice about a named employee); chat is the only permitted channel
- ADR-0189 pattern / L-0066: default-allow is a CVE-class gap for any named capability — explicit seed migration required
- ADR-0024 Contract System Architecture: Lovsen's output (validation result, amendment classification) feeds employment_contract lifecycle — C4 gate must be in place before any mutation is possible
- ADR-0249: capability is registered as `legal` (fifth registered capability) — all consumers MUST use this string

## Considered Options

1. **Default-allow** — no seed, `gate_action` returns `default_permitted` for `legal` capability
2. **Read-only authority, chat-only** (chosen) — seed with `level: 'read_only'`, `min_role: 'manager'`, `allowedChannels: ['chat']`; capability is informational, never writes directly
3. **Suggest authority with four-eyes** — require manager confirmation for every Lovsen answer, blocking conversational use

## Decision Outcome

Chosen option: **Read-only authority, chat-only**, because Lovsen's P1 scope is informational (answer, validate, classify) — it never writes `employment_contract` rows directly. Writes go through the C4 gate at the capability that actually commits (e.g. `contract.update`, `contract.intake`). Lovsen is an advisor, not a writer.

**C4 authority seed — shipped in migration `20260520130000_legal_capability_authority_seed.sql` (ADR-0249):**

```sql
-- Part A: capability_default_registry (platform-wide default for all new workspaces)
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  ('legal', 'read_only', 'manager', false, 72, 'Norsk arbeidsrett — Lovsen. ADR-0249 Phase 0c.')
ON CONFLICT (capability) DO NOTHING;

-- Part B: backfill engine_authority_config for all existing workspaces
INSERT INTO public.engine_authority_config (workspace_id, capability, level, min_role, ...)
SELECT w.workspace_id, 'legal', 'read_only', 'manager', false, 72, ...
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

**Channel restriction (enforced at capability registration in `packages/ai/src/capabilities/legal/index.ts`):**

```typescript
// packages/ai/src/capabilities/legal/index.ts
allowedChannels: ['chat', 'voice', 'system'],  // per-tool Layer 3 guards restrict further per ADR-0078
```

**Telemetry:** `lovsen.query.received` through `lovsen.answer.composed` events (registered in P1.S0, ADR-0256) receive `engine_event` routing added in P1.S4 when the capability lands — that is when the workflow engine needs to react to Lovsen invocations. The telemetry registry comment at `packages/telemetry/src/registry.ts:10634` still references the old name `industry_intelligence.lovsen_query` — update that comment in P1.S4.

## Rules & Consequences

- **Good, because** any Botsson session trying to route a Lovsen query over voice channel is blocked at `gate_action` per-tool Layer 3 guards — ADR-0078 channel guard is enforced, not just documented
- **Good, because** `level: 'read_only'` means Lovsen answers can never be used as direct write authorization — downstream mutation capabilities must call their own `gate_action`
- **Bad, because** `min_role: 'manager'` (per migration + ADR-0249) means employee-facing `cite_law` degrades to suggest within the JS capability layer; the DB row uses manager as the floor and cannot be loosened without a new migration
- **Agent Impact:** P1.S4 sub-sortie MUST use capability string `'legal'` (not `'industry_intelligence.lovsen_query'`) at all call sites. The capability is already seeded via `20260520130000`. Update `packages/telemetry/src/registry.ts:10634` comment to reference `legal`.

---

> Registered in `docs/decisions/0000-decision-log.md`. Cross-reference: ADR-0024 (Contract System Architecture), ADR-0078 (Engine Process Channel Restriction), ADR-0249 (legal capability registration), ADR-0256 (Lovsen Citation Contract), ADR-0257 (Lovsen Confidence Model).
