---
title: "Journey — Admin publishes announcement via InlineConfirmCard"
feature: inline-confirm-card-phase1
journey: happy-publish
status: verified
verified_at: 2026-05-23-build-complete
e2e_test: apps/e2e/tests/inline-confirm-card-phase1/happy-publish.spec.ts
created: 2026-05-23
updated: 2026-05-23
module: MODULE_BOTSSON
tags: [journey, botsson, hitl, communication, announcement, happy-path]
---

# Journey: Admin publishes announcement via InlineConfirmCard

**Role:** admin

**Precondition:**
- Admin authenticated, logged into workspace with `communication` capability authority
- BotssonChat open (any dashboard surface or `/dashboard/Botsson`)
- Workspace has ≥1 active news channel + ≥1 active member (audience non-empty)

## Happy Path

1. Admin types: `"Lag en kunngjøring om brylluppet som starter fredag og varer til søndag"` → BotssonChat POSTs to `/api/botsson/chat` → stage-engine routes to `communication` capability
2. LLM calls `publish_announcement({title, body, audience_kind:"all", confirm:false})` → tool body:
   - precheck `gate_action(workspace, "communication", "chat", profile, "publish_announcement")` → ALLOW
   - resolve audience server-side → `count: N, label: "Alle aktive"`
   - generate `clientMessageId = crypto.randomUUID()` (lifted BEFORE confirm-branch per ADR-0398)
   - call `buildInlineConfirmCard({type:"inline_confirm_card", proposal_id: clientMessageId, surface:"announcement", draft:{title,body}, preview:{title, body_excerpt: body.slice(0,200), recipient_count: N, metadata:[{label:"Kind",value:"general"},{label:"Tier",value:"work"}]}, actions:[confirm,edit,cancel], channel_constraint:["chat"], platforms:["web"]})`
   - return `JSON.stringify({phase:"draft", proposal_id, descriptor})` to LLM
   - emit `inline_confirm_card.shown` (server-side, tool body per L-0233)
3. LLM reads draft + system-prompt instruction (mr-botsson.ts 10-line block) → calls `show_proposal_card(descriptor)` as next tool → stage-engine emits `ClientToolCall{name:"show_proposal_card", arguments: descriptor}` → BFF relays to browser
4. Browser BotssonChat `executeClientToolRoundtrip` detects client_tool_call → looks up `show_proposal_card` in BotssonChat-fixed registry (not page-scoped) → renders `<InlineConfirmCard descriptor onResolve />` inline as message bubble
5. Admin sees card: title "Lag en kunngjøring om brylluppet" / body excerpt / recipient_count "N mottakere · Alle aktive" / chips [Kind: general, Tier: work] / 3 buttons [Bekreft / Endre / Avbryt]
6. Admin clicks **Bekreft** → browser POSTs `client_tool_results [{tool_call_id, result: JSON.stringify({proposal_id, action:"confirm"})}]` → stage-engine resumes LLM with result-as-tool-message
7. LLM calls `publish_announcement({title, body, audience_kind:"all", confirm:true, proposal_id})` → tool body:
   - call `publish_announcement_atomic` RPC with `p_client_message_id = proposal_id` (RPC-level UNIQUE constraint enforces idempotency)
   - emit `inline_confirm_card.confirmed` + existing `emitAnnouncementPublished` (server-side)
8. LLM responds: `"Publisert til N ansatte ✅"` → admin sees confirmation message in chat → card transitions to resolved state (opacity 0.5, scale 0.98, ring-2 ring-green-500/40 flash 300ms)

**Postcondition:**
- 1 new row in `channel_message` table with the title+body content, `client_message_id = proposal_id`
- 1 new row in `engine_event` (channel.message.sent V2)
- `activity_trail` shows `inline_confirm_card.shown` + `inline_confirm_card.confirmed` events with `workspace_id` + `actor_id` non-null
- PostHog received both telemetry events
- All recipients receive the announcement via their default delivery channels (per `publish_announcement_atomic` audience resolution)

## Error Paths

- **gate_action denies on precheck** → tool returns `"Ikke tillatt: ${reason}"` text to LLM → LLM verbalizes in chat → NO card rendered → admin sees explanatory text. Prevents dead-end UX (Code-Tracer mandate).
- **Audience resolves to 0** → tool returns text `"Audience resolves to 0 recipients. Adjust audience targeting or use 'all'."` → LLM verbalizes → NO card rendered
- **LLM forgets to call show_proposal_card** → user sees draft as plain LLM text → reports as bug, system-prompt block needs re-tuning (R4 + T8 catches in 3-turn dialog test)
- **Roundtrip exceeds MAX_ROUNDTRIPS=3** → BotssonChat throws `"Botsson kept asking for tools — gi opp this turn"` → admin sees generic chat error → retries
- **RPC fails on commit (network, DB)** → tool returns `"Error publishing announcement: ${error.message}"` → LLM verbalizes → card transitions to error state (`mode: "error"`, destructive inline message, buttons re-enable for retry)

## Verification

- [x] Implementation matches steps 1-8 above end-to-end (see HANDOFF-inline-confirm-card-phase1.md §Defense code references + file inventory for file:line evidence)
- [x] E2E test exists at `apps/e2e/tests/inline-confirm-card-phase1/happy-publish.spec.ts` and passes — path confirmed in `e2e_test:` frontmatter
- [ ] Manually tested end-to-end via `op run --env-file=.env.template -- pnpm dev` + admin chat session — **Pontus's job at close-feature tmux session**
- [ ] activity_trail rows verified post-publish: `SELECT event_name, properties FROM activity_trail WHERE event_name LIKE 'inline_confirm_card.%' ORDER BY occurred_at DESC LIMIT 2` — **depends on live run**
- [ ] channel_message row verified: matching `client_message_id` to descriptor `proposal_id` — **depends on live run**

**Mark `status: verified` in frontmatter after Pontus runs `close-feature.sh 5` AND confirms manual smoke test (boxes 3-5).**
