---
title: Progressive Channel Cutover — Phase 1A.2 Handoff
status: done
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [helpdesk, progressive-channel, cutover, handoff]
---

# Handoff — Progressive Channel Cutover (Phase 1A.2)

## Summary

Phase 1A.2 is the **behavioral cutover** that lights up the Progressive Channel
ontology established by ADR-0165. The additive schema foundation from Phase 1A.1
(`helpdesk_enabled` flag, `privacy_mode` enum, NOT VALID CHECKs, narrowed RLS) is
now wired end-to-end: classifier-driven PII redaction, Server Actions with
authority gates, web UI (settings modal + channel-row indicators + Min kø
section), mobile cutover from `(queue)` to `(komm)` with ConversationBody
extraction, and telemetry emissions through the canonical `@smartout/telemetry`
registry. Phase 1 `channel_type='desk'` remains functional but deprecated
pending soak. The unified ontology replaces the Phase 1 subtype (`desk`) with a
flag on the primitive, which unblocked mobile parity and removed the special-
case routing previously required at capability layer and agent-router.

## What shipped

### Wave 1 — foundations (3 sub-sorties)

- **Domain taxonomy** — `helpdesk.*` namespace across telemetry registry,
  capability tags, and ADR-0165 §3 vocabulary. Prevents collisions with the
  legacy `channel.*` and `comms.*` event families.
- **PII classifier** — fail-open detector for personnummer, kontonummer, phone,
  email. Emits `helpdesk.pii.detected` with category + confidence. Redacted
  output routed to private sub-channel when `privacy_mode='private_per_requester'`.
- **Dispatcher ENTITY_PK** — engine_dispatch routing for helpdesk tickets now
  keys on `engine_state.id` (not composite channel + thread). Closes the
  double-fire race when two messages land within the dispatcher tick.

### Wave 2a — backend + mobile cutover (2 sub-sorties)

- **Backend Server Actions + migration + telemetry** — `enableHelpdesk`,
  `disableHelpdesk`, `resolveTicket`, `assignResponsible` as Server Actions.
  Migration backfills `helpdesk_enabled=true` for existing `channel_type='desk'`
  rows (idempotent). `emit()` wiring for `channel.helpdesk.enabled`,
  `channel.helpdesk.disabled`, `helpdesk.ticket.resolved`.
- **Mobile `(queue)` → `(komm)` cutover** — the standalone mobile queue route is
  deleted. Ticket work lives inside the unified comms surface. `ConversationBody`
  extracted from the legacy queue screen into a shared component consumed by
  both channel and DM views. Mobile executes D6 (resolve) per ADR-0133; it does
  not compose.

### Wave 2b — web UI + E2E (2 sub-sorties)

- **Web UI** — `SkrankeTab` in `ChannelSettingsModal` with three presets
  (Offentlig skranke / Privat skranke / Tilpasset), `MinKoSection` on the
  dashboard Komm surface (polls every 30s, see known issues), channel-row
  LifeBuoy badge + responsible-rep avatar, `ChannelSettingsModal` integration.
- **E2E spec skeletons** — seven Playwright specs (`enable-helpdesk`,
  `disable-helpdesk-blocked-open-tickets`, `pii-redaction-private-mode`,
  `min-ko-badge`, `mobile-resolve`, `assign-responsible`, `row-indicators`).
  All are `.skip`-gated at describe level pending auth fixtures.

### Wave 2c — this sub-sortie

- Umbrella handoff + journeys + DASHBOARD note.

## Active ADRs for this feature

- **ADR-0161** — Engine-state ticket ontology (ticket = `engine_state`, not a
  new table).
- **ADR-0163** — Dead-infra consumers (`channel_event`, `channel_ai_policy`)
  wired as first real clients.
- **ADR-0165** — Progressive Channel Discriminator (`helpdesk_enabled` flag
  replaces `channel_type='desk'` subtype; deprecate-not-drop under Rule 7).
- **ADR-0166** — PII classifier as fail-open redaction gate + private sub-
  channel routing contract.

## Active Learnings for this feature

- **L-0079** — `completed_at` must stamp on resolve (`engine_state.status='complete'`)
  or Min kø aggregation double-counts.
- **L-0080** — `engine_state.context` JSONB holds `desk_channel_id` parent
  linkage; no `parent_channel_id` column exists.
- **L-0085** — Lucide `Lighthouse` icon is not in the pinned lucide-react
  version; substitute `LifeBuoy` for row badges.
- **L-0086** — Telemetry event names: `channel.helpdesk.enabled` (not
  `helpdesk.channel.upgraded`) and `helpdesk.pii.detected` (not
  `helpdesk.pii.redacted`).
- **L-0087** — Supabase mock must be Zod-validated; chainable-proxy mocks hide
  column typos and ship-block late.
- **L-0088** — `.skip`-gate E2E specs at describe level, not per-test, so
  Playwright reports one skip line per spec, not N.

## Known deviations from spec

- Lucide `Lighthouse` icon unavailable in the pinned lucide-react version —
  `LifeBuoy` substituted for channel-row badges. The `LighthouseAvatar`
  component from `@smartout/ui` is retained for avatar surfaces (it does not
  depend on the missing icon).
- Telemetry event names were corrected during E2E authoring:
  `channel.helpdesk.enabled` (not `helpdesk.channel.upgraded`) and
  `helpdesk.pii.detected` (not `helpdesk.pii.redacted`). Registry in
  `packages/telemetry/src/registry.ts` is canonical.
- `channel.parent_channel_id` column **does not exist**. Parent linkage for
  private sub-channels lives in `engine_state.context->>'desk_channel_id'`
  (JSONB). Any query expecting a column will return empty.
- Open-ticket status values are `waiting` | `active`, not `pending`. The
  `has_open_tickets` guard on disable uses `status IN ('waiting','active')`.
- E2E specs are `.skip`-gated at describe level, awaiting shared auth fixtures
  and Supabase Local seed patterns. Specs compile but do not run.

## Known issues / debt

- All 7 E2E specs are `.skip`. They need a shared auth fixture (admin + rep +
  employee) plus seed helpers (`seedWorkspace`, `seedHelpdeskChannel`,
  `seedOpenTicket`) before they run green.
- Legacy `channel_type='desk'` enum value is deprecated-not-dropped per
  ADR-0165 Rule 7. A follow-up migration dropping the enum value is required
  after full cutover verification in prod (60+ day soak precedent from RLS
  work).
- Custom preset "Tilpasset" in `SkrankeTab` currently ships safe defaults
  (public + AI policy disabled). Deeper per-field configuration is future work
  — the preset exists so the shape is stable.
- `MinKoSection` polls every 30 seconds. Realtime via `channel_event` is Phase
  1B (see ADR-0163).

## Next steps

1. Activate E2E specs as auth fixtures land in `apps/e2e/fixtures/` (tracked
   separately).
2. Write deprecation migration for `channel_type='desk'` enum value after the
   60-day soak completes in prod (monitor `channel_type` distribution in
   `activity_trail`).
3. **Phase 1B** — Min kø realtime subscription replacing the 30s poll. Wires
   `channel_event` as first live consumer of the dead-infra subscription
   channel (ADR-0163 part 2).
4. **Phase 2** — agent-router confidence-threshold helpdesk routing. Blocked
   on ADR-0135 (voice channel decision) because the routing policy needs a
   canonical channel enum before it can hard-gate voice out of helpdesk flows.
