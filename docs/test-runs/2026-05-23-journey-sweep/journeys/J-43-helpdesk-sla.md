---
title: J-43 Helpdesk SLA — auto-escalation / overdue actions / overdue badges
status: FAIL
journey_docs:
  - JOURNEY-helpdesk-sla-auto-escalation.md
  - JOURNEY-helpdesk-sla-manager-overdue-action.md
  - JOURNEY-helpdesk-sla-rep-overdue-badge.md
spec: apps/e2e/tests/helpdesk-sla-*.spec.ts (3 specs)
result: 0 passed / 4 failed
evidence: ../evidence/run-43-helpdesk-sla.log
---

# J-43 Helpdesk SLA — FAIL (0/4)

## BUG-20 — All 4 SLA tests fail
- auto-escalation, manager-overdue-action, rep-overdue-badge
- Probable: `engine_delayed_trigger` cron not running in local OR `helpdesk_query` capability authority not seeded
- Action: inspect failure causes — may overlap with BUG-1 (engine_authority_config seeding)
