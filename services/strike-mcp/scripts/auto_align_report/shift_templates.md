# shift_templates alignment report

**Target table:** `public.schedule_template` — **BLOCKED**
**Status:** 🔴 BLOCKED | confirmed: 0 / dropped: 7 / review: 4 / blockers: 1
**Bubble type:** `shift_template`
**Total records:** 75

## Summary

- 0 fields auto-confirmed (safe matches)
- 7 fields dropped (no v3 equivalent)
- 4 fields in review queue (type conflicts, ambiguous, collisions)
- 1 blockers (NOT NULL v3 columns without mapping)

## Blockers

These v3 columns are NOT NULL with no DEFAULT and have no Bubble source field:

- `name`

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `_id` | `id` | `—` | collision with id | manual decision required |
| `Created By` | `created_by` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | manual decision required |
| `🏠 Department` | `department` | `text` | entity blocked due to NOT NULL constraint(s) without mapping | manual decision required |
| `id` | `id` | `—` | collision with _id | manual decision required |

## Dropped fields

### Always populated (100%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `Start date` | 100% | No v3 column "start_date" on table public.schedule_template |
| `Created Date` | 100% | No v3 column "created_date" on table public.schedule_template |
| `Modified Date` | 100% | No v3 column "modified_date" on table public.schedule_template |

### Mostly populated (>50%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `🏰 Workspace` | 97% | No v3 column "workspace" on table public.schedule_template |
| `Title` | 95% | No v3 column "title" on table public.schedule_template |

### Sparse (<50%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `Days` | 1% | No v3 column "days" on table public.schedule_template |
| `Description` | 5% | No v3 column "description" on table public.schedule_template |
