---
title: "Channel-Divergence Asymmetry Between gate_action and cascade_gate_write"
id: LEARNING_0164
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [gate, channel, voice, security, adr-0078, adr-0091, adr-0099]
---

# Learning-0159: Channel Divergence Between Two Governance Gates Creates Voice CVE

## Context

Council 2026-04-28 reviewed dual-gate reconciliation (`gate_action` vs `cascade_gate_write`). Reviewers traced both gate paths end-to-end. Botsson Harness Builder (Phase 3) caught the asymmetry: `gate_action` reads `engine_process.allowed_channels` and returns `channel_allowed` + `downgrade_to`; `cascade_gate_write` has no `channel` parameter at all (`packages/supabase/src/gate-client.ts:74-99`).

Capability tools call `gate_action` only — channels enforced. Server Actions call `cascade_gate_write` only — channels NOT enforced. ADR-0078 mandates voice forbidden for critical-data mutations. The Server Action path therefore bypasses ADR-0078.

Today the surface is web-only Server Actions (low risk). Phase C1 (mobile LiveKit, ADR-0135) and Phase B4 (helpdesk voice tickets) operationalize the bypass.

## Discovery

When two RPCs cover the same conceptual control-plane (C4 governance) but were authored at different times by different authors, parameter-asymmetry is the default failure mode. The channel parameter was assumed to be "the other gate's job" — but no caller ever invoked both, so the gap was invisible until end-to-end code-trace forced reviewers to look at both signatures side-by-side.

The pattern generalizes: any time control logic is split across two RPCs where each is "authoritative" for its half, and callers pick one based on surface (capability tool vs Server Action), there is no compile-time check that both halves enforce the same invariant set. The only safety net is council-level code-trace.

## Impact

1. **ADR-0230 must land before any voice-initiated mutation surface ships** (Phase C1, Phase B4). `cascade_gate_write` gains `p_channel` parameter; `GateContext` gains required `channel: SessionChannel`.
2. **ADR-0229 dual-gate transitional architecture** treats P5 (channel parameter) as merge blocker for Wave 2B capability dual-gate migration.
3. **Future C4 control-plane work**: when proposing a new authority/data RPC, add a "parameter-symmetry checklist" to the ADR template — every parameter that affects ADR-0078, ADR-0101, or ADR-0099 enforcement MUST appear in BOTH RPC signatures or the asymmetry must be explicitly justified.
4. **Council Phase 2.5 fact-check addendum**: when reviewing dual-RPC topics, briefing must include side-by-side parameter table (RPC A signature vs RPC B signature) so asymmetry is visible at intake.

## References

- ADR-0078 (voice forbidden for critical data)
- ADR-0091 (cascade_gate_write WP2)
- ADR-0099 (gate_action — channel enforcement reference)
- ADR-0135 (mobile LiveKit — Phase C1)
- ADR-0229 (dual-gate transitional architecture)
- ADR-0230 (cascade_gate_write channel parameter)
- Council session 2026-04-28 — `docs/council/COUNCIL-LOG.md`

> After writing: register in `docs/learnings/0000-learning-log.md`.
