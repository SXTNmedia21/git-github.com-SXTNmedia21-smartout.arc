---
title: Learning 0034 — A capability without emit() is invisible to the cascade
status: captured
created: 2026-04-16
updated: 2026-04-16
module: ai-agent
tags: [learning, telemetry, capability, cascade, audit, authority]
---

# Learning 0034 — A capability without emit() is invisible to the cascade

## Context

Council 2026-04-16 (Botsson Runtime Review) found that 11 of 14 Botsson capabilities do not call `emit()` from `@smartout/telemetry`. Only `shift-lifecycle`, `contract`, and `contract-intake` emit. This was discovered by grepping `emit(` across `packages/ai/src/capabilities/` and comparing against the registered capability list.

## What we learned

A capability that mutates state without `emit()` is invisible to four observers simultaneously:

1. **PostHog** — no product analytics for the feature
2. **activity_trail** — no audit row; compliance and incident forensics blind
3. **engine_event** — no Event Engine trigger; workflow automation cannot react
4. **Logger stdout** — no structured log line for operator debugging

Authority decisions (via `gate_action` RPC per ADR-0099) complete successfully but leave no backwards-traceable evidence that the authorized action was performed. C1 (Calibration — belief about system state) and C4 (Governance — permission) cannot be audited.

## Why this matters

CLAUDE.md mandates: *"No mutation without emit. No second event system."* A capability that mutates silently is not a gray area — it is a direct violation of the project's cascade telemetry invariant. Agent Trust Gate cannot pass while silent capabilities exist; new capabilities cannot be added on top of silent plumbing.

## How to detect

- `grep -rn "emit(" packages/ai/src/capabilities/` should produce matches for every capability that performs writes
- Any new `SmartoutTool` with `execute` that calls `supabaseAdmin.from(...).{insert,update,upsert,delete}` MUST also call `emit()`
- Automated check candidate: a lint rule or TypeScript type gate that requires capabilities in a mutation branch to call `emit()` before returning

## How to fix

Do not fix per-capability by hand. The council-approved approach is to auto-emit from `packages/ai/src/adapters/vercel-ai.ts` (the `toVercelTools` adapter): every tool invocation emits `botsson.tool_invoked` with `{ capability, tool, latency_ms, success }`. This closes 14 capabilities in one adapter change rather than 14 capability edits. Per ADR-0113 (Runtime Telemetry Standard) Phase 3.

## Related

- ADR-0113 — Runtime Telemetry Standard (the canonical statement of the rule)
- Council session 2026-04-16 — Botsson Runtime Review
- CLAUDE.md — "No mutation without emit"
