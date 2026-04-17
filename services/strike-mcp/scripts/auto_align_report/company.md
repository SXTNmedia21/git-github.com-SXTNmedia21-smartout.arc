# company alignment report

**Target table:** `public.company`
**Status:** 🟢 ok | confirmed: 10 / dropped: 0 / review: 3 / blockers: 0
**Bubble type:** `🏰company`
**Total records:** 1

## Summary

- 10 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 3 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `_id` | `company_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:company` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |

## Auto-confirmed fields

<details>
<summary>Show 10 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `Company : Email` | `email` | `text` | trim |
| `Company : Round Logo` | `logo_url` | `text` | — |
| `Company : VAT` | `org_number` | `text` | trim |
| `legalAgent: Legal name` | `legal_name` | `text` | trim |
| `Company : Name` | `name` | `text` | trim |
| `Company | Phone` | `phone` | `text` | trim |
| `Adresse: City` | `city` | `text` | trim |
| `Adresse: Zip` | `postal_code` | `text` | trim |
| `Accounting : Contact email` | `billing_email` | `text` | trim |
| `Adresse: Street` | `address_line_1` | `text` | trim |
</details>
