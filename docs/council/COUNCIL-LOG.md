---
title: Council Session Log
status: in_progress
updated: 2026-03-28
created: 2026-03-26
module: governance
tags: [council, decisions, multi-agent, review]
---

# Council Session Log

Tracks all System Council sessions — multi-agent review meetings where specs, plans, bugs, and architectural decisions are reviewed by the full agent team.

## Sessions

| Date       | Topic                             | Type         | Verdict              | Agents Consulted                                          | ADR                                                   | Learning                                                                                                                                                                                                                                                        |
| ---------- | --------------------------------- | ------------ | -------------------- | --------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-26 | Mobile Production Readiness v1.0  | spec         | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator, frontend-designer | None (per-role authority ADR deferred to v1.1)        | Authority default mismatch: tool-selector.ts=read_only vs agent-router.ts=suggest. Ultravox client tools cannot be wrapped as SmartoutTools.                                                                                                                    |
| 2026-03-27 | Onboarding Route Code Review      | architecture | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator, frontend-designer | ADR 13-18 in decision log                             | See decision log for full list. Key learning: pre-auth API calls fail silently.                                                                                                                                                                                 |
| 2026-03-27 | Invitation Flow E2E Audit         | feature      | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator, frontend-designer | Pending: RLS policy ADR, existing-user acceptance ADR | `USING (true)` RLS is never safe for PII tables. Trainee status was a no-op. Batch mode silent on dispatch.                                                                                                                                                     |
| 2026-03-27 | Invitation Core Fixes Spec Review | spec         | APPROVE WITH CHANGES | steward, supervisor                                       | None                                                  | RPC must limit PII to pending invitations. Simplify existing-user to password-only (defer magic link). Migration+page must deploy together.                                                                                                                     |
| 2026-03-26 | Migration Ordering & Idempotency  | bug          | APPROVE WITH CHANGES | steward, supervisor                                       | None                                                  | `CREATE TABLE IF NOT EXISTS` silently ignores FK differences (CASCADE lost). Follow-up migration required. Timestamp collisions from parallel branches.                                                                                                         |
| 2026-03-27 | Notification System Fixes (8-Fix) | bug          | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator                    | Pending: Notification Outbox Architecture ADR         | Engine templates invisible to registry (different namespace). Recipient resolution is a feature, not a detail. Outbox RLS `WITH CHECK (TRUE)` is never safe.                                                                                                    |
| 2026-03-27 | Profile Schema Mismatch Audit     | bug          | APPROVE WITH CHANGES | steward, supervisor                                       | None (CLAUDE.md trap added)                           | `profile` has `display_name` only, not `first_name`/`last_name`. 4 broken queries found (leader-pulse, session-manager x2, list-data-sources) + 2 guardian-bus downstream. 20 files confirmed OK. Data model is correct — identity layer vs D2 workspace layer. |
| 2026-03-28 | Communications Stack Architecture | architecture | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator, frontend-designer | ADR-0063: Comms consolidation                         | Komm canonical, Chat frozen. 3 telemetry gaps (reactions, read, mute). queueMicrotask anti-pattern in CallRoom. 4x MessageBubble maintenance problem. AI integration gap (no ai_assistant channel type yet). |
