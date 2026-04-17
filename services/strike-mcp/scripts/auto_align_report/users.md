# users alignment report

**Target table:** `public.user_identity`
**Status:** 🟢 ok | confirmed: 3 / dropped: 0 / review: 4 / blockers: 0
**Bubble type:** `User`
**Total records:** 127

## Summary

- 3 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 4 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `authentication` | `email` | `text` | object source has no safe mapping to text | transform: `email_from_auth` |
| `_id` | `user_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:user_identity` |
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |

## Auto-confirmed fields

<details>
<summary>Show 3 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `First name` | `first_name` | `text` | trim |
| `Mobile` | `phone` | `text` | trim |
| `Last Name` | `last_name` | `text` | trim |
</details>
