# shifts alignment report

**Target table:** `public.schedule_shift`
**Status:** 🟢 ok | confirmed: 3 / dropped: 0 / review: 7 / blockers: 0
**Bubble type:** `shift`
**Total records:** 2750

## Summary

- 3 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 7 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `teamId` | `team_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:team` |
| `_id` | `schedule_shift_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:shift` |
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `profileId` | `employee_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:profile` |
| `departmentId` | `department_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:department` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `workspace` | `workspace_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:workspace` |

## Auto-confirmed fields

<details>
<summary>Show 3 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `durationsSeconds` | `work_hours` | `numeric` | seconds_to_hours |
| `isLive?` | `is_published` | `boolean` | — |
| `shiftType` | `role` | `text` | trim |
</details>
