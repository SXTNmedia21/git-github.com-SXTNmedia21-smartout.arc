---
title: "Plan — channel-admin-capability-registration"
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: ai
tags: [plan, ai, capability, adr-0336, channel-admin]
---

# Plan — channel-admin-capability-registration

> Branch: `feat/channel-admin-capability-registration` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-6` | Base: `development` | Module: ai | Started: 2026-05-16

## Goal

Register `channel_admin` capability with 6 skeleton tools + seed migration. Unblocks Trust Gate D so `campaign/chat-admin` can start shipping tool bodies.

ADR-0336 already accepted design-only (commit b2060888e on development). This sortie ships the registration scaffold.

## Hard constraints

- Skeleton tools throw `"Not implemented in registration sortie — track in feat/channel-admin-<tool>-body"` so accidental calls fail fast.
- Per-tool authority + min_role + channel matches ADR-0336 design table.
- Capability lives in own namespace per ADR-0240 (writes to `channel` + `channel_member` only; no `channel_message` writes).
- Seed migration timestamp STRICTLY GREATER than current development HEAD max migration ts.
- TypeScript strict, no `any`.

## Sub-agent tracks

| Track | Agent | Model | Status |
|---|---|---|---|
| T0 Explore | Explore | haiku | dispatching |
| T1 Capability + tools + registry | general-purpose | sonnet | blocked T0 |
| T2 Seed migration | general-purpose | sonnet | blocked T0 |
| T3 Review | code-reviewer + system-steward | sonnet+opus | blocked G2 |

## T0 — Explore

Read:
- `packages/ai/src/capabilities/communication/index.ts` — shape reference
- `packages/ai/src/capabilities/tips/index.ts` — closest peer
- `packages/ai/src/capabilities/registry.ts` — registration pattern
- `packages/ai/src/capabilities/types.ts` — CapabilityName union
- `supabase/migrations/20260428100007_tips_authority_seed.sql` — seed shape

Report: capability shape template, registry insertion pattern, seed SQL template, current HEAD migration ts.

## T1 — Capability + 6 skeleton tools + registry wire

Tool authority matrix per ADR-0336:

| Tool | level | min_role | channel | Notes |
|---|---|---|---|---|
| mute_channel | autonomous | employee | chat | self-act, no PII |
| leave_channel | autonomous | employee | chat | self-act, no PII |
| invite_to_channel | confirm | manager | chat | PII lookup forces chat-only |
| rename_channel | confirm | admin | chat | structural change |
| archive_channel | confirm | admin | chat | structural change |
| change_member_role | confirm | admin | chat | role escalation gate |

Each skeleton body throws `Not implemented in registration sortie`.

## T2 — Seed migration

`supabase/migrations/<TS>_seed_channel_admin_authority.sql` following tips seed shape. Idempotent.

## G2 — typecheck + self-test

`pnpm turbo typecheck` clean. Optional vitest verifying registry contents.

## T3 — Review

Parallel code-reviewer + system-steward.

## G3 — Close

HANDOFF lists 6 follow-on tool-body sorties. 2 journeys flipped. close-feature.sh → development.

## Acceptance Criteria

- [ ] T1 capability + 6 tools registered
- [ ] T2 seed migration applies clean
- [ ] G2 typecheck green
- [ ] T3 reviews pass
- [ ] HANDOFF lists 6 follow-on sorties
- [ ] 2 journeys flipped verified
