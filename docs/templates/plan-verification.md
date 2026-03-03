---
title: Plan Verification Workflow
status: draft
updated: 2026-03-12
created: 2026-03-01
module: meta
tags: [template, plan, verification]
---

# Plan Verification Workflow

> Use this workflow to verify whether a plan in `docs/plans/` has been fully implemented.

---

## When to Run

- Periodically (weekly or after a sprint)
- When a plan feels "done" but hasn't been formally verified
- Before starting new work that depends on a previous plan

---

## Verification Steps

### Step 1: Read the Plan

Read the plan file and extract:

| Field              | What to Look For                                   |
| ------------------ | -------------------------------------------------- |
| **Deliverables**   | Files to create/modify, migrations, ADRs, UI pages |
| **Status markers** | Checkboxes, "completed" labels, phase markers      |
| **Dependencies**   | Other plans or ADRs this depends on                |

### Step 2: Check Each Deliverable Against Codebase

For each deliverable category, verify existence AND correctness:

| Category             | How to Verify                                                                        |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Migrations**       | File exists in `supabase/migrations/`, tables/enums reflected in `database.types.ts` |
| **TypeScript types** | File exists in `packages/types/`, exports used by consuming code                     |
| **UI pages**         | Route directory exists in `apps/web/` or `apps/landing/`, page.tsx renders           |
| **API routes**       | `route.ts` exists at expected path, exports GET/POST/etc                             |
| **Components**       | File exists, imported by parent page or layout                                       |
| **Services**         | Directory exists in `services/`, has package.json + Dockerfile + src/                |
| **ADRs**             | File exists in `docs/decisions/`, registered in `0000-decision-log.md`               |
| **Config**           | `.env.example` updated, `config.ts`/`env.ts` validates new vars                      |
| **Docker**           | Service in `infra/docker-compose.yml`, Dockerfile builds                             |

### Step 3: Classify the Plan

| Status                    | Criteria                                   | Action                                                       |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| **Completed**             | ALL deliverables exist and are correct     | Move to `docs/plans/completed/`                              |
| **Partially implemented** | Most deliverables exist, minor gaps remain | Update plan with status table showing what's done vs missing |
| **Not started**           | No deliverables found in codebase          | Keep in `docs/plans/`, no changes                            |
| **Superseded**            | Replaced by a newer plan or ADR            | Move to `docs/plans/completed/` with note "Superseded by X"  |

### Step 4: Move or Update

**If completed:**

```bash
mv docs/plans/YYYY-MM-DD-plan-name.md docs/plans/completed/
```

**If partially implemented:**
Add a status table at the top of the plan:

```markdown
## Implementation Status

| Component | Status     | Notes              |
| --------- | ---------- | ------------------ |
| Migration | ✅ Done    | `20260301_xxx.sql` |
| UI page   | ❌ Missing | Not started        |
```

**If superseded:**

```bash
# Add note at top of file, then move
mv docs/plans/YYYY-MM-DD-plan-name.md docs/plans/completed/
```

---

## Verification Checklist (copy per plan)

```markdown
- [ ] Plan file read and deliverables listed
- [ ] Each deliverable checked against codebase
- [ ] ADR exists and is registered (if plan created one)
- [ ] No orphaned references (plan mentions files that don't exist)
- [ ] Status classified: completed / partial / not started / superseded
- [ ] Action taken: moved to completed/ OR updated with status table
```

---

## Notes

- BUILD_ORDER.md is a living master plan — it stays in `docs/plans/` always
- Plans that spawn sub-plans should only be marked completed when ALL sub-plans are done
- When in doubt, check git log for the plan's date range to see what was actually committed
