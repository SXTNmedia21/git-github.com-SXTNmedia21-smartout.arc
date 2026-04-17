---
title: Telemetry Registry Audit 2026-04-17
status: done
updated: 2026-04-17
created: 2026-04-17
module: telemetry
tags: [telemetry, audit, adr-0114, emit]
---

# Telemetry Registry Audit — 2026-04-17

## TL;DR

| Metric | Count |
|---|---|
| Registered events (interface + EVENT_ROUTING) | **398** |
| Unique event names actually emitted in code | **186** |
| `emit(` callsites (typed wrapper, web + mobile + services) | **333** |
| `emitViaEndpoint(` callsites (Edge Functions) | **5** |
| Direct `activity_trail`/`engine_event` inserts bypassing `emit()` | **≥2** (one confirmed: `accept-invitation`) |
| Registered but never emitted | **213** (54% of registry) |
| Emitted but not registered | **1** (`knowledge ingestion_completed`) |
| Server Actions files touched | 17 — 16 emit, 1 read-only queries file |
| `useMutation` files without `emit()` on write path | **4 / 85** (94% compliant) |

**Headline:** The registry has drifted into an aspirational surface. Over half of the declared events have zero emission sites. The single unregistered emit lives in an Edge Function that bypasses the typed `emit()` wrapper entirely (direct `activity_trail` insert). Mobile mutation freeze sites (use-punch.ts:141-142, use-swap.ts:59-60 etc.) emit with `workspace_id: null|""` and `actor_id: ""` — confirming the ADR-0134 telemetry-contract gap.

Before we enforce `emit()` on remaining mutations (ADR-0114), we need to (1) close the mobile `workspace_id`/`actor_id` empty-string corruption, (2) reconcile the naming-convention split (`channel.*` dotted vs `channel *` spaced), and (3) trim or fill the 213 phantom registrations.

---

## 1. Registered Events — Summary

Registry source: `packages/telemetry/src/registry.ts` (5,754 lines).

- **398** `interface XxxEvent extends BaseEvent` definitions.
- **398** entries in `EVENT_ROUTING: Record<SmartoutEvent["event"], EventMeta>` (line 4228).
- **398** variants in the `SmartoutEvent` discriminated union (line 3823).
- Shape: `BaseEvent = { workspace_id: string | null; actor_id: string; timestamp?; correlation_id? }` + per-event `properties`.

### Destination fan-out (registered events)

| Destination | Registered events routed |
|---|---|
| `posthog` | 332 / 398 (83%) |
| `logger` | 329 / 398 (83%) |
| `activity_trail` | 301 / 398 (76%) |
| `engine_event` | 119 / 398 (30%) |
| `billing_activity_log` | 13 / 398 (3%) — platform-scoped per ADR-0125 |

- Events routed to all four standard channels (posthog+logger+activity_trail+engine_event): **57**.
- Events routed to posthog only: 16 (mostly navigation, passive UI signals).
- Events routed to logger only: 1 (`telegram bridge_message_relayed`).
- Events with empty destinations: 0.

### Categories

Declared `EventCategory` union: `auth | onboarding | org_structure | scheduling | contracts | operations | haccp | training | communication | system | navigation | channels | agent | telegram | wizard | security | enrichment | ops_intelligence | billing`.

---

## 2. Emit Sites — Summary

| Area | Files | `emit(` calls |
|---|---|---|
| `apps/web/src/` | 148 | 300 |
| `apps/mobile/src/` | 21 | 29 |
| `services/` (stage-engine) | 1 | 3 |
| `supabase/functions/` (emit direct) | 0 | 0 |
| `supabase/functions/` (via `emitViaEndpoint` → `/api/internal/emit`) | 1 | 4 |
| `supabase/functions/` (direct `activity_trail.insert` bypass) | ≥1 | ≥2 |

**Top emit-event call counts (call-site multiplicity):**

```
23× "button clicked"                           (ui rules)
 6× "day_info created"
 5× "shift punched_in"
 4× "operating_hours updated"
 4× "communication sent"
 3× "wizard step_completed", "wizard completed"
 3× "shift updated", "shift created", "shift swap_rejected"
 3× "reconciliation admin_action"
 3× "deviation reported"
 3× "contract sent", "contract created"
 3× "chat message_sent"
```

### Emit mechanism variants found in code

1. **Typed wrapper** — `emit(event)` from `@smartout/telemetry`, reads `EVENT_ROUTING`, fans out per destination.  → `packages/telemetry/src/emit.ts`.
2. **Client-side** — `emit.client.ts` for browser-sent beacons.
3. **Mobile native** — `emit.native.ts`.
4. **`emitViaEndpoint()`** — ad-hoc helper defined in `supabase/functions/generate-monthly-invoices/generator.ts:434`, POSTs to `/api/internal/emit` route. Not a shared primitive — duplicated inline.
5. **Direct insert bypass** — `supabase/functions/accept-invitation/index.ts:413-426` does `adminClient.from("activity_trail").insert(...)` and `from("engine_event").insert(...)` in parallel, no `emit()` call. Silently avoids PostHog + logger routing.

---

## 3. Delta — Registered vs Emitted

### 3.1 Emitted but NOT registered (1)

| Event name | Source file | Problem |
|---|---|---|
| `knowledge ingestion_completed` | `supabase/functions/ingest-workspace-knowledge/index.ts:409` | Direct `activity_trail.insert` in Edge Function — never goes through `emit()`, so `EVENT_ROUTING` has no entry. PostHog + logger never see this event. |

### 3.2 Registered but NEVER emitted (213 of 398)

Biggest domain clusters with zero emit coverage:

| Domain prefix | Registered-but-silent count | Examples |
|---|---|---|
| `channel.*` (dotted namespace) | 26 | `channel.call.started`, `channel.message.sent`, `channel.reaction.added`, `channel.read` |
| `wizard` / `workspace` / `website` | 25 | `website created`, `wizard abandoned`, `workspace provision_failed` |
| `contract *` | 13 | `contract intake completed`, `contract compliance blocked`, `contract revision created` |
| `telegram *` | 10 | `telegram poll_sent`, `telegram escalation_sent`, `telegram session_created` |
| `agent *` / `botsson.*` | 13 | `agent tokens_used`, `agent session_started`, `botsson.turn_completed`, `botsson.tool_invoked` |
| `auth *` | 5 | `auth signed_in`, `auth signed_up`, `auth logged_in`, `auth signup_failed` |
| `shift *` / `shift_lifecycle *` / `session *` | 15 | `shift assigned`, `shift late_detected`, `shift_lifecycle settled`, `session opened` |
| `season *` / `season_*` | 10 | `season created`, `season_budget updated`, `season_goal created` |
| `security *` | 3 | `security lockout_triggered`, `security rate_limited`, `security sandbox_blocked` |

Full list: see `/tmp/registered_not_emitted.txt` during audit (regenerable). Representative subset of 213 below (Appendix A).

### 3.3 Naming-convention split

The registry has **two incompatible conventions** coexisting, which makes grep-based audits noisy:

- **Space-separated** (dominant): `shift created`, `contract sent`, `channel created` — 370+ events.
- **Dot-namespaced** (channels + botsson only): `channel.message.sent`, `botsson.turn_started`, `help_request.created`, `news.post.reacted` — ~30 events.

The dot-namespaced variant is used exclusively for domains with zero emission. If we ever emit them, it breaks the `<entity> <verb>` convention documented in `BaseEvent`/`SmartoutEvent`. Council should decide: collapse to one convention, or document why channels use dots.

---

## 4. Mutation Coverage

### 4.1 Server Actions (`apps/web/src/app/**/_actions/*.ts`)

17 files scanned. All 16 mutation files emit. The only file without `emit()` is `apps/web/src/app/dashboard/billing/_actions/queries.ts` — confirmed read-only (zero `.insert/.update/.delete/.upsert`), so correctly exempt.

**Server Action compliance: 16/16 (100%).**

### 4.2 TanStack `useMutation` callers

85 files contain `useMutation(`. 4 lack any `emit()` call on the write path:

| File | Mutation purpose | Risk |
|---|---|---|
| `apps/web/src/components/dashboard/ReconciliationView.tsx` | `ensureReconciliation` — creates `daily_reconciliation` row | **HIGH** — C1 calibration event, should fan out to engine_event |
| `apps/web/src/components/dashboard/cockpit/sheets/DailyNoteSheet.tsx` | Save day note | MED — UX signal + activity_trail |
| `apps/web/src/components/dashboard/cockpit/sheets/ReservationSheet.tsx` | Save reservation | MED — D4 demand signal |
| `apps/mobile/src/hooks/queries/use-notifications.ts` | Mark notifications read (2 mutations) | LOW — read-side state, but `channel.read` is registered |

**useMutation compliance: 81/85 (95%).**

### 4.3 Mobile telemetry contract violations (ADR-0134)

Cross-referenced the freeze list from `CLAUDE.md`. Confirmed in-tree:

| File | Line(s) | Violation |
|---|---|---|
| `apps/mobile/src/hooks/mutations/use-punch.ts` | 141-142 | `workspace_id: null, actor_id: ""` in error-path emit |
| `apps/mobile/src/hooks/mutations/use-swap.ts` | 59-60, 122-123, 133-134, 187-188 | `workspace_id: "", actor_id: selectedProfileId ?? ""` — four sites |
| `apps/mobile/src/hooks/mutations/use-create-shift.ts` | 68-69 | `workspace_id: payload.workspace_id, actor_id: ""` |

These pass TypeScript (the type allows `workspace_id: string \| null` and `actor_id: string`), but silently corrupt `activity_trail` row-level routing and `engine_event` dispatch. Matches ADR-0134 gate #1.

---

## 5. Top 3 Gaps

1. **213 phantom registrations (54%)** — half the registry is dead weight. Subagents/council-review should decide per cluster: (a) emit is coming in a planned module (leave registered), (b) rename/merge with an existing event, or (c) delete the interface. Priority clusters to resolve first: `channel.*` (26 — Komm module is live, events should exist), `contract *` (13 — contract-composition engine is actively shipping).

2. **Edge Function emit bypass** — two paths bypass the typed `emit()` surface: `emitViaEndpoint()` in `generate-monthly-invoices/generator.ts` (duplicates emit logic inline, fires only to `/api/internal/emit`), and direct `activity_trail.insert` in `accept-invitation/index.ts` + `ingest-workspace-knowledge/index.ts`. Result: unregistered events (e.g. `knowledge ingestion_completed`), missing PostHog/logger fan-out, and no compile-time type check. Need a shared `packages/telemetry/src/emit.edge.ts` + ADR.

3. **Mobile telemetry contract corruption (ADR-0134)** — 6+ emit sites in `apps/mobile/src/hooks/mutations/` pass empty-string or null identifiers. This is the pending freeze gate. Fix pattern is already documented in `use-punch.ts:24-46` (`getProfileContext()`) — apply consistently + add unit tests asserting `workspace_id !== null && actor_id !== ""` before `emit()`.

---

## 6. Recommended Actions (before ADR-0114 emit enforcement)

| # | Action | Owner | Gate |
|---|---|---|---|
| 1 | Add Zod/TS runtime guard inside `emit()` that rejects `actor_id === ""` and logs loudly. Non-blocking dev warning; hard fail on CI. | telemetry | blocks Sprint 2 enforcement |
| 2 | Fix mobile telemetry contract sites (`use-punch`, `use-swap`, `use-create-shift`) — lift mobile freeze gate #1. | mobile | blocks ADR-0134 |
| 3 | Promote `emitViaEndpoint` into `packages/telemetry/src/emit.edge.ts` and refactor `generate-monthly-invoices/generator.ts` + any new Edge Function usage. | telemetry | blocks ADR-0114 enforcement on Edge |
| 4 | Replace the two direct-insert bypasses (`accept-invitation`, `ingest-workspace-knowledge`) with the new edge emitter; register `knowledge ingestion_completed` properly. | supabase | 1 hour fix |
| 5 | Council decision on naming convention (`channel.*` vs `channel *`) — then migrate one direction. | council | documentation ADR |
| 6 | Prune or fill the 213 phantom registrations in batches by domain. Start with `channel.*` (Komm module is shipping and should emit anyway). | per-module | cleanup, non-blocking |
| 7 | Add 4 missing `emit()` calls in the `useMutation` gap list (`ReconciliationView`, `DailyNoteSheet`, `ReservationSheet`, `use-notifications`). | per-team | blocks Sprint 2 gate |
| 8 | Add a CI check: `grep -r 'event:' | diff against EVENT_ROUTING keys` — fail on unregistered events. | ci | ADR-0114 enforcement |

---

## Appendix A — Registered-but-not-emitted (full 213 sample by cluster)

**channel.* (26):** `channel.archived, channel.call.ended, channel.call.group_announced, channel.call.invite_accepted, channel.call.invite_missed, channel.call.invite_rejected, channel.call.invite_sent, channel.call.participant_joined, channel.call.participant_left, channel.call.participant_muted, channel.call.ptt_activated, channel.call.ptt_deactivated, channel.call.started, channel.created, channel.member.joined, channel.member.left, channel.message.deleted, channel.message.edited, channel.message.pinned, channel.message.sent, channel.message.unpinned, channel.reaction.added, channel.reaction.removed, channel.read, help_request.created, help_request.resolved`

**contract * (13):** `contract attachment deleted, contract attachment uploaded, contract compliance blocked, contract compliance overridden, contract framework drift detected, contract intake admin bypass, contract intake completed, contract intake declined, contract intake escalated, contract intake field submitted, contract intake started, contract retention archived, contract revision created`

**auth * (5):** `auth signed_up, auth signed_in, auth signed_out, auth logged_in, auth signup_failed` — these exist in old emit sites but as `auth otp_*` variants; the generic sign-in/up events appear to be pre-OTP pattern never cleaned up.

**botsson.* (9):** `botsson.intent_classified, botsson.step_cap_hit, botsson.tool_failed, botsson.tool_invoked, botsson.turn_completed, botsson.turn_started, botsson autofill_applied, botsson nudge_accepted, botsson nudge_dismissed, botsson nudge_shown`

**agent * (6):** `agent budget_exhausted, agent context_window_truncated, agent hook_blocked, agent session_closed, agent session_started, agent tokens_used`

**website * (13):** `website asset uploaded, website content_generated, website created, website domain_failed, website domain_verified, website menu_synced, website page created, website page deleted, website pages reordered, website preview token created, website preview_created, website section created, website section deleted, website section updated, website sections reordered, website setup completed, website spokesperson_content_submitted, website spokesperson_task_overdue, website system_section_added`

**season / season_* (10):** `season activated, season archived, season created, season operating_hours_copied, season operating_hours_removed, season operating_hours_updated, season updated, season_budget updated, season_goal created, season_goal deleted, season_goal updated, season_policy_binding updated`

**shift / shift_lifecycle / session (15):** `shift adhoc_approved, shift assigned, shift call_initiated, shift late_detected, shift no_show_escalated, shift supplement_reviewed, shift unassigned, shift_lifecycle approved, shift_lifecycle interpreted, shift_lifecycle published, shift_lifecycle settled, shift_type_config created, shift_type_config removed, shift_type_config updated, session hook_fired, session opened, session pending_signoff, session_task.assigned, session_task.created`

**telegram * (10):** `telegram bridge_closed, telegram bridge_message_relayed, telegram bridge_opened, telegram escalation_resolved, telegram escalation_sent, telegram message_received, telegram message_sent, telegram poll_resolved, telegram poll_sent, telegram session_created`

**Other notable silent events (security, workspace, enrichment, gate, ai, approval, checklist, day_factors, hour_factors, reminder, roster, scrape, news, department updates, etc.):**
`ai generation_failed, approval resolved, brreg lookup_failed, checklist deviation_flagged, checklist overdue, communication failed, communication.broadcast_sent, conversation created, day_factors updated, department archived, department created, department updated, enrichment corrected, enrichment hit, enrichment missed, enrichment requested, escalation triggered, gate denied, gate evaluated, hour_factors updated, invitation resent, invitation cancelled, leader_pulse generated, news.post.created, news.post.deleted, news.post.reacted, news.post.updated, onboarding_guide step_completed, position created, position updated, procedure assigned, procedure_step completed, procedure_step skipped, profession assigned, profession confirmed, profession created, profile deactivated, profile department updated, profile granted, profile login code sent, profile reactivated, profile revoked, profile role updated, profile status updated, public_holiday created, public_holiday deleted, public_holiday updated, reminder converted, reminder opened, reminder sent, roster deleted, roster updated, scrape failed, scrape partial, security lockout_triggered, security rate_limited, security sandbox_blocked, setup_guide completed, template applied, template_shift created, week reset, wizard abandoned, wizard fact_edited, workspace abandoned, workspace created, workspace finalize_failed, workspace provision_failed`

---

## Appendix B — Emit-site inventory (counts)

```
apps/web/src/                148 files, 300 emit() calls
apps/mobile/src/              21 files,  29 emit() calls
services/stage-engine/         1 file,    3 emit() calls  (routes/agent/chat.ts)
supabase/functions/            1 file,    4 emitViaEndpoint() calls  (generate-monthly-invoices/generator.ts)
supabase/functions/            2 files,   2+ direct activity_trail.insert bypasses
                                          (accept-invitation/index.ts, ingest-workspace-knowledge/index.ts)
```

Unique event names actually emitted (across all files): **186**.
Overlap with registry: **185** (one unregistered: `knowledge ingestion_completed`).

---

## Appendix C — Audit methodology

1. `packages/telemetry/src/registry.ts` parsed for `interface XxxEvent extends BaseEvent` → 398 definitions.
2. `EVENT_ROUTING` object scanned line 4228–5754 → 398 keyed entries, destinations extracted via grep.
3. Source grep for `emit(` and `emitViaEndpoint(` across `apps/web/src`, `apps/mobile/src`, `services`, `supabase/functions` (TS + TSX only).
4. Event literals extracted via regex `event:\s*"[a-z_][a-z_ .]+"` from all emit contexts → 186 unique names.
5. Set diff (`comm`) between registered names and emitted names → 213 unused / 1 unregistered.
6. `useMutation` files enumerated and checked for `emit(` presence on write path → 4 gaps.
7. Mobile contract sites cross-referenced against ADR-0134 call list in `CLAUDE.md`.

No code was modified during this audit.
