---
title: "Journey-Authoring Tool Boundary — publishDraft Delegates to publish_mission"
id: ADR_0237
status: proposed
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0237: Journey-Authoring Tool Boundary — publishDraft Delegates to journey.publish_mission

## Context and Problem Statement

Council R1 (2026-04-29 Botsson on platform-admin) Phase 5 code-trace by agent-coord + harness-builder found `packages/ai/src/capabilities/journey-authoring/tools.ts:443-481` (`publishDraftTool`) executing three direct Supabase writes — `journey` INSERT, `journey_version` INSERT, `wizard_session` UPDATE — outside any `gatedMutation()` wrapper. Tool docstring at line 282 falsely claimed "ADR-0204 gatedMutation surrounds the journey + journey_version inserts." Body contradicts docstring. ADR-0204 §3 mandates ALL agent-layer mutations route through `gatedMutation`. ADR-0173 declares `journey.publish_mission` as a separate frozen-4 capability owning the journey/journey_version write surface.

Two violations stack: (a) a journey_authoring tool reaches into the publish_mission domain bypassing capability boundaries, (b) the writes have no gate_action, no gate_evaluation, no emit, no audit trail. The tool is currently dead code (Complete-button uses a separate `/api/platform-admin/journeys/wizard/[sessionId]/complete` endpoint), but the registry exposes it to the agent.

## Decision Drivers

- ADR-0204 §3 — all agent-layer mutations through `gatedMutation`
- ADR-0173 — `journey.publish_mission` is a frozen-4 capability owning journey/journey_version writes
- ADR-0099 — gate_action audit chain mandatory for governance-affected tables
- ADR-0134 — every mutation emits with non-null workspace_id + actor_id
- L-0166 — direct-write sites in capability tools bypass both gates (recurring pattern)
- Capability namespace boundary — `journey_authoring` authors specs; `journey.*` runs them; cross-namespace writes blur frozen contracts

## Considered Options

1. **Delegate** — `publishDraftTool` calls the existing `journey.publish_mission` capability tool (canonical per ADR-0173 frozen-4). journey_authoring becomes pure authoring; persistence to journey/journey_version stays in publish_mission domain.
2. **Wrap in-place** — keep publishDraft in journey_authoring/tools.ts but wrap the three writes in `gatedMutation` calls under `capability="journey.publish_mission"`. Functionally compliant but blurs capability boundaries.
3. **Amend ADRs** — update ADR-0226 + ADR-0173 to permit journey_authoring writing journey/journey_version directly. Least defensible — undermines frozen-4 contract.
4. **Remove publishDraftTool entirely** — wizard already has its own complete endpoint; the tool is dead code. Remove from registry and types, defer publish-via-agent to future work.

## Decision Outcome

Chosen option: **"Option 1 — Delegate"**, because:
- Preserves ADR-0173 frozen-4 (journey.publish_mission stays sole owner of journey writes)
- Closes ADR-0204 violation cleanly (delegated call goes through publish_mission's existing gatedMutation)
- Closes ADR-0099 audit chain (publish_mission already emits + writes gate_action)
- Closes ADR-0134 telemetry contract (publish_mission already emits with non-null IDs)
- Avoids dead-code removal that may break a planned voice-driven publish flow

If `journey.publish_mission` does not currently expose a tool callable by capability-to-capability dispatch, **Phase 1 of this ADR is** to expose it. Until that surface exists, `publishDraftTool` stays unregistered (removed from `packages/ai/src/capabilities/journey-authoring/index.ts` exports + `tools` array). The Complete-button endpoint continues to handle wizard publish.

## Rules & Consequences

- **Good, because** capability boundaries stay clean, frozen-4 preserved, audit chain unbroken, telemetry contract honored.
- **Good, because** L-0166 pattern (direct-write capability tools) gets one more closure.
- **Bad, because** delegate pattern requires journey.publish_mission to expose an inter-capability call surface — currently no precedent in `packages/ai/src/capabilities/`.
- **Bad, because** if Phase 1 (expose surface) takes >1 sprint, publishDraftTool stays unregistered = 4-tool capability becomes 3-tool transitionally. ADR-0226 Decision Outcome must reflect.
- **Agent Impact:** until Phase 1 lands, the agent CANNOT publish journeys via journey_authoring. Wizard Complete-button is the only publish path. Document this in journey_authoring system prompt so the agent doesn't tell the user "I'll publish for you" then fail.
- **Lint enforcement:** add `packages/ai/src/capabilities/journey-authoring/**` to `smartout/no-direct-supabase-write` rule's enforced-error scope. Currently warn-only; promote to error per L-0166 §Impact §2.

## References

- ADR-0099 — gate_action audit chain
- ADR-0134 — telemetry non-null contract
- ADR-0173 — journey capability frozen-4
- ADR-0204 — gatedMutation as canonical mutation primitive
- ADR-0226 — Journey-Authoring Capability via Stage Engine
- L-0166 — journey/tools.ts has 7 direct writes bypassing both gates
- L-0175 (this council) — per-tool trace mandatory for Chair Phase 3
- L-0176 (this council) — docstring claims compliance ≠ evidence

---

> After writing: register in `docs/decisions/0000-decision-log.md`. Promote to `accepted` after Phase 1 lands or after publishDraftTool removed from registry.
