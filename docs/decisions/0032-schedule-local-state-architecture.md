---
title: "Schedule Page Local State Architecture"
id: ADR-0032
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0032: Schedule Page Local State Architecture

## Context and Problem Statement

MODULE_03 (Scheduling) is the most complex module in Smartout v3. A UI prototype exists with 832 lines in `page.tsx` and 9 component files, all using hardcoded dummy data. The team needs to validate that all interactions work correctly before committing to a database schema — building database-first risks creating a schema that doesn't match actual UI needs.

## Decision Drivers

- The schedule page has the highest interaction complexity in the system (30+ distinct user actions)
- Types must align 1:1 with `@smartout/types` enums and the MODULE_03 data model for seamless future migration
- Fast iteration on UI behavior is blocked by database migration overhead
- Shift lifecycle (MODULE_03 SS11) and absence handling (MODULE_03 SS7) need validation before schema design
- Template include/exclude staff assignments (MODULE_03 SS13.1) add combinatorial complexity

## Considered Options

1. **Database-first** — Create full schema with RLS, build UI against real data
2. **Local state with useReducer + Context** — Wire all interactions with in-memory state, migrate to database later
3. **Mock API layer** — Build fake API endpoints returning static data

## Decision Outcome

Chosen option: **"Local state with useReducer + Context"**, because it allows immediate validation of all 30+ interactions without migration overhead, and the types are designed to map directly to the eventual database schema.

### Implementation Details

- All UI interactions wired with `useReducer` + React Context
- Types align with `@smartout/types` enums (`DayCategory`, `TaskStatus`) and MODULE_03 data model
- Shift lifecycle follows MODULE_03 SS11: `created -> assigned -> published -> active -> completed -> unpublished`
- Absences are modeled as separate entities from shifts (MODULE_03 SS7)
- Templates support include/exclude staff assignments (MODULE_03 SS13.1)
- 30+ reducer actions cover: shift CRUD, lifecycle transitions, day operations, absence management, templates, open shifts, day content, and UI state

## Rules & Consequences

- **Good, because** fast iteration on UI interactions without database migration overhead
- **Good, because** future database migration is a type-compatible drop-in (same shape, add `workspace_id` + RLS)
- **Good, because** all interactions can be tested immediately without Supabase running
- **Bad, because** no persistence between page reloads
- **Bad, because** no multi-user collaboration during prototype phase
- **Bad, because** no real notifications (push/SMS are toast-only placeholders)
- **Bad, because** coverage calculations are simplified (no real team-employee mapping)
- **Agent Impact:** When migrating to database, keep the same type shapes and add `workspace_id`, `created_at`, `updated_at` columns. Replace reducer dispatch with Supabase mutations. RLS policies must cover both JWT and API key auth paths per CLAUDE.md gateway checklist.

---
