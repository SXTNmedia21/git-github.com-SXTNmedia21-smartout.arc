---
id: ADR-0198
title: "CapabilityDefinition typed fields — allowedChannels required, toolAuthPattern required, emitPrefix explicit"
status: accepted
date: 2026-04-23
created: 2026-04-23
updated: 2026-04-23
deciders: [pontus, council]
superseded_by: null
module: MODULE_BOTSSON
tags: [adr, capability, type-safety, telemetry, harness]
---

# ADR-0198 — CapabilityDefinition typed fields

> **Numbering note:** This ADR was scoped in the plan as ADR-0194. On Task 8.1 reservation, 0194–0197 were already taken on sibling branches (`0194-journey-ir-v2-to-engine-missions-mapping.md`, `0195-authority-loader-full-dotted-key-preservation.md`, `0196-journey-engine-invariants-11-12-13.md`, `0197-phantom-contracts-promotion.md`). Renumbered to 0198. References to "ADR-0194" in Tasks 5–7 commits and inline code comments point to this file — see the "Historical Naming" section at the bottom.

## Context and Problem Statement

`CapabilityDefinition` is the per-capability shape consumed by the stage-engine router, the tool-selector, and the telemetry registry bridge. Before this ADR, three cross-cutting invariants on a `CapabilityDefinition` were **socially enforced**:

1. **Channel restriction (ADR-0078)** — every capability must declare the channels it is reachable from (`chat`, `voice`, `sms`, `email`, `system`, …). `allowedChannels` existed on the type but was marked optional, so a new capability could be authored without it and default to "everywhere" — the worst-case posture.
2. **Authoring auth pattern (ADR-0191)** — every capability must pick `bff` (BFF-proxied with JWT forwarding) or `direct_admin` (service-role admin client). The selection lived only in reviewer memory; a capability could be wired to admin by accident.
3. **Emit-namespace ownership (ADR-0116 + registry)** — every capability that emits domain events owns a prefix in `packages/telemetry/src/registry.ts` (e.g. `contract.*`, `schedule.*`). Collisions and unregistered events ("phantom contracts") were caught — if at all — by code review or by `writeActivityTrail` silently dropping the event.

This is the **4th occurrence** of the phantom-contract class (L-0094 — 2026-04-22 contract-hub-redesign post-merge code-trace). Each recurrence has been fixed at the emit-site layer; none so far had been fixed at the registration layer. `authority`/`emit`/`channel` drift was a CI-time concern, not a compile-time one.

**Phase 5 Trust-Gate (harness-hardening spec, 2026-04-23):** Item 2 is the "registration-layer" fix — promote the three invariants into required `CapabilityDefinition` fields so that adding a capability without them is a TypeScript compile error, not a runtime or code-review concern.

## Decision Drivers

- **Compile-time > CI-time > runtime.** Each tier further from `tsc` is a tier further from the author's feedback loop. The registration layer is the narrowest bottleneck (17 call sites today, all in `packages/ai/src/capabilities/*/index.ts`) — moving invariants here maximises coverage for minimum typing surface.
- **No new authority source.** ADR-0099 establishes `engine_authority_config` as workspace-scoped C4 state. Adding `authority: AuthorityLevel` at definition time would create a 4th source (after DB row, bootstrap-trigger advisory per ADR-0192, and `defaultAuthority?` fallback) and would invite local overrides that contradict the DB.
- **No registry duplication.** The telemetry registry (`packages/telemetry/src/registry.ts`) already enumerates every registered event. Repeating event names on `CapabilityDefinition` as `emitEvents: string[]` would force dual writes and re-open the exact drift class we are closing.
- **Runtime uniqueness is cheap.** One `Map<string, string>` check at `getAllCapabilities()` call time is negligible and catches the one failure mode a typed `emitPrefix` cannot: two capabilities happening to choose the same prefix.

## Considered Options

1. **Add required `authority: AuthorityLevel` field** — REJECTED. Collides with ADR-0099 C4 workspace-scoped authority. Would imply per-definition authority overrides DB state; there is no coherent merge rule. `defaultAuthority?` stays as an advisory fallback (and becomes dead code post-ADR-0192 bootstrap-trigger — plan to remove).
2. **Add `emitEvents: string[]` listing every event the capability emits** — REJECTED. Duplicates `packages/telemetry/src/registry.ts`. First drift re-introduces the bug we are fixing. Harder to update than the registry itself.
3. **Promote `allowedChannels` to required + add `toolAuthPattern: "bff" | "direct_admin"` required + add `emitPrefix: string | null` explicit** — CHOSEN.

## Decision Outcome

Chosen option: **Option 3 — three typed fields promoted to required on `CapabilityDefinition`.**

The exact shape (post-Task 5, from `packages/ai/src/capabilities/types.ts`):

```ts
export type CapabilityDefinition = {
  name: CapabilityName;
  description: string;
  tools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  suggestTools?: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  /** ADR-0078: capability is only available when session.channel is in this list.
   *  Required + non-empty (enforced socially by all 17 capabilities today; promoted
   *  to compile-time by ADR-0198). */
  allowedChannels: ReadonlyArray<SessionChannel>;
  /** ADR-0191: per-capability binary choice between BFF-proxied and direct-admin auth. */
  toolAuthPattern: "bff" | "direct_admin";
  /** ADR-0198: emit namespace owned by this capability (e.g. "contract", "schedule").
   *  `null` = this capability emits no domain events (only auto-emit via toVercelTools). */
  emitPrefix: string | null;
  /** Optional advisory fallback when engine_authority_config row is missing.
   *  Post-ADR-0192 bootstrap-trigger this becomes dead code. */
  defaultAuthority?: AuthorityLevel;
};
```

Per-capability `emitPrefix` assignment (Task 6, 17 capabilities):

| Capability | emitPrefix |
|---|---|
| profile | `null` |
| ui | `null` |
| guardian | `"guardian"` |
| schedule | `"schedule"` |
| operations | `"operations"` |
| communication | `"channel"` |
| contract | `"contract"` |
| contract_intake | `"contract_intake"` |
| shift_swap | `"shift_swap"` |
| operations_intelligence | `"ops_intelligence"` |
| training | `"training"` |
| shift_lifecycle | `"shift"` |
| governance | `"governance"` |
| billing_query | `"billing"` |
| memory | `"memory"` |
| helpdesk_query | `"helpdesk"` |
| journey | `"journey"` |

**Runtime uniqueness assertion** — `getAllCapabilities()` in `packages/ai/src/capabilities/registry.ts` throws on duplicate non-null `emitPrefix`:

```ts
export function getAllCapabilities(): CapabilityDefinition[] {
  const all = Object.values(capabilities);
  // emitPrefix collision check — ADR-0198 + INVARIANTS.md I3.
  const prefixOwners = new Map<string, string>();
  for (const cap of all) {
    if (cap.emitPrefix === null) continue;
    const existing = prefixOwners.get(cap.emitPrefix);
    if (existing) {
      throw new Error(
        `capability emitPrefix collision: "${cap.emitPrefix}" claimed by both ${existing} and ${cap.name}`,
      );
    }
    prefixOwners.set(cap.emitPrefix, cap.name);
  }
  return all;
}
```

Fails at stage-engine startup (first `getAllCapabilities()` call) rather than silently routing events to the wrong capability.

**Cross-ADR references:**

- **ADR-0078** (chat-only for PII capabilities) — `allowedChannels` is the mechanical enforcement surface.
- **ADR-0099** (C4 workspace-scoped authority) — intentionally NOT encoded on `CapabilityDefinition`; stays in `engine_authority_config`. `defaultAuthority?` is advisory only.
- **ADR-0116** (telemetry event registry) — `emitPrefix` is the namespace claim; registry owns event-level detail.
- **ADR-0191** (capability tool-auth passing pattern) — `toolAuthPattern` is its typed manifestation.
- **ADR-0192** (authority-seed bootstrap trigger) — once active, renders `defaultAuthority?` dead; planned removal at that point.

## Implementation

Landed 2026-04-23 across Tasks 5–7 of the harness-hardening plan (`docs/superpowers/plans/2026-04-23-harness-hardening.md`):

- **Task 5** — `CapabilityDefinition` type widened: `allowedChannels` now required, `toolAuthPattern` added required, `emitPrefix: string | null` added required. 17 capability `index.ts` files updated. `@smartout/ai` typecheck green.
- **Task 6** — per-capability `emitPrefix` assignments committed per table above.
- **Task 7** — runtime uniqueness assertion added to `getAllCapabilities()`, covered by `packages/ai/src/capabilities/__tests__/registry-uniqueness.test.ts` (2/2 passing, `@smartout/ai` test suite 252/252).

Commit sequence: `baebc115` (Task 5–6 typed fields) → `ec51289f` (Task 7 runtime assertion) → this ADR (Task 8).

## Rules & Consequences

- **Good, because** every new capability MUST declare its channels, its auth pattern, and its emit namespace — omission is a TypeScript error, not a runtime surprise.
- **Good, because** `emitPrefix` collisions fail fast at stage-engine startup with a named error; silent fan-out is no longer possible.
- **Good, because** no new authority source is introduced — DB state remains the single source of truth for C4 gating.
- **Bad, because** the one-time migration touched 17 files; future authors pay the typing cost on every new capability (intended).
- **Bad, because** `defaultAuthority?` is now dead code on the ADR-0192 bootstrap-trigger path; scheduled for removal when that ADR reaches `accepted` + implemented state.
- **Agent Impact:** when authoring a new capability, you must decide `allowedChannels` (ADR-0078), `toolAuthPattern` (ADR-0191), and `emitPrefix` (this ADR) up front. The compiler rejects the definition otherwise. If the capability emits no domain events, set `emitPrefix: null` explicitly — there is no default.

## Historical Naming

The harness-hardening plan (2026-04-23) scoped this decision as **ADR-0194**. At Task 8.1 reservation across all branches, ADR-0194 was already registered on a sibling branch (`campaign/journey-engine`) as `0194-journey-ir-v2-to-engine-missions-mapping.md`. ADRs 0195, 0196, 0197 were likewise taken on that branch. Renumbered to the next free slot: **ADR-0198**.

In-tree references to "ADR-0194" that belong to this decision:

- Code comments in `packages/ai/src/capabilities/types.ts` (field docstrings on `allowedChannels` and `emitPrefix`).
- Code comment in `packages/ai/src/capabilities/registry.ts` (uniqueness-check comment).
- Commit message subject of `ec51289f` ("ADR-0194: runtime assertion prevents emit-namespace collision").

These are left in-place as archival references. All future references use **ADR-0198**.

---

> Registered in `docs/decisions/0000-decision-log.md`.
