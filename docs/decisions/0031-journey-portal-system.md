---
title: "Journey Portal System"
id: ADR-0031
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
depends_on:
  - CORE_ARCH_V2
  - MODULE_17
---

# ADR-0031: Journey Portal System

## Context and Problem Statement

Smartout is migrating 68 user journeys from Bubble.io to a modern stack. There is no unified tracking system for journey implementation status, dependencies, or lifecycle progression. Without a meta-layer, the build process relies on spreadsheets and manual coordination, making it impossible to know at a glance which journeys are ready, which are blocked, and what phase the overall migration is in.

## Decision Drivers

- Need a single source of truth for all 68 journeys and their implementation status
- Status transitions must be validated — not every journey can jump to any state
- Every status change must be auditable (who moved what, when)
- The system must live inside platform-admin (godmode-only), not be a separate tool
- Must support future AI-assisted journey definition (wizard) and automated test runs
- Must be workspace-scoped to support multi-tenant architecture

## Considered Options

1. **External tracker (Linear only)** — Track journeys as Linear issues with custom labels
2. **Database-backed Journey Portal** — 4 tables in Supabase, platform-admin UI, 13-status lifecycle
3. **Spreadsheet + manual sync** — Google Sheets with periodic imports

## Decision Outcome

Chosen option: **"Database-backed Journey Portal"**, because it provides validated status transitions, full audit trail, workspace-scoped RLS, and a foundation for AI-assisted journey definition in Phase 2. Linear integration remains planned as a sync target, not the source of truth.

## Rules & Consequences

- **Good, because** all 68 journeys are queryable, filterable, and trackable with full audit history
- **Good, because** the 13-status lifecycle with validated transitions prevents invalid state changes
- **Good, because** the system seeds from JOURNEY_REGISTRY.md, creating a single source of truth
- **Bad, because** adds 7 new enums and 4 new tables to the schema
- **Bad, because** the seed migration is large (~68 INSERT statements with steps)
- **Agent Impact:** When implementing a journey, check the Journey Portal for current status and update it when work begins/completes. All journey-related code changes should reference the journey code (J-001 through J-068).

### Schema

| Table              | Purpose                                 | RLS                      |
| ------------------ | --------------------------------------- | ------------------------ |
| `journey`          | Main journey records (68 rows seeded)   | godmode + workspace read |
| `journey_step`     | Ordered steps per journey               | godmode + workspace read |
| `journey_event`    | Audit log for status changes and events | godmode + workspace read |
| `journey_test_run` | E2E test execution history (Phase 2+)   | godmode + workspace read |

### 13-Status Lifecycle

```
Definition: idea → wizard → defined
Planning:   ready_impl
Build:      building → review
Test:       ready_test → testing → ready_validation
Release:    implemented → active / inactive / broken
```

### Phased Implementation

- **Phase 1 (this ADR):** Tables, types, status machine, portal UI (list + detail + status changer)
- **Phase 2:** AI wizard for journey definition, E2E test generation
- **Phase 3:** Linear sync, automated test runs, doc generation

---
