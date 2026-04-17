# teams alignment report

**Target table:** `public.team`
**Status:** 🟢 ok | confirmed: 3 / dropped: 0 / review: 5 / blockers: 0
**Bubble type:** `🎎team`
**Total records:** 22

## Summary

- 3 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 5 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `🏰 Workspace` | `workspace_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:workspace` |
| `_id` | `team_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:team` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `🏠 Department` | `department_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:department` |

## Auto-confirmed fields

<details>
<summary>Show 3 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `Title` | `name` | `text` | trim |
| `🎨_pallet` | `color` | `text` | trim |
| `Description` | `description` | `text` | trim |
</details>
