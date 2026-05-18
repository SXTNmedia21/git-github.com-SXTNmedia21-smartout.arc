---
title: "Announcement Schema Contract — Tool API Preserved"
id: ADR_0371
status: accepted
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0371: Announcement Schema Contract — Tool API Preserved

> Drafted from council REJECT verdict on `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md` (2026-05-18). Breaking change disclosure required before re-submission.

## Context and Problem Statement

The Announcement Kind/Tier/Entity-Link spec collapsed the agent capability tool `publish_announcement` parameter shape from `{ title: string(1-120), body: string(1-1600) }` to `{ content: string(1-800) }`. Council Phase 3 code-trace at `packages/ai/src/capabilities/communication/publish-announcement.ts:43-77` confirmed the existing schema has separate `title` and `body` fields, and the 3 web composer paths (`use-send-announcement.ts:43-44`, `use-send-broadcast.ts`, `send-broadcast-action.ts`) pass them separately.

This is a breaking API change for:
- Mr. Botsson (agent caller) — tool schema mismatch means all prompt examples need rewriting + intent-classifier system prompt updates.
- Dashboard composers (web caller) — `NyheterClient.tsx` `ComposeAnnouncement` modal has separate `title` + `body` text inputs.
- Day-Control Melding tab (web caller) — `send-broadcast-action.ts` carries `system_data.broadcast_type` + `system_data.session_id` distinct from content fields.
- Mobile read-side (consumer) — `ChannelMessageBubble.tsx:55` renders system-bubble; field expectations are downstream of the persisted `channel_message.content`.

No ADR was drafted for the breaking change. No migration path was specified. No consumer survey was performed. No backward-compatibility window was named.

## Decision Drivers

- Existing schema is in production — agent has been publishing with `{title, body}` since the capability landed.
- 800-character single-content limit is shorter than current `title (120) + body (1600) = 1720` total — operators authoring long announcements would be silently truncated.
- Mr. Botsson's prompt templates reference `title` and `body` as distinct fields; collapsing them would require simultaneous prompt rewrites + intent-classifier same-commit lock (L-0292/ADR-0112).
- Mobile read path uses `channel_message.content` directly — if the collapse changes how content is stored, mobile rendering must be re-verified.
- L-0177 silent fallback class — never silently change a contract; always fail-fast on schema mismatch.

## Considered Options

1. **Option A — No collapse. Keep `{title, body}` in tool, RPC, and DB.** New sidecar fields (kind/tier/tags/link) are additive only. Pros: zero breaking change; mobile unaffected; agent prompts unchanged. Cons: spec §11 card-render assumes single-content rendering — must be re-specified to accept title + body.

2. **Option B — Collapse `{title, body} → {content}` with explicit migration ADR + backward-compat window.** New schema accepts `{content}`. Migration: existing rows backfilled by concatenating `title + "\n\n" + body` into a single-content column OR keeping title/body alongside new content. Composers + tool + mobile updated in lockstep. Pros: simpler V1 surface forward. Cons: ADR-level breaking change; migration path complex; backward-compat coverage non-trivial; possible character-limit regression.

3. **Option C — Hybrid: keep `{title, body}` in DB + tool, add `{content}` as derived view for card rendering only.** No schema change; card render uses `concat(title, body)` semantics. Pros: zero schema migration; agent + composers unchanged. Cons: card render code branches on title-or-content; future code paths must follow the derive-or-store choice consistently.

## Decision Outcome

**Chosen: Option A — Preserve tool API contract.** Locked 2026-05-18 by Pontus.

Concrete:
- Tool schema at `packages/ai/src/capabilities/communication/publish-announcement.ts:43-77` keeps `{ title: string(1-120), body: string(1-1600), audience_kind, audience_*, confirm }` unchanged.
- Server-side concatenation at line 162 (`const content = ${params.title}\n${params.body}`) preserved.
- `channel_message.content` DB column unchanged (single text column — there is no separate `title`/`body` column to preserve; the "preservation" applies at TOOL API LEVEL only).
- V2 additive params (kind, tier, tags, linked_entity_type, linked_entity_id) live on the tool schema AND on `announcement_meta` sidecar table (NOT on `channel_message`).
- Mobile read path unchanged: existing `ChannelMessageBubble` at `apps/mobile/src/components/komm/ChannelMessageBubble.tsx` consumes `content`; tier badge + entity link CTA wrap card additively.
- Spec V2 §11 card-render uses title (first line) + body (rest) split — composer UI keeps both inputs.

## Rules and Consequences

- **Good, because** explicitly disclosing the breaking change prevents silent contract drift across agent + web + mobile.
- **Good, because** Option A removes a breaking change from the V1 scope, allowing the spec to land faster.
- **Bad, because** Option A leaves the `title (120)` + `body (1600)` shape in place, which some operators find verbose; the future may need a re-design.
- **Agent Impact:** Tool capability authors must NEVER collapse existing parameter shapes without an ADR + consumer survey. Spec pseudocode that changes parameter shape requires explicit "BREAKING" annotation visible in council Phase 3 briefings.

---

> Pair with ADR-0369 + ADR-0370. V2 spec re-draft at `docs/superpowers/plans/2026-05-18-announcement-kind-tier-link.md`.
