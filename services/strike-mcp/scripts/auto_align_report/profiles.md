# profiles alignment report

**Target table:** `public.profile`
**Status:** 🟢 ok | confirmed: 3 / dropped: 0 / review: 6 / blockers: 0
**Bubble type:** `profile`
**Total records:** 135

## Summary

- 3 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 6 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `_id` | `profile_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:profile` |
| `User` | `user_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:user_identity` |
| `🏡 Department` | `department_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:department` |
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `🏰 Workspace` | `workspace_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:workspace` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |

## Auto-confirmed fields

<details>
<summary>Show 3 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `Profile Image` | `avatar_url` | `text` | trim |
| `Profile Name` | `display_name` | `text` | trim |
| `kioskCode` | `external_employee_number` | `text` | trim |
</details>
