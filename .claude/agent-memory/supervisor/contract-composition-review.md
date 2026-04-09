---
name: contract-composition-review
description: Patterns and bugs found during contract composition engine review (feat/contract-composition-engine, 2026-04-09)
type: project
---

## Contract Composition Engine Review Findings

### Recurring Bug Patterns
- **Column name typos:** `address_line1` vs `address_line_1` (DB column has underscore). Also `address_line2` vs `address_line_2`. Both in AI tools AND in SECURITY DEFINER RPCs.
- **Engine process lookup by name vs id:** `engine_process` table uses text `id` field as PK, not `name`. Lookups must use `.eq("id", ...)` not `.eq("name", ...)`.
- **actor_id auth UID vs profile_id:** API routes commonly pass `user.id` (auth UID) to `emit()` but registry defines `actor_id` as profile_id. Must resolve profile first.

### Security Pattern to Enforce
- AI tools correctly guard admin/owner via `resolveActorRole()`, but corresponding API routes sometimes skip role checks (only verify authentication). Both paths must be guarded.

### Entity Type Fragmentation
- `EntityType` union has both `"contract"` (DocuSeal) and `"employment_contract"` (composition engine). AI tools use `"contract"`, API routes use `"employment_contract"`. Audit trail is fragmented.

### Scope Creep Signals
- Agent removed `emit("shift completed")` from useShiftClock and replaced notifications outbox with no-op stub. Watch for agents "cleaning up" adjacent code while implementing features.

### Two Contract Tables
- `contract` table = DocuSeal external contracts (legacy)
- `employment_contract` table = composition engine (new)
- AI `contract/tools.ts` has tools hitting BOTH tables in the same capability file.
