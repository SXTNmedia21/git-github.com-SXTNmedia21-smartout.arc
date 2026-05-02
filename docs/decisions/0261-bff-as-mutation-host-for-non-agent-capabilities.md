---
title: ADR-0261 — BFF as Mutation Host for Non-Agent Capabilities
status: accepted
updated: 2026-04-29
created: 2026-04-29
module: payroll
tags: [adr, bff, capabilities, payroll, tips, mutations, server-actions, telemetry]
---

# ADR-0261 — BFF as Mutation Host for Non-Agent Capabilities

## Context

Sortie 1 of `campaign/payroll` shipped four capability skeletons in `packages/ai/src/capabilities/tips/tools.ts` — `tips.approve_pool`, `tips.distribute`, `tips.adjust`, and `tips.audit` — alongside telemetry registry entries in `packages/telemetry/src/registry.ts`, on the assumption that these capabilities would eventually be filled with agent-executable bodies. The skeletons return `{ok:false, error:'not_implemented'}` with no DB writes and no `emit()` calls.

At the same time, the actual tip-pool mutations in Sortie 1 ship as Next.js Server Actions at `apps/web/src/app/dashboard/tips/_actions/` (following ADR-0114) calling SECURITY DEFINER RPCs directly (e.g. `approve_tip_pool`, `distribute_tips`). The Server Actions carry `callGateAction(...)` + `emit(...)` on `onSuccess` — they are the real mutation path for every human-UI flow.

This creates a structural ambiguity: are capability skeletons placeholders for future agent flows, or are they phantom contracts (ADR-0196 / ADR-0197 Mode 2)? The Wave 2 council (2026-04-18) flagged the dual-path divergence risk explicitly — when both a capability body and a Server Action exist for the same mutation, they can silently diverge in authority derivation, telemetry payload, and gate sequencing (L-0094 4th / 5th occurrence pattern).

The council verdict for `campaign/payroll` (2026-04-29, confidence: high) examined the full tips surface and found that:

1. No current Botsson voice/chat surface consumes any `tips.*` capability.
2. The BFF Server-Action pattern is already uniform across availability, shift-swap, and wizard-override flows (ADR-0205 precedent).
3. ADR-0114 designates Server Actions as the canonical user-initiated mutation primitive.
4. Filling capability `execute()` bodies in the absence of an agent consumer introduces phantom-body risk (ADR-0197 Mode 2) and a second write path that must be kept in sync with the Server Action indefinitely.

The decision codifies the correct interpretation and establishes the pattern for the full tips family and any future PII-adjacent payroll/billing capabilities that follow the same shape.

## Decision

**For capabilities where no agent surface (Botsson voice or chat) currently consumes the mutation:**

1. **The BFF route (Next.js Server Action) is the sole mutation owner.** It calls `callGateAction(...)` (ADR-0201, ADR-0099), runs the SECURITY DEFINER RPC, and emits telemetry in `onSuccess`. This is the complete, authoritative path.

2. **Capability `execute()` skeletons remain `{ok:false, error:'not_implemented'}` indefinitely.** This is NOT a phantom-emit violation (ADR-0196 Invariant 11). Invariant 11 bans the shape `emit("run_started") → return {ok:true, note:"skeleton"}`. The correct skeleton shape — `return {ok:false, error:'not_implemented'}` with zero `emit()` calls — is valid and intentional.

3. **Telemetry emit lives in the BFF route's `onSuccess`, never in the capability skeleton.** A skeleton that emits nothing does not need a registry entry removed; the registry entry documents intent for when the agent surface lands, not a current obligation.

4. **When an agent surface later needs the same mutation**, the capability `execute()` imports the same shared core module (e.g. `calculate.ts`, the RPC caller) and calls the same SECURITY DEFINER RPC — single shared core, two surfaces (BFF + capability). The telemetry emit is NOT duplicated: emit in the BFF route stays; the capability body adds its own emit (same event, different surface tag in `surface` payload field). Authority derivation follows ADR-0191 pattern B (`ctx.supabaseAdmin` after `callGateAction`).

5. **This pattern applies to the full `tips.*` capability family and is the documented model for any future payroll/billing capability family** where the initial delivery is human-UI-only and agent exposure is deferred.

### Verification — skeletons stay write-free

```bash
# Must return zero — no DB mutations inside skeleton execute() bodies
grep -R "supabase\.from\|supabaseAdmin\.from\|\.insert\|\.update\|\.delete" \
  packages/ai/src/capabilities/tips/tools.ts
# Expected: 0 matches

# Must return zero — no emit() inside skeleton execute() bodies
grep -R "emit(" packages/ai/src/capabilities/tips/tools.ts
# Expected: 0 matches

# BFF is the sole emit site — must return non-zero for each tips.* event
grep -R "emit(" apps/web/src/app/dashboard/tips/_actions/
# Expected: one emit call per Server Action
```

### Verification — gate is always called in BFF routes

```bash
# Every Server Action in the tips flow must call callGateAction
grep -R "callGateAction" apps/web/src/app/dashboard/tips/_actions/
# Must return one hit per mutating action file
```

## Consequences

### Positive

- **Zero phantom-body risk.** Skeletons with no `emit()` and no write cannot drift from the BFF path.
- **Single source of truth for mutations.** Server Actions own the write; no dual-path synchronisation burden until an agent surface is declared.
- **ADR-0114 + ADR-0201 compliance by default.** BFF-first naturally satisfies the canonical-primitive and gate-mandatory rules.
- **Clear upgrade path.** When Botsson needs a tips mutation, the pattern is documented: import shared core, call same RPC, add surface-tagged emit, cite this ADR.
- **Avoids the Wave 2 dual-path divergence class** (flagged 2026-04-18): authority derivation, telemetry, and gate sequencing live in exactly one place until an agent surface is intentionally added.

### Negative

- **Capability skeletons are long-lived placeholders.** They occupy namespace in `packages/ai/src/capabilities/tips/` and appear registered without functional bodies. A reader unfamiliar with this ADR may mistake them for phantom contracts.
- **Registry entries for tips events exist without current emitters in the capability layer.** This is intentional but requires this ADR as the explanation anchor.
- **If an agent surface lands without referencing this ADR**, a developer may fill the `execute()` body with a second full mutation path (creating the dual-path divergence this ADR prevents). Mitigation: `close-feature-journey-guardian.sh` gate (see Verification section above); code review checklist cites ADR-0229.

### Mitigation

- Every capability file in `packages/ai/src/capabilities/tips/` carries a file-level JSDoc comment: `// BFF-only per ADR-0229 — execute() stays not_implemented until agent surface declared.`
- `close-feature.sh` runs the grep gates above as part of the payroll campaign gate (alongside ADR-0196 Invariant 11 checks).
- HANDOFF for Sortie 1 links this ADR in the "architecture decisions" section.

## Alternatives Considered

### Option B — Fill capability `execute()` bodies immediately (capability-only)

Move all mutation logic into capability `execute()` bodies; Server Actions become thin wrappers that call the capability. This would make the capability the single truth.

**Rejected:** The Server Action is the surface that Next.js App Router, `useTransition`, and optimistic UI integrate with. Routing through a capability body from a Server Action introduces a redundant call stack and re-exposes the authority-passing complexity that ADR-0191 resolves for stage-engine contexts. ADR-0114 explicitly positions Server Actions as the canonical primitive for user-initiated mutations. Inverting that hierarchy breaks the established pattern without adding value.

### Option C — Dual-path: fill capability and keep Server Action (both active)

Implement full bodies in both the capability `execute()` and the Server Action, choosing at call time based on whether the caller is an agent or a human UI.

**Rejected:** This is exactly the dual-path divergence that the Wave 2 council (2026-04-18) identified as the primary risk class. Two active write paths for the same mutation will silently diverge in gate sequencing, telemetry payload shape, or actor derivation within weeks. ADR-0203 + ADR-0204 demonstrate the resolution cost of reconciling two active gate paths after the fact. Option C is the failure mode this ADR exists to prevent.

## Related ADRs

| ADR | Relation |
|-----|----------|
| [ADR-0078](0078-channel-restriction-pii.md) | PII-adjacent capabilities require explicit `allowedChannels`; tips capabilities carry this at registration time regardless of skeleton status. |
| [ADR-0114](0114-server-actions-canonical-mutation-primitive.md) | Establishes Server Actions as canonical user-initiated mutation primitive — this ADR extends that decision to the capability-skeleton coexistence case. |
| [ADR-0151](0151-stage-engine-profile-id-server-derivation.md) | Actor_id/profile_id must be derived server-side; BFF-as-mutation-host is the surface where this derivation occurs for tips flows. |
| [ADR-0173](0173-journey-capability-model.md) | Precedent: journey capabilities may be `{ok:false, error:'not_implemented'}` skeletons; this ADR generalises that posture to payroll capabilities. |
| [ADR-0196](0196-journey-engine-invariants-11-12-13.md) | Invariant 11 bans phantom-emit. This ADR clarifies that no-emit + not_implemented is NOT a violation — the ban targets `emit + return ok + no write`. |
| [ADR-0201](0201-season-agent-capability.md) | `callGateAction` mandatory on every mutating capability, regardless of authority default. BFF routes that own mutations must satisfy this — not delegated to the skeleton. |
