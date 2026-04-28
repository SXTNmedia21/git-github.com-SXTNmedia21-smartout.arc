---
title: "Rejected ADR Options Resurface Under New Names"
id: LEARNING_0152
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [adr-rediscovery, channel-restriction, voice-safe, council, adr-0078]
---

# Learning-0152: Rejected ADR Options Resurface Under New Names

## Context

2026-04-28 council on journey-engine doc consolidation — Harness Builder uniquely caught: the proposed `voice_safe: true | false` field in `RESCUE-PROMPT.md` frontmatter (`docs/engines/system-intelligence/10-rescue-prompt-spec.md`) duplicates the `human_only` flag pattern explicitly **rejected** by ADR-0078 §"Considered Options". ADR-0078 rationale: such flags overlap C4 authority, fragment policy, and produce drift.

ADR-0078 + ADR-0163 enforce channel restriction via 3 layers:
1. Process `engine_process.allowed_channels` column
2. Capability `CapabilityDefinition.allowedChannels` array (mandatory non-empty per ADR-0163)
3. Tool `AgentToolContext.channel` self-check

`voice_safe` would have been an unenforced layer 4 — markdown frontmatter with no enforcement infrastructure. If layers 1-3 already block voice, layer 4 redundant. If they don't, layer 4 in markdown is unenforceable.

## Discovery

When authors write new specs, they search for problem-shaped solutions in the immediate context — not in the historical ADR record. The "shall this be safe in voice?" question naturally produces the obvious answer "add a flag." Authors rarely scan §"Considered Options" of related ADRs to see if the obvious answer was already considered and rejected.

Pattern signature:
- New flag/field name (e.g., `voice_safe`, `human_only`, `allow_voice`, `restricted_channels`) introduced in spec
- Domain (channel safety, authority, tenancy, telemetry) has an existing ADR
- That ADR's §"Considered Options" lists a structurally-identical rejected option
- Author is unaware of rejection; spec ships as if it's a new idea

This is the inverse of "rediscovery is normal." Rediscovery without checking the ADR record produces silent drift back to patterns that the system explicitly chose against.

## Impact

**Process change:** Council Phase 2 briefing must include "ADR §Considered-Options scan": for any new flag, field, or option introduced in a spec, the briefing-author must scan §"Considered Options" of the most-related accepted ADRs (channel restriction → ADR-0078; authority → ADR-0099/0173/0176; tenancy → ADR-0039) and explicitly answer: "does this rediscover a rejected option?" If yes, justify why circumstances changed; if no, confirm the new option is structurally distinct.

**Author guidance:** before adding any boolean flag to a spec, search `docs/decisions/` for the domain noun and read §"Considered Options" of the top 3 hits. If a structurally-similar option was rejected, either (a) align with the rejection, (b) write a superseding ADR with explicit rationale for revisiting.

**Council reviewer guidance:** when reviewing a new schema/spec, ask "is there an ADR §Considered Options section that would have rejected this?" Harness Builder caught this one because the channel-restriction ADRs are core to its domain. Other reviewers should adopt the same check for their domains.

## References

- ADR-0078 (engine_process channel restriction — §Considered Options rejected `human_only`)
- ADR-0163 (mandatory `allowedChannels` for PII)
- ADR-0223 (Journey Rescue reconciliation — drops voice_safe)
- Council 2026-04-28 (`docs/council/COUNCIL-LOG.md`)
- L-0151 (phantom contracts simultaneously authored)

---
