---
title: Decision Log
status: in_progress
updated: 2026-03-10
created: 2026-03-10
module: wizzard
tags: [decisions]
---

# Decision Log — csv-mapping

| #   | Date       | Decision                                                                                                          | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| #   | Date       | Decision                                                                                                          | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-08 | wait_for_event conditions are resumption-only — executeStep skips condition check for wait_for_event action types | Accepted |
| 2   | 2026-03-08 | engine_state.workspace_id nullable — pre-workspace processes (signup_onboarding) start before workspace exists    | Accepted |
| 3   | 2026-03-08 | engine_trigger.workspace_id nullable — global triggers match all workspaces                                       | Accepted |
| 4   | 2026-03-08 | engine_event.workspace_id nullable — events can fire before workspace creation                                    | Accepted |
| 5   | 2026-03-08 | match_state operator for cross-entity event matching — payload field maps to state context field                  | Accepted |
| 6   | 2026-03-08 | entity_id matching relaxed — events without entity_id match all waiting states (non-entity-scoped events)         | Accepted |
| 7   | 2026-03-08 | Compile function is pure — no DB deps, converts journey PM rows to engine_process/step/trigger structs            | Accepted |
| 8   | 2026-03-08 | E2E tests are API-driven — hit engine-dispatch via fetch, no browser required                                     | Accepted |
| 9   | 2026-03-08 | engine_process.id is human-readable TEXT PK (signup_onboarding, workspace_setup)                                  | Accepted |

status: in_progress
updated: 2026-03-10
created: 2026-03-10
module: scrapling
tags: [decisions]

---

# Decision Log — scrapling-extract

| #   | Date       | Decision                                                                                                          | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-10 | Use /extract/document (not /extract) for file upload endpoints to avoid conflict with existing URL-based /extract | accepted |

---

# Decision Log — client-contract

| #   | Date       | Decision                                                                                                         | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-10 | Webhook uses status weight to prevent regression from out-of-order DocuSeal events                               | accepted |
| 2   | 2026-03-10 | Contract-service resolves placeholders on send if unresolved — two creation paths (Next.js simple, service full) | accepted |
| 3   | 2026-03-10 | Signing URL stored as opaque token, not full URL — prevents URL guessing                                         | accepted |
