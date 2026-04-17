---
title: ADR-0118 — Invoice Engine as C3 Commercial Consumer
id: ADR_0118
status: accepted
layer: decision
created: 2026-04-17
updated: 2026-04-17
module: billing
tags: [adr, billing, c3-commercial, invoice, cascade]
---

# ADR-0118 — Invoice Engine as C3 Commercial Consumer

## Context and Problem Statement

Billing Engine Fase 1 (spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md`) introduces `invoice`, `invoice_line_item`, and `usage_snapshot` tables. Before any schema or code is written, the cascade placement question must be settled: does the invoice engine belong to a new dimension, a new control plane, or an existing plane?

The cascade model defines C3 Commercial as the plane that answers "What value was created? What does it cost?" (spec §2.3). Invoice generation is period-bounded attribution of platform value to a billable entity (company). That mapping is the core question C3 exists to answer.

## Decision Drivers

- Cascade invariant: producers (D-dimensions) must never be mutated by consumers (C-planes)
- Billing is company-scoped, not workspace-scoped — `invoice` and `invoice_line_item` carry `company_id`, not `workspace_id`
- `usage_snapshot` aggregates workspace activity; it must remain workspace-scoped (hypothesis H6 in Fase 1 spec)
- Dunning and collection notes are audit events, not domain entities — they must not pollute the cascade table graph

## Considered Options

1. **Invoice engine as C3 Commercial consumer** — reads D6 + K1b, writes its own tables, never mutates cascade sources
2. **New dimension D7 Commerce** — invoice as a first-class production dimension alongside D6
3. **New control plane C5 Billing** — standalone plane with its own authority and schema namespace

## Decision Outcome

Chosen option: **"Invoice engine as C3 Commercial consumer"**, because billing answers exactly the question C3 is chartered to answer and introduces no new runtime production logic that would warrant a separate dimension or plane.

The invoice engine:
- Reads `schedule_shift` (D6) and pricing terms from `workspace_doc_chunk` / K1b config
- Writes `invoice`, `invoice_line_item`, and `usage_snapshot` — tables it owns exclusively
- Never writes back to any D1–D6 table or K1a/K1b source
- Records dunning and collection notes via `activity_trail` (no `dunning_note` table)

`invoice` and `invoice_line_item` carry `company_id` rather than `workspace_id` — a documented exception to the workspace-scoped rule (workspace isolation is still enforced at the `usage_snapshot` level per H6).

## Rules & Consequences

- **Good, because** C3 already owns the "value → cost" attribution contract; no new architectural primitive needed
- **Good, because** the workspace_id exception is bounded to company-scoped billing tables — not a general precedent
- **Good, because** dunning notes via `activity_trail` preserves cascade invariant #2 (no derived entities mutating the graph)
- **Bad, because** company-scoped tables require explicit RLS policies referencing `company_member` rather than the standard `workspace_id` helper — developers must not copy standard workspace RLS boilerplate onto `invoice`/`invoice_line_item`
- **Agent Impact:** any agent or developer adding invoice-related tables must place them under C3, never D6. Any audit trail for dunning/collection events goes to `activity_trail` with `event_type = 'billing.*'`. The workspace_id exception must be called out in `MODULE_BILLING.md` (to be written).

## Related

- Cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` §2.3
- Billing Fase 1 spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md`
- Follow-up: ADR-0119 (usage reproducibility contract), ADR-0120 (invoice immutability)
- Requires: `MODULE_BILLING.md` to document workspace_id exception and C3 placement
