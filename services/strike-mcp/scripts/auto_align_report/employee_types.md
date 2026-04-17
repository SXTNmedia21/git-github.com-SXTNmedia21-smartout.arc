# employee_types alignment report

**Target table:** `public.employee_type`
**Status:** 🟢 ok | confirmed: 7 / dropped: 0 / review: 4 / blockers: 0
**Bubble type:** `⏱️employee_type`
**Total records:** 3

## Summary

- 7 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 4 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `_id` | `employee_type_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:employee_type` |
| `Modified Date` | `updated_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |
| `🏰 Workspace` | `workspace_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:workspace` |
| `Created Date` | `created_at` | `timestamptz` | timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy | transform: `bubble_date_to_tstz` |

## Auto-confirmed fields

<details>
<summary>Show 7 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `Fixed salary?` | `fixed_salary` | `boolean` | — |
| `days_trailPeriod` | `days_trial_period` | `integer` | — |
| `Accounting_Account_Code` | `accounting_account_code` | `text` | trim |
| `max_hours_week` | `max_hours_week` | `numeric` | — |
| `max_vacation_days` | `max_vacation_days` | `integer` | — |
| `Title` | `title` | `text` | trim |
| ` _colorPallet` | `color_pallet` | `text` | trim |
</details>
