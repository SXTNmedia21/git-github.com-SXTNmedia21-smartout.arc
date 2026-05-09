---
title: "Legacy `department_session.handoff_notes` column deprecation"
id: ADR-0188
status: accepted
layer: decision
created: 2026-04-22
updated: 2026-04-23
---

# ADR-0188: Legacy `department_session.handoff_notes` column deprecation

## Context and Problem Statement

Council 1 + Council 2 (2026-04-22) discovered the handoff write path is **half-migrated**. Two write paths target different stores, and 6 readers still read the legacy TEXT column — which means every mobile handoff submitted since launch has been dark data, never surfaced to admin or AI.

**Already using the `session_note` table (canonical):**

- Mobile offline-queue: `apps/mobile/src/lib/sync/action-map.ts:95` writes `session_note` with `note_type='handoff'`
- Mobile hook: `apps/mobile/src/hooks/mutations/use-submit-handoff.ts:35-42`
- Table + enum exist: `supabase/migrations/20260412100300_session_infrastructure.sql:120-128` (`session_note_type = handoff | closing | general`)

**Still reads/writes legacy TEXT column `department_session.handoff_notes`:**

- Web upsert (RACE): `apps/web/src/components/dashboard/cockpit/sheets/DailyNoteSheet.tsx:97,113-131` — overwrites the entire column on save; has no `emit()` (ADR-0134 violation).
- AI capability readers: `packages/ai/src/capabilities/communication/briefing.ts:96,143`, `packages/ai/src/capabilities/communication/compile-day-brief.ts:36,111`, `packages/ai/src/capabilities/operations-intelligence/monitor-tools.ts:133`.
- Mobile home: `apps/mobile/src/components/home/BeforeShiftView.tsx:98-104,161`.
- Web checklist: `apps/web/src/app/dashboard/close/_components/ChecklistSection.tsx:47`.
- Cron: `supabase/functions/ops-day-brief/index.ts:61,99`.

6 readers on the TEXT column, 2 mobile writers + 1 web upsert writer on diverging stores. `session_note` gives typed structure, per-row authorship (`created_by`), timestamps, enum typing, natural multi-entry support (split-shift — Invariant #11), and RLS already designed. The TEXT blob has none of that.

## Decision Drivers

- **Dual source of truth** — mobile writes `session_note`, web overwrites a TEXT column. Readers see one or the other. Data loss by design.
- **Split-shift semantics (Invariant #11)** — single TEXT column cannot represent multiple handovers in one department_session; append-log can.
- **ADR-0134 compliance** — the web upsert path has no `emit()`. Migration to `session_note.insert()` fixes the telemetry hole as a side effect.
- **Audit integrity** — per-row `created_by` + `created_at` vs. "whoever saved last wins" on a shared blob.
- **AI context richness** — briefing capabilities benefit from multiple recent handoffs (LIMIT N, author-attributed) rather than one concatenated blob.
- **Backwards compatibility** — 6 readers break if the column is dropped without migration; a phased rollout is mandatory.

## Considered Options

1. **Path A — Column canonical + append RPC.** Make the TEXT column the source of truth; wrap writes in an RPC that appends. Rejected — inverts the already-half-shipped migration; mobile is already on `session_note`.
2. **Path B — `session_note` canonical, 3-phase deprecation (chosen).** Stop new writes to the column, migrate readers in a follow-up sub-sortie with backfill, drop the column after a 30-day observation window.
3. **Path C — Hybrid: column as denormalized projection via trigger.** Keep the column as a denormalized "latest handoff" projection maintained by a trigger on `session_note`. Rejected — no codebase precedent for denormalize-via-trigger, invents a pattern to paper over the divergence, and trigger loops risk interaction with ADR-0187.
4. **Path D — Drop column immediately.** Rejected — 6 readers break, historical handoff content lost.

## Decision Outcome

Chosen option: **Path B — `session_note` canonical, 3-phase deprecation.**

`session_note` is the canonical store for handoff content. `department_session.handoff_notes` is deprecated and removed across three phases, each a distinct sub-sortie.

### Phase 1 — Stop writing (this sub-sortie, M3)

- Migrate `DailyNoteSheet.tsx:113-131` from `.upsert()` on the column to `session_note.insert()` with `note_type='handoff'`.
- Add `emit()` to the new write path (fixes ADR-0134 violation).
- Revoke `UPDATE` privilege on `department_session.handoff_notes` from application roles (`authenticated`, service). Only trigger functions (ADR-0187 pattern) may UPDATE; no app-level writes.
- Deprecation comment: `COMMENT ON COLUMN department_session.handoff_notes IS 'DEPRECATED — read only. See ADR-0188. Will be removed after reader migration.';`

### Phase 2 — Migrate readers (follow-up sub-sortie, ~2 weeks later)

- Migrate the 6 readers to `session_note` queries:
  ```sql
  SELECT content, created_by, created_at
  FROM session_note
  WHERE note_type = 'handoff'
    AND department_session_id = ?
  ORDER BY created_at DESC
  LIMIT N
  ```
  N = 1 for "latest handoff" readers (`BeforeShiftView`, `ChecklistSection`). N = 10 for AI briefing context (`briefing.ts`, `compile-day-brief.ts`, `monitor-tools.ts`, `ops-day-brief`).
- Backfill migration — for every `department_session.handoff_notes IS NOT NULL` where no `session_note(handoff)` row exists for that session, `INSERT` a synthetic row:
  - `created_by = duty_leader_id` (fallback: `opened_by`)
  - `created_at = closed_at OR updated_at`
  - `content = handoff_notes`
  - `source_discriminator = 'backfill_adr_0188'` (filter trigger emits per ADR-0150)
- Backfill is idempotent — re-runnable.

### Phase 3 — Drop column (after Phase 2 in production + 30-day observation)

- `ALTER TABLE department_session DROP COLUMN handoff_notes;`
- Regenerate `packages/supabase/src/database.types.ts`.

## Rules & Consequences

### Positive

- Structured, typed, multi-entry-capable handoff data.
- Per-row authorship + timestamps for audit.
- Natural split-shift support (Invariant #11 in `CAMPAIGN-daily-operation.md`).
- AI capability reads get richer context — filterable, paginated, author-attributed.
- Removes dual source of truth and the web-upsert RACE.
- Closes the ADR-0134 telemetry hole on the web handoff path as a side effect.

### Negative

- 6-reader migration effort in Phase 2.
- Backfill migration must preserve every row of historical handoff content — no data loss acceptable.
- 3-phase rollout extends the deprecation window (~6 weeks end-to-end).

### Neutral

- Mobile writers unchanged — already canonical.
- `signoff_notes` column is a separate concern (ADR-0157 day-control); not touched here.

### Agent Impact

- Any new capability or tool reading handoff content after Phase 2 MUST query `session_note`, not the TEXT column. Readers written before Phase 2 lands are listed in this ADR and must be migrated together.
- AI briefing prompts can be upgraded to surface up to N recent handoffs with author attribution instead of a single blob — consumers should plan for the richer context.
- Phase 1 writers must emit `session.handoff_submitted` (or matching registry entry) via the canonical `emit()` path. Any "silent" upsert is forbidden going forward.

## Related ADRs

- **Depends on** ADR-0187 (single-emitter invariant) — Phase 1 must coordinate the new `session_note` write's emit with existing `session_note` insert triggers; no double-emit.
- **Amends** ADR-0156 (Day-Control canonical admin surface) — `WebDayControl` reads handoff via `session_note` post-Phase 2.
- **Related** ADR-0134 (Mobile Telemetry Contract) — `DailyNoteSheet.tsx` writer gains `emit()` as part of Phase 1 fix.
- **Related** ADR-0150 (Source-discriminator trigger filters) — backfill uses `source_discriminator='backfill_adr_0188'` to avoid re-emitting historical events.
- **Supersedes:** none.

## References

- Council 1 + Council 2 verdicts — 2026-04-22
- `apps/web/src/components/dashboard/cockpit/sheets/DailyNoteSheet.tsx:97,113-131` (Phase 1 target)
- `supabase/migrations/20260412100300_session_infrastructure.sql:120-128` (table + enum)
- `apps/mobile/src/lib/sync/action-map.ts:95` (already canonical)
- `apps/mobile/src/hooks/mutations/use-submit-handoff.ts:35-42` (already canonical)
- `CAMPAIGN-daily-operation.md` §Campaign Invariants #11 (split-shift semantics)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
