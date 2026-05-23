---
title: "Brownfield-first ungoverned routines"
id: ADR_0405
status: accepted
layer: decision
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
tags: [procedure-engine, routine, governance, brownfield, schema]
---

# ADR-0393: Brownfield-first ungoverned routines

## Context and Problem Statement

Workspaces start fragmented — "brownfield". Staff already follow informal routines before any
governance chain exists. Phase 1 of the procedure-engine required `routine.protocol_id` and
`procedure.protocol_id` to be non-null, meaning a workspace had to stand up a full
policy→protocol→procedure chain before it could record a single routine. That friction blocks the
natural capture moment: "I'm standing here doing this thing, I want to describe it now." The
system was punishing the honest brownfield state and rewarding artificial governance-first theatre.

## Decision Drivers

- Capture what a workspace already does, before formalizing why.
- RLS and workspace isolation must work without a protocol parent in the chain.
- The governance nudge must exist but never block creation — "nudge, never gate".
- Image provenance (Phase 2B capture-to-author flow) needs a `created_via` + `source_reference`
  on `routine` so origin is traceable even when no protocol exists at creation time.
- Spec: `docs/superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md` §2.

## Considered Options

1. **Nullable `protocol_id` + `governance_status` enum** (chosen) — routines/procedures may be
   born ungoverned; a column records whether governance has been attached; the system nudges later.
2. **Require protocol before routine** — original Phase 1 model; rejected because it blocks
   brownfield capture and creates governance theatre.
3. **Separate "draft routine" table** — adds schema complexity and a promotion path; rejected as
   over-engineered for a simple nullability change.

## Decision Outcome

Chosen option: **Option 1**.

Schema changes (migration `20260623100000`):

- `routine.protocol_id` — **nullable**. Was NOT NULL. No backfill required (existing rows already
  have a protocol; new ungoverned rows will have NULL).
- `procedure.protocol_id` — **nullable**. Same rationale.
- `routine.governance_status` — new enum column `governance_status` (`unassigned` | `attached`),
  NOT NULL, DEFAULT `unassigned`. Set to `attached` by trigger when `protocol_id` is written.
  Null `protocol_id` always implies `unassigned`; the enum is the queryable read surface.
- `routine.created_via` — new enum column `routine_created_via`
  (`manual` | `camera_capture` | `ai_extract` | `import`), NOT NULL, DEFAULT `manual`.
  Stamps the origin channel at creation.
- `routine.source_reference` — nullable UUID, FK-less (interpreted via `created_via`). Same
  pattern as `session_task.source_reference` (ADR-0391). Stores e.g. the Storage path UUID for
  a camera-captured image.

RLS adjustment: workspace-scoped policies on `routine` and `procedure` use `workspace_id` directly
(already present via ADR-0391 trigger-backfill) — they no longer traverse `protocol_id` to derive
workspace. NULL `protocol_id` is a valid state, not a constraint violation.

Nudge surface (future work): a dashboard card or Botsson prompt that lists
`governance_status = 'unassigned'` routines and invites attachment. Not in this ADR.

## Rules & Consequences

- **Good, because** capturing what a workspace already does is now frictionless — no governance
  chain required before creation.
- **Good, because** `governance_status` is a clean queryable signal for nudge surfaces, reporting,
  and compliance readiness scores without scanning for NULL FKs.
- **Good, because** `created_via` + `source_reference` give durable provenance for the
  2B camera→extract→routine flow (ADR-0395) without a separate provenance table.
- **Bad, because** ungoverned routines are valid DB rows — tooling and reports must filter or
  group by `governance_status` rather than assuming all routines have a protocol parent.
- **Bad, because** `source_reference` is FK-less; a stale reference won't be caught by the DB.
  Consumers must tolerate missing source rows (same pattern, same risk, as ADR-0391).
- **Agent Impact:** Do NOT assume `routine.protocol_id` is non-null. Any query that joins
  `routine → protocol → policy` must use LEFT JOIN. The provenance columns (`created_via`,
  `source_reference`) MUST be stamped at creation — never left to default after the fact. Use
  `governance_status` for nudge and reporting queries, not `protocol_id IS NULL`. The trigger
  that sets `governance_status = 'attached'` fires on UPDATE of `protocol_id`; do not replicate
  this logic in application code.

Refs: ADR-0391 (Phase 1 provenance triple), ADR-0394 (mobile carve-out for capture-to-author),
ADR-0395 (multimodal image-storage contract), ADR-0151 (server-derived identity, RLS),
ADR-0367 (day_line area-anchored runtime).
Spec: `docs/superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md` §2.

---

> Registered in `docs/decisions/0000-decision-log.md`.
