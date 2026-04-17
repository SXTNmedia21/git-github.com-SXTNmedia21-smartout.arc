# Auto-align summary — 2026-04-16T13:15:48.352Z

**v3_schema_hash:** `b958bacca72f25a7164a22638178fc9657f426295428b8a2e5e6aa5a1b99f31a`
**Shadow output:** `mappings/.aligned/`

## BLOCKED entities

These entities have NOT NULL v3 columns with no Bubble source field. Must resolve before migration.

- **employment_profiles** → `public.employee_payroll_profile` — blockers: profile_id, salary_type, agreed_weekly_hours, tariff_category, seniority_start_date, valid_from
- **handbooks** → `public.runbook` — blockers: protocol_id, name, trigger_event, trigger_conditions, escalation_chain, control_list_id
- **shift_templates** → `public.schedule_template` — blockers: name

## Unmatched entities

No v3 table was found — human table selection required.

- **inventory** (bubble_type: `🏰invetory`)
- **punchclock_rules** (bubble_type: `🕹️⏱️punchclock_rules`)
- **records** (bubble_type: `🗓️record`)
- **salary_rules** (bubble_type: `⏱️salary_rule`)
- **subtasks** (bubble_type: `subtask`)
- **swaprecords** (bubble_type: `⏱️swaprecord`)
- **tasks** (bubble_type: `task`)
- **time_rules** (bubble_type: `🕹️timerule`)
- **timeperiod_rules** (bubble_type: `🔥timeperiod_rule`)
- **training** (bubble_type: `🎎training`)

## Empty-attested entities

No data to migrate for this workspace. Mapping preserved for future runs.

- **employment_contracts** → `public.employment_contract`
- **invitations** → `public.invitation`
- **rule_templates** → `public.schedule_template`
- **shift_satellites** → `public.shift_note`

## Ready for review

| Entity | Target | Confidence | Confirmed | Dropped | Review queue | Blockers |
|--------|--------|------------|-----------|---------|--------------|----------|
| company | `public.company` | HIGH | 10 | 0 | 3 | 0 |
| departments | `public.department` | HIGH | 1 | 0 | 4 | 0 |
| employee_types | `public.employee_type` | HIGH | 7 | 0 | 4 | 0 |
| locations | `public.location` | HIGH | 4 | 0 | 4 | 0 |
| profiles | `public.profile` | HIGH | 3 | 0 | 6 | 0 |
| salary_transactions | `public.payroll_ledger_archive` | HIGH | 5 | 0 | 7 | 0 |
| shifts | `public.schedule_shift` | HIGH | 3 | 0 | 7 | 0 |
| supplements | `public.supplier` | HIGH | 1 | 30 | 2 | 0 |
| teams | `public.team` | HIGH | 3 | 0 | 5 | 0 |
| users | `public.user_identity` | HIGH | 3 | 0 | 4 | 0 |
| workspace | `public.workspace` | HIGH | 5 | 0 | 5 | 0 |

## Strategic decisions needed

- **subtasks**: fold into `task.parent_id`? If v3 `task` table has `parent_id`, consider folding instead of a separate subtask table. (yes/no)
- **profiles**: 6 fields in review queue — batch decisions needed
- **salary_transactions**: 7 fields in review queue — batch decisions needed
- **shifts**: 7 fields in review queue — batch decisions needed

## Totals

- **Entities processed:** 28
- **Auto-confirmed fields:** 45
- **Dropped fields:** 119
- **Review queue:** 304
- **Blockers:** 13
