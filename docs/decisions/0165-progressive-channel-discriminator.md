---
title: "Progressive Channel discriminator — helpdesk as flag, not subtype"
id: ADR_0165
status: accepted
layer: decision
created: 2026-04-20
updated: 2026-04-20
amends: ADR-0161
---

# ADR-0165: Progressive Channel discriminator — helpdesk as `helpdesk_enabled` flag, not `channel_type='desk'` subtype

## Context and Problem Statement

Phase 1 helpdesk shipped 2026-04-20 with `channel_type='desk'` as the enum-level discriminator (ADR-0161 §Rules-Data-model §1). Post-implementation experience and the 2026-04-20 Progressive Channel council surfaced three structural issues:

1. **Ontology mismatch with user mental model.** A channel that serves as both a chat room AND a helpdesk cannot exist in the subtype model — a channel is EITHER desk OR chat, never both. Hospitality teams want #bar to be a social room that ALSO accepts structured questions with a responsible rep.
2. **L-0070 from prior council** already warned: sibling-table/subtype patterns do not answer ontology questions, they defer them. Adding `channel_type='desk'` + `channel_type='query_thread'` was exactly this pattern, landing as a tactical fix.
3. **No path to progressive upgrade/downgrade.** Converting a regular channel to a helpdesk requires rewriting `channel_type` + dependent RLS policies + message history implications. A flag can flip cleanly; an enum cannot without migration theatre.

## Decision Drivers

- ADR-0161 ontology invariant (ticket = `engine_state`) MUST be preserved. Ticket is NOT a row on `channel`. This is the load-bearing insight from 2026-04-19 council.
- `channel_ai_policy` dead-infra deadline 2026-07-13 (ADR-0087, wired in ADR-0160) — reuse the existing storage, do not add parallel columns for AI policy on `channel`.
- Existing Phase 1 migrations (`20260515130000` through `20260515130400`) must remain valid; no rewrites of applied history.
- `engine_state.entity_id = channel.id` is a live contract consumed by the `channel_event` projection trigger (`20260515120000:51-55`) and `resolve-ticket.ts:131,137`. Any change to this ontology silently breaks Komm UI resolve events.
- Security: `channel_jwt_insert` RLS policy (`20260422300100:24-26`) currently allows JWT INSERT of `channel_type='custom'`. If helpdesk-authority depends on a column in that row, user-side inserts become an attack vector.

## Considered Options

1. **Alt A — Keep ADR-0161's `channel_type='desk'` subtype unchanged.** Accept that progressive upgrade is not supported; admins create dedicated desk channels.
2. **Alt B — Full subtype rewrite.** Replace `'desk'` enum with new enum values per privacy mode (`'helpdesk_public'`, `'helpdesk_private'`, etc.), run migration across all historical rows.
3. **Alt C — Progressive flag (this ADR).** Add `channel.helpdesk_enabled boolean` as runtime truth source. Existing `channel_type='desk'` rows set the flag to `true` on backfill. The enum value is deprecated-not-dropped. Read paths consult `helpdesk_enabled`; `channel_type` becomes irrelevant for helpdesk behavior.
4. **Alt D — Progressive flag + polymorphic `entity_id`.** As C, but split ontology per privacy mode: public-mode tickets anchor on `channel_message.id`, private-mode on `channel.id`.

## Decision Outcome

Chosen: **Alt C — Progressive flag with preserved entity ontology.**

Rationale:
- Preserves ADR-0161 ontology invariant — `engine_state.entity_id` remains `channel.id` in both public and private mode. Projection trigger, resolve-ticket Server Action, capability tools continue to work unchanged.
- Code-trace in Progressive Channel council exposed that Alt D's polymorphic `entity_id` creates **two silent breaks**: (1) `channel_event` projection looks up `channel.id` in `channel` table; if payload carries `channel_message.id`, row is silently dropped; (2) `resolve-ticket.ts:131` calls `revalidatePath(/thread/${ticket.entity_id})` — breaks for message-id entities. Alt D was rejected on this evidence.
- `helpdesk_enabled` flag supports admin-UX progressive disclosure: any channel can be upgraded via one server action, downgraded if no open tickets. Alt A cannot; Alt B requires per-row migration.
- Dual-truth window (`channel_type='desk'` still set on legacy rows) is acceptable because read paths consult ONLY `helpdesk_enabled`. Rule: `channel_type` carries no helpdesk semantics after this ADR.

### Amended from ADR-0161

This ADR amends ADR-0161 §Rules-Data-model §1:

> **Before (ADR-0161):** Desk = `channel` row with new `channel_type='desk'` and `responsible_profile_id FK`.
>
> **After (this ADR):** Desk = `channel` row with `helpdesk_enabled=true`, `responsible_profile_id FK`, and `privacy_mode` set. `channel_type` is NOT consulted to determine helpdesk-ness. Existing `channel_type='desk'` rows are backfilled to `helpdesk_enabled=true` and retain the enum value forever as deprecated-but-valid lineage.

ADR-0161's §Rules-Data-model §2–7 (ticket = engine_state; lifecycle = engine_process; etc.) are unchanged.

## Rules

1. **Read-time truth source:** `channel.helpdesk_enabled boolean` is the ONLY flag consulted at read time to determine if a channel is a helpdesk. Never `channel_type = 'desk'`.
2. **Privacy mode:** `channel.privacy_mode` enum (`public` | `private_per_requester`) — only valid when `helpdesk_enabled = true`, enforced by CHECK constraint (NOT NULL implied by conditional CHECK). `public` = messages visible to all channel members; `private_per_requester` = each ticket spawns a sub-channel (reuses `channel_type='query_thread'` from Phase 1, new sub-channel per ticket, requester + rep only members).
3. **Responsibility:** `channel.responsible_profile_id` required when `helpdesk_enabled=true`. Existing CHECK `channel_desk_requires_responsible` at `20260515130100:31` must be REPLACED (NOT duplicated) with `NOT helpdesk_enabled OR responsible_profile_id IS NOT NULL`. Sequence: NOT VALID → VALIDATE → DROP old.
4. **Entity ontology (UNCHANGED from ADR-0161):** `engine_state.entity_id = <conversation_channel.id>`. Public mode: conversation is the helpdesk channel itself. Private mode: conversation is the sub-channel. Both shapes have `entity_type = 'channel'`. No message-ID anchoring; presentation computes "first message" via `MIN(created_at)`.
5. **AI policy reuse:** `channel_ai_policy.text_participation` and `voice_participation` are the truth source for Botsson behavior. NO new `botsson_policy` column on `channel`. `text_participation='proactive'` enables Phase 2 auto-response (listener to be built in Phase 2 per L-0086).
6. **RLS narrowing (SECURITY):** JWT INSERT of a row with `helpdesk_enabled=true` MUST be denied. Enforced by policy narrowing: `WITH CHECK (helpdesk_enabled = false OR is_admin_in_workspace(workspace_id))`. Service role (via Server Actions) retains full access.
7. **Dual-truth deprecation contract:** `channel_type='desk'` is deprecated-not-dropped. Read paths consulting `channel_type` for helpdesk-ness are BUGS after this ADR. ADR-0161's write-path language ("new desks are created with `channel_type='desk'`") is void; new desks flip `helpdesk_enabled` on existing `channel_type` (typically the channel's pre-existing value).
8. **Downgrade safety:** `downgradeChannelFromHelpdesk` Server Action MUST refuse if any open `engine_state` references the channel. Rep demotion pattern from L-0080 applies: prior rep's `channel_member.role` is demoted from `representative` back to `member`, not deleted (preserves message authorship history).

## What is explicitly rejected

- **`channel_message.engine_state_id uuid REFERENCES engine_state(id)` FK.** Code-trace showed this creates a dual-write polymorphism trap. "Orb on first message" is a presentation query (`MIN(created_at)`), not a persisted FK.
- **`channel.domain_tags text[]` for Botsson routing.** Creates a 4th enforcement layer parallel to `capability.allowedChannels` (ADR-0078/0163). If Phase 2 reveals a real per-channel capability-subset need, write a separate ADR then with documented precedence.
- **`channel.parent_channel_id uuid` column in Phase 1A.** Reuse `engine_state.context.desk_channel_id` (already populated by `helpdesk_query/tools.ts:96-101`). Introducing a FK column would require Phase 2 dispatcher ENTITY_PK extension (L-0085).
- **UPDATE `channel_type` = 'standard' during backfill.** Value does not exist in `comm_channel_type` enum. Legacy `'desk'` rows stay `'desk'` forever (Supervisor F1, 2026-04-20 council).

## Consequences

### Positive

- Any channel can be upgraded to helpdesk without data migration. Admins change policy via one Server Action.
- Ontology invariant preserved — no new silent-break surface in `channel_event` projection or resolve paths.
- `channel_ai_policy` dead-infra gets real writer (admin upgrades write policy row). Deadline 2026-07-13 closed.
- Security posture improved — RLS narrowing closes JWT-INSERT attack vector that existed on original `channel_type='desk'` model.

### Negative / trade-offs

- Dual-truth window exists as long as legacy `channel_type='desk'` rows exist. Mitigated by rule 7 (read paths MUST consult flag, not enum). Enforced via code review; grep audit for `channel_type = 'desk'` as acceptance gate.
- Phase 2 listener for `channel_ai_policy.text_participation='proactive'` still needs to be built — reuse is for storage, not for end-to-end behavior (see L-0086).

## Implementation plan (summary)

**Phase 1A.1** (1 week, additive schema + RLS narrowing + L-0087 mock replacement prereq, 48h soak)
**Phase 1A.2** (1 week, backfill + CHECK swap + UI cutover + 7 E2E tests)
**Phase 1B** (3 days, Botsson review-row UI slot — no skeleton per Frontend)
**Phase 2** (BLOCKED on 4 prerequisites — see L-0085, L-0086)
**Phase 3** (BLOCKED downstream of Phase 2)

Full plan in `docs/superpowers/specs/2026-04-20-progressive-channel-design.md`.

## References

- ADR-0161 (amended)
- ADR-0163 (PII allowedChannels mandatory — preserved)
- ADR-0078 (channel restriction — preserved)
- ADR-0160 (channel_event projection — preserved)
- L-0070 (sibling-table pattern — motivated this ADR)
- L-0085 (dispatcher ENTITY_PK gap — Phase 2 blocker)
- L-0086 (channel_ai_policy half-wired — Phase 2 scope reality)
- L-0087 (mock-surface trap expands with additive columns — 1A.1 prereq)
- L-0088 (ontology change ≠ presentation change — motivated rejecting the engine_state_id FK)
- Council session 2026-04-20 Progressive Channel — see `docs/council/COUNCIL-LOG.md`
