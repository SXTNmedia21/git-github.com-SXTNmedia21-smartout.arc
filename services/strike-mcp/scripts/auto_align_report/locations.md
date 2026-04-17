# locations alignment report

**Target table:** `public.location`
**Status:** 🟢 ok | confirmed: 4 / dropped: 0 / review: 4 / blockers: 0
**Bubble type:** `location`
**Total records:** 19

## Summary

- 4 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 4 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `🏰 Workspace` | `workspace_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:workspace` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `_id` | `location_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:location` |

## Auto-confirmed fields

<details>
<summary>Show 4 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `Active` | `is_active` | `boolean` | — |
| `Title` | `name` | `text` | trim |
| `Sort` | `sort_order` | `integer` | — |
| `Description` | `description` | `text` | trim |
</details>
