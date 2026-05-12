---
title: Botsson publishAnnouncement Capability
status: draft
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [botsson, capability, publishannouncement, agent-tool, adr-0287, adr-0173]
---

# Botsson publishAnnouncement Capability

> Adds an agent-callable capability tool for publishing announcements via Mr. Botsson. Unblocked now that ADR-0287 retrofit (`3dc9a4c26`) brought sendMessage to compliance.

## What

Add a new agent capability tool in `packages/ai/src/capabilities/communication/`:

- Tool: `publish_announcement`
- Capability: `communication` (existing — same as `sendMessage`)
- Mutation surface: `channel_message` INSERT with `message_type='announcement'`, `visibility_scope`, `target_profile_ids[]`, `system_data.audience_kind` + `audience_label`
- Authority: `suggest` by default — manager confirms wording before publish. Voice channel rejected per ADR-0078 voice-broadcast restriction.

Mirrors the manual UI path `useSendAnnouncement` from Wave A (commit `3854f3513` + `2f656cdb6` audience-targeting wiring). Agent invokes tool → callGateAction grants → mutation writes row → trigger fires notifications at priority=1 / mode='work'.

## Why

Wave A shipped the human-author path (`/dashboard/komm/nyheter` ComposeAnnouncement modal). Agent-author path was deferred pending ADR-0287 retrofit. Now retrofit is landed (`feat/sendmessage-adr-0287-retrofit`), the agent tool can be safely added without inheriting a pre-existing gate-action gap.

Botsson value: "compose announcement for me, target on-duty bar staff, push" — agent drafts + audience-resolves + publishes via single conversational turn. Pontus's product narrative.

## Sources of truth

- **ADR-0287:** `docs/decisions/0287-gate-action-mandatory-on-mutation-capability-tools.md` — mandatory gate_action call
- **ADR-0173:** capability boundary rules (communication owns channel_message)
- **ADR-0163:** channel restriction + PII allowedChannels
- **ADR-0078:** engine_process channel restriction (voice broadcast guard)
- **Wave A useSendAnnouncement:** `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` — UI mutation precedent
- **sendMessage retrofit (just shipped):** `packages/ai/src/capabilities/communication/tools.ts:127-210` — pattern template for retrofit + gate
- **gate.ts (just shipped):** `packages/ai/src/capabilities/communication/gate.ts` — callGateAction wrapper

## Constraints

- **Authority = suggest.** Agent drafts the announcement but the wording requires manager confirmation BEFORE publish. Until C4 four-eyes flow lands for `communication.publish_announcement`, the tool returns a draft for human approval rather than auto-publishing. ADR-0099 §C4 governs.
- **Voice channel REJECTED.** `ctx.channel === "voice"` → fail-close with explicit error. Voice broadcast = PII amplification surface. Match ADR-0078 + L-0066 fail-closed defaults.
- **Audience resolution server-side.** Agent passes `{ audience_kind, departmentIds?, roles?, profileIds? }`. Tool resolves to actual `target_profile_ids[]` via service-role query (mirrors `useAudienceResolver` from Wave A T2). Agent NEVER receives raw profile_ids → PII boundary preserved.
- **gate_action MANDATORY before INSERT.** Per just-shipped ADR-0287 retrofit pattern. callGateAction with `capability: "communication"`, `action_type: "publish_announcement"`, `channel: ctx.channel ?? "chat"`, `entity_type: "channel_message"`, `entity_id: null`.
- **Telemetry alignment.** Same `channel.message.sent` event as Wave A useSendAnnouncement — properties include `audience_kind`, `target_profile_count`, `visibility_scope`, `notification_priority`, `notification_mode`. `origin_type: "agent"`.

## Out of scope

- C4 four-eyes approval flow for publish_announcement (separate sortie when authority surface for "confirm" tier is built)
- Voice-channel announcement (explicit denied)
- Mobile agent publishing (web compose stays web-only per ADR-0133; agent is a server-side actor, not surface)
- Pin/unpin agent capability (separate sortie if needed)
- Read-side `getNewsFeed` capability tool (separate sortie)

## Council escalation flagged

This sortie introduces:
1. New capability tool action_type → may need new `engine_authority_config` seed row
2. Audience resolution via service-role from agent context → ADR-0151 server-derive boundary question
3. Authority tier `suggest` vs `confirm` decision

Recommend Council review BEFORE build starts. Council session shape:
- system-steward: ADR coherence (0287 + 0099 + 0173 + 0163)
- supervisor: pattern compliance with just-landed sendMessage retrofit
- system-agent-coordinator: agent surface + ToolSet typing + intent classifier coverage
- botsson-harness-builder: pipe status + publishAnnouncement phase mapping
- frontend-designer: skipped (no UI scope)

## Acceptance

- `publish_announcement` tool registered in `packages/ai/src/capabilities/communication/index.ts` `suggestTools`
- callGateAction wraps the INSERT (mirrors sendMessage retrofit)
- Audience resolution happens server-side; agent never sees raw profile_ids
- Voice channel rejected with descriptive error
- Unit tests cover: granted-suggest path, voice-denied path, channel-policy-denied path, missing-seed default-deny
- intent classifier coverage (ADR-0112) — `publish_announcement` action_type registered
- HANDOFF + 4-5 journeys
