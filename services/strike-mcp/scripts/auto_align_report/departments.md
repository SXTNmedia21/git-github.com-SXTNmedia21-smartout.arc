# departments alignment report

**Target table:** `public.department`
**Status:** 🟢 ok | confirmed: 1 / dropped: 0 / review: 4 / blockers: 0
**Bubble type:** `department`
**Total records:** 6

## Summary

- 1 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 4 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `_id` | `department_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:department` |
| `🏰 Workspace` | `workspace_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:workspace` |

## Auto-confirmed fields

<details>
<summary>Show 1 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `Titel` | `name` | `text` | trim |
</details>
