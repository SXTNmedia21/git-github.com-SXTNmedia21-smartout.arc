---
title: "Agent 9 — Festival Setup Findings (08:00–14:00)"
created: 2026-05-25
agent: A9
slice: Festival-setup
status: complete
tags: [simulation, festival, pop-up, cascade, labor, capacity]
---

# A9 — Sjølyst Sommerfest: Setup Phase (08:00–14:00)

> Norwegian festival ops lens: 1200 guests, 60 staff, multi-vendor, one-day entity.
> All gaps code-traced to actual migration files or spec text.

---

## 1. Cascade model: can it accommodate a 1-day pop-up?

**Short answer: not by design, and barely by workaround.**

The cascade spec (`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md:62`) assumes:
- `I1 → D1–D6 → C1–C4` pipeline seeded at workspace creation
- `first_season_active` is a **required** bootstrap gate
  (`packages/ai/src/industry/packages/hospitality.ts:479`)
- `department_operating_hours` drives `session_hook` timing and is a
  structural dependency for any D6 production day

For Sjølyst Sommerfest: the festival is a **single workspace** (no multi-workspace nesting exists — see gap below), so you need to bootstrap a full workspace for a 1-day event. That means:

1. Full I1 bootstrap (7 gates, spread over 7 suggested days — hospitality.ts:407-528)
2. Create departments (Stage, Bar, Food Court, VIP, Security, Entrance) — permanent schema, `is_active BOOLEAN` only (`00002_structure_tables.sql:41`)
3. Bind a regulatory framework (`workspace_framework_binding` — one per workspace, enforced by the spec at line 120)
4. Create a season that wraps a single day

**Gap FES-1 (NEW):** `department.is_active` is a boolean toggle — there is no `valid_from`/`valid_until`/`dissolve_at` on the `department` table (`00002_structure_tables.sql:32-45`). Pop-up departments created for the festival cannot self-dissolve at 01:00. Someone must manually `is_active = false` per department. No D6 "decommission session" event is emitted at festival end to trigger cleanup. The cascade engine has no "temporary department" primitive — only permanent departments with an on/off switch.

**Severity:** MEDIUM — operational overhead, not data corruption. But at 01:00 after a festival, no one will remember to deactivate 7 departments.

---

## 2. Pop-up entity gap

**The D1 envelope has no concept of a temporary scope.**

Evidence:
- `department` table (`00002_structure_tables.sql:32–45`): 8 columns, no temporal bounds
- `planning_event` (`20260421100200_cascade_a1_domain_tables.sql:133–153`): has `event_date`/`end_date` and `demand_multiplier` — but this is a **D4 demand signal**, not a D1 structural entity. It tells the engine "expect 1200 covers on this date" — it does NOT create or dissolve departments or sessions
- `planning_event_category` enum (`20260421100100_cascade_a1_enums.sql:38`): values are `external_scraped`, `cultural_commercial`, `internal`, `weather`, `recurring` — no `event_operation` or `pop_up` category. A festival is not modeled as a first-class planning entity type; it would be forced into `internal` or `cultural_commercial`
- The cascade spec principle 6 (`spec:171`): **"No empty workspaces. Every workspace starts from I1 bootstrap."** A pop-up that dissolves after one day still leaves a persistent workspace, departments, season, and framework binding in the database

**FES-2 (NEW):** No mechanism to "archive workspace" post-event. Smartout has no workspace lifecycle state (`workspace.status` is not visible in migrations reviewed). A festival workspace will sit permanently in the tenant list. Production landmine at scale (100 festivals/year = 100 zombie workspaces).

**FES-3 (NEW):** `planning_event_category` enum lacks `pop_up_operation` value. Force-fitting a festival into `cultural_commercial` is semantically wrong and would corrupt D4 demand signal interpretation for the workspace. Adding enum values requires a migration.

---

## 3. Casual labor gap

**The `employment_form_enum` has `temporary` — but no `casual` or `one-day` variant.**

Traced evidence:
- `20260519100100_contracts_module_foundation.sql:45–51`: `employment_form_enum` values = `permanent`, `temporary`, `apprentice`, `practice`, `freelance`
- `20260503110000_employment_category_constraint_and_template_column.sql:10–11`: `employment_category` CHECK constraint = `'fast'`, `'deltid'`, `'tilkalling'` — `tilkalling` (on-call) is the closest match for casual festival workers, but it implies a recurring employment relationship, not a one-day engagement
- `20260519150000_contract_text_to_enum_cast.sql:160`: `employment_form` is NOT NULL. Every person added to the workspace needs a contract with one of the 5 enum values. There is no "no-contract, shift-only" path

**FES-4 (NEW — CRITICAL for ops):** For 60 one-day festival staff, Smartout requires:
1. Create a `profile` per person (full profile, workspace-scoped)
2. Create an `employment_contract` with NOT NULL `employment_form` (closest: `temporary`)
3. Create a `season` reference for the contract date range
4. `owner_contract_active` bootstrap gate blocks the workspace being "ready" until this is done

This is enormous setup overhead for people who are employed for ~14 hours. No "shift-only" or "casual-day" path exists. Øya festival hires 400 staff; Hovefestivalen had 1500+. This path is untenable at real festival scale.

**FES-5 (NEW):** Volunteer labor: `employment_form = NULL` is the de-facto volunteer signal in `20260515100100_employment_contract_tripletex_columns.sql:38` — "excluded from Tripletex sync". But `20260519150000_contract_text_to_enum_cast.sql:160` adds `SET NOT NULL` on `employment_form`. These two migrations are in direct conflict. A volunteer (who needs NULL `employment_form` per the tripletex semantics) would fail the NOT NULL constraint post-Wave 3. **This is a latent data integrity bug, not just a festival gap.** Any workspace with volunteers will hit this if contracts existed before the Wave 3 migration.

---

## 4. Multi-vendor sub-workspaces

**Not supported. No parent-child workspace relationship exists.**

Evidence searched:
- `grep "sub.workspace|parent_workspace|child_workspace"` across all migrations → 0 hits for structural table relationships
- `workspace_framework_binding` spec at line 120: "One workspace = one active framework at a time" — reinforces single-tenant assumption
- Multi-workspace references found (`20260608120000_sortie_a2_d6_rls_with_check.sql:309`) are about a **user being a member of multiple workspaces**, not a workspace containing sub-workspaces

**FES-6 (NEW):** Yara's 4 food vendors each have their own staff, their own POS, their own payroll. In Smartout today, they would need to be:
- **Option A:** 4 separate workspaces → 0 cross-visibility, 4 × bootstrap overhead, no unified festival view
- **Option B:** 4 departments inside one workspace → all vendor staff are peers under one `workspace_framework_binding` and one C4 governance config. Vendor A's manager cannot be isolated from Vendor B's data (no RLS partitioning below workspace level)

Neither option is clean. Option B is the pragmatic workaround, but it means the festival-wide workspace admin can see Taco Vendor's wage data — a GDPR violation if vendors are independent businesses. No vendor-scoped RLS policy mechanism exists.

---

## 5. All-hands announcement at 11:00 — 60-staff fanout

**Technically feasible but with a blocking prerequisite bug.**

The announcement fanout works via `fn_publish_announcement_notifications`
(`20260620140300_fn_publish_announcement_notifications.sql:6`), which fans out to all `channel_member` rows `WHERE left_at IS NULL AND NOT is_muted`.

For Magnus to reach all 60 staff:
- All 60 must be members of a single "all-hands" channel
- Channel must be set to `visibility_scope = 'all_members'`
  (`channel_message_visibility` enum has `'all_members'` — `20260422300000_channel_communications.sql:44`)

**FES-7 (DERIVED from BUG-1):** `engine_authority_config` is missing for `communication` capability (BUG-1 from BUGS.md). Until BUG-1 is fixed, `publish_announcement` is blocked entirely. Magnus cannot reach any staff — 0 of 60 get the pre-doors briefing. This is not a festival-specific gap, but it is a **show-stopper for every multi-staff deployment until BUG-1 is patched**.

**FES-8 (NEW):** No `channel_message_visibility` value for `'on_shift_only'`. At 11:00, Magnus wants to reach only staff *currently on site*. The current enum (`all_members`, `admins`, `targeted_members`) has no shift-aware targeting. He would have to manually pick 60 profile IDs for `targeted_members`, or blast `all_members` and include off-shift people who are not yet on site. For a 1200-guest event this is a real operational safety gap — pre-doors briefing must reach only confirmed on-site staff.

---

## 6. Real-time capacity counter at 14:00 doors-open

**No such capability exists anywhere in the schema.**

Evidence:
- `schedule_day_booking.guest_count` (`20260301600003_schedule_persistence_tables.sql:358`): this is a *per-booking* guest count for restaurant reservations — static at creation time, not a live gate counter
- Supabase realtime is subscribed for `schedule_shift`, `schedule_absence`, `schedule_day_booking`, `schedule_day_task`, `schedule_day_message` (`same file:596–601`) — no attendance scan table in the realtime publication
- No `ticket_scan`, `entry_log`, `crowd_count`, `gate_event` table found in any migration
- `deviation` table (`20260304200200_deviation_shift_approval.sql:42`): covers `safety`, `customer`, `procedure`, `system`, `material` domains — no `capacity_breach` or `crowd_safety` domain

**FES-9 (NEW):** Real-time crowd counting (Kasper scanning 1200 tickets in 90 min) is entirely outside Smartout scope. No `entry_event`, `scan_log`, or `capacity_counter` table exists. Worse: there is no integration hook — no `planning_event_source` value for `ticket_system_webhook` or similar. The gap is confirmed: external ticketing (TicketCo, Billetto, etc.) handles this. Smartout has no place to receive the count or display a live safety cap.

**FES-10 (NEW):** Even if a live count arrived, `deviation.domain` enum has no `crowd_safety` value. A crowd-surge at 80% capacity (960 guests) with rapid inflow cannot be logged as a safety deviation without forcing it into the generic `safety` domain with a free-text subcategory — no structured `crowd_surge` deviation type exists. For a post-event regulatory report (Politiet krav til arrangement §X), unstructured subcategories are insufficient.

---

## 7. Security incident logging

**Partial fit — with structural limitations.**

`deviation.domain` = `'safety'` with `subcategory TEXT` (`20260304200200_deviation_shift_approval.sql:50–52`) would need to carry "ejection", "medical", "crowd-surge" as free-text. The `deviation_severity` enum (`'low'`, `'medium'`, `'high'`, `'critical'`) does cover severity escalation for medical incidents.

**FES-11 (NEW):** `deviation.session_id` FK is to `department_session`, not to a festival-wide "event session". If Sigrid's security team spans multiple departments (they cover the entire site), a security deviation cannot be cleanly attached to a single `department_session`. It would need to be attached to the `Security` department session only, losing the cross-department context. A crowd surge near the Stage with Bar contributing is a multi-department event but the schema has no cross-department incident grouping.

---

## 8. Ticket scanning + wristband

**Confirmed out of scope.** No evidence of ticket scanning, NFC/QR wristband, or gate management in any migration or industry package. External system (TicketCo, Billetto, RFID provider) must own this entirely. No integration spine exists in the `external_system_connection` table that would accommodate a real-time scan feed (ADR-0203 integration A3 tables exist but with no festival-scan adapter defined).

---

## Summary table

| ID | Severity | Gap | Code ref |
|----|----------|-----|----------|
| FES-1 | MED | No `valid_until` on `department` — pop-up depts never auto-dissolve | `00002_structure_tables.sql:32–45` |
| FES-2 | MED | No workspace lifecycle/archive state — zombie workspaces post-event | workspace schema (no status column found) |
| FES-3 | LOW | `planning_event_category` lacks `pop_up_operation` enum value | `20260421100100_cascade_a1_enums.sql:38` |
| FES-4 | HIGH | No "shift-only" or "casual-day" labor path — 60 festival workers need full contracts | `20260519150000:160`, `20260503110000:10–11` |
| FES-5 | CRITICAL | Volunteer NULL `employment_form` conflicts with NOT NULL constraint from Wave 3 | `20260515100100:38` vs `20260519150000:160` |
| FES-6 | HIGH | No sub-workspace or vendor-scoped RLS — 4 vendors cannot be isolated | workspace schema + RLS policies |
| FES-7 | CRITICAL | BUG-1 blocks all announcements — derived from BUGS.md | `20260601100000_seed_communication_authority.sql` |
| FES-8 | MED | No `on_shift_only` visibility scope for announcements | `20260422300000_channel_communications.sql:44` |
| FES-9 | HIGH | Zero real-time crowd count / capacity tracking capability | no `entry_event` table found anywhere |
| FES-10 | MED | `deviation.domain` enum lacks `crowd_safety` — post-event police report gap | `20260304200200_deviation_shift_approval.sql:11–14` |
| FES-11 | MED | Security deviations cannot span multiple departments in one incident | `20260304200200_deviation_shift_approval.sql:46` |

---

## Cross-reference to BUGS.md (dedup)

- **FES-7** is a direct consequence of **BUG-1** (communication authority seed missing). Not a new bug — just a festival-scale amplification of a known critical.
- All other FES-N findings are genuinely new — not present in the 22 bugs from the 2026-05-23 sweep.
