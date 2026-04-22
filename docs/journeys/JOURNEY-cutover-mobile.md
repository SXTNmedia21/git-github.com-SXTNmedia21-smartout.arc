---
title: Journey — Helpdesk Mobile Cutover (Phase 1A.2)
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-channel
tags: [journey, helpdesk, mobile, phase-1a-2, komm, cutover, conversation-body]
---

# Journey — Helpdesk Mobile Cutover (Phase 1A.2)

> Replaces the Phase 1 mobile "use Chat tab to reply" deviation. The
> ticket detail screen now embeds the same conversation surface the
> Chat tab uses, so reps read, reply, and resolve a ticket without
> leaving it.
>
> Surface changes:
> - Tab "Min kø" renamed under the hood to `(komm)` — same label ("Min
>   kø"), same icon (`LifeBuoy`), replaces the former `(queue)` tab.
> - Tab screen `(komm)/index.tsx` has two segments: "Min kø (N)" and
>   "Kanaler". Segment default: Min kø when open tickets exist,
>   otherwise Kanaler.
> - Ticket detail moves from `/(app)/(queue)/[ticketId]` to
>   `/(app)/(komm)/[channelId]`. The route param is still the
>   `channel_id`; the name just matches the contract more honestly.
> - New `ConversationBody` component is the single source of truth for
>   message list + realtime subscription + composer + reactions. Used
>   by both `(chat)/[id].tsx` and `(komm)/[channelId].tsx`.
> - The Phase 1 placeholder copy *"Meldinger lastes i neste iterasjon
>   — bruk Chat-fanen til å svare på saken inntil videre."* is gone.

ADR-0133 boundary: authoring verbs (upgrade to desk, reassign rep,
downgrade, governance) remain web-only. Mobile surfaces execution
verbs only — read queue, read ticket, reply, resolve.

---

## Journey: Rep opens Min kø and sees a live count

**Precondition:** Rep is signed in. `useMyProfile` resolves a profile
with `workspace_id`. At least one `engine_state` row for
`helpdesk_query_lifecycle` has `assignee_id=profile.profile_id` and
`status IN ('waiting','active')`.

1. Rep taps the "Min kø" tab in the bottom nav → `KommScreen` mounts.
2. `useMyQueue(profileId, workspaceId)` fetches open tickets →
   `useGroupedConversations` fetches the channel sections in parallel.
3. While the queue is loading, the segment selector shows "Min kø"
   and "Kanaler" but the body renders an `ActivityIndicator`.
4. Queue resolves with N tickets → segment state locks to "Min kø"
   (one-shot `useEffect` that only fires while `segment === null`).
   The segment label updates to `"Min kø (N)"`.
5. Rep sees the Instrument Serif title "Min kø", the subcount line
   (`"3 åpne · 1 venter"` or `"3 åpne saker"`), and a `FlatList` of
   `QueueRow`s below the segment bar.
6. Pull-to-refresh triggers `queueQuery.refetch()` → list and subcount
   update.

**Postcondition:** Rep has an at-a-glance view of assigned tickets.
No mutation.

**Error paths:**
- Queue fetch fails → segment body renders the existing error state
  (`AlertCircle` + retry button).
- Zero open tickets on first load → segment defaults to "Kanaler"
  instead of showing the empty orb by surprise. Rep can still tap
  "Min kø" to see the `ResponsibilityOrb status="complete"` empty
  state any time.
- Profile not loaded → queries disabled → spinner until profile
  resolves.

---

## Journey: Rep switches to Kanaler from the same tab

**Precondition:** Rep is on the Komm tab, either because the queue is
empty or they just want to browse channels.

1. Rep taps the "Kanaler" segment pill → `setSegment("channels")`.
2. `ChannelList` renders the `SectionList` sourced from
   `useGroupedConversations(isDuringShift, pinnedIds)`. Sections
   are: active session card (during shift only), departments, teams,
   direct messages.
3. Rep taps a channel row → `router.push('/(app)/(chat)/${id}')`. The
   chat detail screen opens with the usual `ConversationBody`,
   unaffected by the cutover.

**Postcondition:** Rep reached a non-helpdesk thread via the
Komm tab. Chat detail behavior is unchanged from Phase 1.

**Error paths:**
- Sections empty → `ChannelList` shows its own empty state
  (`EmptyState` with "Kanaler opprettes automatisk...").
- Channel fetch fails → existing error path in
  `useGroupedConversations` — Kanaler segment shows the empty state
  with `refreshing` from the SectionList.

---

## Journey: Rep opens a ticket and replies inline (Phase 1A.2 fix)

**Precondition:** Rep is on Min kø segment with at least one open
ticket assigned to them.

1. Rep taps a `QueueRow` → `goToTicket(ticket)` pushes
   `/(app)/(komm)/[channelId]` with `params: { channelId: ticket.channel_id }`.
2. `KommTicketDetailScreen` mounts → reads `channelId` from
   `useLocalSearchParams` → `useTicket(channelId, workspaceId)`
   fetches the ticket.
3. Loading → full-screen `ActivityIndicator`.
4. Ticket loaded → screen stacks:
   - `TicketHeaderMobile` — back chevron, status chip (VENTER / AKTIV
     / LØST), summary, requester name + avatar, opened-at relative.
   - `ConversationBody` — paginated inverted `FlatList` of
     `MessageBubble`s, realtime subscription on
     `channel_message` filtered by `channel_id`, `MessageInput`
     composer with reply preview and long-press `ReactionBar`.
   - `ResolveFAB` (bottom-right) if rep is assignee AND status ≠
     `complete`.
5. Rep types "Vi har korrigert lønnen nå, beklager forsinkelsen." in
   the composer → taps send → `useSendMessage` fires an optimistic
   append, writes via Supabase, and the realtime subscription in
   `ConversationBody` reconciles the echo by `client_message_id` so
   no duplicate row appears.
6. Requester (on web or mobile) sees the new message within a few
   hundred ms via their own `channel:{channelId}` subscription.

**Postcondition:** The reply is in the thread and both sides see it
in realtime. No placeholder copy anywhere. Rep did not need to switch
to the Chat tab.

**Error paths:**
- `useTicket` returns null (cross-workspace RLS block or missing
  row) → forbidden state: dim `LifeBuoy` + `mobile_ticket_forbidden.*`
  strings, no composer, no FAB.
- Composer attempts to send while `workspace_id` or `profile_id` is
  still null (first paint race) → `ConversationBody.handleSend`
  returns early without sending. Rep retries once state hydrates.
- Realtime channel disconnect → bubbles reappear on next
  `useMessages` refetch on focus. No error surface in this cut; the
  offline queue + network banners land in a later sub-sortie.
- PTT/voice in a `query_thread` channel → composer suppresses the PTT
  button because channel `audio_policy='off'` (Phase 1 seed; ADR-0078
  PII defense).

---

## Journey: Rep resolves the ticket from mobile

**Precondition:** Rep is on the ticket detail screen, is the
assignee, status is `waiting` or `active`.

1. Rep taps the `ResolveFAB` → `sheetRef.current?.open()` slides
   `ResolveSheet` up. (Unchanged from Phase 1.)
2. Rep adds an optional resolution note → taps "Løs sak" →
   `useResolveTicket.mutate({ ticket_id, channel_id, resolution_note })`.
3. Backend (helpdesk_query capability via BFF per ADR-0132) flips
   `engine_state.status='complete'`, stamps `completed_at`, writes the
   note, emits `helpdesk.query.resolved`.
4. Mutation resolves `{ ok: true }` → sheet closes → `Alert.alert(
   t("toast.ticket_resolved", { requester }))`.
5. `TicketHeaderMobile` status chip flips to `LØST` → `ResolveFAB`
   disappears because `status === 'complete'` → composer stays so the
   rep can still send a closing message if they want.
6. Rep goes back → Queue refetches on focus → resolved ticket drops
   off the list.

**Postcondition:** Same as Phase 1 — engine_state terminal, telemetry
emitted, queue count drops.

**Error paths:**
- Mutation fails (`onError` or `{ ok: false }`) → `Alert.alert(
  t("toast.ticket_resolve_failed"))`. Sheet stays open so the rep can
  retry without re-typing the note.
- Rep was reassigned between screen mount and resolve tap → backend
  capability rejects → same error alert. On next focus the ticket
  drops off Min kø.

---

## Out-of-scope (remains web-only per ADR-0133)

- Upgrade query → desk (authoring verb)
- Reassign rep (authoring verb)
- Downgrade desk → query (authoring verb)
- Governance mode toggle, SLA policy authoring, desk creation
- Onboarding wizard, schedule editor, contract authoring

Mobile never grows buttons for these. Web remains the only surface.
