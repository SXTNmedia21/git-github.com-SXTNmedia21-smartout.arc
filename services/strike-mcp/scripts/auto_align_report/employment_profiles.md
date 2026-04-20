# employment_profiles alignment report

**Target table:** `public.employee_payroll_profile` — **BLOCKED**
**Status:** 🔴 BLOCKED | confirmed: 0 / dropped: 38 / review: 1 / blockers: 6
**Bubble type:** `⏱️employment_profile`
**Total records:** 135

## Summary

- 0 fields auto-confirmed (safe matches)
- 38 fields dropped (no v3 equivalent)
- 1 fields in review queue (type conflicts, ambiguous, collisions)
- 6 blockers (NOT NULL v3 columns without mapping)

## Blockers

These v3 columns are NOT NULL with no DEFAULT and have no Bubble source field:

- `profile_id`
- `salary_type`
- `agreed_weekly_hours`
- `tariff_category`
- `seniority_start_date`
- `valid_from`

## Review queue

| Bubble field | Proposed target | v3 type | Issue | Recommended action |
|---|---|---|---|---|
| `_id` | `id` | `uuid` | Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation | manual decision required |

## Dropped fields

### Always populated (100%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `Accounting_Account_Code` | 100% | No v3 column "accounting_account_code" on table public.employee_payroll_profile |
| `Modified Date` | 100% | No v3 column "modified_date" on table public.employee_payroll_profile |
| `🎎 profile` | 100% | No v3 column "profile" on table public.employee_payroll_profile |
| `Created By` | 100% | No v3 column "created_by" on table public.employee_payroll_profile |
| `🏰 workspace` | 100% | No v3 column "workspace" on table public.employee_payroll_profile |
| `Created Date` | 100% | No v3 column "created_date" on table public.employee_payroll_profile |
| `User` | 100% | No v3 column "user" on table public.employee_payroll_profile |
| `validated_date` | 100% | No v3 column "validated_date" on table public.employee_payroll_profile |

### Mostly populated (>50%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `employment.Json` | 64% | No v3 column "employment_json" on table public.employee_payroll_profile |
| `primeDepartment` | 71% | No v3 column "primedepartment" on table public.employee_payroll_profile |
| `system_Id` | 67% | No v3 column "system_id" on table public.employee_payroll_profile |
| `effectiveFrom` | 93% | No v3 column "effectivefrom" on table public.employee_payroll_profile |
| `info.bankAccount` | 57% | No v3 column "info_bankaccount" on table public.employee_payroll_profile |
| `info_social_security` | 56% | No v3 column "info_social_security" on table public.employee_payroll_profile |
| `info.fullName` | 99% | No v3 column "info_fullname" on table public.employee_payroll_profile |
| `profile.Json` | 59% | No v3 column "profile_json" on table public.employee_payroll_profile |
| `⏱️ emplyee_Type` | 92% | No v3 column "emplyee_type" on table public.employee_payroll_profile |
| `rate_hourly_default` | 63% | No v3 column "rate_hourly_default" on table public.employee_payroll_profile |
| `shiftplan Active departments` | 78% | No v3 column "shiftplan_active_departments" on table public.employee_payroll_profile |
| `Fixed salar?` | 66% | No v3 column "fixed_salar" on table public.employee_payroll_profile |

### Sparse (<50%)

| Bubble field | Occurrence | Reason |
|---|---|---|
| `info_position_size` | 5% | No v3 column "info_position_size" on table public.employee_payroll_profile |
| `🎎_status` | 1% | No v3 column "status" on table public.employee_payroll_profile |
| `_employmentCategory` | 49% | No v3 column "employmentcategory" on table public.employee_payroll_profile |
| `info.adress` | 45% | No v3 column "info_adress" on table public.employee_payroll_profile |
| `primePosition` | 29% | No v3 column "primeposition" on table public.employee_payroll_profile |
| `On hire?` | 45% | No v3 column "on_hire" on table public.employee_payroll_profile |
| `🗓️ baseSalary` | 1% | No v3 column "basesalary" on table public.employee_payroll_profile |
| `monthly_Contracted_hours ` | 30% | No v3 column "monthly_contracted_hours" on table public.employee_payroll_profile |
| `fixed 🗓️ salaryDetail` | 1% | No v3 column "fixed_salarydetail" on table public.employee_payroll_profile |
| `list of fixed 🗓️ salaryDetails` | 1% | No v3 column "list_of_fixed_salarydetails" on table public.employee_payroll_profile |
| `shiftPlan: tinyProfile` | 12% | No v3 column "shiftplan_tinyprofile" on table public.employee_payroll_profile |
| `rate_fixed` | 27% | No v3 column "rate_fixed" on table public.employee_payroll_profile |
| `list of 🗓️ mealDeal.supplements` | 40% | No v3 column "list_of_mealdeal_supplements" on table public.employee_payroll_profile |
| `contract_start_date` | 3% | No v3 column "contract_start_date" on table public.employee_payroll_profile |
| `info_id_image` | 11% | No v3 column "info_id_image" on table public.employee_payroll_profile |
| `info_position_title` | 5% | No v3 column "info_position_title" on table public.employee_payroll_profile |
| `⏱️ baseRates` | 25% | No v3 column "baserates" on table public.employee_payroll_profile |
| `effectiveTo` | 5% | No v3 column "effectiveto" on table public.employee_payroll_profile |
