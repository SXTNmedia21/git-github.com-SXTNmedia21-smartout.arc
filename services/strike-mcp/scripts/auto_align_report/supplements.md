# supplements alignment report

**Target table:** `public.supplier`
**Status:** 🟢 ok | confirmed: 1 / dropped: 30 / review: 2 / blockers: 0
**Bubble type:** `⏱️salary_type(supplement)`
**Total records:** 117

## Summary

- 1 fields auto-confirmed (safe matches)
- 30 fields dropped (no v3 equivalent)
- 2 fields in review queue (type conflicts, ambiguous, collisions)
- 0 blockers (NOT NULL v3 columns without mapping)

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `ID` | `id` | `—` | collision with _id | manual decision required |
| `_id` | `id` | `—` | collision with ID | manual decision required |

## Dropped fields

### Always populated (100%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `🏰workspace` | 100% | No v3 column "workspace" on table public.supplier |
| `⏱️ _rateAdjustment` | 100% | No v3 column "rateadjustment" on table public.supplier |
| `Amount / Procent` | 100% | No v3 column "amount_procent" on table public.supplier |
| `⏱️ _rateAdjustmentType` | 100% | No v3 column "rateadjustmenttype" on table public.supplier |
| `effective_to` | 100% | No v3 column "effective_to" on table public.supplier |
| `effective_from` | 100% | No v3 column "effective_from" on table public.supplier |
| `Created Date` | 100% | No v3 column "created_date" on table public.supplier |
| `Modified Date` | 100% | No v3 column "modified_date" on table public.supplier |
| `Created By` | 100% | No v3 column "created_by" on table public.supplier |

### Mostly populated (>50%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `supplement.json` | 90% | No v3 column "supplement_json" on table public.supplier |
| `- Allow over midnight` | 96% | No v3 column "allow_over_midnight" on table public.supplier |
| `access ⚔️ teams` | 58% | No v3 column "access_teams" on table public.supplier |
| `- Affected by Breaks?` | 94% | No v3 column "affected_by_breaks" on table public.supplier |
| `Accounting_Account_Code` | 92% | No v3 column "accounting_account_code" on table public.supplier |
| `Duration min` | 79% | No v3 column "duration_min" on table public.supplier |
| `access⏱️employment_type` | 83% | No v3 column "access_employment_type" on table public.supplier |
| `apply_after_minutes` | 78% | No v3 column "apply_after_minutes" on table public.supplier |
| `access _weekDays` | 99% | No v3 column "access_weekdays" on table public.supplier |
| `a_melding_code` | 68% | No v3 column "a_melding_code" on table public.supplier |
| `- EnforcedPayment` | 91% | No v3 column "enforcedpayment" on table public.supplier |
| `Stop time` | 93% | No v3 column "stop_time" on table public.supplier |
| `Start time` | 94% | No v3 column "start_time" on table public.supplier |
| `Description` | 59% | No v3 column "description" on table public.supplier |

### Sparse (<50%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `Color` | 44% | No v3 column "color" on table public.supplier |
| `- activeOnHolyday` | 35% | No v3 column "activeonholyday" on table public.supplier |
| `🗓️ _shiftFlags` | 4% | No v3 column "shiftflags" on table public.supplier |
| `minimum leangth` | 2% | No v3 column "minimum_leangth" on table public.supplier |
| `duration hour` | 10% | No v3 column "duration_hour" on table public.supplier |
| `⏱️ _rateType` | 16% | No v3 column "ratetype" on table public.supplier |
| `PK ⏱️ _salaryCategory` | 16% | No v3 column "pk_salarycategory" on table public.supplier |

## Auto-confirmed fields

<details>
<summary>Show 1 fields</summary>

| Bubble field | Target column | v3 type | Transform |
|---|---|---|---|
| `name` | `name` | `text` | — |
</details>
