---
title: J-18 Dashboard Setup Wizard
status: FAIL
journey_docs: [JOURNEY-dashboard-redesign.md (related)]
spec: apps/e2e/tests/dashboard-setup-wizard-deep.spec.ts
result: 0 passed / 1 failed / 2 did not run
evidence: ../evidence/run-18-dashboard-setup.log
---

# J-18 Dashboard Setup Wizard — FAIL

Blocked by BUG-8 (channel.workspace_id FK lacks ON DELETE CASCADE). Test fixture `restoreWorkspaceData` cannot delete workspace because channel rows still reference it.

## Action
- Fix BUG-8 via migration:
  ```sql
  ALTER TABLE channel DROP CONSTRAINT channel_workspace_id_fkey;
  ALTER TABLE channel ADD CONSTRAINT channel_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;
  ```
- Re-run to validate
