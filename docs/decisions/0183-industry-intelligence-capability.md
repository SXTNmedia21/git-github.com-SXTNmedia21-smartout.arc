---
title: "industry_intelligence Capability (proposed, deferred)"
id: ADR-0183
status: proposed
layer: decision
created: 2026-04-22
updated: 2026-04-22
module: contracts
tags: [capability, industry-intelligence, k1a, drift-remediation, change-proposal, deferred]
---

# ADR-0183: `industry_intelligence` Capability (proposed, deferred)

## Context and Problem Statement

ADR-0181 makes K1a→K1b drift observable via lineage columns but ships only a passive badge in Phase 4. Phase 5 of the contract-management-redesign (Council 2026-04-22 Q7) requires active drift remediation: a workspace admin must be able to see what changed in the upstream K1a template since the fork, review proposed clause updates, and accept or reject each one — with full audit trail via `change_proposal`.

Agent-coord code-trace confirmed no `industry_intelligence` capability exists today. `packages/ai/src/capabilities/` contains no registration, no tools, no `engine_authority_config` seed. Building it is a net-new capability — must go through the full capability protocol (registration, tool authoring, authority seed, telemetry registry, channel declaration).

This ADR scopes the capability but does NOT accept it. Acceptance is gated on Phase 5 resource allocation and explicit workspace-admin UX design for the accept/reject flow.

## Decision Drivers

- Phase 4 passive drift (ADR-0181) is observability-only — without this capability, Phase 5 has no implementation path.
- ADR-0076 — composition is cascade derivation; drift remediation is a derivation-refresh concern.
- ADR-0078 — channel restrictions apply to PII-handling capabilities only; template authoring and diff-review are NOT PII intake, so `allowedChannels: ["chat", "voice"]` is permissible.
- ADR-0097 — C4 authority defaults are not free; default `read_only` blocks and default-allow in `gate_action` over-grants. Any new capability MUST ship with an explicit `engine_authority_config` seed.
- L-0094 — phantom emit contracts; telemetry events must be registered before emit sites land.
- L-0086 — half-wired infrastructure is worse than missing infrastructure; half-shipped capability produces silent gaps.

## Considered Options

1. **Dedicated capability `industry_intelligence` with three tools (`check_drift`, `fetch_k1a_version`, `propose_clause_update`) — proposed, accept later** — clean cascade boundary, explicit authority seed, passes L-0097 check.
2. **Extend the existing `training` or `contracts` capability with drift tools** — conflates concerns; drift is an industry-knowledge lens, not a training or composition operation; rejected per ADR-0076.
3. **Ship drift remediation as a Server Action without capability indirection** — skips the cascade authority model; rejected per ADR-0091 + L-0097 (default-allow risk).
4. **Defer indefinitely — ship Phase 4 passive-only, revisit when workspace admins complain** — viable if Phase 5 is not resourced, but leaves the drift badge as a dead-end affordance. (L-0086 trap.)

## Decision Outcome

Chosen option (proposed, not accepted): **"Dedicated capability `industry_intelligence` with three tools"**. Acceptance blocked on Phase 5 resource allocation + explicit workspace-admin UX design for the accept/reject flow. No code ships under this ADR until status flips to `accepted`.

### Capability scope

```ts
// packages/ai/src/capabilities/industry-intelligence/index.ts (proposed)
export const industryIntelligenceCapability: SmartoutCapability = {
  name: "industry_intelligence",
  description: "Detect K1a→K1b drift, fetch upstream version diffs, propose clause updates for admin review.",
  allowedChannels: ["chat", "voice"],  // ADR-0078: not PII intake, voice permitted
  tools: [checkDriftTool, fetchK1aVersionTool, proposeClauseUpdateTool],
};
```

### Tools

| Tool | Purpose | Writes? |
|---|---|---|
| `check_drift` | Given a forked template_id, return `{ stale: boolean, source_version: string, current_version: string, delta_summary: string }`. Pure read. | No |
| `fetch_k1a_version` | Given a template_id + two versions, return the clause-level diff between them. Pure read. | No |
| `propose_clause_update` | Generate a `change_proposal` row for a specific clause-level update. Admin reviews, accepts or rejects downstream via existing `change_proposal` flow. | Yes (`change_proposal`) |

### Authority seed (required on acceptance per ADR-0097 + L-0097)

```sql
-- packages/supabase/migrations/<ts>_industry_intelligence_authority_seed.sql
INSERT INTO engine_authority_config (capability_name, tool_name, level) VALUES
  ('industry_intelligence', 'check_drift', 'autonomous'),
  ('industry_intelligence', 'fetch_k1a_version', 'autonomous'),
  ('industry_intelligence', 'propose_clause_update', 'suggest');
```

Rationale: reads are `autonomous` (no side effects); `propose_clause_update` is `suggest` because it writes `change_proposal` which then flows through the existing admin-review gate.

### Telemetry (required on acceptance per L-0094 + ADR-0175 pattern)

Register in `packages/telemetry/src/registry.ts` before any emit site:

- `industry_intelligence.drift_checked` — fires on every `check_drift` call.
- `industry_intelligence.version_fetched` — fires on every `fetch_k1a_version` call.
- `industry_intelligence.clause_update_proposed` — fires on every successful `propose_clause_update` call.

All three route to the standard four destinations (PostHog, Logger, activity_trail, engine_event).

### Channel policy

`allowedChannels: ["chat", "voice"]` — template authoring and clause review are NOT PII intake. ADR-0078 restricts voice only for PII-handling capabilities (personnummer, bank, adresse). A workspace admin asking "what changed in the Riksavtalen template since last month?" is a knowledge query, not PII. Explicit declaration required per ADR-0163.

### Blocks / prereqs before acceptance

1. Phase 5 resource allocation confirmed.
2. Workspace-admin UX design for the accept/reject flow complete (visual mock + flow diagram).
3. `change_proposal` downstream gate validated — confirm existing admin-review flow handles clause-level proposals, or scope an extension in a sibling ADR.
4. Migration 0a/0b/0c split confirmed (capability registration + authority seed + optional backfill).

## Rules & Consequences

- **Good, because** Phase 5 has a scoped capability to implement against — no ad-hoc Server Action sprawl.
- **Good, because** explicit `allowedChannels` declaration respects ADR-0163 and avoids Layer-1 silence per L-0063.
- **Good, because** authority seed is declared up front — no default-allow / default-blocking trap per L-0097.
- **Bad, because** remains `proposed` until Phase 5 is resourced — the drift badge shipped in Phase 4 has no active path until this ADR is accepted, which risks L-0086 half-wired-infrastructure perception. (Mitigation: Phase 4 badge copy explicitly states "remediation coming in Phase 5".)
- **Bad, because** three new capability tools + three telemetry events + one authority-seed migration is a non-trivial lift; must be planned as its own sub-sortie.
- **Agent Impact:** Until this ADR is `accepted`, no capability tool named `industry_intelligence.*` may be registered. Any PR referencing it without the ADR flipping must be rejected. When acceptance lands, the registration PR must land with the authority seed migration + telemetry registration + tool implementations in a single atomic sub-sortie.

## References

- ADR-0076 — composition as cascade derivation (drift remediation is derivation-refresh).
- ADR-0078 — channel restrictions (template authoring is non-PII → voice permitted).
- ADR-0091 — `gate_action` dual-gate (capability authority model).
- ADR-0097 — C4 authority defaults are not free (mandatory seed).
- ADR-0133 — mobile surface boundary (remediation UI is web-only).
- ADR-0163 — `allowedChannels` mandatory for PII-handling capabilities; explicit declaration required for all.
- ADR-0175 — emit-registry contract pattern.
- ADR-0181 — K1a→K1b lineage columns; provides the data this capability reads.
- ADR-0182 — namespace separation; drift-remediation events belong to `industry_intelligence.*`, not `contract_template.*`.
- L-0086 — half-wired plumbing is worse than missing.
- L-0094 — phantom emit contracts.
- L-0097 — C4 authority defaults are not free.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
