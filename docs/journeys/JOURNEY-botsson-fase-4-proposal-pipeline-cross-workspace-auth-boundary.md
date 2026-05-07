---
title: "Journey — Cross-workspace JWT rejected at stage-engine"
feature: botsson-fase-4-proposal-pipeline
journey: cross-workspace-auth-boundary
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: Botsson
tags: [journey, security]
---

# Journey: User from workspace A cannot drive Botsson against workspace B

**Role:** security boundary verification

**Precondition:** Two workspaces exist locally (A and B). User has a profile in A only. JWT minted for workspace A.

## Happy Path

1. Browser running as workspace-A user → forces `workspace_context.workspace_id = B` in voice-agent request body (simulated tampering) → adapter.ts passes through → stage-engine resolves authority chain server-side from JWT → JWT-derived workspace = A, body claims B → mismatch → stage-engine returns `403` → no `agent_session_recording` row written → no proposal tools dispatched.

**Postcondition:** `403` response. No cross-workspace data leak. Activity log records auth violation. `change_proposal` table contains zero rows for workspace B from this session.

## Error Paths

- **Multi-workspace local seed unavailable** → fall back to structural verification: assert that `workspace_id` in body is NEVER trusted, only JWT-derived. Code review pass: search for any `req.body.workspace_id` references in stage-engine routes — should be zero load-bearing reads (per ADR-0151).

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — Task 14.8 (functional path if multi-workspace seed available, else structural)
- [ ] Code review confirms no body-supplied `workspace_id` is used for authority decisions
- [ ] ADR-0151 compliance verified

**Mark `status: verified` in frontmatter when all four boxes are checked.**
