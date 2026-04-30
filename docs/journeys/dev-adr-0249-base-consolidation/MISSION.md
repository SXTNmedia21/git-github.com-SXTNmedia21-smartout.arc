---
title: "Dev ADR-0249 Base-YML Consolidation (Phase 1 dev-mission)"
mission_id: dev-adr-0249-base-consolidation
phase: 1
persona: harness-builder
created: 2026-04-30
updated: 2026-04-30
status: draft
---

<!-- ADR target: ADR-0249 (next-available per decision-log as of 2026-04-30; highest registered is ADR-0244; ADR-0245-0248 reserved for engine_state ontology + schema reconciliation sequence per Phase 2 of this plan) -->

# Dev ADR-0249 Base-YML Consolidation

Phase 1 dev-mission. The mission-pool worker runs this mission after Pontus
manually queues it (sets engine_state.status='scheduled' per plan §Step 1.2).
It produces a concrete deliverable: an ADR documenting the Steward-prescribed
docker-compose.yml structural fix (base.yml complete, prod.yml additive-only),
plus a PR against `development`.

No capability calls. No schema mutations. No runtime side effects. The output
is a documentation artifact (one ADR file + decision-log entry + one PR).

## Persona: harness-builder

This mission runs as the `harness-builder` persona. It has read-only access to
infrastructure files and write access only inside `docs/decisions/`. It opens a
PR via `gh` shell command but performs no database mutations, no workspace
operations, and no capability invocations.

## Stages

### Stage 1 — Read production architecture and infra files

Read `docs/architecture/SMARTOUT_PRODUCTION_ARCHITECTURE.md` to understand the
current documented state of the docker-compose structure.

Read all `infra/docker-compose.*.yml` files (`docker-compose.yml`,
`docker-compose.override.yml`, `docker-compose.prod.yml`) to observe the
current base vs override split and identify any services defined in prod.yml
that should live in base.yml.

FLOW token: `step-1-read-infra`.

### Stage 2 — Read decision template

Read `docs/templates/decision.md` to obtain the canonical ADR structure:
sections, frontmatter fields, status values, and formatting conventions.

This stage produces no output file — it loads the template into working
context for Stage 3.

FLOW token: `step-2-read-template`.

### Stage 3 — Compose ADR-0249 draft

Compose the ADR-0249 content per the Steward's structural fix:

- **Problem:** `docker-compose.prod.yml` currently duplicates service
  definitions that belong in `base.yml`. Override files should be additive
  only — they must not redefine keys already present in the base.
- **Decision:** `docker-compose.yml` (base) must be complete and self-standing.
  `docker-compose.prod.yml` must be purely additive (environment overrides,
  volume mounts specific to prod, replica counts). No service defined in
  prod.yml may duplicate a full service block from base.
- **Status:** proposed.

FLOW token: `step-3-compose-draft`.

### Stage 4 — Write ADR file

Write `docs/decisions/0249-base-yml-consolidation.md` using the content
composed in Stage 3 and the section structure from Stage 2.

File must include YAML frontmatter with at minimum:
`title`, `status: proposed`, `created: 2026-04-30`, `updated: 2026-04-30`,
`module: infra`, `tags: [docker, infra, base-yml]`.

FLOW token: `step-4-write-adr`.

### Stage 5 — Append decision-log entry

Append a new row to the ADR table in `docs/decisions/0000-decision-log.md`
following the existing format (newest first):

```
| [ADR-0249](0249-base-yml-consolidation.md) | 2026-04-30 | Base YML Consolidation — docker-compose.yml complete and self-standing; docker-compose.prod.yml additive-only. | proposed |
```

FLOW token: `step-5-update-log`.

### Stage 6 — Open PR

Run `gh pr create` to open a pull request against `development` with:
- Title: `docs(infra): ADR-0249 base-yml consolidation`
- Body: describes the ADR, links to the file, notes this was produced by
  mission `dev-adr-0249-base-consolidation` running in mission-pool worker.

FLOW token: `step-6-open-pr`.

### Stage 7 — Emit journey.completed

Emit `journey completed` via `@smartout/telemetry` with payload:
- `mission_id: "dev-adr-0249-base-consolidation"`
- `adr: "ADR-0249"`
- `pr_opened: true`

FLOW token: `step-7-complete`.

## Success criteria

- `docs/decisions/0249-base-yml-consolidation.md` exists with all template
  sections filled.
- `docs/decisions/0000-decision-log.md` contains ADR-0249 row.
- PR open in GitHub against `development`.
- All 7 FLOW events emitted (run_started + 5x step_reached + completed).

## Acceptance

Pontus reviews PR and ADR content. Merge constitutes Phase 1 gate passage per
`docs/plans/PLAN-arena-harness-migration.md §Phase 1 gate`.
