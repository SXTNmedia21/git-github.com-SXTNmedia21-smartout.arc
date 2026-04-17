---
title: Phase 3.5a Discovery Findings — Strøm Mat & Bar
status: done
created: 2026-04-08
updated: 2026-04-08
module: strike-mcp
tags: [discovery, bubble, phase-3.5a]
---

# Phase 3.5a Discovery Findings

**Date:** 2026-04-08
**Target workspace:** Strøm Mat & Bar (`1675220407080x794481244847879300`)
**Method:** `scripts/run_discovery.ts` using strike-mcp internals as library
**Bubble endpoint:** `https://smartout.io/version-test/api/1.1/obj/<type>` (test branch)

## Result: 20/20 entities discovered, 0 failures

After correcting `src/entities.ts` with real Bubble type names from the `/api/1.1/meta` endpoint, all 20 target entities produced valid mappings.

---

## Corrections from the original Phase 4-6 plans

The original plans (now deprecated per council review) assumed plain ASCII Bubble type names. Reality is much messier — many types have emoji prefixes, some don't exist, some are split across multiple types.

### Entities that worked as planned

| strike-mcp name | Bubble type | Records |
|---|---|---|
| workspace | `workspace` | 40 |
| locations | `location` | 217 |
| departments | `department` | 79 |
| users | `User` (note capitalization) | 655 |
| shifts | `shift_satellite` | 25,333 |
| shift_templates | `shift_template` | 75 |
| tasks | `task` | 373 |

### Entities corrected to emoji-prefixed types

| strike-mcp name | Original guess | Real Bubble type | Records |
|---|---|---|---|
| teams | `team` (404) | `🎎team` | ~237 |
| training | `training` (404) | `🎎training` | ~756 |
| supplements | `supplement` (404) | `⏱️salary_type(supplement)` | ~117 |
| inventory | `inventory_item` (404) | `🏰invetory` (Bubble has typo — missing 'n') | 32 |
| handbooks (was "manuals") | `manual` (404) | `handbook` | 26 |

### Entities split into multiple types

The original plan had a single `rules` entity. Bubble actually has **5 distinct rule types**:

| strike-mcp name | Bubble type | Records |
|---|---|---|
| salary_rules | `⏱️salary_rule` | 0 |
| time_rules | `🕹️timerule` | 0 |
| rule_templates | `🕹️ruletemplate` | 0 |
| timeperiod_rules | `🔥timeperiod_rule` | ~148 |
| punchclock_rules | `🕹️⏱️punchclock_rules` | ~128 |

The first three have **zero records** in Strøm Mat & Bar — they may be deprecated or unused in production. The zero-records attestation gate will flag these in the Phase 3.5b review step; the human can attest `known_empty_source: true` to skip them for this workspace.

### Entities removed

**`routines`** — does not exist in Bubble `/meta` endpoint. No `routine` type, no close matches. Removed from registry entirely.

### New entities discovered

Bubble has entities we hadn't planned for:

| strike-mcp name | Bubble type | Records | Why this matters |
|---|---|---|---|
| profiles | `profile` | 684 | **Separate** from `User` (655 records). Likely the operational HR record — maps to v3 `profile` table directly. |
| invitations | `🎎invitation` | 39 | Bubble **already has** an invitation system. Perfect match for v3 `invitation` table. Likely solves the auth.users handoff problem elegantly. |
| subtasks | `subtask` | 215 | Tasks have subtasks — v3 may need this (or may fold into `task` with parent_id). |

---

## Other Bubble types observed (not yet in registry)

The `/meta` endpoint returned 106 types total. Beyond what we captured, Bubble has:

### Employment / HR
- `⏱️employment_profile`, `⏱️employment_contract`, `⏱️employee_type`, `⏱️employee_request`, `⏱️employee_accounts`, `⏱️employee_accounts_transactions`
- `⏱️basesalary`, `⏱️timesheet`, `⏱️swaprecord`

### Communication
- `channel`, `message`, `notifications🚫`, `notifyprofile`, `emailtemplate`

### Learning / gamification
- `handbook.challenge`, `handbook.stage`, `🎓detail`, `🕹️achivment`, `🕹️milestone`, `🕹️dayplan`, `🕹️daylog`, `🕹️dayinstuction(note)`, `🕹️job_log`, `🕹️leaderboard`, `🕹️week_goal`

### Payroll (Tier 3 — likely archive)
- `🗓️payroll`, `🗓️record`, `🗓️salarylog`, `🗓️schedule`
- `payroll.details`, `⏱️salary_transaction(salary_detail)`

### Wine bar / F&B (Strøm is Mat & Bar)
- `🍾product`, `🍾menues`, `🍾controllist`, `🍾record`, `🍾storage`, `🍾delete🚫`
- `🌏country🚫`, `🌏grape🚫`, `🌏region🚫`

### Stripe / billing
- `💳stripecustomer`, `💳stripecycle`, `💳stripeemail`, `💳stripemodule`, `💳stripemodulepricing`, `💳stripepaymentproof`, `💳stripepricing`, `💳stripesinglepayment`, `💳stripesubscription`

### Other
- `activity`, `content`, `newlead`, `player`, `question`, `question.option`
- `user_ai`, `user_data`, `user_info`, `user🔑access`
- `✨aicomplitonlog`, `✨ailog`
- `🎎cache.schedule`, `🎎operation`, `🎎pastexperience`, `🎎preferences`
- `🏰company`, `🏰preferences`
- `🗃️category`
- `🚀donerecord`, `🚀record🚫`
- `🧾contracttemplate`

**Per the strike-mcp spec**, Tier 3 (historical payroll, Stripe, old contracts) stays in Bubble for archive. Communication and learning/gamification are out of scope unless v3 has equivalent tables. Wine-bar-specific data depends on whether v3 has an inventory module.

---

## Field shape observations

### Bubble field names are chaos

Real fields observed across mappings:
- Emoji-prefixed: `🎎 Manager`, `🏰 Company`, `🏰 Shiftplan`, `🎎 Profile`, `user🔑Access`
- Leading-space: ` ℹ️channel`
- Dot-notation: `workspace.Json`, `data.json`
- With emoji suffix: `date.start 🟢`, `_payrollType 🟢`
- Mixed case: `Created By`, `Created Date`, `First name`, `Modified Date`
- Plain snake_case: `name_text`, `email_text`, `list_admin_keys`

Phase 3.5b review ritual will need to handle all of these when matching against v3 columns (which are uniformly snake_case singular).

### Records are sparse

Across all entities, many records have fields populated only on newer records. The `research_entity` first-N + last-N sampling strategy captured both ends, so the mappings have good field coverage — but occurrence counts vary wildly (some fields 100%, some <5%).

Phase 3.5b review ritual will warn on fields where `v3_column.NOT NULL` but source `occurrence_count < sample_record_count`.

---

## Next steps (Phase 3.5b)

1. **Parse `v3_schema.json`** (already done — 229 tables)
2. **Human review** via `scripts/review_mapping.ts` — walk through each of the 20 mappings field-by-field
3. **Target_table selection** per entity — match Bubble entity to v3 table
4. **Field alignment** — for each Bubble field, pick v3 column or skip
5. **Zero-records attestation** for `salary_rules`, `time_rules`, `rule_templates`
6. **Decide auth.users strategy** for `users`/`profiles`/`invitations` — council recommended Option A (skip auth.users, use email-UUID + invitation flow)

## Known gaps for Phase 3.5c

When we get to validation:
- `profile.profile_code` is NOT NULL but no Bubble equivalent — must be synthesized
- `profile.company_id` is NOT NULL — must be derived from workspace
- `profile.departments` and `.locations` are `uuid[]` — need `fk_uuid_array` transform (already added in Step 0)
- `handle_new_user()` trigger on `auth.users` must be disabled during migration apply
- RLS policies must be verified via non-service-role readback after apply

All of these are tracked in the Step 0 commits and the council review.

---

## Commits

- `65d67ef` — `.env.example` workspace selection note
- `148a18f` — `1721526` — `6711bbf` — `75038d2` — `263a854` — `e8a3d81` — Step 0 pre-flight fixes
- `6e70f8b` — v3 schema parser
- `e4bfb7a` — run_discovery.ts + scripts/lib/discovery.ts
- `5e3f2d7` — review_mapping.ts + scripts/lib/review.ts
- `(current)` — entities.ts correction + 20 real mappings committed
- `8cb65b7` — v3_schema.json snapshot + gen script
