# Op 4: Approve + Materialize

> Status transition: `ready_impl → implemented`. Input: `<slug>.refined.yaml` from op 3. Output: 13-file folder at `docs/journeys/<slug>/`.
>
> The lock. After approve, IR is immutable. Edit creates new draft from copy → new `journey_version`.

## When this op runs

- User has a `<slug>.refined.yaml` and says "approve" or "materialize"
- All refine warnings resolved
- Author has reviewed enrichment text (anti-laziness gate passed)

## Pre-conditions (all must hold — refuse otherwise)

- [ ] `<slug>.refined.yaml` exists and `_refine_summary.errors` is empty
- [ ] Capability count is 4 (no expansion)
- [ ] All four capability authority rows exist in `engine_authority_config` (or seed migration)
- [ ] No phantom emits (every emit referenced is in registry)
- [ ] No phantom consumers (every row written has a named reader — see §15.3 of PRD)
- [ ] Author-reviewed coaching text on every step (not auto-derived placeholders)
- [ ] Mission auto-derivation does NOT match author's enrichment byte-for-byte (anti-laziness)
- [ ] If `pii_input: true` on any step, `platform` excludes voice (or includes voice with explicit acknowledgment)

## What this op materializes

Folder at `docs/journeys/<slug>/`:

```
docs/journeys/<slug>/
├── journey.md              # ← derived from refined.yaml + frontmatter
├── ROADMAP.md              # ← author writes (if not already)
├── MISSION.md              # ← auto-derived skeleton + author enrichment
├── LIVE-EXPERIENCE.md      # ← compiled from journey.md steps to prose
├── LICENSE.md              # ← compiled from capability refs
├── FLOW.md                 # ← compiled from journey.md (see references/flow-md-schema.md)
├── API.md                  # ← compiled from network_response triggers
├── DATAFLOW.md             # ← compiled from assertions + side_effects
├── COUPLINGS.md            # ← compiled from prerequisites + terminates
├── e2e.spec.ts             # ← generated from FLOW.md
├── RESCUE-PROMPT.md        # ← optional, present if op 05 ran
└── ir/
    ├── journey.yaml        # ← the immutable canonical IR
    └── journey.hash        # ← sha256(journey.yaml)
```

## Process

1. **Verify pre-conditions.** Check each box. Stop on first failure.
2. **Compute IR hash.** `sha256(refined.yaml)`. Will become `journey.hash`.
3. **Write canonical IR.** Copy refined.yaml → `docs/journeys/<slug>/ir/journey.yaml`. Strip `_binding` and `_refine_summary` annotations (those were authoring metadata, not runtime IR).
4. **Generate compiled artefacts:** journey.md, LIVE-EXPERIENCE.md, LICENSE.md, FLOW.md, API.md, DATAFLOW.md, COUPLINGS.md, e2e.spec.ts. (Each generator is a pure function — `IR → file`.)
5. **Author Roadmap + Mission.** Roadmap must already exist OR ask user to write it now (paired with auto-derived mission). Mission auto-derived skeleton, then author enrichment phase.
6. **Run anti-laziness gate.** If MISSION.md stages match auto-derivation byte-for-byte, reject. Author must add coaching text.
7. **Insert DB rows:**
   - `journey_ir` row with `status='published'`
   - `engine_missions` row with `is_active=false`
   - `engine_authority_config` rows (idempotent — already seeded via migration)
8. **Emit `journey.published` event.**
9. **Update INDEX.md.** Add new entry under `## Journeys`.
10. **Tell user next step:** "Materialized at `docs/journeys/<slug>/`. Status: `implemented`. Run `/journey-protocol activate <slug>` to flip mission to active."

## Refuse if

- Any pre-condition fails (specific message per gate)
- Folder already exists at `docs/journeys/<slug>/` and IR hash differs (offer: bump `journey_version` to v2 instead)
- Roadmap-Mission pairing fails (`ROADMAP.fires_mission != MISSION.mission_id`)
- E2E generation fails for any FLOW row
- LICENSE manifest references a capability not in the four frozen names

## After approve

- IR is immutable. Edits go to a new `journey_version` (v2, v3...).
- Mission can be activated via separate flow (not part of this skill).
- Folder is source of truth. Hand-edits to compiled files (LIVE-EXPERIENCE, LICENSE, FLOW, API, DATAFLOW, COUPLINGS, e2e.spec.ts) will be overwritten on next compile. Hand-edits allowed only on: ROADMAP.md, MISSION.md (between approves), RESCUE-PROMPT.md.

## See also

- `docs/engines/system-intelligence/05-protocol-pipeline.md` §2.4 — canonical approve contract
- `docs/engines/system-intelligence/07-journey-package-compiler.md` — full compile contract
- `docs/engines/system-intelligence/04-lifecycle.md` — status state machine
- `docs/engines/system-intelligence/11-handoff-capstone.md` — existing capability + authority seed evidence
- `references/folder-layout.md` — 13-file layout reference
