---
title: Journey — Helpdesk Mobile (Phase 1)
status: in_progress
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [journey, helpdesk, mobile, phase-1, queue, resolve]
---

# Journey — Helpdesk Mobile (Phase 1)

> End-user journeys for the mobile rep experience. Phase 1 mobile scope is
> strictly execution-side per ADR-0133 ("web composes, mobile executes"):
> read queue, read a ticket, resolve. Reply embedding in the ticket detail
> screen is a **Phase 1 deviation** — the message list reuses the existing
> Komm Chat tab until the chat conversation body is extracted into a
> shareable component. See "Not in scope" at the bottom.
>
> Surfaces:
> - Tab "Min kø" → `/(app)/(queue)` — FlatList of assigned tickets
> - Ticket detail → `/(app)/(queue)/[ticketId]`
>   (route param is `channel_id` — the conversation thread)

---

## Journey: Rep opens the queue tab

**Precondition:** Rep is signed in on mobile. `useMyProfile` resolves a profile with `workspace_id`. At least one `engine_state` row for `helpdesk_query_lifecycle` has `assignee_id=profile.profile_id` and `status IN ('waiting','active')`.

1. Rep taps the "Min kø" tab → `QueueScreen` mounts → `useMyQueue(profileId, workspaceId)` fetches the queue.
2. Fetch in flight → Rep sees the Instrument Serif header "Min kø" and a centered `ActivityIndicator`.
3. Data arrives → screen computes `openCount` and `waitingCount` → subcount line reads either `"3 åpne · 1 venter"` (if any waiting) or `"3 åpne saker"` (no waiting) — both via i18n.
4. `FlatList` renders one `QueueRow` per ticket with requester avatar, summary, status, opened_at relative time. Separator is a hairline `theme.colors.border` at 40% opacity.
5. Rep pulls down → `RefreshControl` triggers `refetch` → subcount and list update.

**Postcondition:** Rep has an accurate, at-a-glance view of their open tickets. No mutation.

**Error paths:**
- Fetch fails → screen swaps to error state: `AlertCircle` icon + `t("mobile_queue.error_title")` + "Prøv igjen" retry button that calls `refetch`.
- Zero open tickets → empty state: a 160px `ResponsibilityOrb status="complete"` (warm glow) + `t("mobile_queue.empty_title")` + body copy. Rep understands nothing is waiting.
- Profile not yet loaded (first paint after login) → `useMyQueue` is called with `undefined` profileId → query is disabled → loading spinner until profile resolves, then re-runs.

---

## Journey: Rep opens a ticket from the queue

**Precondition:** Queue screen is populated. Rep has an open ticket in the list.

1. Rep taps a `QueueRow` → `goToTicket(ticket)` calls `router.push({ pathname: '/(app)/(queue)/[ticketId]', params: { ticketId: ticket.channel_id } })`.
2. `TicketDetailScreen` mounts → pulls `ticketId` (the channel_id) from `useLocalSearchParams` → `useTicket(ticketId, workspaceId)` fetches the ticket + channel metadata.
3. Loading → Rep sees a full-screen `ActivityIndicator`.
4. Ticket loaded → Rep sees `TicketHeaderMobile`: back-chevron, status label (uppercase: `VENTER` / `AKTIV` / `LØST` via i18n), summary, requester avatar + name, opened-at relative time.
5. Below the header, the message area shows placeholder copy: *"Meldinger lastes i neste iterasjon — bruk Chat-fanen til å svare på saken inntil videre."* — Rep reads this and understands the reply path for Phase 1 is the existing Komm Chat tab.
6. If the rep is the assignee AND status ≠ complete → a `ResolveFAB` is visible bottom-right. Otherwise the FAB is hidden (requester viewing their own ticket, admin looking on, already-resolved ticket).

**Postcondition:** Rep has full ticket context visible; knows they must switch to Chat tab to reply in Phase 1; sees the resolve entry point if eligible.

**Error paths:**
- `useTicket` returns `null` (ticket doesn't exist or cross-workspace RLS block) → "Forbidden" state: dim `LifeBuoy` icon + `t("mobile_ticket_forbidden.title")` + body. No leak of existence.
- Rep is not the assignee (e.g. opens from notification after reassignment) → no FAB → Rep cannot resolve; must open Chat tab to read or ask admin to reassign.
- Rep lost network after load → header stays; sending messages from Chat tab follows the normal offline-queue behavior (ADR-0134 telemetry contract applies — `workspace_id` + `actor_id` resolved before enqueue).

---

## Journey: Rep replies to a ticket (Phase 1 deviation)

**Precondition:** Rep is viewing a ticket detail screen, status active or waiting, is the assignee.

1. Rep reads the placeholder copy instructing them to use Chat tab → taps the Chat tab in the bottom navigation.
2. Chat tab opens the existing Komm conversation list → Rep locates the `query_thread` channel (identified by the ticket summary as the channel name).
3. Rep taps the channel → `/(app)/(chat)/[id]` opens with the existing message list + composer → Rep types reply, hits send → message persists via the existing Komm send path.
4. Rep returns to the queue tab to continue triaging.

**Postcondition:** Reply is in the thread. Web rep/admin and requester see the message in realtime via the Komm channel-message subscription. No helpdesk-specific telemetry fires for the reply itself (it's a normal `channel_message.sent`).

**Error paths:**
- Channel was deleted / archived mid-session → Chat tab shows it as gone; Rep returns to Queue, which will also drop the ticket on next refresh if the engine_state flips.
- Voice/PTT attempted in a `query_thread` → channel `audio_policy='off'` (Phase 1 seed) → composer hides the PTT button. Voice is forbidden for helpdesk queries per ADR-0078 (PII defense).

> **Follow-up (out of Phase 1):** Extract `ConversationBody` from `(app)/(chat)/[id].tsx` into a shareable component so the ticket detail screen can embed it directly, replacing the placeholder.

---

## Journey: Rep resolves a ticket from mobile

**Precondition:** Rep is on the ticket detail screen, is the assignee, ticket status is `waiting` or `active`.

1. Rep taps the `ResolveFAB` (bottom-right, warm orb styling matching status) → `ResolveSheet` slides up from the bottom.
2. Sheet shows: "Løs sak for {requesterName}" title, optional resolution-note textarea (1–300 chars), "Avbryt" and "Løs sak" buttons.
3. Rep types "Lønn ble utbetalt i dag, takk for tålmodigheten." → taps "Løs sak" → `useResolveTicket` mutation fires with `{ ticket_id, channel_id, resolution_note }`.
4. Mutation calls the helpdesk_query capability's `resolveTicket` tool via BFF (`/api/emma/chat` → stage-engine → capability) per ADR-0132 (mobile is thin client, routes through web).
5. Backend writes `engine_state.status='complete'` + `completed_at=now()` + context note, emits `helpdesk.query.resolved`, advances the state machine.
6. Mutation resolves with `{ ok: true }` → `sheetRef.current?.close()` → `Alert.alert(t("toast.ticket_resolved", { requester }))` shows confirmation ("Saken for {requester} er løst.").
7. Rep navigates back → Queue refetches on focus → resolved ticket drops off the list.

**Postcondition:** Same as web resolve journey — `engine_state.completed_at` stamped, telemetry emitted, ticket terminal. Queue count on the tab badge (if implemented) decrements.

**Error paths:**
- Mutation fails (network, backend error) → `onError` / `{ ok: false }` branch → `Alert.alert(t("toast.ticket_resolve_failed"))` → sheet stays open so Rep can retry without re-typing the note.
- Rep is not the assignee (edge case: ticket was reassigned after screen mount) → backend capability rejects → same error alert.
- Ticket already resolved by the web rep in parallel → backend returns idempotent "already complete" → mobile treats as success (Phase 1 behavior; a Phase 2 refinement could show "Saken var allerede løst").
- Rep goes offline before submitting → mutation is not queued in Phase 1 (resolve is authority='confirm', must reach backend live). Alert shows failure. Rep retries when online.

---

## Journey: Rep receives a push notification for a new ticket (out of Phase 1)

This journey is declared here as a **reference to Phase 2 / ADR-0132 follow-up** and is not implemented in Phase 1:

- `helpdesk.query.opened` event will fan to a push notification via the existing notifications pipeline when the desk has a responsible rep with a push token.
- Tapping the notification will deep-link to `/(app)/(queue)/[channelId]`.
- Phase 1 rep discovers new tickets by pull-to-refresh or periodic query invalidation.

---

## Not in scope for Phase 1 (mobile)

- **Message list embedded in ticket detail** — placeholder text directs rep to Chat tab. Follow-up extracts `ConversationBody`.
- **Self-claim** (rep tapping an unassigned ticket to take it) — Phase 2. Phase 1 requires admin reassignment via web.
- **Reassignment from mobile** — prohibited by ADR-0133 (authoring verbs are web-only).
- **Desk creation / editing** — web-only, ADR-0133.
- **SLA visual cues** — Phase 2 (requires `engine_delayed_trigger`).
- **Push notifications for new tickets** — Phase 2.
- **Offline resolve queue** — Phase 2+; Phase 1 requires live connectivity for `confirm`-level mutations.
- **Voice reply to a ticket** — forbidden (ADR-0078 PII defense, `audio_policy='off'`).
- **Biometric C4 confirmation before resolve** — Phase 3 candidate for HR/payroll desks.
