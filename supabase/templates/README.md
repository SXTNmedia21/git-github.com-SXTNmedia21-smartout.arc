---
title: Industry Template Seeds
status: in_progress
updated: 2026-03-06
created: 2026-03-06
module: templates
tags: [seed, template, onboarding, industry]
---

# Industry Template Seeds

Pre-built operational blueprints that populate a workspace with realistic, production-quality data. Each template represents a complete operational setup for a specific industry.

## Available Templates

| Industry   | Folder        | Employees | Departments | Policies | Schedule |
| ---------- | ------------- | --------- | ----------- | -------- | -------- |
| Restaurant | `restaurant/` | 50        | 7           | 10       | 3 months |

## Structure

Each industry template is a folder containing modular SQL files:

```
templates/{industry}/
├── _apply.sql          Master file — runs all others in order
├── departments.sql     Departments + positions
├── locations.sql       Locations + zones
├── employees.sql       Auth users + profiles (diverse types)
├── policies.sql        Policies with real regulatory references
├── governance.sql      Protocols, procedures, steps, routines,
│                       control lists, knowledge tests, confirmations
└── schedule.sql        3 months of shift data
```

## Naming Convention

- **Folder name** = industry (lowercase, singular): `restaurant`, `hotel`, `bar`, `cafe`
- **File names** = data type (lowercase): `departments.sql`, `employees.sql`
- **Function names** = `template_{industry}_{datatype}(p_workspace_id uuid)`

## Usage

### Apply full template

```sql
-- Creates everything for a restaurant workspace
SELECT template_restaurant_apply('your-workspace-uuid-here');
```

### Apply individual modules

```sql
-- Only departments and positions
SELECT template_restaurant_departments('your-workspace-uuid-here');

-- Only employees (requires departments first)
SELECT template_restaurant_employees('your-workspace-uuid-here');
```

### From command line

```bash
# Apply full template to local DB
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/templates/restaurant/_apply.sql \
  -c "SELECT template_restaurant_apply('your-workspace-uuid');"
```

## Prerequisites

Before applying a template, the workspace must already exist with:

- A `company` record
- A `workspace` record
- An admin `profile` (role = 'admin')
- At least one `season` (status = 'active')

These are created during onboarding (either via `finalize-workspace` or `activate-workspace` edge functions).

## Employee Types (Restaurant)

| Type                 | Count | Characteristics                                        |
| -------------------- | ----- | ------------------------------------------------------ |
| Norskspråklig voksen | 25    | Native Norwegian, full-time, core staff                |
| Ikke-norskspråklig   | 10    | Foreign workers, full-time, `en`/`sv` language         |
| Mindreårig (16-17)   | 5     | Restricted hours per Arbeidsmiljøloven, trainee status |
| Pensjonist           | 4     | Part-time, experienced, 2-3 shifts/week                |
| Frilanser/tilkalling | 6     | On-call, events + weekends, irregular schedule         |

## Dependency Order

Templates must be applied in this order (handled by `_apply.sql`):

1. `departments.sql` — no dependencies
2. `locations.sql` — no dependencies
3. `policies.sql` — depends on departments (for scoped policies)
4. `governance.sql` — depends on policies + departments
5. `employees.sql` — depends on departments
6. `schedule.sql` — depends on employees

## Adding New Templates

1. Create folder: `templates/{industry}/`
2. Create files following the same pattern as `restaurant/`
3. Each file defines one function: `template_{industry}_{datatype}(p_workspace_id uuid)`
4. Create `_apply.sql` that sources all files and defines `template_{industry}_apply()`
5. Update this README with the new template

All content should be in Norwegian. Reference real regulations where applicable.
