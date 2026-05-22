---
title: "Journey — Created routine carries image provenance and is ungoverned"
feature: procedure-engine-2b
journey: agent-provenance-ungoverned
status: draft
verified_at: null
e2e_test: null
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
tags: [journey]
---

# Journey: Created routine carries image provenance and is born ungoverned

**Role:** system (backend)

**Precondition:** A routine is committed via the 2B flow with no protocol selected.

## Happy Path

1. The commit RPC sets `routine.created_via = 'image'` and `routine.source_reference = <storage_path>`.
2. With no protocol chosen, `routine.protocol_id IS NULL` and `routine.governance_status = 'unassigned'`.
3. The commit route emits `routine.created_from_image` and, when ungoverned, `routine.governance_unassigned`.
4. A later cron materialization of `session_task` can trace the image origin via `routine_id → routine.source_reference`.

**Postcondition:** The routine is fully functional yet flagged ungoverned; the nudge-to-govern surface (future) can read the flag/event.

## Error Paths

- **Protocol IS chosen** → `governance_status = 'attached'`; no `routine.governance_unassigned` event emitted.
- **Telemetry emit fails** → best-effort; does not block the commit (write already succeeded).

## Verification

- [ ] Implementation matches the steps above
- [ ] Tests exist and pass (commit-route emits both events for null protocol; SQL asserts columns)
- [ ] Manually verified: DB row shows `created_via='image'`, `governance_status='unassigned'`, `source_reference` set

**Mark `status: verified` in frontmatter when all three boxes are checked.**
