---
title: Botsson publishAnnouncement Capability
status: approved-with-conditions
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [botsson, capability, publishannouncement, agent-tool, adr-0287, adr-0173]
council: 2026-05-11 — APPROVE WITH CHANGES (Steward + Agent-coord + Harness)
---

# Botsson publishAnnouncement Capability

> Council 2026-05-11 verdict: APPROVE WITH CHANGES. Trust Gate HOLD until prereqs land on development.

## What

Add a new agent capability tool in `packages/ai/src/capabilities/communication/`:

- Tool: `publish_announcement`
- Capability: `communication` (existing — same as `sendMessage`). ADR-0173 frozen-4 satisfied (communication owns `channel_message`; announcement is a `channel_message_type` subtype).
- Mutation surface: `channel_message` INSERT with `message_type='announcement'`, `visibility_scope`, `target_profile_ids[]`, `system_data.audience_kind` + `audience_label`
- Authority: `suggest` tier with draft-return semantics (see Constraints §Authority below)
- Channel: `chat` ONLY — voice REJECTED in-tool body (NOT via gate_action's channel_allowed)

Mirrors the manual UI path `useSendAnnouncement` from Wave A (commits `3854f3513` + `2f656cdb6` audience-targeting wiring). Agent invokes tool → in-tool voice reject → callGateAction grants → server-side audience resolution → mutation writes row → trigger fires notifications at priority=1 / mode='work'.

## Why

Wave A shipped the human-author path (`/dashboard/komm/nyheter` ComposeAnnouncement modal). Agent-author path was deferred pending ADR-0287 retrofit. Now retrofit is landed on `feat/sendmessage-adr-0287-retrofit` (commit `3dc9a4c26`), the agent tool can be added without inheriting a pre-existing gate-action gap.

Botsson value: "compose announcement for me, target on-duty bar staff, push" — agent drafts + audience-resolves + publishes via single conversational turn. Pontus's product narrative.

## Sources of truth

- **ADR-0287:** `docs/decisions/0287-gate-action-mandatory-on-mutation-capability-tools.md` — mandatory gate_action call
- **ADR-0173:** capability boundary rules (communication owns channel_message)
- **ADR-0163:** channel restriction + PII allowedChannels
- **ADR-0078:** engine_process channel restriction (voice broadcast guard — note: gate_action's `channel_allowed` only activates with `p_engine_process_id`; direct agent calls do NOT pass it. Voice rejection MUST live in-tool.)
- **ADR-0189:** seed-parity — `communication` capability is currently NOT seeded in `engine_authority_config` per migration `20260518000000` header. Default-allow until seeded. Council blocker B2.
- **ADR-0099 §C4:** four-eyes invariant. Not wired for `communication` capability today — confirm tier deferred (see §Out of scope).
- **ADR-0151:** server-derive — `ctx.workspaceId` + `ctx.profileId` resolved server-side; agent never supplies them in body.
- **Wave A useSendAnnouncement:** `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` — UI mutation precedent (browser-side `"use client"`; CANNOT be imported server-side)
- **Wave A useAudienceResolver:** `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts` — browser-side resolver. Must be PORTED to server (~80 LOC duplication) per ADR-0173 capability boundary.
- **sendMessage retrofit:** `packages/ai/src/capabilities/communication/tools.ts:127-210` on `feat/sendmessage-adr-0287-retrofit` — pattern template
- **gate.ts:** `packages/ai/src/capabilities/communication/gate.ts` on `feat/sendmessage-adr-0287-retrofit` — callGateAction wrapper. Return shape: `{ allow: boolean, channelAllowed: boolean }`.
- **Telemetry extension:** `packages/telemetry/src/registry.ts` extended on Wave A commit `b95742cef` — `ChannelMessageSent.properties` gained optional `audience_kind?`, `visibility_scope?`, `target_profile_count?`, `notification_priority?`, `notification_mode?`. Sortie depends on this landing on development.

## Sequencing prerequisites (Council Trust Gate HOLD until these land)

Build CANNOT start until ALL of these land on `development`:

1. **`feat/sendmessage-adr-0287-retrofit` merged** → `packages/ai/src/capabilities/communication/gate.ts` available + sendMessage shows ADR-0287 pattern template
2. **`feat/nyheter-engagement-wave-a` merged** → `packages/telemetry/src/registry.ts` extended ChannelMessageSent properties available
3. **`communication` capability seed migration** for `engine_authority_config` — either bundled in this sortie's first commit OR shipped as separate prereq sortie. Without this seed, `gate_action` default-allows (L-0066 CVE class). Seed shape:
   ```sql
   INSERT INTO engine_authority_config (workspace_id, capability, level, min_role, requires_four_eyes)
   SELECT workspace_id, 'communication', 'suggest', 'employee', false FROM workspace
   ON CONFLICT (workspace_id, capability) DO NOTHING;
   ```
   Per Council resolution: gate_action RPC keys on `(workspace_id, capability)` only — capability-level seed covers all action_types under `communication`. NO new action_type-level row needed.

## Constraints

### Authority (Council resolved)

- **Tier: `suggest`** — `confirmTools` array DOES NOT EXIST in `CapabilityDefinition` shape (`packages/ai/src/capabilities/types.ts:131-149`). Authority bucketing is advisory only. Runtime authority is via gate_action RPC.
- **Draft-return semantics, NOT auto-publish.** Until C4 four-eyes is wired for `communication` capability (separate sortie), the tool returns the composed draft + audience preview as a string for the agent to confirm with the user via dialog. Agent then either: (a) calls the tool again with a confirm-flag, OR (b) the human invokes `useSendAnnouncement` directly from `/dashboard/komm/nyheter` to publish.
- **NEVER auto-publishes** workspace-wide content without explicit human confirm step. ADR-0099 §C4 broadcast-class harm prevention.

### Voice channel rejection (Council B3)

- **In-tool body reject, NOT via gate_action.** gate_action's `channel_allowed` flag only activates when `p_engine_process_id` is passed (see `gate_action_unseeded_warning.sql:113-125`). Direct agent tool calls do NOT pass that. Therefore voice reject MUST be the FIRST statement in `execute()`:
  ```typescript
  if (ctx.channel === "voice") {
    return "Announcement publishing is not available over voice. Switch to chat.";
  }
  ```
- This is Layer 3 (tool-level) channel guard. Capability-level `allowedChannels` still includes voice (since `sendMessage` allows it) — per-tool restriction wins.

### Audience resolution server-side (Council B5 + B7)

- Agent passes audience intent: `{ audience_kind: "all" | "on_duty" | "department" | "role" | "individuals", departmentIds?: string[], roles?: string[], profileIds?: string[] }`
- Tool ports the 5 audience-kind branches from `useAudienceResolver` (browser-side) to server-side using `ctx.supabaseAdmin`. ~80 LOC duplication acceptable per ADR-0173.
- **PII contract:** tool return value MUST contain only `target_profile_count` + `audience_label`. NEVER raw `target_profile_ids[]`. Unit test required.

### gate_action call (Council B4 + B6)

- callGateAction with:
  - `capability: "communication"`
  - `action_type: "publish_announcement"`
  - `channel: ctx.channel ?? "chat"`
  - `entity_type: "channel_message"`
  - `entity_id: null` (insert)
- Returns `{ allow: boolean, channelAllowed: boolean }`. Check `allow === true`. Fail-close otherwise with descriptive error.
- Note: action_type `publish_announcement` is recorded in `activity_trail` audit but does NOT drive authority resolution (capability-level granularity).

### Telemetry

- Same `channel.message.sent` event as Wave A useSendAnnouncement
- Properties: `channel_id`, `origin_type: "agent"`, `message_type: "announcement"`, `visibility_scope`, `target_profile_count`, `audience_kind`, `notification_priority: 1`, `notification_mode: "work"`
- `nonEmpty(workspaceId, "workspace_id")` + `nonEmpty(profileId, "actor_id")` per ADR-0134 — no silent fallback

## Out of scope

- **C4 four-eyes approval flow** for confirm tier on `communication` — separate sortie when `change_proposal` surface for capability mutations exists
- **Voice-channel announcement** — explicitly denied at tool layer
- **Mobile agent publishing** — agent runs server-side (L3→L4); web composes per ADR-0133
- **Pin/unpin agent capability** — separate sortie if needed
- **Read-side `getNewsFeed` capability tool** — separate sortie
- **Auto-publish without human confirm** — explicitly out of scope until C4 wired

## Council 2026-05-11 verdict summary

3 reviewers consulted: Steward + Agent-coord + Harness. Verdict: **APPROVE WITH CHANGES** — Trust Gate HOLD.

### Resolved findings (folded into this spec)

- **B1** branch sequencing → §Sequencing prerequisites added
- **B2** missing `communication` capability seed → §Sequencing prerequisites #3 (capability-level granularity per Agent-coord trace; not action_type)
- **B3** voice reject must be in-tool → §Constraints §Voice channel rejection
- **B4** `confirmTools` doesn't exist → §Constraints §Authority clarified (suggest tier with draft-return)
- **B5** PII contract on tool return → §Constraints §Audience resolution
- **B6** Wave A telemetry sequencing → §Sequencing prerequisites #2
- **B7** audience resolver port not import → §Constraints §Audience resolution
- **B8** C4 inconsistency → §Constraints §Authority + §Out of scope made internally consistent

### Phase mapping (Harness §6)

Append as **Phase B follow-up: B-comm-1 publishAnnouncement** under `campaign/botsson-arena`. Update `BOTSSON-SYSTEM-MAP.md` §4 when build lands.

## Acceptance

- All 3 prerequisites landed on development (Wave A merge + sendmessage-retrofit merge + communication seed migration)
- `publish_announcement` tool registered in `packages/ai/src/capabilities/communication/index.ts`
- callGateAction wraps the INSERT (mirrors sendMessage retrofit pattern)
- In-tool voice reject as FIRST statement in execute() (NOT relying on gate_action's channel_allowed)
- Audience resolution happens server-side via ported logic (no import of browser-side `useAudienceResolver`)
- Tool return value contains only `target_profile_count` + `audience_label` — verified by unit test
- Draft-return behavior when authority allows (no auto-publish without explicit human confirm)
- Unit tests cover: granted path, voice-denied path, channel-policy-denied path, missing-seed default-deny path, PII boundary (no raw IDs in return)
- intent classifier coverage — capability `communication` already registered; no action_type granularity needed
- 3-5 user journeys documented
- HANDOFF written with decisions + learnings + next-step deferred sorties
