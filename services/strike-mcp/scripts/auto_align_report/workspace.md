# workspace alignment report

**Target table:** `public.workspace`
**Status:** 🟢 ok | confirmed: 5 / dropped: 0 / review: 5 / blockers: 0
**Bubble type:** `workspace`
**Total records:** 40

## Summary

- 5 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 5 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `🏰 Company` | `company_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:company` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `_id` | `workspace_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:workspace` |
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `Default_language` | `language` | `preferred_language` | v3 column type "preferred_language" is not in a recognized type family — manual mapping required | manual decision required |

## Auto-confirmed fields

<details>
<summary>Show 5 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `Titel` | `name` | `text` | trim |
| `round_logo` | `logo_url` | `text` | — |
| `brandColor` | `brand_color` | `varchar` | — |
| `phoneNumber` | `phone` | `text` | trim |
| `adress` | `address_line_1` | `text` | trim |
</details>
