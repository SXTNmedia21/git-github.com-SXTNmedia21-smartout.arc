---
name: import-domain-spec
description: Use when the campaign bootstrap (Phase 0) needs to turn an existing domain spec into campaign inputs — ingest a `docs/domains/<domain>/` spine and extract dimensions, entities, datatypes, and components into a `feature_list.json` + component-index entries the bootstrapper feeds. The orchestrator mounts this to import a spec instead of hand-drafting the fundamental list. Symptoms — "feed the bootstrap a feature-list", "import the core-structure spec", "extract entities/components from the domain docs".
updated: 2026-06-03
---

# Import Domain Spec

Turn an existing **domain spec** into the campaign's **fundamental list** — without hand-drafting it.
This skill **composes** existing extractors; it does not reimplement them (reuse-first).

**The insight:** the domain-steward docs (`docs/domains/<domain>/`) have **already extracted** the hard
parts — `DATA-MODEL.md` is entities + datatypes + dimensions, code-verified. This skill maps that into the
campaign schemas + adds components, then validates. Mostly mapping, little new analysis.

## When

Phase-0 bootstrap, step 3 ("feed the fundamental list"). The orchestrator points at one domain spec → out
comes a `feature_list.json` slice + component-index entries the bootstrapper consumes. One domain at a time.

## Inputs

- A domain spine: `docs/domains/<domain>/` — read `DATA-MODEL.md` (entities·datatypes·dimensions),
  `ARCHITECTURE.md` (structure·components), `USER-FLOWS.md` (intents), `GAPS-AND-DEBT.md` (backend gaps).
- The canon schemas: `.sxtn/runbook/schemas/feature_list.schema.json` + `component-index.schema.json`.

## Procedure (compose — don't reinvent)

1. **Dimensions / entities / datatypes** → from `DATA-MODEL.md` directly (already extracted, code-verified).
   Only if the spec is thin, fall back to **`sxtn-backend-discovery`** to derive them. Entities are
   **findings, never creates** — a table named in the spec that the DB lacks is surfaced, not invented (DB-wall).
2. **Components** → run **`sxtn-component-indexer`** on the domain's design/port code → component-index
   entries (`component_id` = `ELEMENT.FEATURE.ACTION` · type · `trigger_kind` · `telemetry_event_id` ·
   `consistency_gate` · `noop_gate`).
3. **Emit `feature_list.json`** — one feature per portable surface: `feature` · `module`/`domain` ·
   `tier` · the entities it reads · the components it owns · the events it must emit (from the
   telemetry-map control.json if present).
4. **Validate** against the two canon schemas. Reject on drift — don't ship a list the schema rejects.

## Outputs

- `feature_list.json` (domain slice) — the fundamental list for the bootstrapper.
- component-index entries — the spy/lifecycle seed (`proposed`).
- Both conform to `.sxtn/runbook/schemas/`.

## Rails

- **No ghost.** Extract from the real spec; never invent entities, components, or events to fill a slot.
- **DB-wall.** Missing table/column = a finding to surface, never a license to create.
- **Reuse-first.** Compose `backend-discovery` + `component-indexer` + the domain docs. If you find yourself
  re-deriving what `DATA-MODEL.md` already states, stop — map it.
- **Single `.sxtn` writer.** The emitted files land on this tree via one instance (rule 9).

## Red flags — STOP

- Hand-typing `feature_list.json` entries the domain docs already contain → map, don't author.
- Inventing a component/event that has no source in the spec or code → that's a ghost. (no-ghost)
- Adding an entity because the design "needs" a table → finding, not create. (DB-wall)

## Reference

First demonstration target: `docs/domains/core-structure/` (DATA-MODEL has the D1 identity/workspace/profile
entities + datatypes + dimensions already extracted — a clean map, little new analysis).
