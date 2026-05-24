---
id: L-0349
title: Spine claim DEV-4 "voice tools bypass gatedMutation" was FALSE — they don't mutate
status: published
date: 2026-05-25
related: [L-0147 (chair self-reversal), L-0297 (ADR-prose-vs-code receipt rule), ADR-0289]
tags: [agent-harness, voice, spine-drift, ADR-0078, ADR-0204, ADR-0289]
---

# L-0349 — Spine claim DEV-4 mischaracterized voice schedule tools

## What happened

Council 2026-05-25 code-tracer (system-agent-coordinator) verified `services/voice-agent/src/tools-schedule.ts` against spine claim in `docs/domains/agent-harness/GAPS-AND-DEBT.md` DEV-4: *"3 voice schedule tools bypass gatedMutation orchestrator. ADR-0204 cascade integrity invariant #8 violated."*

Reality: the 10 voice schedule tools (`propose_create_shift`, `propose_update_shift`, `propose_delete_shift`, + 7 view-state tools) **never write to DB**. They publish data-channel events via `_publishActivity` (lines 136, 223, 286). Header comment lines 14-26 explicitly documents the architecture:

> "Proposal tools do NOT use the ADR-0078 three-layer channel guard because they do not write to domain tables. Their defence is structural isolation: registered only in the voice-agent runtime (no chat twin in V0). Domain mutation is gated at the human acceptance step, not at the voice channel. ... No gate_action needed: no mutation touches domain tables."

ADR-0289 governs this pattern. Voice ghost-card flow: voice tool publishes event → BotssonShell → ScheduleVoiceToolsBridge → AgentProposalsContext → manual human approval → normal write path (which DOES use gatedMutation).

## Why it matters

A FALSE claim in a `mirror: verified` spine becomes load-bearing in every downstream council. Council 2026-05-25 nearly demanded "fix DEV-4 voice bypass" as pre-work blocker; code-trace surfaced that the work is non-existent (architecture is by design).

Sibling: L-0297 ADR-prose-vs-code receipt rule (claims drift from code; verify before acting). L-0147 family (chair reasons at prose level; code-tracer is the corrective).

## Class

**Spine drift** — `mirror: verified, last_verified: 2026-05-23` was technically accurate for the existence of the 3 tools but mischaracterized the structural defence. The spine entry conflated "no gatedMutation call-site" with "ADR-0204 violation" — the former is true, the latter is false.

## Fix

`docs/domains/agent-harness/GAPS-AND-DEBT.md` DEV-4 must be amended:

- BEFORE: "DEV-4: Schedule voice tools — 3 mutations bypass gatedMutation"
- AFTER: "DEV-4 (RECLASSIFIED 2026-05-25): Voice schedule proposal tools rely on human-acceptance gate (ADR-0289), not capability gate. Structural isolation by design. Not a bypass. What IS missing: chat-side twin for same UX in chat channel."

## Prevention rule

Phase 2.5 fact-check briefing rule (already enforces ADR-prose-vs-code per L-0297) extends to **spine-claim-vs-code** for any GAPS-AND-DEBT entry the briefing cites as load-bearing. Open the actual code referenced by the spine entry; verify the violation classification matches reality before accepting it as blocker.

Discriminating test for "bypass" vs "by-design":
1. Does the tool actually write to DB? (grep `.from(...).insert/.update/.delete/.upsert`)
2. If NO writes: tool is event-publisher, not mutation. ADR-0078/0204 do not apply. Verify a human-acceptance step exists downstream.
3. If YES writes without gate: real bypass — flag as ADR violation.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- `services/voice-agent/src/tools-schedule.ts:14-26,136,223,286` (architecture comment + event publishers)
- `docs/domains/agent-harness/GAPS-AND-DEBT.md` DEV-4 (claim to amend)
- ADR-0078 (channel guard), ADR-0204 (gatedMutation single path), ADR-0289 (voice ghost-card pattern)
