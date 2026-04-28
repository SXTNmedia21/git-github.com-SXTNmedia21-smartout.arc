---
title: "Progressive Channel — helpdesk as flag on channel primitive"
status: accepted
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [spec, progressive-channel, helpdesk, komm, phase-1a]
---

# Spec — Progressive Channel

> Upgrade the `channel` primitive in Komm to absorb helpdesk behavior as progressive layers, superseding Phase 1's `channel_type='desk'` subtype discriminator. Approved by Council 2026-04-20 (APPROVE WITH CHANGES — RESCOPED).

## Summary

Any channel can be **upgraded to helpdesk** (toggle a flag, assign a responsible rep, set privacy mode) and **downgraded** (if no open tickets). Helpdesks are not a separate channel type — they are regular channels with `helpdesk_enabled=true`. Phase 1 helpdesks (which used `channel_type='desk'`) migrate transparently: existing rows keep their enum value forever as deprecated-but-valid lineage; `helpdesk_enabled` becomes the read-time truth source.

**Key simplifications decided by council:**
- Keep today's `engine_state.entity_id = channel.id` ontology unchanged.
- NO `channel_message.engine_state_id` FK (presentation computes "first message" via query).
- NO `channel.domain_tags` (overlaps `capability.allowedChannels`, defer until a real need emerges).
- NO `channel.parent_channel_id` (reuse `engine_state.context.desk_channel_id`).
- Leave `channel_type='desk'` on legacy rows forever; `'standard'` is not a valid enum value.

## Three switches per channel

| Switch | Column | Values |
|---|---|---|
| Helpdesk on/off | `channel.helpdesk_enabled boolean` | `false` (default) / `true` |
| Privacy | `channel.privacy_mode channel_privacy_mode` | `public` / `private_per_requester` |
| Responsible rep | `channel.responsible_profile_id uuid` | NULL when helpdesk_enabled=false; required when true |

AI policy is **reused from existing `channel_ai_policy` table** (ADR-0165 Rule 5): `text_participation` (`disabled` / `mention_only` / `proactive`) and `voice_participation` (`disabled` / `listen_only` / `interactive`). No new botsson_policy column.

## Four presets (admin UI)

| Preset | helpdesk_enabled | privacy_mode | text_participation | voice_participation |
|---|---|---|---|---|
| Ingen skranke | false | public (ignored) | disabled | disabled |
| Fag-skranke (offentlig) | true | public | mention_only | disabled |
| HR-skranke (privat) | true | private_per_requester | disabled | disabled |
| Tilpasset | admin chooses | admin chooses | admin chooses | admin chooses |

Phase 2 adds a 5th preset (Fag-skranke med Botsson) once the `proactive` listener is built.

## Requester flow (ticket opened)

**Public mode** (#bar, #kjokken, #hms):
1. Requester types question directly in the channel as a normal message.
2. Server-side hook on `channel_message.insert` checks `channel.helpdesk_enabled=true AND privacy_mode='public'`.
3. **PII classifier runs with 800ms soft-hold (ADR-0166):** if PII detected, original message is redacted, private sub-channel spawned, author sees inline clarification. Otherwise message publishes normally.
4. `engine_state` row created with `process_id='helpdesk_query_lifecycle'`, `entity_id=channel.id`, `context.requester_profile_id`, `context.first_message_id` (for presentation only, not as FK), `assignee_id=responsible_profile_id`.
5. `helpdesk.query.opened` event emitted; responsible rep sees new row in Min kø.
6. Rep replies in the same channel; all members see the conversation.
7. Rep resolves via "Løs sak"-affordance → `engine_state.status='complete', completed_at=now()` (L-0079 stamping), `helpdesk.query.resolved` emitted.

**Private mode** (#lonn, #hms-personlig):
1. Requester sees empty channel with "Start privat sak med HR"-knapp.
2. Click → short title prompt → Server Action spawns sub-channel (`channel_type='query_thread'`, members = requester + rep only).
3. `engine_state.entity_id = sub_channel.id`, conversation proceeds privately.
4. On resolve, sub-channel archived (not deleted — audit), visible in requester's "Mine tidligere saker".

## Rep flow (Min kø)

**Web:** new Komm sidebar section "Min kø (3)" above kanalliste. Grouped by channel with sub-headers (Frontend blocker 4). Time displayed in Geist Mono; rows sorted oldest-first (urgency via position).

**Mobile:** segment tabs inside Komm bottom-tab: `[ Min kø (3) ] [ Kanaler ]`. Defaults to Min kø when count>0, else Kanaler. Session-remembers user preference. Existing `(app)/(queue)` bottom-tab is deleted; routes migrate to `(app)/(komm)/kø` and `(app)/(komm)/[channelId]`.

**Botsson-review rad (Phase 1B slot):** no skeleton when empty. When Phase 2 populates, renders with Sparkles icon + dashed border + left accent strip, nested under the ticket row it relates to.

## Admin flow (channel upgrade)

- Channel settings modal gains new "Skranke"-tab (alongside existing Generelt / Medlemmer / AI-policy / Oppbevaring).
- Preset radio + inline "Ansvarlig rep" combobox (expand-in-place inside selected preset card per Frontend review).
- Each preset shows a one-line consequence summary (e.g. *"HR-skranke: meldinger er private, kun rep ser dem"*).
- Tilpasset option shows warning strip: *"Avanserte innstillinger. Anbefaler preset."*
- Save → Server Action `upgradeChannelToHelpdesk` writes channel columns + upserts `channel_ai_policy` + adds rep as `channel_member(role='representative')` + emits `channel.helpdesk.enabled`.

**Downgrade safety:** `downgradeChannelFromHelpdesk` refuses if any open `engine_state` references the channel. Admin must resolve/reassign first. No force-downgrade in Phase 1A.

## Migration (two-phase)

### Phase 1A.1 — Schema-only additive (1 week + 48h soak)

Migration `2026042X_channel_progressive_flags.sql`:
- ADD `channel.helpdesk_enabled boolean NOT NULL DEFAULT false`
- CREATE `channel_privacy_mode` enum (`public`, `private_per_requester`)
- ADD `channel.privacy_mode channel_privacy_mode NULL`
- ADD CHECK `channel_helpdesk_requires_responsible` as **NOT VALID**: `NOT helpdesk_enabled OR responsible_profile_id IS NOT NULL`
- ADD CHECK `channel_private_requires_helpdesk` as **NOT VALID**: `privacy_mode IS NULL OR privacy_mode = 'public' OR helpdesk_enabled = true`
- Narrow `channel_jwt_insert` RLS: `WITH CHECK (helpdesk_enabled = false OR is_admin_in_workspace(workspace_id))` — closes attack vector from Supervisor F4.
- Rollback migration file required.

**48h soak prerequisites:**
- Replace `packages/ai/src/capabilities/helpdesk_query/__tests__/tools.test.ts:24-56` chainable-proxy mock with Zod-validated stub (L-0087 ship-block).
- Staging regression pass on channel INSERT/UPDATE flows.

### Phase 1A.2 — Backfill + CHECK swap + UI cutover (1 week)

Migration `2026042Y_channel_helpdesk_backfill.sql`:
- `UPDATE channel SET helpdesk_enabled=true, privacy_mode='private_per_requester' WHERE channel_type='desk'`
  - Note: leave `channel_type='desk'` unchanged. `'standard'` is not a valid enum value.
- `VALIDATE CONSTRAINT channel_helpdesk_requires_responsible`
- `VALIDATE CONSTRAINT channel_private_requires_helpdesk`
- `DROP CONSTRAINT channel_desk_requires_responsible` (from `20260515130100:31`)

Application cutover:
- DELETE `apps/web/src/app/dashboard/komm/desks/*` (entire directory)
- ADD "Skranke"-tab to channel settings modal
- ADD Min kø sidebar section (web) + segment tabs (mobile)
- MIGRATE `apps/mobile/app/(app)/(queue)/*` → `apps/mobile/app/(app)/(komm)/kø` + `(komm)/[channelId]`
- EXTRACT `ConversationBody` from mobile `(chat)/[id].tsx` (removes placeholder text)
- 6 new Server Actions: `upgradeChannelToHelpdesk`, `downgradeChannelFromHelpdesk`, `setResponsibleRep`, `openPublicTicketFromMessage`, `openPrivateTicket`, `resolveTicketFromMessage`
- NEW events registered in `packages/telemetry/src/registry.ts`:
  - `channel.helpdesk.enabled`
  - `channel.helpdesk.disabled`
  - `channel.responsible.reassigned`
  - `helpdesk.pii.detected`
  - `helpdesk.pii.classifier_timeout`

### Phase 1B — Botsson-review-row UI slot (3 days, after 1A.2 soak)

UI component only. No skeleton when empty. Nested under ticket with Sparkles + dashed border + left accent strip. No capability wiring.

### Phase 2 — BLOCKED on 4 prerequisites

1. Dispatcher ENTITY_PK extension for `channel`, `channel_message`, `engine_state` (L-0085)
2. `channel_ai_policy.text_participation='proactive'` listener built — NOT "reuse", honest scope per L-0086
3. Hospitality domain taxonomy defined as platform artifact (K1a)
4. Intent-classifier at `intent-classifier.ts:36-56` extended with domain-scoped filtering + confidence threshold + clarifying-question flow

Scope when unblocked: ~4 weeks.

### Phase 3 — BLOCKED downstream of Phase 2

SLA darkening orb via `engine_delayed_trigger` (existing infrastructure, ADR-0161 Alt D insight holds). Auto-escalation, `helpdesk.sla.breach` event.

Scope: ~3 weeks.

## E2E tests (required before Phase 1A.2 merge)

Per Supervisor review:

1. `helpdesk-progressive-upgrade.spec.ts` — upgrade regular channel to helpdesk, verify rep sees it in Min kø, verify legacy-desk rows unaffected.
2. `helpdesk-downgrade-blocks-with-open-tickets.spec.ts` — try downgrade with open tickets, expect refusal; resolve, try again, expect success.
3. `helpdesk-public-ticket-lifecycle.spec.ts` — open public ticket from message, verify timeline status-orb, resolve, verify completed_at stamp (L-0079 regression guard).
4. `helpdesk-private-ticket-lifecycle.spec.ts` — open private ticket, verify sub-channel creation, member list, resolve.
5. `helpdesk-pii-redaction.spec.ts` — post personnummer in public helpdesk, verify soft-hold redaction, sub-channel creation, activity_trail entry (ADR-0166).
6. `helpdesk-rls-jwt-insert-blocked.spec.ts` — JWT user attempts INSERT with helpdesk_enabled=true, expect RLS refusal (Supervisor F4 regression guard).
7. `helpdesk-rep-demotion-on-reassign.spec.ts` — reassign rep, verify prior rep demoted to 'member' role (L-0080 regression guard).

## Frontend blockers (all Phase 1A.2)

1. Replace emoji icons (🔦 🔒 🤖) with Lucide (`Lighthouse` / `Lock` / `Sparkles`).
2. Status-orb density rules: show only on first message of thread (computed via `MIN(created_at)` query per L-0088), shrink when active, replace with check-dot when complete, hide after 24h.
3. WCAG 1.4.1 shape/glyph companion for each status (not color alone).
4. Min kø grouped by channel with sub-headers, sorted by oldest waiting ticket.
5. `prefers-reduced-motion` paths for incoming-ticket animation, exit blur, badge-count pop.

Should-fix (also Phase 1A.2):
- Expand-in-place rep dropdown inside selected preset card.
- Consequence summaries under each preset label.
- Private-channel empty state with three zones (identity / action / reassurance).
- Mobile segment tabs scroll-persistent, session-remembered choice.
- Geist Mono for SLA time labels with color-shift at 5min/15min thresholds.
- Botsson-rad nested under ticket row with left accent strip.

## Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| RLS JWT-insert attack vector (Supervisor F4) | CRITICAL | Closed in 1A.1 via RLS narrowing policy |
| L-0087 mock-trap expansion for 2+ new columns | CRITICAL | Zod-validated stub replacement is 1A.2 ship-block |
| Silent projection-trigger break (if ontology split) | HIGH | Mitigated by design — unified `entity_id=channel.id` retained |
| Backfill idempotency | MEDIUM | LIMIT 1 on any multi-row subquery in backfill |
| Dual-truth window (`channel_type='desk'` + flag) | MEDIUM | Rule 7 of ADR-0165: read paths consult flag only |
| L-0082 sub-channel policy inheritance | DEFERRED | Not applicable in 1A (sub-channels exist only in private mode, policy copied at spawn) |

## References

- ADR-0165 (this spec's load-bearing decision)
- ADR-0166 (PII public-mode redaction — Q1 product decision)
- ADR-0161 (amended by ADR-0165)
- ADR-0163 (preserved; amended by ADR-0166)
- ADR-0078 (preserved)
- ADR-0160 (preserved — `channel_event` projection)
- L-0085, L-0086, L-0087, L-0088 (council's captured learnings)
- L-0079, L-0080, L-0081 (Phase 1 learnings, regression guards in E2E)
- Council session 2026-04-20 Progressive Channel — `docs/council/COUNCIL-LOG.md`
