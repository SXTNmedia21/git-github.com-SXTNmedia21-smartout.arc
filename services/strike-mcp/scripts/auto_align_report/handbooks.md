# handbooks alignment report

**Target table:** `public.runbook` — **BLOCKED**
**Status:** 🔴 BLOCKED | confirmed: 0 / dropped: 44 / review: 1 / blockers: 6
**Bubble type:** `handbook`
**Total records:** 26

## Summary

- 0 fields auto-confirmed (safe matches)
- 44 fields dropped (no v3 equivalent)
- 1 fields in review queue (type conflicts, ambiguous, collisions)
- 6 blockers (NOT NULL v3 columns without mapping)

## Blockers

These v3 columns are NOT NULL with no DEFAULT and have no Bubble source field:

- `protocol_id`
- `name`
- `trigger_event`
- `trigger_conditions`
- `escalation_chain`
- `control_list_id`

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `description` | `description` | `text` | entity blocked due to NOT NULL constraint(s) without mapping | manual decision required |

## Dropped fields

### Always populated (100%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `Created By` | 100% | No v3 column "created_by" on table public.runbook |
| `- Can be completed by badge quiz?` | 100% | No v3 column "can_be_completed_by_badge_quiz" on table public.runbook |
| `_status` | 100% | No v3 column "status" on table public.runbook |
| `Modified Date` | 100% | No v3 column "modified_date" on table public.runbook |
| `Created Date` | 100% | No v3 column "created_date" on table public.runbook |
| `_id` | 100% | No v3 column "id" on table public.runbook |
| `Title` | 100% | No v3 column "title" on table public.runbook |
| `workspace` | 100% | No v3 column "workspace" on table public.runbook |
| `- Must be completed in order?` | 100% | No v3 column "must_be_completed_in_order" on table public.runbook |

### Mostly populated (>50%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `handbook.challenges` | 65% | No v3 column "handbook_challenges" on table public.runbook |
| `Est. time (min)` | 65% | No v3 column "est_time_min" on table public.runbook |
| `enrolledCount` | 77% | No v3 column "enrolledcount" on table public.runbook |
| `_colorPallet` | 81% | No v3 column "colorpallet" on table public.runbook |
| `_handbookType` | 81% | No v3 column "handbooktype" on table public.runbook |
| `daysToComplete` | 69% | No v3 column "daystocomplete" on table public.runbook |

### Sparse (<50%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `coverImage` | 46% | No v3 column "coverimage" on table public.runbook |
| `badgeImageUrl` | 38% | No v3 column "badgeimageurl" on table public.runbook |
| `badgeImage` | 38% | No v3 column "badgeimage" on table public.runbook |
| `Post` | 19% | No v3 column "post" on table public.runbook |
| `rating` | 27% | No v3 column "rating" on table public.runbook |
| `achievedBy` | 27% | No v3 column "achievedby" on table public.runbook |
| `log_search` | 35% | No v3 column "log_search" on table public.runbook |
| `list of 📚category` | 35% | No v3 column "list_of_category" on table public.runbook |
| `validPeriod_days` | 19% | No v3 column "validperiod_days" on table public.runbook |
| `listofcontents` | 35% | No v3 column "listofcontents" on table public.runbook |
| `subTitle` | 50% | No v3 column "subtitle" on table public.runbook |
| `handbook.stages` | 42% | No v3 column "handbook_stages" on table public.runbook |
| `enrolled handbooks.logs` | 50% | No v3 column "enrolled_handbooks_logs" on table public.runbook |
| `_dataType` | 46% | No v3 column "datatype" on table public.runbook |
| `🏳️‍🌈 titles` | 31% | No v3 column "titles" on table public.runbook |
| `priority` | 31% | No v3 column "priority" on table public.runbook |
| `_userRole` | 31% | No v3 column "userrole" on table public.runbook |
| `- mandatory` | 35% | No v3 column "mandatory" on table public.runbook |
| `- Global?` | 35% | No v3 column "global" on table public.runbook |
| `🏳️‍🌈 descriptions` | 31% | No v3 column "descriptions" on table public.runbook |
| `list of teams` | 4% | No v3 column "list_of_teams" on table public.runbook |
| `department` | 4% | No v3 column "department" on table public.runbook |
| `parantId` | 31% | No v3 column "parantid" on table public.runbook |
| `🏳️‍🌈 subTitles` | 27% | No v3 column "subtitles" on table public.runbook |
| `- Certification?` | 27% | No v3 column "certification" on table public.runbook |
| `version` | 23% | No v3 column "version" on table public.runbook |
| `access🔑key` | 4% | No v3 column "access_key" on table public.runbook |
| `job` | 4% | No v3 column "job" on table public.runbook |
| `View count` | 19% | No v3 column "view_count" on table public.runbook |
