---
title: "Journey-Protocol Op Pipeline (5-op authoring) + 13-file folder"
id: ADR-0222
status: accepted
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0222: Journey-Protocol Op Pipeline + 13-file Approved Folder

## Context and Problem Statement

The journey-engine campaign closure (2026-04-27) shipped 4 capabilities (`run_dev`, `run_guided`, `publish_mission`, `publish_guide`). Authoring of new journeys requires structured walkthroughs (intent → spec → refine → approve → rescue). The 2026-04-28 doc consolidation introduced a 5-op skill pipeline + 13-file approved folder layout but registered no ADR. Council 2026-04-28 verdict: APPROVE WITH CHANGES, requires ADR registration before contracts become load-bearing.

## Decision Drivers

- CLAUDE.md §"ADR Enforcement" requires ADRs for new schemas + decision points
- 2026-04-27 closure trust-gate: 2 of 4 capabilities kept end-to-end; new contracts must close gaps, not add phantom ones
- Capability count frozen at 4 per ADR-0173; skill ops are NOT capabilities (no runtime mutation surface)
- Existing `docs/journeys/JOURNEY-*.md` closure stubs collide with new `docs/journeys/<slug>/` folder pattern — needs differentiation rule
- 19-file proposal rejected by author 2026-04-28 ("User/Knowledge/Function-test = reports, not artefacts")

## Considered Options

1. **Option A** — 5-op skill pipeline (Create → Spec → Refine → Approve → Rescue), 13-file approved folder, INTENT-banner on un-implemented contracts. Skill ops are documentation-only authoring helpers; runtime DB writes happen via existing 4 capabilities.
2. **Option B** — 8-op pipeline mirroring 13-status authoring lifecycle (idea → wizard → defined → ready_impl → building → review → testing → implemented). Granular but heavyweight; 13-status enum is for narrative, not ops.
3. **Option C** — No skill, fully manual authoring + capability calls. Simplest but loses the conversational pushback that prevents scope creep on day 1.

## Decision Outcome

Chosen option: **"Option A"**, with the explicit constraint that skill ops do NOT mutate DB directly. Skill `approve` op invokes existing capabilities (`publish_mission`, `publish_guide`) — never writes `engine_missions` / `engine_authority_config` / `journey_ir` rows itself. Authority remains migration-only per ADR-0176.

13-file folder is **platform-level only** (lives in repo at `docs/journeys/<slug>/`). NOT per-tenant. Tenant-scoped journey IRs live in `journey_ir` DB table per existing schema (multi-tenant via `workspace_id` RLS, ADR-0046). The 13-file folder serves first-party platform journeys (admin onboarding, employee onboarding, scheduling primitives — the journeys Smartout itself authors). Customer-authored journeys never land here.

This boundary is enforced by:
- File path lives in repo (not workspace-scoped storage)
- Skill `ops/04-approve.md` writes to `docs/journeys/<slug>/` — repo-level path
- No `workspace_id` column on the folder; tenant scoping happens at `journey_ir` row level
- Customer self-service authoring (if added in future) MUST go through DB, never repo file system

Pattern matcher + state card are runtime-derived from IR (no per-journey files).

Closure stubs (`docs/journeys/JOURNEY-*.md`) and protocol packages (`docs/journeys/<slug>/`) coexist via path differentiation: file vs directory. Future rename to `docs/journeys/closures/` + `docs/journeys/protocols/` deferred until collision actually occurs.

## Rules & Consequences

- **Good, because** authoring gets structured pushback (1-paragraph idea → full IR → bound → locked) without inventing new mutation paths.
- **Good, because** 4-capability freeze (ADR-0173) preserved — skill ops never mutate authority/missions directly.
- **Good, because** `INTENT, NOT IMPLEMENTED` banners on un-built ops (compile pipeline, FLOW generator, e2e generator) prevent future contributors from treating phantom contracts as ratified.
- **Bad, because** approve op is currently un-runnable (no compile pipeline implementation) — skill ships as design intent only.
- **Bad, because** closure-stub vs protocol-package collision risk grows with each new journey; deferred rename will eventually be needed.
- **Agent Impact:** Skill author MUST verify spec contract has runtime consumer before claiming spec is "complete." Banners on intent-only docs MUST stay until implementation lands.

## References

- `docs/engines/system-intelligence/05-protocol-pipeline.md` — pipeline canonical
- `docs/engines/system-intelligence/07-journey-package-compiler.md` — 13-file canonical
- `docs/engines/system-intelligence/04-lifecycle.md` — 13-status / 7-enum / 6-state reconciliation
- ADR-0173 (capability count frozen at 4)
- ADR-0176 (authority migration-only)
- ADR-0099 (gate_action on every mutation)
- ADR-0196 (phantom-emit invariants 11/12/13)
- L-0151 (phantom contracts simultaneously authored)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
