---
title: "Append-Log + Projection Column Is the Right Hybrid When Readers ≫ Writers"
id: LEARNING_0109
status: canonical
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [database, schema-design, handoff, session-note, dark-data, daily-operation, council]
---

# Learning-0109: Append-Log + Projection Column Pattern

## Context

Council 1 of the 2026-04-22 daily-operation session reviewed the handover-migration sub-sortie. The current shape is:

- `department_session.handoff_notes TEXT` — column on the aggregate, treated as canonical store by web (Server Action upserts the column).
- `session_note` — append-log table with `(session_id, note_type, body, created_by, created_at)` columns, written by the mobile handover wizard.

Six readers consume handoff text (admin signoff drawer, daily_reconciliation narrative generator, AI-copilot next-shift brief, Operations Calendar tile, email digest, audit export). Three writers exist (web inline upsert, mobile wizard append, engine_process handover-compose step).

The bug: mobile writes rows into `session_note` that no reader ever looks at. Web readers read `department_session.handoff_notes`. Mobile writes are **dark data** — the audit trail shows them, but no downstream surface reflects them. Additionally, web's upsert pattern races: two managers editing the note at the same end-of-shift moment produce a last-writer-wins overwrite with no history.

Council 1 rejected both "pick the column" and "pick the table" as the fix. The right shape is the hybrid: table is canonical truth, column is a projection maintained by trigger.

## Discovery

For aggregate-scoped content (notes attached to a session, a shift, a department) the storage decision has three candidates, and the decision is reader-count-driven:

1. **Column only** — simple, one read, one write. Right when there is exactly one writer and history does not matter. Breaks immediately when a second writer appears (race, no history, dark-data risk).
2. **Append-log table only** — audit-perfect, multi-writer safe. Right when readers are rare or tolerant of a `DISTINCT ON` / `ORDER BY created_at DESC LIMIT 1` per read. Breaks on hot read paths where that projection query shows up in every page load of a common surface.
3. **Hybrid: append-log table + projection column maintained by trigger** — canonical truth in the table, projection column is a cached derivation on the aggregate. Readers of the hot path read the column; audit / history readers read the table.

The test for choosing the hybrid is three conditions, all required:

- Reader count > 5 distinct call sites.
- "Latest row" is 90%+ of reads — history / thread view is the minority.
- Projection maintenance is simple — single-key `UPDATE aggregate SET col = NEW.body WHERE id = NEW.session_id` in an `AFTER INSERT` trigger on the append-log.

**The hard constraint:** the projection column must be **read-only to application code**. Only the projection trigger may write it. If application code can `UPDATE aggregate.col` directly, the system reverts to the "column-only" failure mode — two writers, race, no history.

`department_session.handoff_notes` fails this constraint today: web Server Actions write the column directly, which is why mobile writes became dark data. The fix is not "stop writing the column" — it's "stop writing the column directly, route all writes through `session_note` INSERT, let the trigger maintain the projection."

## Impact

- **ADR-0188 (proposed, this council):** 3-phase migration of `department_session.handoff_notes`:
  - **Phase 1:** Add `handoff_notes_latest TEXT` projection column. Add `AFTER INSERT` trigger on `session_note` that updates the projection for `note_type='handoff'` rows. Backfill from current `handoff_notes` via one-time migration.
  - **Phase 2:** Migrate all readers from `handoff_notes` → `handoff_notes_latest`. Migrate web writer from column-upsert → `session_note` append. Mobile path already correct.
  - **Phase 3:** Drop `handoff_notes` column. Projection is canonical read path, `session_note` is canonical write path.
- **Design heuristic added (smartout-database-guide skill):** "Append-log + projection" as named pattern. When defining storage for aggregate-scoped content, default to append-log table; add projection column only if the three conditions above are met.
- **Review checklist:** Any PR adding a column that will be written by more than one code path must be challenged — "is this actually a projection of an append-log?" If the answer is yes, do the hybrid.
- **Dark-data tripwire:** If a table has >1 writer but <1 reader, it's dark data. Add a CI check that flags tables in `activity_trail.entity_type` with no SELECT call sites.

## References

- ADR-0188 (proposed — append-log + projection migration for handoff_notes)
- ADR-0187 (related — single-emitter invariant; similar consolidation theme)
- Learning-0108 (triple-writer pattern — same architectural root cause)
- `department_session.handoff_notes` (deprecated column, 3-phase removal planned)
- `session_note` (append-log table, becomes canonical)
- Council 1 verdict, 2026-04-22 daily-operation session

---

> Registered in `docs/learnings/0000-learning-log.md`.
