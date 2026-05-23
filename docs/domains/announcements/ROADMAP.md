---
title: "Announcements Domain — Roadmap"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: announcements
tags: [announcements, roadmap, wave-a, wave-b, kind, tier, entity-link, celebration]
mirror: aspirational
last_verified: 2026-05-23
---

# Announcements — Roadmap

> Forward plan + shipped history. Claims here are aspirational unless marked "SHIPPED". References governing ADRs, specs, plans, and handoffs as dated sources — never absorbs them.

---

## Governing ADRs

| ADR | Title | Status |
|---|---|---|
| ADR-0369 | Announcement Atomicity — RPC-Body Fan-Out | accepted — V2 must implement Option B |
| ADR-0370 | Capability Boundary for Announcement Surface | accepted — extend `communication` capability |
| ADR-0371 | Announcement Schema Contract — Tool API Preserved | accepted — keep `{title, body}` |
| ADR-0372 | Bursdag Auto-Publish Pipe (celebration branch) | accepted |
| ADR-0078 | Voice Channel Restrictions | accepted — no voice announcements |
| ADR-0133 | Mobile Surface Boundary | accepted — mobile read-only |
| ADR-0157 | Direct Supabase Mutations vs Server Actions | accepted — 2 direct hooks allowed |
| ADR-0189 | `broadcast.send` Capability Seed | accepted |
| ADR-0204 | Gated Mutation Wrapper | accepted — agent path uses it |
| ADR-0331 | Dagslinjen Audience JSONB vs Junction | accepted |

---

## Council Learnings (Live Debt)

These learnings emerged from the Wave B v1 council rejection (2026-05-18). They remain live operational debt for any future announcement-related work.

| Learning | File | What it says |
|---|---|---|
| L-0312 | `docs/learnings/0312-set-constraints-all-deferred-does-not-defer-triggers.md` | `SET CONSTRAINTS ALL DEFERRED` only defers DEFERRABLE FK/UNIQUE constraints, NOT plain `AFTER INSERT` triggers. The notification trigger fires at statement end, not at COMMIT. |
| L-0313 | `docs/learnings/0313-phase-2-5-grep-must-search-alter-type-add-value.md` | When checking enum presence, grep for `ALTER TYPE ... ADD VALUE` not just `CREATE TYPE`. Values added mid-migration series are invisible to naive type-name grep. |
| L-0314 | `docs/learnings/0314-capability-key-drift-between-spec-pseudocode-and-router.md` | Capability key in spec pseudocode ≠ capability key in production body. Always verify the actual `callGateAction` call in the tool file, not the spec. |
| L-0315 | `docs/learnings/0315-callgateaction-signature-positional-not-callback.md` | `callGateAction` signature is positional, not callback-style. Match the exact production signature. |

---

## Wave A — Shipped ✅

**Specs and plans (dated sources):**
- `docs/modules/announcments/nyheter/project/docs/plans/PLAN-nyheter-engagement-wave-a.md` — completed Wave A plan
- `docs/HANDOFF-nyheter-engagement-wave-a.md` — closure handoff

**What shipped:**
- Notification priority branching (`announcement_notification_priority.sql`) — `priority=1, mode='work'`
- Audience picker with 5 kinds + live recipient count pill
- Pin/unpin + PinnedStrip sticky scroller
- Per-card reactions + read-receipt aggregation (per-card; batch-fetch pending)
- `ComposeAnnouncement` modal inside the bulletin board
- Agent capability `publish_announcement` with two-call confirm pattern

---

## Wave B v1 — REJECTED 2026-05-18

**Spec (v1):** `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md`

Failed council review with 6 blockers + 7 must-fixes. Trust Gate 8/8 FAIL. Three architectural decisions extracted and locked as ADRs (0369, 0370, 0371). Four learnings logged (L-0312–0315).

Key blockers:
1. `SET CONSTRAINTS ALL DEFERRED` does not defer plain triggers → notification fan-out would silently use wrong tier (ADR-0369).
2. Spec pseudocode used `broadcast.send` capability key but production code uses `communication` (ADR-0370).
3. Spec collapsed `{title, body}` → `{content}` without breaking-change ADR (ADR-0371).
4. `PGRST203` overload ambiguity risk (resolved in M17).
5. Missing `search_path = public` on SECURITY DEFINER RPC.
6. Incorrect `announcement_kind` enum values vs Phase 2.5 grep findings.

---

## Wave B v2 — APPROVED-PENDING-CODE

**Spec (v2):** `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md` — `status: accepted`, `council_verdict: APPROVED-PENDING-CODE`

**Plan:** `docs/superpowers/plans/2026-05-18-announcement-kind-tier-link.md`

**Handoffs:** `docs/HANDOFF-announce-kind-tier-link.md`, `docs/HANDOFF-announce-v2-bursdag-pipe.md`

**What shipped (DB and backend):**
- `announcement_enums.sql` (M1) — 3 new enum types
- `announcement_meta_table.sql` (M2) — sidecar table
- `fn_publish_announcement_notifications.sql` (M3) — fan-out helper
- `publish_announcement_atomic_rpc.sql` (M4) — atomic RPC Option B
- `channel_message_trigger_announcement_guard.sql` (M5) — trigger guard
- `get_channel_messages_announcement_columns.sql` (M6) — extended return shape
- `announcement_kind_add_celebration_and_system_message.sql` (M7) — celebration + system_message kind values
- `publish_announcement_atomic_celebration_branch.sql` (M13) — ADR-0372 celebration branch
- `publish_announcement_atomic_celebration_branch_fix.sql` (M16) — bug fix
- `drop_publish_announcement_atomic_14param_overload.sql` (M17) — PGRST203 prevention
- `emit-announcement-events.ts` — shared emit helper
- `TierBadge.tsx` (mobile) — tier visualization on system bubble
- `EntityLinkCTA.tsx` (mobile) — deferred mount (Track G)

**Deferred (Track E / Track G):**
- `AnnouncementKindPicker.tsx` — composer kind selector
- `AnnouncementTierPicker.tsx` — composer tier selector
- `EntityLinkPicker.tsx` — composer entity link selector
- `EntityLinkCTA` mobile mount (Track G)
- Web kind/tier picker integration into all 4 composer doors

---

## Celebration Branch — Shipped ✅

**Spec:** `docs/superpowers/specs/2026-05-11-botsson-publishannouncement-capability.md` (partial — celebration extension)

**ADR:** ADR-0372 (`docs/decisions/0372-bursdag-auto-publish-pipe.md`)

**Handoff:** `docs/HANDOFF-announce-v2-bursdag-pipe.md`

Service-role-only path in `publish_announcement_atomic`. JWT callers receive `CELEBRATION_SERVICE_ROLE_ONLY`. `celebration_publication` table provides idempotency gate (once per birthday per workspace per day).

---

## Botsson publishAnnouncement Capability — Shipped ✅

**Spec:** `docs/superpowers/specs/2026-05-11-botsson-publishannouncement-capability.md`

**Plan:** `docs/superpowers/plans/PLAN-botsson-publishannouncement-capability.md`

**Handoff:** `docs/HANDOFF-botsson-publishannouncement-capability.md`

Capability lives in `packages/ai/src/capabilities/communication/` (communication domain, ADR-0240 + ADR-0370). 4 journeys authored. Tests at `publishAnnouncement.test.ts` + `publishCelebrationBirthday.test.ts`.

---

## E2E Stabilize — In Progress

**Handoff:** `docs/HANDOFF-e2e-nyheter-stabilize.md`

**Journey:** `docs/journeys/JOURNEY-e2e-nyheter-stabilize-all-specs-green.md`

Open sortie `feat/e2e-nyheter-stabilize`. See `E2E-COVERAGE.md` for current matrix.

---

## Candidate Future Phases (Unsequenced)

| Candidate | Closes | Notes |
|---|---|---|
| Kind/Tier picker UI (Track E) | Wave B pickers deferred | `AnnouncementKindPicker` + `AnnouncementTierPicker` in all 4 composer doors |
| EntityLinkPicker web + EntityLinkCTA mobile mount (Track G) | Entity link deferred | Component exists on mobile; web picker and mobile mount pending |
| Mobile bulletin layout | GAPS §M1 | Dedicated card-feed layout on mobile; pinned strip; reactions |
| Home widget (employee) | GAPS §M2 | Latest announcements on employee home surface (both web + mobile) |
| Audience resolver consolidation | GAPS §C1 | Single shared resolver; web + agent adapters |
| Capability-gate harmonization | GAPS §C2 | Route `use-send-announcement` + `use-send-broadcast` through capability gate |
| Read-receipt batch fetch | GAPS §P1 | `fn_news_read_receipts_batch` RPC; N-query-per-card eliminated |
| Norwegian i18n completion | GAPS §I1 | Missing `nyheter.*` keys in nb locale |
| Scheduled publish | GAPS §F1 | `publish_at` column + cron consumer |
| Edit-after-publish | GAPS §F2 | Edit composer + "edited" indicator |
| Expiry / auto-archive | GAPS §F3 | `expires_at` + cron cleanup |
| Chat "+" inline-attach | GAPS §UX1 | Plus-icon in chat composer to publish announcement in-thread |
