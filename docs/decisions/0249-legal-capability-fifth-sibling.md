---
title: "legal capability — fifth registered capability, Norsk arbeidsrett (Lovsen-branding)"
id: ADR_0249
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
---

# ADR-0249: `legal` capability — fifth registered capability, Norsk arbeidsrett

## Context and Problem Statement

ADR-0242 (contract/payroll capability split) specified `legal` as a "third capability sibling" to `contract` + `payroll`. It named three tools — `validate_aml_14_6`, `cite_law`, `classify_amendment` — with per-tool channel restrictions per ADR-0078.

Phase 0c requires:

1. The `legal` capability to be registered in `packages/ai/src/capabilities/registry.ts`.
2. `validate_aml_14_6` to be wired as a mandatory pre-dispatch gate in `/api/contracts/send`.
3. The `CapabilityName` union to gain `"legal"`.

ADR-0173 defined "frozen-4" boundary for journey capabilities specifically, not a platform-wide capability count freeze. The 17 + capabilities registered since ADR-0173 (schedule, operations, shift_lifecycle, governance, billing_query, memory, helpdesk_query, kb_query, journey, journey_authoring, season, availability, payroll, personal, ...) confirm ADR-0173 applies exclusively to the four `journey.*` capability names, not to the global registry count. `legal` is therefore a new sibling without violating ADR-0173.

## Decision Drivers

- CAPABILITY-legal.md (2026-04-29): architecture spec demands `legal` as capabilities layer, NOT a standalone agent.
- ADR-0220 (Botsson sole front door): `legal` is tools only; Botsson invokes them and responds in Lovsen-voice.
- ADR-0078: per-tool channel restrictions declared in capability `allowedChannels` + tool-level guard (Layer 1 + Layer 3).
- ADR-0099: `classify_amendment` is mutation-driving → `gate_action: enforce, default_allow: false`.
- L-0181 (persona vocabulary ≠ agent architecture): Lovsen is output branding, not a separate agent session.
- Phase 0c mandate: `validate_aml_14_6` stub wired in `/api/contracts/send` as mandatory gate BEFORE DocuSeal dispatch.

## Considered Options

1. **Fifth registered capability `legal`** — `validate_aml_14_6` + `cite_law` + `classify_amendment` as defined in ADR-0242. Phase 0c stubs; Lovdata MCP in Phase 0c+.
2. **Inline validation in route only** — skip capability registration; put stub directly in route handler. Breaks ADR-0220 (no bypass), loses Botsson routing, loses telemetry prefix isolation.
3. **Extend `contract` capability** — add `validate_aml_14_6` to existing `contract` capability. Mixes Medium-PII tools with advisory legal tools; collapses `allowedChannels` to lowest common denominator.

## Decision Outcome

Chosen option: **Option 1 — fifth registered capability `legal`**.

### Capability registration

| File | Change |
|------|--------|
| `packages/ai/src/capabilities/legal/index.ts` | `legalCapability: CapabilityDefinition` |
| `packages/ai/src/capabilities/legal/tools.ts` | `validateAml146`, `citeLaw`, `classifyAmendment` (Phase 0c stubs) |
| `packages/ai/src/capabilities/types.ts` | `CapabilityName` gains `"legal"` |
| `packages/ai/src/capabilities/registry.ts` | `legal: legalCapability` entry |
| `packages/ai/package.json` | Export map gains `./capabilities/legal` + `./capabilities/legal/tools` |

### Tool channel contract (ADR-0078)

| Tool | allowedChannels | Layer 3 guard |
|------|-----------------|---------------|
| `validate_aml_14_6` | `["chat", "voice"*]` | `channel !== "chat" && channel !== undefined && channel !== "system"` → fail |
| `cite_law` | `["chat", "voice"]` | None (capability allowedChannels is sufficient) |
| `classify_amendment` | `["system", "autonomous"]` | `channel !== "system" && channel !== "autonomous" && channel !== undefined` → fail |

*Note: capability declares `allowedChannels: ["chat", "voice", "system"]` (union). Per-tool guards are Layer 3 defence-in-depth.

### Send-route hook (ADR-0249 primary deliverable)

`/api/contracts/send` gains `validateAml146.execute()` call BEFORE DocuSeal dispatch (line ~197 in original file). Hook:
- Constructs minimal `AgentToolContext` with `channel: "system"` (server-only, not a chat session).
- On `pass===false` (Phase 0c+ real validator): returns 422 with `aml_errors[]` + `aml_status`.
- On `pass===true` (Phase 0c stub): continues to dispatch unchanged.
- Emits `legal.aml_14_6.validated` telemetry per L-0184 (single canonical emit producer).

### Telemetry (ADR-0194 emitPrefix isolation)

Three events registered in `packages/telemetry/src/registry.ts`:

| Event | Destinations | Category |
|-------|-------------|----------|
| `legal.aml_14_6.validated` | posthog, activity_trail | contracts |
| `legal.law_cited` | posthog, logger | contracts |
| `legal.amendment_classified` | posthog, activity_trail | contracts |

emitPrefix `"legal"` unique in registry — `getAllCapabilities()` collision check enforces this.

### Phase 0c vs Phase 0c+ split

| Phase | Scope |
|-------|-------|
| **0c (this ADR)** | Capability scaffold + 3 stub tools + send-route hook + telemetry registration + tests |
| **0c+** | Lovdata MCP integration: `validate_aml_14_6` body runs 16-letter §14-6 checklist via `regulatory_framework` + `framework_rule` (K1a). Requires Phase 0c.1 K1a seed migration first. |

## Rules & Consequences

- **Good, because** capability isolation enables per-tool authority seeding (ADR-0192), channel gating (ADR-0078), and Botsson routing (ADR-0220) without modifying existing contract/payroll capabilities.
- **Good, because** stub-first approach unblocks send-route gate today without Lovdata API dependency. Gate is a no-op until Phase 0c+ ships the real validator.
- **Bad, because** stub always passes — Phase 0c gate is a framework hook, not enforcement. Must ship Phase 0c+ before the gate provides real compliance protection.
- **Agent Impact:** Any tool that invokes `validate_aml_14_6` directly MUST pass `channel: "system"` or `channel: "chat"`. Botsson chat sessions pass `channel: "chat"`. Route handlers pass `channel: "system"`. Voice sessions are rejected at Layer 3.

## Authority seed (required same PR as Phase 0c+)

```sql
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  ('legal', 'read_only', 'manager', false, 72,
   'Norsk arbeidsrett — Lovsen. validate_aml_14_6: manager, chat; cite_law: employee, chat+voice; classify_amendment: admin, system, enforce. ADR-0249 Phase 0c. 2026-04-30.')
ON CONFLICT (capability) DO NOTHING;
```

Migration name: `20260430000001_legal_capability_authority_seed.sql` (pending).

## ADR compliance

- **ADR-0078** channel restriction: per-capability `allowedChannels` + per-tool Layer 3 guard
- **ADR-0099** gate_action: `check` for read tools; `enforce + default_allow:false` for `classify_amendment`
- **ADR-0151** forgery defence: workspace_id from JWT (already resolved by send-route before hook fires)
- **ADR-0173** frozen-4: does NOT apply to global registry — frozen-4 is journey.* capability names only
- **ADR-0192** authority seed: migration stub named; must ship before Phase 0c+ gate enforcement
- **ADR-0194** emitPrefix: `"legal"` registered; collision-checked by `getAllCapabilities()`
- **ADR-0220** Botsson sole front door: `legal` is tools, not agent; Botsson invokes, responds in Lovsen-voice
- **ADR-0242** capability split: `legal` is third sibling alongside `contract` + `payroll`
- **L-0181** persona ≠ agent: Lovsen branding is output only
- **L-0184** single canonical emit: `emit()` called inside tool `execute`, not duplicated in route

## References

- CAPABILITY-legal.md (Phase 0c spec, 2026-04-29)
- SKILL.AML.md + SKILL.CLASSIFYER.md + checklist.md (Lovsen agent specs)
- ADR-0242, ADR-0234 (capability split, contract/payroll)
- ADR-0078, ADR-0099, ADR-0151, ADR-0173, ADR-0192, ADR-0194, ADR-0220
- L-0181, L-0184
