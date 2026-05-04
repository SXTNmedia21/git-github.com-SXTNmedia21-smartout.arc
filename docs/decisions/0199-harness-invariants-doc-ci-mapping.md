---
id: ADR-0199
title: "Harness invariants — compiled index with CI-enforcement mapping"
status: accepted
date: 2026-04-23
created: 2026-04-23
updated: 2026-04-23
deciders: [pontus, council]
superseded_by: null
module: MODULE_BOTSSON
tags: [adr, harness, invariants, ci, observability]
---

# ADR-0199 — Harness invariants compiled index

> **Numbering note:** This ADR was scoped in the plan as ADR-0196. On Task 13.2 reservation, 0194–0198 were already taken on sibling branches (`0194-journey-ir-v2-to-engine-missions-mapping.md`, `0195-authority-loader-full-dotted-key-preservation.md`, `0196-journey-engine-invariants-11-12-13.md`, `0197-phantom-contracts-promotion.md`, `0198-capability-definition-typed-fields.md`). Renumbered to 0199. References to "ADR-0196" in plan Step 13 and inline commit messages point to this file.

## Context and Problem Statement

The Botsson harness relies on roughly 9 cross-cutting invariants — some compile-time (capability shape), some runtime (emit-prefix uniqueness), some CI-time (emit-registry coverage, forgeable-actor scan, gate_action singleton). These invariants are stated in 20+ different ADRs (ADR-0018, ADR-0039, ADR-0099, ADR-0116, ADR-0151, ADR-0175, ADR-0198 …). Today there is no single index that answers:

1. **"What does the harness actually rely on?"** — a reviewer landing on the repo cold cannot discover this from the ADR list without reading every ADR title.
2. **"Which invariants are enforced, and by what?"** — prose ADRs assert "every emit() must be registered" but nothing says whether a regression would be caught by typecheck, by CI script, by test, or not at all.
3. **"Where are the honest gaps?"** — invariants that only live in prose (ADR text, CLAUDE.md reminders) are silent until someone notices a regression weeks later.

Without the index, every new contributor or council review re-derives the invariant list from scratch, and every "which ADR covers X?" query is a full-text search. The harness-hardening Phase 5 Trust-Gate (Item 4) explicitly asked for this compiled artefact before greenlighting v1 of the harness.

This is the companion to ADR-0198 (CapabilityDefinition typed fields) which lifted three invariants from prose into compile-time. ADR-0199 makes the remaining set visible and auditable.

## Decision Drivers (Why we must make a decision)

- **Single index, not single source of truth.** The ADRs remain authoritative; INVARIANTS.md is a compiled reference that links back. No re-stating ADR bodies — links only — so the index cannot drift from the ADRs.
- **Honesty over comfort.** Colour-code with 🟢/🟡/🔴 so prose-only invariants are visible as such. Silent assumptions are worse than declared gaps.
- **Cheap to maintain.** Compiled index, ~30 lines, one table per layer. Update on landing a new invariant or retiring one — not per commit.
- **Same vocabulary as BOTSSON-SYSTEM-MAP.md.** Reviewers already read the system map with the 🟢/🟡/🔴 convention; reusing it means zero re-learning cost.

## Considered Options

1. **Fold invariants into CLAUDE.md.** Rejected — CLAUDE.md is ephemeral project memory, not architecture documentation. A reviewer landing from a PR wouldn't check it. Also, CLAUDE.md is already long and adding 9 rows of tables hurts its scanning density.
2. **One INVARIANTS.md per package.** Rejected — fragments the answer to "what does the harness rely on". The whole point is a single index; 8 package-level files would push the burden of aggregation onto the reviewer.
3. **Single compiled index under `docs/architecture/`.** CHOSEN. Matches the home of BOTSSON-SYSTEM-MAP.md (the closest prior-art doc). Discoverable by path. One file, two tables (contract-layer, harness-layer), one row per invariant with explicit CI-status column.

## Decision Outcome

Chosen option: single `docs/architecture/INVARIANTS.md` with 9 rows + colour convention matching BOTSSON-SYSTEM-MAP.md.

Layout:

- **Contract-Layer Invariants** (I1–I6) — things true of every capability/tool/emit/gate path. Today: 6 🟢.
- **Harness-Layer Invariants** (I7–I9) — things true of every migration / Edge Function / mutation. Today: 2 🟡, 1 🔴.
- **Changelog** at the bottom — every row change records the date and delta.

Each row states: the invariant, its source ADR(s), the CI check (script name, typecheck, runtime assertion, or "none today"), and the colour status.

Cross-linked from `docs/architecture/BOTSSON-SYSTEM-MAP.md` at the TL;DR so a reviewer skimming the system map sees the invariants link at eye-level.

## Rules & Consequences enforced for Agents

- **Good, because** the harness's guarantees are now discoverable in one file, with CI enforcement visible per row. 🔴 rows are honest todos; 🟡 rows declare their gaps; 🟢 rows name the enforcer.
- **Good, because** landing a new invariant now has a natural home — add a row to INVARIANTS.md, colour-code it, link the ADR. No more "did we write that down anywhere?"
- **Bad, because** two files (INVARIANTS.md + each row's source ADR) must stay in sync on renames / renumbers. Mitigation: the index only points to ADRs; if an ADR is renumbered, update the row. No prose content to re-sync.
- **Agent impact:** when reviewing a PR that touches a contract-layer concern (capability shape, emit, authority gate), open INVARIANTS.md first — it is the shortest path from "what rule applies here?" to "is CI catching it?". When adding a new invariant, add the row alongside the ADR in the same commit.

## Implementation

- `docs/architecture/INVARIANTS.md` — created 2026-04-23. 9 invariants, 6 🟢 + 2 🟡 + 1 🔴.
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` — cross-link added after TL;DR. L3 row for `profile_id derivation` flipped 🔴 → 🟢 (landed via Tasks 2+3+4 of the harness-hardening bundle).
- `docs/decisions/0000-decision-log.md` — ADR-0199 row added.
- CI wiring for I2/I4/I6 lives in `.github/workflows/ci.yml` → `harness-invariants` job; npm scripts in `packages/ai/package.json` (`invariants:emit-coverage`, `invariants:server-actor`, `invariants:gate-singleton`). See ADR-0151, ADR-0099, ADR-0175 for the underlying invariants.

## Historical Naming

| Reference in plan / commits | Refers to |
| --------------------------- | --------- |
| ADR-0196 (plan §Task 13)    | This file (ADR-0199) — renumbered on reservation 2026-04-23 because 0196 was taken by `journey-engine-invariants-11-12-13.md` on sibling `campaign/journey-engine`. |
