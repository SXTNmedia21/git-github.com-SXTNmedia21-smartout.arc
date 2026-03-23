---
title: "Haiku Audit Instruction: Engine-to-Database Mapping"
status: active
updated: 2026-04-09
created: 2026-04-09
module: engine
tags: [audit, mapping, database, system-intelligence, haiku-task]
---

# Haiku Audit: Engine Package -> Database Mapping

## Your Mission

Systematically go through EVERY document in the Industry Intelligence Engine package for Restaurant (`docs/engines/industri-inteligence/hospitalety/`) and produce a complete data mapping audit.

Your output is a single deliverable: a structured audit file that maps every concept, element, text field, and function in the engine docs to either an existing database table/column OR marks it as "UNMAPPED — needs data layer".

---

## How to Work

Work through the engine docs ONE BY ONE, in order. For each document:

1. **Read the full document**
2. **Extract every data element** — every noun that represents stored data, every field, every list item, every relationship
3. **Classify each element** using the categories below
4. **Map it** to an existing database table + column, OR mark it unmapped

Do NOT skip elements. Do NOT summarize. Every bullet point, every list item, every field name matters.

---

## Document Processing Order

Process these in exact order:

| #   | File                                                                 | Focus                                                        |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | `00-engine-core.md`                                                  | System vs industry layer split — what needs tables vs config |
| 2   | `01-ai-council/restaurant-council.md`                                | Persona definitions — what is stored vs prompt-only          |
| 3   | `02-default-policies/restaurant-policy-catalog.md`                   | Policy items — map to `policy`, `protocol`, and sub-tables   |
| 4   | `03-templates/restaurant-business-structure-template.md`             | Departments, roles, teams, locations, zones, cohorts         |
| 5   | `03-templates/restaurant-task-pipelines-template.md`                 | Pipelines, triggers, verifications, hooks                    |
| 6   | `03-templates/restaurant-journey-template-catalog.md`                | Journey definitions, steps, outcomes                         |
| 7   | `04-research/restaurant-research-pack.md`                            | KPIs, success factors, workflow patterns                     |
| 8   | `05-testing/restaurant-testing-profiles.md`                          | Test profiles, personas, scenarios                           |
| 9   | `06-relevance-map/restaurant-relevance-map.md`                       | Cross-references — verify completeness                       |
| 10  | `07-company-handbook/restaurant-company-handbook-template.md`        | Handbook sections — what is data vs document                 |
| 11  | `08-role-capability-profiles/restaurant-role-capability-baseline.md` | Role capabilities, skills, training requirements             |
| 12  | `09-environment-profile/restaurant-environment-baseline.md`          | Physical environment, equipment, zones                       |
| 13  | `10-niche-profiles/restaurant-niche-italian-premium-service.md`      | Niche overrides, weights, specializations                    |

---

## Existing Database Tables (known)

These tables already exist. Map engine elements to these FIRST before declaring anything unmapped:

### Identity & Organization

- `user_identity` — user accounts
- `company` — company/business entity
- `company_member` — user-company membership
- `workspace` — isolated workspace per company
- `profile` — employee profile within workspace
- `department` — organizational departments
- `location` — physical locations
- `team` — teams within workspace
- `team_member` — team membership
- `position` — job positions
- `zone` — physical zones within locations

### Governance & Training

- `policy` — policies
- `protocol` — protocols (children of policies)
- `procedure` / `procedure_step` — step-by-step procedures
- `routine` — recurring routines
- `runbook` / `runbook_step` — operational runbooks
- `control_list` — checklists
- `knowledge_test` — tests
- `confirmation` — acknowledgement/sign-off records
- `protocol_assignment` — assignment of protocols to profiles

### Operations

- `schedule_shift` — shift scheduling
- `season` — time periods
- `season_budget` / `day_factor` / `hour_factor` — budget planning
- `asset` — equipment and assets
- `onboarding_session` — onboarding tracking

### Contracts

- `employment_contract` — employment contracts
- `contract_template` / `contract` / `contract_event` / `contract_reminder` — contract system
- `clause_library` — reusable contract clauses

### Communication

- `communication_log` — communication records
- `notification_outbox` / `notification_preference` — notifications
- `invitation` — employee invitations
- `message_template` — message templates

### Engine / AI

- `engine_memory` — persistent agent memories (pgvector)
- `engine_authority_config` — per-workspace capability authority levels

### Audit & Platform

- `activity_trail` — user activity log
- `platform_audit_log` / `platform_metrics_daily` — platform-level tracking

---

## Output Format

Create your output as a single markdown file. For EACH document processed, produce a section like this:

```markdown
## [Document Number] — [Document Title]

### Mapped Elements (has database backing)

| Engine Element      | Description          | Table      | Column(s)          | Notes     |
| ------------------- | -------------------- | ---------- | ------------------ | --------- |
| Department: Kjokken | Default kitchen dept | department | name, workspace_id | Seed data |
| ...                 | ...                  | ...        | ...                | ...       |

### Unmapped Elements (needs data layer)

| Engine Element    | Description          | Suggested Table | Suggested Column(s) | Priority |
| ----------------- | -------------------- | --------------- | ------------------- | -------- |
| Mission statement | Company mission text | company? or new | mission_statement   | high     |
| ...               | ...                  | ...             | ...                 | ...      |

### Ambiguous Elements (needs decision)

| Engine Element | Description               | Question                                                            |
| -------------- | ------------------------- | ------------------------------------------------------------------- |
| Brand tone     | Communication style guide | Is this stored as company config, policy, or engine prompt context? |
| ...            | ...                       | ...                                                                 |
```

Use these priority levels for unmapped elements:

- **critical** — Core system function depends on this
- **high** — Important for system intelligence / daily operations
- **medium** — Enriches system but not blocking
- **low** — Nice to have, could be prompt-only or config

---

## Final Summary Section

After processing all 13 documents, produce:

### 1) Coverage Summary

| Category             | Mapped | Unmapped | Ambiguous | Total |
| -------------------- | ------ | -------- | --------- | ----- |
| Organization         | X      | X        | X         | X     |
| Governance           | X      | X        | X         | X     |
| Operations           | X      | X        | X         | X     |
| Training             | X      | X        | X         | X     |
| Communication        | X      | X        | X         | X     |
| KPI/Metrics          | X      | X        | X         | X     |
| AI/Engine            | X      | X        | X         | X     |
| Environment          | X      | X        | X         | X     |
| Niche/Specialization | X      | X        | X         | X     |
| **Total**            | **X**  | **X**    | **X**     | **X** |

### 2) Unmapped Data Points — Full List

One flat list of ALL unmapped elements across all documents, sorted by priority (critical first), with suggested table/column.

### 3) Suggested New Tables

If the audit reveals clusters of unmapped elements that don't fit existing tables, suggest new tables with:

- Table name (following `snake_case` singular convention)
- Purpose
- Key columns
- Which engine elements it would serve

### 4) Suggested Column Additions

For existing tables that need new columns, list:

- Table name
- New column name + type
- Which engine element it serves

---

## Rules

1. **Be exhaustive** — Every single data point in every document must appear in the output
2. **Be specific** — "Policy items" is not enough. List each individual policy item
3. **Be honest** — If something is clearly prompt-only context (not stored data), mark it as such in Notes
4. **Don't invent** — Only map to tables/columns that actually exist. If unsure, put it in Ambiguous
5. **Think about seed vs runtime** — Some elements are seed data (created once at setup), others are runtime data (created during operation). Note which is which
6. **Check `database.types.ts`** — If you need to verify a column exists, read `packages/supabase/src/database.types.ts`
7. **Check migrations** — If you need to verify table structure, check `supabase/migrations/`

---

## Deliverable

Save your output to:

```
docs/engines/industri-inteligence/hospitalety/AUDIT-engine-to-database-mapping.md
```

With YAML frontmatter:

```yaml
---
title: "Audit: Restaurant Engine to Database Mapping"
status: in_progress
updated: YYYY-MM-DD
created: YYYY-MM-DD
module: engine
tags: [audit, mapping, database, system-intelligence]
---
```
