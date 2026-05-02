---
title: "Lovsen Capability Authority — C4 authority seed for industry_intelligence.lovsen_query"
id: ADR_0259
status: accepted
accepted_at: 2026-04-29
layer: decision
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [lovsen, c4, authority, capability, adr, p1-s0]
related_adrs: [ADR-0024, ADR-0078, ADR-0256, ADR-0257]
---

# ADR-0259: Lovsen Capability Authority

## Context and Problem Statement

Lovsen answers legal questions that may have material consequences: dismissal validity, contract compliance, salary obligations. A confident answer is not the same as an authorized action. The C4 governance model (Cascade Core, ADR-0024 — Contract System Architecture) requires an explicit authority level before any Botsson capability can commit or recommend a committed action. Without a seeded `engine_authority_config` row for the `industry_intelligence.lovsen_query` capability, `gate_action` falls through to the default-allow branch — a CVE-class gap (per ADR-0189 pattern). Additionally, ADR-0078 (Engine Process Channel Restriction) forbids voice channels for PII-handling operations; legal advice contains quasi-PII (employment relationship details, salary, dismissal cause) and must be restricted to `chat` channel only.

## Decision Drivers

- "Confident ≠ Authorized": Lovsen may have HØY confidence but the question may require a human-reviewed response before the manager acts — confidence level does not grant authorization
- ADR-0078 channel restriction: voice is forbidden for quasi-PII content (legal advice about a named employee); chat is the only permitted channel
- ADR-0189 pattern: default-allow is a CVE-class gap for any named capability — explicit seed migration required
- ADR-0024 Contract System Architecture: Lovsen's output (validation result, amendment classification) feeds employment_contract lifecycle — C4 gate must be in place before any mutation is possible

## Considered Options

1. **Default-allow** — no seed, `gate_action` returns `default_permitted` for `industry_intelligence.lovsen_query`
2. **Read-only authority, chat-only** (chosen) — seed with `level: 'read_only'`, `min_role: 'employee'`, `allowedChannels: ['chat']`; capability is informational, never writes directly
3. **Suggest authority with four-eyes** — require manager confirmation for every Lovsen answer, blocking conversational use

## Decision Outcome

Chosen option: **Read-only authority, chat-only**, because Lovsen's P1 scope is informational (answer, validate, classify) — it never writes `employment_contract` rows directly. Writes go through the C4 gate at the capability that actually commits (e.g. `contract.update`, `contract.intake`). Lovsen is an advisor, not a writer.

**C4 authority seed (delivered in P1.S4 migration):**
```sql
INSERT INTO engine_authority_config
  (workspace_id, capability, min_role, level, requires_four_eyes, observer_escalation_hours)
SELECT
  w.id,
  'industry_intelligence.lovsen_query',
  'employee',       -- all roles may query Lovsen
  'read_only',      -- informational only — no mutation authority
  false,            -- no four-eyes on queries
  72                -- default escalation window
FROM workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

**Channel restriction (enforced at capability registration in P1.S4):**
```typescript
// packages/ai/src/capabilities/industry-intelligence/index.ts
allowedChannels: ['chat'],  // ADR-0078 + ADR-0259: voice forbidden for legal advice
```

**Telemetry:** `lovsen.query.received` through `lovsen.answer.composed` events (registered in P1.S0, ADR-0256) receive `engine_event` routing added in P1.S4 when the capability lands — that is when the workflow engine needs to react to Lovsen invocations.

## Rules & Consequences

- **Good, because** any Botsson session trying to route a Lovsen query over voice channel is blocked at `gate_action` — ADR-0078 channel guard is enforced, not just documented
- **Good, because** `level: 'read_only'` means Lovsen answers can never be used as direct write authorization — downstream mutation capabilities must call their own `gate_action`
- **Bad, because** `min_role: 'employee'` means any authenticated user can invoke Lovsen — workspace admins cannot restrict Lovsen access per-employee in P1 (deferred to P2 workspace configuration)
- **Agent Impact:** P1.S4 sub-sortie MUST ship the seed migration before enabling the `industry_intelligence.lovsen_query` capability in production. The capability MUST declare `allowedChannels: ['chat']` at registration. Adding `engine_event` routing to Lovsen telemetry events is also a P1.S4 task.

---

> Registered in `docs/decisions/0000-decision-log.md`. Cross-reference: ADR-0024 (Contract System Architecture), ADR-0078 (Engine Process Channel Restriction), ADR-0256 (Lovsen Citation Contract), ADR-0257 (Lovsen Confidence Model).
