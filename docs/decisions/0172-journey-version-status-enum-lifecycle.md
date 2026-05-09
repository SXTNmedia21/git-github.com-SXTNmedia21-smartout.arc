---
title: "journey_version_status enum + journey lifecycle state model"
id: ADR-0172
status: accepted
layer: decision
created: 2026-04-21
updated: 2026-04-22
---

# ADR-0172: `journey_version_status` enum + journey lifecycle state model

## Context and Problem Statement

Spec v1.6.0 proposed `ALTER TYPE journey_status ADD VALUE 'ready_test'` to add store-listing states. `journey_status` enum already defines 13 values including `ready_test` (migration `20260301140000_journey_system.sql:14-20`) — the ALTER will fail on deploy. More importantly, `journey_status` is the runtime execution status of a journey **instance** (pending/running/completed/failed/etc.), while the spec needs an **authoring lifecycle status** for a journey **version** (draft → ready_test → ready_publish). Two different concerns, two different enums.

## Decision Drivers

- L-0023 (dev-tracking vs runtime-state separation) — a version's authoring state is not a run's execution state.
- Deploy safety — enum collision = migration fails, ship blocked.
- Store-listing gating — `close-feature.sh` must check `journey_version_status = 'ready_publish'` before allowing merge; runtime enum is wrong contract.
- Separation-of-concerns across reviewers and tooling — reporting a version as `draft` is meaningless if the same column also reports instances as `running`.

## Considered Options

1. **New enum `journey_version_status`** on new column `journey_version.status` — default `draft`, transitions `draft → ready_test → ready_publish → archived`.
2. **Reuse `journey_status`** and add `ready_publish` / `archived` — keeps one enum.
3. **Boolean columns** (`is_ready_test`, `is_ready_publish`) — no enum.

## Decision Outcome

Chosen option: **"New enum `journey_version_status`"**, because (a) `journey_status` already means "run execution state" and retrofitting authoring states into it creates a semantic monster, (b) migration 0a/0b/0c pattern (L-0075) works cleanly on a new enum, (c) gate logic reads from a column whose name matches the question it asks.

Lifecycle table moves from `journey_event` (dev-tracking) to `journey_version` row: `status journey_version_status NOT NULL DEFAULT 'draft'`, with `ready_test_at timestamptz`, `ready_publish_at timestamptz`, `archived_at timestamptz` for audit.

## Rules & Consequences

- **Good, because** enum collision vanishes; migration deploys cleanly.
- **Good, because** each enum has a single owner question — runtime asks `journey_status`, authoring asks `journey_version_status`.
- **Good, because** `close-feature.sh` gate can SQL-check one column without joining to an instance table.
- **Bad, because** reviewers now need to remember two enums — documented in ordbok/glossary.
- **Agent Impact:** Any code reading "is this journey shippable?" must query `journey_version.status = 'ready_publish'` — NEVER `journey_status`. Spec v1.7.0 must replace every `ALTER TYPE journey_status` with the new enum migration. `journey_event` no longer stores lifecycle state (closes L-0023 contradiction on spec line 176).

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
