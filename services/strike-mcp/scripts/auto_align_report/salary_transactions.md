# salary_transactions alignment report

**Target table:** `public.payroll_ledger_archive`
**Status:** 🟢 ok | confirmed: 5 / dropped: 0 / review: 7 / blockers: 0
**Bubble type:** `⏱️salary_transaction(salary_detail)`
**Total records:** 17607

## Summary

- 5 fields auto-confirmed (safe matches)
- 0 fields dropped (no v3 equivalent)
- 7 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `🏰 workspace` | `workspace_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:workspace` |
| `_id` | `payroll_ledger_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:payroll_ledger` |
| `Related_Shift` | `schedule_shift_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:shift` |
| `4. Date` | `transaction_date` | `date` | v3 column type "date" is not in a recognized type family — manual mapping required | transform: `iso_to_date` |
| `🎎 Profile` | `profile_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:profile` |
| `🎎 team` | `team_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:team` |
| `🏠 department` | `department_id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | transform: `fk_uuid:department` |

## Auto-confirmed fields

<details>
<summary>Show 5 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `10. Base Salary` | `base_salary` | `numeric` | — |
| `Accounting_Account_Code` | `accounting_account_code` | `text` | trim |
| `11. Total Salary` | `total_salary` | `numeric` | — |
| `9. Hours` | `hours` | `numeric` | — |
| `a_melding_code` | `a_melding_code` | `text` | trim |
</details>
