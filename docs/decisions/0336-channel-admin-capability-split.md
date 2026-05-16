---
id: ADR-0336
title: "Channel-Admin Capability Split"
status: proposed
date: 2026-05-16
deciders: [pontus, council]
tags: [communication, capability, authority, c4, channel-admin]
supersedes: null
superseded_by: null
created: 2026-05-16
updated: 2026-05-16
layer: decision
---

# ADR-0336: Channel-Admin Capability Split

**Status:** Proposed
**Date:** 2026-05-16
**Council:** Chat-WhatsApp Phase 3 priority council — APPROVE WITH CHANGES

## Context and Problem Statement

Chat-WhatsApp Phase 3 (Trust Gate D) requires adding channel management tools to
the Botsson harness: mute/leave (autonomous), invite/rename (confirm), archive
(confirm), and role-change (confirm + `min_role: admin`). These tools were
initially briefed as extensions to the existing `communication` capability
(ADR-0078).

The `communication` capability has `defaultAuthority: "read_only"` and nine
tools, all on a uniform authority profile. Adding channel-admin tools would
introduce three distinct authority levels within a single capability:

- **Autonomous** — mute, leave (user self-acts, no approval)
- **Confirm** — invite, rename, archive (manager-level approval gate)
- **Confirm + min_role: admin** — role_change (admin-only gate)

Mixing authority levels within a single capability creates ambiguous
`defaultAuthority` semantics and breaks the clean per-capability seed model
(one seed row per capability per workspace bootstrap).

## Decision Drivers

- **ADR-0078** — channel-pinning and authority level per capability are
  load-bearing; mixed-level capabilities fragment the authority model
- **ADR-0163** — PII `allowedChannels` restrictions: invite involves PII
  lookup (profile name + contact), forcing `channel: ["chat"]` restriction
  on a subset of tools in a mixed capability
- **ADR-0099** — four-eyes gate requires `level` to be consistent across
  tools in the same gate evaluation path
- **ADR-0287** — `gate_action` declared per-tool; capability-level authority
  sets the floor; min_role constraints must be per-tool in the seed, not
  capability-wide
- **ADR-0240** — cross-namespace writes forbidden; channel-admin tools writing
  to `channel_member` + `channel` must stay in one namespace

## Considered Options

- **Option A** — Extend `communication` capability with new channel-admin tools
  (inline authority override per tool in `gate_action`)
- **Option B** — Create new `channel_admin` capability with its own
  `defaultAuthority`, seed, and tool namespace

## Decision Outcome

**Chosen option: B — New `channel_admin` capability**, because:

1. Authority levels differ fundamentally from `communication` (read_only vs
   autonomous vs confirm vs confirm+min_role). A single `defaultAuthority`
   cannot represent all three.
2. PII channel restriction (`allowedChannels: ["chat"]`) applies to invite
   only — not to mute/leave. Mixed restriction on a single capability forces
   per-tool overrides that erode the model.
3. Seed migration is one row per capability. `channel_admin` gets its own seed
   in `engine_authority_config` per ADR-0189, enabling independent authority
   tuning per workspace.
4. ADR-0240 cross-namespace write boundary is preserved: `channel_admin`
   tools write to `channel` + `channel_member`, `communication` tools write
   to `channel_message`. Clean namespace ownership.

**Capability definition (proposed):**

```typescript
export const CHANNEL_ADMIN_CAPABILITY = {
  name: "channel_admin",
  defaultAuthority: "confirm",  // lowest common floor (mute/leave get autonomous override)
  allowedChannels: ["chat"],    // invite PII forces chat-only for full capability
  tools: [
    "mute_channel",       // autonomous (self-act)
    "leave_channel",      // autonomous (self-act)
    "invite_to_channel",  // confirm + PII check (ADR-0163)
    "rename_channel",     // confirm
    "archive_channel",    // confirm + min_role: manager
    "change_member_role", // confirm + min_role: admin (ADR-0099)
  ],
}
```

**Authority seed (one row per tool with override):** see migration
`<TS>_seed_channel_admin_authority.sql` — ships atomically with first tool per
ADR-0189.

## Rules & Consequences enforced for Agents

- **Good, because** authority semantics are unambiguous per-capability; seed
  migration is one clean row; PII channel restriction applies uniformly.
- **Good, because** `communication` capability retains `read_only` default
  without contamination from admin-level tools.
- **Bad, because** two capabilities means two places to check for
  "communication-related" tools in the harness — document in BOTSSON-SYSTEM-MAP.
- **Agent Impact:** When implementing any new channel management tool, register
  it under `channel_admin`, NOT `communication`. If the tool writes to
  `channel_message` rather than `channel`/`channel_member`, re-evaluate
  namespace (may belong in `communication`). Gate the capability registration
  with an ADR row before shipping.

## Cross-References

ADR-0078 (channel-pinning), ADR-0099 (four-eyes gate), ADR-0163 (PII
allowedChannels), ADR-0189 (authority seed ships with tool), ADR-0240
(cross-namespace writes), ADR-0287 (gate_action per-tool)

## Conditional Follow-Up

See ADR-0339 — if `invite_to_channel` becomes a multi-step welcome flow
(mission + profile creation + `channel_member` insert), the invite tool may
delegate to a `mission` in `packages/ai/src/missions/`. ADR-0336 governs the
capability boundary; ADR-0339 governs whether invite is a tool or a mission
wrapper.
