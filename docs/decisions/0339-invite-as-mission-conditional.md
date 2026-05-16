---
id: ADR-0339
title: "Invite-as-Mission (Conditional on ADR-0336 Outcome)"
status: proposed
date: 2026-05-16
deciders: [pontus, council]
tags: [channel-admin, mission, invite, capability]
supersedes: null
superseded_by: null
created: 2026-05-16
updated: 2026-05-16
layer: decision
---

# ADR-0339: Invite-as-Mission (Conditional)

**Status:** Proposed (conditional — depends on ADR-0336 implementation path)
**Date:** 2026-05-16
**Council:** Chat-WhatsApp Phase 3 priority council — APPROVE WITH CHANGES

## Context and Problem Statement

ADR-0336 defines `channel_admin` as a new capability with `invite_to_channel`
as one of its tools. The invite flow has two possible complexity levels:

**Simple path** — user enters email/profile; system inserts a `channel_member`
row; notification emitted. Single capability tool, single `gatedMutation` call.

**Complex path** — invitee does not have a Smartout profile yet. Flow becomes
multi-step: (1) send invite link, (2) invitee creates profile, (3) auto-join
channel on profile creation, (4) emit `channel_member.inserted`. This is a
stateful multi-step workflow — the definition of a `mission` in
`packages/ai/src/missions/`.

If the complex path is chosen, `invite_to_channel` capability tool cannot be a
single `gatedMutation` call. It must delegate to a `mission` that manages the
multi-step state.

## Decision Drivers

- ADR-0173 (frozen-4 boundaries) — missions live in `packages/ai/src/missions/`;
  they are not inlined into capability tools
- ADR-0240 (cross-namespace writes) — capability tool cannot own `profile`
  creation (that belongs to the identity layer, pre-workspace)
- ADR-0099 (four-eyes gate) — single `gate_evaluation` row per mission start,
  not per step

## Considered Options

- **Option A** — Implement `invite_to_channel` as a capability tool (assumes
  invitee already has a Smartout profile; reject with clear error if not)
- **Option B** — Implement `invite_to_channel` as a capability tool that
  delegates to an `invite_to_workspace_and_channel` mission for new-user flows
- **Option C** — Skip invite in Phase 3 (Trust Gate D); implement in a
  dedicated future sortie once profile-creation flow is specified

## Decision Outcome

**This ADR is CONDITIONAL.** The decision tree is:

```
ADR-0336 outcome resolved?
  └── YES: channel_admin capability chosen (Option B)
        └── Invite complexity:
              ├── Simple (invitee has profile) → Option A: single tool
              └── Complex (new user) → Option B: tool delegates to mission
        └── OR: Phase 3 defers invite entirely → Option C
```

**If Option A chosen:**

`invite_to_channel` tool body:
1. `gatedMutation("confirm")` gate eval (ADR-0099)
2. Verify `profile` exists for invitee_id
3. If profile missing: return `{ ok: false, code: "PROFILE_REQUIRED",
   message: "Invitee must have a Smartout profile first" }`
4. `INSERT INTO channel_member (channel_id, profile_id, role)` via
   `mutate-with-gate.ts`
5. `emit("channel.member_invited", { channel_id, invitee_id, workspace_id })`

**If Option B chosen (mission path):**

Mission file: `packages/ai/src/missions/invite-to-channel/index.ts`

Steps:
1. Gate evaluation (confirm + min_role: manager)
2. Check invitee profile existence
3. If profile exists: `channel_member` INSERT + emit → terminal
4. If no profile: send invite link + set `engine_state.status = "pending"`
   → `wait_for_event: profile.created`
5. On `profile.created`: auto-join `channel_member` INSERT + emit → terminal

**If Option C chosen (defer):**

`invite_to_channel` is excluded from the Phase 3 `channel_admin` capability
registration. ADR-0339 status stays proposed until Phase 4 invite sortie.

## Activation Criteria

This ADR activates (moves from proposed to accepted) when:
1. ADR-0336 is accepted with `invite_to_channel` included in `channel_admin`
2. Invite complexity is determined (simple vs new-user)
3. Implementation path (Option A or B) is verified against
   `mutate-with-gate.ts` body constraints per L-0247

## Rules & Consequences enforced for Agents

- **Good, because** invite complexity does not derail ADR-0336 capability split
  decision — the two decisions are properly sequenced.
- **Bad, because** conditional ADRs require tracking; mark status explicitly
  when activation criteria are met.
- **Agent Impact:** Do NOT implement invite as a mission until this ADR
  activates. If building the simple-path tool (Option A), the tool body MUST
  include a hard fail-fast if profile is missing — no silent empty
  `channel_member` row, no new-user-creation side effect from a capability
  tool.

## Cross-References

ADR-0336 (channel_admin capability split — parent decision), ADR-0099
(four-eyes gate), ADR-0173 (frozen-4 mission boundary), ADR-0240
(cross-namespace writes), L-0247 (runtime helper single-call constraint)
