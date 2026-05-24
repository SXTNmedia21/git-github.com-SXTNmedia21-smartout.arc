---
title: ADR-0415 — Server Actions vs Capability Tools — Decision Tree
id: ADR-0415
status: proposed
date: 2026-05-24
module: meta
tags: [adr, architecture, capability, server-action, emit, telemetry]
related: [ADR-0287, ADR-0204, ADR-0134, L-0176, L-0340]
---

# ADR-0415 — Server Actions vs Capability Tools — Decision Tree

## Context

Journey-sweep council 2026-05-24 surfaced an architectural drift in BUG-3 (pin/unpin announcement DB shape). Agent Coordinator code-trace established:

1. ADR-0287 declares `pin_announcement` (or `pin_message`) as a Botsson capability tool with gate_action + emit() contract.
2. **No such capability tool exists in `packages/ai/src/capabilities/communication/tools.ts`** — grep returns zero matches.
3. Real implementation lives at `apps/web/src/app/dashboard/komm/_actions/pin-message-action.ts` — a Next.js Server Action that writes `pinned_by` + `pinned_at` columns directly to the DB with service-role bypass.
4. Telemetry is fired from `apps/web/src/app/dashboard/komm/_hooks/use-pin-message.ts:33` using `void emit(...)` in React Query `onSuccess` — **fire-and-forget, no await**.
5. Test failure (BUG-3) is a race condition: test queries `activity_trail` for the pin event before the fire-and-forget emit() round-trips through `/api/telemetry` and writes the audit row. Toast appears synchronously in the same onSuccess; emit completes asynchronously later.

This is symmetric with L-0340 (telemetry contract without emit wiring) but inverted: emit exists, but is decoupled from the mutation that triggered it. Same root cause class: **feature delivered without emit() at the same site as mutation.**

Smartout has 2+ write surfaces with this ambiguity:
- `pin-message-action.ts` (pin/unpin) — Server Action with deferred telemetry
- `pin-message-action.ts:28` itself contains a TODO acknowledging the gap: "when a Botsson `komm.pin_message` capability tool is introduced … route through gateAction"

Other Server Actions in the codebase likely exhibit the same pattern (audit candidate). Without a decision tree, every new write surface will face the same choice ad-hoc.

## Decision

Adopt a **Server Actions vs Capability Tools decision tree** + telemetry contract per write surface type.

### Decision tree

| Question | If yes | If no |
|---|---|---|
| Will an AI agent invoke this write? | Build as **Capability Tool** in `packages/ai/src/capabilities/<domain>/tools.ts` | Continue |
| Does the write require gate_action (per ADR-0287 authority config)? | Build as **Capability Tool** | Continue |
| Is the write a workspace-scoped mutation with multi-channel telemetry routing (PostHog + activity_trail + engine_event)? | Build as **Capability Tool** | Continue |
| Is the write user-only, single-form, no agent surface, no engine_event routing? | Build as **Server Action** with co-located emit | — |

Default to Capability Tool when in doubt. Server Actions are a narrower carve-out.

### Telemetry contract for Server Actions

Server Actions classified by the tree as "Server Action with co-located emit" MUST:

1. **`await emit(...)` in the Server Action body** — NOT fire-and-forget from a consuming hook
2. Use `nonEmpty(workspace_id)` + `nonEmpty(actor_id)` per ADR-0134 (fail-fast on missing IDs)
3. Co-locate emit with the mutation: emit AFTER the DB write succeeds, BEFORE returning
4. Register the event in `packages/telemetry/src/registry.ts` per ADR-0377
5. Document the Server Action header with: "Telemetry: emits `<event_name>` per ADR-0415 server-action carve-out"

### Resolution for ADR-0287 ambiguity

ADR-0287 references `pin_message` / `pin_announcement` as a capability tool. **One of two actions required:**

- **Option A (recommended):** Build the `pin_message` capability tool in `packages/ai/src/capabilities/communication/tools.ts`. Migrate `pin-message-action.ts` to call it via `gatedMutation` wrapper. Remove `use-pin-message.ts` emit (capability tool emits in body).
- **Option B:** Amend ADR-0287 to remove the `pin_message` capability claim. Keep `pin-message-action.ts` as Server Action. Add `await emit()` in the action body. Remove `use-pin-message.ts` client-side emit.

Decision deferred to the BUG-3 architectural sortie (per chair Phase 5 synthesis 2026-05-24 sortie sequence).

### Audit obligation

When this ADR ships, audit all Server Actions in `apps/web/src/app/**/_actions/` for emit() pattern compliance. Findings table in `docs/audits/2026-05-24-server-action-emit-audit.md`.

## Consequences

**Positive:**
- New write surfaces have a clear decision rule instead of ad-hoc choice
- Server Actions become first-class with documented telemetry contract
- Eliminates "Server Action + fire-and-forget hook emit" race condition class
- Closes BUG-3 architectural ambiguity definitively

**Negative:**
- Adds documentation overhead for Server Actions (header tag + audit row)
- Some existing Server Actions may need refactor to add `await emit()` (audit will surface count)
- Decision tree is not autonomous CI-enforceable; requires reviewer attention

## Alternatives Considered

1. **Status quo (no decision tree):** every author picks ad-hoc. Rejected — produces BUG-3-class drift indefinitely.
2. **Ban Server Actions entirely:** every write goes through capability tools. Rejected — Server Actions are first-class Next.js primitive for user-only flows; banning is over-rotation.
3. **Move all Server Action telemetry to a generic middleware:** complex, hides emit at unexpected layer. Rejected.

## References

- ADR-0287 — gate_action mandatory + capability surface boundary
- ADR-0204 — gatedMutation wrapper pattern (and the L-0176 docstring-drift around it)
- ADR-0134 — telemetry IDs fail-fast (nonEmpty)
- ADR-0377 — telemetry registry contract
- L-0176 — docstring-claims-compliance-body-doesn't (sibling drift pattern)
- L-0340 — telemetry contract without emit wiring (inverted-class sibling)
- L-0344 — BUGS.md ghost-claim pattern (this council)
- Journey-sweep council 2026-05-24 chair Phase 5 synthesis
