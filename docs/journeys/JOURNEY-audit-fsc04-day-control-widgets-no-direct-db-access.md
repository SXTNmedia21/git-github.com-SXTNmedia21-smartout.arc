---
title: "Journey — Day-control widgets respect ADR-0156 no-direct-DB rule"
feature: audit-fsc04-day-control-server-actions
journey: day-control-widgets-no-direct-db-access
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, adr-0156, governance, grep-invariant]
---

# Journey: Grep across day-control surface returns 0 direct DB writes

**Role:** future auditor

**Precondition:** Refactor complete. Both new Server Actions shipped.

## Happy Path

1. Run `grep -rn "\.from(\"deviation\")\.\(insert\|update\|delete\|upsert\)\|\.from(\"department_session\")\.\(insert\|update\|delete\|upsert\)" apps/web/src/components/day/ apps/web/src/app/dashboard/dagskontroll/`
2. Returns 0 hits (or only hits inside `_actions/` Server Action directories)
3. Day-control widget tree is read-only on DB; all writes route through Server Actions
4. Auditor confirms F-SC-04-15 + F-SC-04-13 stay closed

**Postcondition:** ADR-0156 audit-integrity driver upheld. ADR-0204 backlog reduced by 2 sites.

## Verification

- [ ] Grep command returns 0 hits in widget tree
- [ ] Server Actions live at `_actions/*-action.ts` paths
- [ ] Synthesis F-SC-04-15 + F-SC-04-13 → CLOSED

**Mark verified when all checked.**
