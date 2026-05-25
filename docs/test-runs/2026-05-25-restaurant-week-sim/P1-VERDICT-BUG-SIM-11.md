---
title: P1 Verdict — BUG-SIM-11 Audience-Resolver Cross-Tenant Leak
status: done
created: 2026-05-25
updated: 2026-05-25
module: communication
tags: [security, audience-resolver, cross-tenant, rls, service-role, sim-verification]
---

# P1 Verdict — BUG-SIM-11 Audience-Resolver Cross-Tenant Leak

## Classification

**P0 — EXPLOITABLE** (with narrowed blast radius; see Evidence §Blast Radius)

The `on_duty` branch in `packages/ai/src/capabilities/communication/audience-resolver.ts:59-73`
is missing the `workspace_id` filter present on every sibling branch (`all`, `department`, `role`).
The sole production caller — `publish-announcement.ts:237,348` — invokes the resolver with
`ctx.supabaseAdmin`, which is the service-role client (RLS-bypassing per
`services/stage-engine/src/lib/supabase.ts:18-21`). RLS on `timesheet.time_entry` exists and is
correctly workspace-scoped, but service-role bypasses it. Result: a real cross-tenant data leak
into the calling workspace's tooling surface.

Blast radius is narrowed (NOT eliminated) by a downstream `channel_member` JOIN in the fan-out
helper that filters recipients to the workspace's own channel members. The leak therefore does
NOT deliver notifications across workspaces, but it DOES leak counts/PII via four side channels.

## Evidence

### Bug location (the missing filter)

`packages/ai/src/capabilities/communication/audience-resolver.ts:59-73`:

```ts
if (input.kind === "on_duty") {
  // SAFETY: timesheet schema FK joins to public.profile fail in PostgREST,
  // so we query time_entry rows then dedupe profile_ids in JS.
  const { data, error } = await supabase
    .schema("timesheet")
    .from("time_entry")
    .select("profile_id")
    .is("punch_out", null)
    .limit(500);                                  // ← NO .eq("workspace_id", workspaceId)
  ...
}
```

Compare sibling branches that DO filter:

- `all`             — `:48-56`   `.eq("workspace_id", workspaceId)` present
- `department`      — `:76-114`  `.eq("workspace_id", workspaceId)` present (both queries)
- `role`            — `:116-136` `.eq("workspace_id", workspaceId)` present
- `individuals`     — `:138-140` no DB call (dedupes input array — not a leak vector)

The asymmetry is the bug. `workspaceId` is already a parameter to `resolveAudience()` and is
used by every other branch; adding it to the `on_duty` branch is a one-line fix.

### Client construction = service-role (RLS bypass)

`packages/ai/src/capabilities/communication/publish-announcement.ts:184`:

```ts
const supabase = ctx.supabaseAdmin;
```

`packages/ai/src/capabilities/communication/publish-announcement.ts:237`:

```ts
resolved = await resolveAudience(supabase, ctx.workspaceId, audience);
```

`services/stage-engine/src/lib/supabase.ts:12-21`:

```ts
/**
 * Service-role client — bypasses RLS.
 * Used for: API key hash lookups in platform_api_key,
 * loading identity context, admin operations.
 * NEVER expose this client to user-facing code.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
);
```

`services/stage-engine/src/core/agent-router.ts:721-735` populates `toolContext.supabaseAdmin`
with the same global service-role instance — every capability tool invocation in agent mode
receives the RLS-bypassing client.

### RLS posture on `timesheet.time_entry` (defense-in-depth would have caught this — but is bypassed)

`supabase/migrations/20260324090000_timesheet_schema.sql:57-96`:

```sql
ALTER TABLE timesheet.time_entry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_time_entry" ON timesheet.time_entry
  FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_time_entry" ON timesheet.time_entry
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());
```

JWT + API key reads ARE workspace-scoped. Service-role is not. Postgres semantics: RLS does NOT
apply to `BYPASSRLS` roles, and `service_role` has `BYPASSRLS` by default. The application code
is the only line of defense for service-role queries — and on `on_duty` that line is missing.

### Blast Radius

#### What the leak DOES NOT do (defenses in depth that hold)

The fan-out helper `fn_publish_announcement_notifications`
(`supabase/migrations/20260620140300_fn_publish_announcement_notifications.sql:78-86`) joins
`channel_member cmem` filtered by `channel_id = p_channel_id`. Channels belong to one workspace
(checked in the parent RPC `publish_announcement_atomic.sql:33-39` —
`CHANNEL_WORKSPACE_MISMATCH` fail-fast on cross-workspace channel injection). Cross-tenant
profile_ids that arrive in `p_target_profile_ids` therefore CANNOT match any `cmem.profile_id`
for `p_channel_id`, so:

- No notification_outbox rows are created for foreign-workspace recipients.
- No push/in_app/email is delivered cross-tenant.

`channel_member.workspace_id` (`supabase/migrations/20260422300000_channel_communications.sql:174-181`)
plus the channel-to-workspace 1:1 FK means the JOIN is a natural workspace-scope filter.

#### What the leak DOES do (4 side channels — all exploitable)

1. **Persisted PII on `channel_message.target_profile_ids`** —
   `publish_announcement_atomic.sql:78` inserts `p_target_profile_ids` as-is into the row's
   `target_profile_ids` UUID array column. The RPC does NOT validate that those UUIDs belong
   to `p_workspace_id`. Result: a workspace-A row contains workspace-B/C/D profile_ids. RLS on
   `channel_message` keeps that row visible to workspace-A only, but the cross-tenant UUIDs are
   now permanently stored as PII inside workspace A — discoverable to any workspace-A admin/user
   with read access. Compliance impact: GDPR Article 5(1)(f) integrity/confidentiality of
   processing — PII of data subjects belonging to OTHER controllers is now under workspace-A's
   custodianship without legal basis.

2. **Information disclosure via InlineConfirmCard draft phase** —
   `publish-announcement.ts:282-298` returns `recipient_count: resolved.count` and
   `metadata: [{ label: "Mottakere", value: resolved.label }]` (label is e.g. `"På vakt (47)"`)
   on the draft response BEFORE any commit. Botsson voices that number to the manager. The
   "47" is the global on-duty count across ALL workspaces. A manager at a 10-employee
   restaurant requesting `on_duty` audience would see and hear an inflated count, leaking a
   running tally of every clocked-in worker in the platform.

3. **Telemetry/analytics leak** —
   `publish-announcement.ts:303-312` (draft) and `:384-398` (commit) emit
   `inline_confirm_card.shown` + `channel.message.sent` (via `emitAnnouncementPublished`)
   with `recipient_count`/`target_profile_count` populated from the cross-tenant resolution.
   The telemetry destinations include PostHog (analytics-side leak),
   `activity_trail` (audit-trail leak), and `engine_event` (workflow-runtime leak). All four
   `emit()` destinations carry the inflated count under `workspace_id = ctx.workspaceId`,
   silently misattributing foreign-workspace activity to the calling workspace's
   metrics/audit/event surface.

4. **Resume-phase amplification mitigated by accident** —
   `publish-announcement.ts:342-352` (DEFENSE 3, ADR-0398) forces `audience_kind = "all"` when
   `proposal_id != null`. This narrows the resume-attack surface (a captured/forged proposal_id
   cannot re-trigger `on_duty` resolution on commit), but the original draft-phase leak still
   fires on the FIRST call. The defense is forward-only, not retroactive.

### Test scenario walked (mental, code-traced — not executed)

Preconditions:
- Workspace A has 1 manager (auth.uid() = u_A, profile_id = p_A, manager+ in workspace_A).
- Workspace A has a news channel `chan_A` with members [p_A, p_A_emp1, p_A_emp2].
- Workspace B has 30 employees, 15 clocked in (`punch_out IS NULL` on `timesheet.time_entry`).
- Workspace C has 20 employees, 10 clocked in.
- Workspace A has 0 employees currently clocked in.

Trace:
1. Manager u_A invokes `publish_announcement` via Botsson chat with
   `audience_kind = "on_duty"`, `channel_id = chan_A`.
2. `agent-router.ts:721` builds `toolContext` with `supabaseAdmin` = global service-role client.
3. `publish-announcement.ts:184` aliases `supabase = ctx.supabaseAdmin`.
4. `publish-announcement.ts:189-199` `callGateAction(communication, publish_announcement_atomic)` PASSES
   (u_A IS manager in workspace A, gate evaluates correctly).
5. `publish-announcement.ts:202-211` channel-membership check PASSES (p_A IS member of chan_A).
6. `publish-announcement.ts:217-220` `isAiAllowedInChannel(chan_A, "text", false)` PASSES
   (assuming default policy).
7. `publish-announcement.ts:237` calls `resolveAudience(serviceRoleClient, workspace_A_id, {kind: "on_duty"})`.
8. `audience-resolver.ts:63-68` issues `SELECT profile_id FROM timesheet.time_entry WHERE punch_out IS NULL LIMIT 500`
   under service-role → returns 25 profile_ids: 15 from workspace_B + 10 from workspace_C +
   0 from workspace_A. (Workspace A is the legitimate target; it has 0 entries. The result
   set contains zero workspace-A rows.)
9. `audience-resolver.ts:70-73` returns `{ profileIds: [25 foreign UUIDs], count: 25, label: "På vakt (25)" }`.
10. `publish-announcement.ts:242-244` `count !== 0` → does not short-circuit.
11. `publish-announcement.ts:251-259` precheck gate (`publish_announcement` draft) PASSES.
12. `publish-announcement.ts:269-321` draft phase: returns InlineConfirmCardDescriptor with
    `recipient_count: 25`, `metadata: [{label: "Mottakere", value: "På vakt (25)"}]` to Botsson.
    **First leak: u_A's UI/voice now displays "På vakt (25)" — the cross-tenant headline count.**
13. `publish-announcement.ts:303-312` emit `inline_confirm_card.shown` with
    `workspace_id: workspace_A_id, recipient_count: 25`. **Second leak: cross-tenant count
    persisted to PostHog + activity_trail + engine_event under workspace_A.**
14. Manager taps "Publiser" on the card → tool re-invoked with `confirm=true, proposal_id=<draft uuid>`.
15. `publish-announcement.ts:342` `effectiveAudience = {kind: "all"}` (DEFENSE 3 fires correctly
    because `proposal_id != null`). Audience IS re-resolved as `all` for workspace_A_id (clean).
16. `publish-announcement.ts:357-374` RPC `publish_announcement_atomic` called with
    `p_target_profile_ids: <workspace_A all members>` (clean — DEFENSE 3 saved the commit phase).
17. `publish-announcement.ts:384-398` emit `channel.message.sent` with `target_profile_count`
    from the re-resolved (clean) `effectiveResolved`. Commit-phase telemetry IS clean.

Net of the trace:
- Cross-tenant count + label DOES reach Botsson and the manager (Leak Channel #2).
- Cross-tenant count + label DOES persist to PostHog/activity_trail/engine_event in DRAFT
  emit (Leak Channel #3, draft only).
- Cross-tenant profile_ids DO NOT reach `channel_message.target_profile_ids` on commit
  (DEFENSE 3 forces `kind: "all"`, so Leak Channel #1 is dormant unless `proposal_id` is
  absent — see "Without-proposal_id variant" below).
- Cross-tenant profile_ids DO NOT receive notifications (`channel_member` JOIN filter).

#### Without-proposal_id variant (Leak Channel #1 fires)

If a client calls `publish_announcement` with `confirm=true` and NO `proposal_id` (legitimate
per the schema — `proposal_id` is optional, line 158-166), DEFENSE 3 does NOT fire (line 342
condition `params.proposal_id != null` is false), and the body-supplied `audience_kind = "on_duty"`
flows through to the RPC. In that case `p_target_profile_ids` IS populated with cross-tenant
UUIDs and Leak Channel #1 (persisted PII on the row) fires. The current InlineConfirmCard flow
always sets `proposal_id`, but the tool API does NOT require it — any future caller (page tool,
direct API, automated test, alternative HITL primitive) that skips the card and commits directly
will trigger the persistence leak.

## Sortie D Gate

**PROCEED-IMMEDIATELY**

Rationale:
- Leak channels #2 and #3 are LIVE and require only a happy-path call (no forged input,
  no privilege escalation, no auth bypass) — any manager+ user in any workspace triggers
  them by composing an `on_duty` announcement via Botsson. Detection requires inspecting
  the resolver call, which no current test covers.
- Leak channel #1 is dormant under the current InlineConfirmCard flow but ARMED for any
  future commit-without-proposal_id caller. ADR-0398 DEFENSE 3 is not a fix for the root
  cause; it is a downstream mitigation for one specific pathway.
- Leak channel #4 (telemetry under wrong workspace_id) corrupts metrics and audit-trail —
  same class as the L-0177 silent-fallback bans Pontus has called out repeatedly.

Fix scope (estimate):
- 1-line code fix on `audience-resolver.ts:63-68` (add `.eq("workspace_id", workspaceId)`).
- 1-line code fix on `use-audience-resolver.ts:51-56` (same — keeps mirror in sync; this
  surface is anon-key + RLS so it is NOT exploitable from the browser, but the asymmetry
  with the server resolver invites future drift and L-0176-class docstring divergence).
- Add RPC-level validation in `publish_announcement_atomic`:
  `WHERE profile_id = ANY(p_target_profile_ids) AND workspace_id = p_workspace_id` to
  filter `p_target_profile_ids` to in-workspace IDs only (defense in depth — keeps the row
  clean even if a future capability tool forgets the filter). Sortie D should choose code
  fix + RPC defense in depth.
- Add regression unit test `publishAnnouncement.test.ts` asserting that calling
  `audience_kind = "on_duty"` against a 2-workspace fixture returns ONLY workspace-A
  profile_ids (this prevents recurrence).

Priority gate: PROCEED-IMMEDIATELY, ahead of any feature work touching `communication`
capability or InlineConfirmCard surfaces. Recommend Sortie D before any new tool registers
the `communication` capability or adds an `audience_kind`-aware surface.

## Confidence

**HIGH**

Reasons:
- Bug is a one-line code asymmetry visible by direct diff between sibling branches in the
  same file (lines 48-56, 76-114, 116-136 all filter; 59-73 does not).
- Client construction confirmed in two independent places (`stage-engine/src/lib/supabase.ts`
  + `agent-router.ts:721-735`) — both populate `toolContext.supabaseAdmin` with the
  RLS-bypassing global instance.
- RLS posture on `timesheet.time_entry` confirmed in migration source
  (`20260324090000_timesheet_schema.sql:57-96`); RLS exists but does not gate service-role.
- Downstream defense (`channel_member` JOIN in fan-out) confirmed in
  `20260620140300_fn_publish_announcement_notifications.sql:78-86` — accurately bounds
  the blast radius to side channels, NOT to notification delivery.
- DEFENSE 3 (ADR-0398) read from `publish-announcement.ts:329-352` — confirmed it narrows
  the commit-phase write-leak (#1) but does NOT mitigate the draft-phase read-leak (#2, #3).
- No existing test in `publishAnnouncement.test.ts` covers the cross-tenant `on_duty`
  scenario (grep clean).

Residual uncertainty (low):
- I did not enumerate ALL future or speculative callers of `publish_announcement` — the
  proposal_id-absent variant of Leak Channel #1 is conditional on a caller that skips
  InlineConfirmCard. Treat that channel as ARMED-NOT-EXPLOITED today, EXPLOITED tomorrow.
- I did not run live SQL against either local or cloud Supabase — verdict is code-traced.
  An empirical reproduction would harden the verdict but is not required to gate Sortie D
  given the directness of the missing filter.

## Files cited (absolute paths)

- `/home/sxtnl/dev/smartout.ai-wt-8/packages/ai/src/capabilities/communication/audience-resolver.ts`
- `/home/sxtnl/dev/smartout.ai-wt-8/packages/ai/src/capabilities/communication/publish-announcement.ts`
- `/home/sxtnl/dev/smartout.ai-wt-8/apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts`
- `/home/sxtnl/dev/smartout.ai-wt-8/services/stage-engine/src/lib/supabase.ts`
- `/home/sxtnl/dev/smartout.ai-wt-8/services/stage-engine/src/core/agent-router.ts`
- `/home/sxtnl/dev/smartout.ai-wt-8/supabase/migrations/20260324090000_timesheet_schema.sql`
- `/home/sxtnl/dev/smartout.ai-wt-8/supabase/migrations/20260620140400_publish_announcement_atomic_rpc.sql`
- `/home/sxtnl/dev/smartout.ai-wt-8/supabase/migrations/20260620140300_fn_publish_announcement_notifications.sql`
- `/home/sxtnl/dev/smartout.ai-wt-8/supabase/migrations/20260422300000_channel_communications.sql`
- `/home/sxtnl/dev/smartout.ai-wt-8/packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.test.ts`
