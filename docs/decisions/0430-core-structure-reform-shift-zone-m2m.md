---
title: "Core Structure Reform Phase 2 — Shift × Zone × Location M:N (Option Y)"
id: ADR_0430
status: accepted
layer: decision
created: 2026-05-27
updated: 2026-05-28
---

# ADR-0430: Core Structure Reform Phase 2 — Shift × Zone × Location M:N (Option Y)

## Context and Problem Statement

ADR-0367 v1.1 established the D6 tri-layer model: `department_session → day_line → shift_session`, with `shift_session_day_line` as the M:N junction between `shift_session` and `day_line`. This model correctly separates the aggregate (payroll), program (day execution), and runtime (per-employee witness) layers.

Two schema artifacts were deferred from that work and now block the cascade's correctness:

**1. `schedule_shift` carries stale direct location columns.**
`schedule_shift` (a D2 planning record — a Vakt in product vocabulary) still carries `location_id FK → location` and `zone TEXT`. These columns predate the HVOR/HVEM orthogonality rule established by ADR-0367 and violate cascade Invariant #1: the planning record must NOT pre-bind a Vakt to one area. A Vakt spans one or more Soner inside an Område; the binding is execution-time, not plan-time. As the business grows to multi-location or event-floor operations, a single Vakt may cover multiple Soner — an M:N relationship that the current `location_id` scalar cannot model.

Concrete write sites that embed the broken pattern today (from the 2026-05-27 Core Structure Reform Index audit):
- `packages/ai/src/capabilities/timeline-template/tools.ts:288` — text zone field written on shift insert
- `packages/ai/src/capabilities/scheduler/tools.ts:541-561, 587-610` — `gatedMutation` extends location_id assignment
- `apps/web/src/app/dashboard/_actions/add-shift-action.ts:288-313` — direct `.insert()` on `schedule_shift` outside `gatedMutation` (G4 gap per ADR-0204)

Additionally, five files carry `// L-0064` comment markers flagging `schedule_shift.department_id` as nullable — a `NOT NULL` constraint was never enforced. This is a schema-level correctness gap: every Vakt must know its Avdeling for payroll, solver eligibility, and audience routing.

**2. `profile.location_id` is an over-binding.**
A profile (employee) is not bound to a single physical area. Their area context is session-derived: which Soner their Vakt intersects on a given day. `profile.location_id` does not appear in any active code path (confirmed by the 2026-05-27 audit; ADR-0056 noted it as "nullable, deprecated"). Retaining it misleads future agents and mobile developers into reading a stale signal. Its presence also blocks clean mobile parity: `apps/mobile/src/components/RoutineReviewForm.tsx` + `use-shift-session.ts:71` + `use-routine-extract.ts:41` currently reach for `profile.location_id` as a shortcut, which must be replaced with the correct `profile → department → department_location → location` path (ADR-0367 Rule 6).

**Council verdict (2026-05-27):** 4/4 reviewers converged on Option Y — APPROVE WITH CHANGES with 8 implementation conditions, transcribed below as load-bearing rules.

---

## Decision Drivers

- **HVOR/HVEM orthogonality (cascade Invariant #1).** `department` is the HVEM axis; `location`/`zone` is the HVOR axis. The junction `department_location` owns the relationship between them at the structural level (D1). A planning record (D2/D6) must derive its area context from the employee's runtime session, not store it as a forgeable scalar on the plan row.
- **M:N inevitability.** A Vakt inside a large Bar/Kitchen/FoH environment routinely spans multiple Soner (e.g. "Bar 1 + Bar 2" during a music event). The current `location_id` TEXT scalar cannot represent this. One row per Sone via `shift_zone` M:N is the only correct model.
- **G4 security gap.** `add-shift-action.ts:288-313` performs direct `schedule_shift` INSERT outside `gatedMutation` (ADR-0204 violation). The zone-expansion work MUST close this gap by wrapping the action in `gatedMutation` before any `zone_ids[]` logic is added.
- **Mobile P0 unblocked.** Dropping `profile.location_id` forces mobile surfaces onto the correct `shift_session → day_line → location` resolution path, which is realtime, sessionful, and multi-area-aware. This unblocks the full `use-shift-session.ts` rewrite needed for ADR-0133 compliance.
- **Performance: single hop.** The current `location:location_id(name)` embed in capability reads (12 sites across 4 files) is a flat scalar lookup. After reform, reads join `shift_session_day_line → day_line → location` — same hop count, but now the join path is correct and works for multi-zone shifts.
- **L-0042 migration discipline.** All new migrations must carry timestamps `> 20260801000000` (current HEAD migration tip: `20260801000000_hq_workspace_location_area_reshape.sql`). The council condition originally stated `> 20260716200100`; the tip has advanced since 2026-05-27 and this constraint supersedes the original.

---

## Considered Options

### Option X — Status quo (keep `schedule_shift.location_id` + `zone` TEXT)

Retain the direct scalar columns and the free-text zone. No migration needed.

**Rejected because:** Scalar `location_id` cannot model M:N. `zone TEXT` is unvalidated and unindexed. As workspace operations grow to multi-zone events, the planning layer corrupts cascade Invariants #1 and #3 (planning must not conflate where and who). Drift compounds — five `L-0064` comments already signal that nullable `department_id` is untracked; adding more nullable zone-shaped columns continues the pattern.

### Option Y — `shift_zone` subordinate to `shift_session_day_line`, with CHECK constraint (CHOSEN)

Introduce a new `shift_zone` table that is a child of the existing `shift_session_day_line` junction (which already exists per migration `20260620120400`). Each `shift_zone` row has a FK to `shift_session_day_line(shift_session_id, day_line_id)` composite PK, plus `zone_id FK → zone`. A CHECK constraint enforces `zone.location_id = day_line.location_id` — a Sone must belong to the same Område as the day_line it is assigned under. `workspace_id` is a top-level column on `shift_zone` (RLS root).

Migration sequence: M1 (backfill `schedule_shift.department_id` + NOT NULL) → M2 (CREATE TABLE `shift_zone` + RLS + CHECK) → M3 (backfill `shift_zone` from existing `shift_session_day_line` defaults) → M4 (DROP COLUMN `schedule_shift.location_id`, `schedule_shift.zone`, `profile.location_id` — only after code-rewrite passes).

**Chosen because:** Subordination to `shift_session_day_line` is the only model that preserves cascade Invariant #1. The junction already exists; `shift_zone` is a refinement inside it, not a new coordination axis. The CHECK constraint makes location coherence a database invariant, not a runtime assertion.

### Option Z — Parallel `shift_zone(shift_id, zone_id)` junction not subordinate to `shift_session_day_line`

Create a standalone M:N junction: `shift_zone(shift_id, zone_id)` with FK to `schedule_shift` and FK to `zone`. No parentage on `shift_session_day_line`.

**Rejected because:** Without anchoring on `shift_session_day_line`, the location coherence invariant (`zone.location_id = day_line.location_id`) cannot be enforced by a CHECK constraint — it would require a cross-table trigger, which is fragile and harder to audit. It also duplicates the `shift_session_day_line` path (the binding already resolves which day_line a shift belongs to), creating two sources of truth for "which area does this shift cover". The council steward identified this collision in Phase 5 (2026-05-27): `shift_session_day_line` already provides the composite key; Option Y subordinates correctly.

### Option W — Add `department.department_group enum {foh, boh, mgmt, events}` alongside this reform (considered and deferred)

The 2026-05-27 audit raised the idea of a grouping column on `department`. The council phase-2.5 fact-check confirmed this enum does NOT exist in the current schema. Adding it here would widen the scope of an already load-bearing migration set.

**Deferred:** ADR-0429 resolves the vocabulary question (FoH/BoH/Admin) at the product/seed level. A schema `department_group` enum is a separate ADR if cross-department query patterns emerge. Not in scope for ADR-0430.

---

## Decision Outcome

**Chosen: Option Y — `shift_zone` subordinate to `shift_session_day_line`, FK to composite + CHECK constraint.**

The reform proceeds in four ordered migrations (M1–M4). READ-capability rewrites happen before WRITE-rewrites. COLUMN-DROP (M4) happens only after code rewrites pass typecheck and E2E.

### Telemetry contract (Condition #6 — HARD pick)

**Chosen: Option β — ride existing `roster.add_shift_manual` event with `metadata.zone_ids[]`.**

Rationale: Option α (new events `shift_zone.assigned` + `shift_zone.removed`) would require two new registry entries AND emit() call-sites in the same commit (L-0176 — per ADR-0377 / L-0193 recurrence trap, registry entry without paired emit() = silent audit hole). Option β reuses the existing `roster.add_shift_manual` event, appending `zone_ids: string[]` to the existing `metadata` payload. The audit trail still answers "which zones were assigned" via the metadata field. The story is complete without new event surface. If zone-level granularity becomes a reporting need (e.g. per-zone utilization metrics), a new `shift_zone.assigned` event can be added via a future ADR with the L-0176 pair constraint explicitly enforced.

### Load-bearing acceptance criteria (all 8 council conditions)

The 8 conditions from the 2026-05-27 council verdict are binding rules. They are restated in the Rules & Consequences section below.

---

## Rules & Consequences

### Rule 1 — Option Y junction model (Condition #1)

`shift_zone` is a child of `shift_session_day_line`. Schema shape:

```sql
CREATE TABLE public.shift_zone (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  shift_session_id      UUID NOT NULL,
  day_line_id           UUID NOT NULL,
  zone_id               UUID NOT NULL,
  location_id           UUID NOT NULL,  -- denormalized for FK coherence (Rule 1)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (shift_session_id, day_line_id)
    REFERENCES shift_session_day_line(shift_session_id, day_line_id),
  FOREIGN KEY (zone_id, location_id) REFERENCES zone(id, location_id),
  FOREIGN KEY (day_line_id, location_id) REFERENCES day_line(id, location_id)
);
```

Location coherence (zone.location_id = day_line.location_id) is enforced as a **composite FK invariant**, not a CHECK constraint. PostgreSQL does not allow subqueries inside CHECK; the denormalized `location_id` column on `shift_zone` plus two composite FKs (one to `zone(id, location_id)`, one to `day_line(id, location_id)`) makes the coherence rule **enforced at every write path** — including service-role bulk INSERT, `pg_dump/restore`, and `session_replication_role = replica`. Two UNIQUE constraints are additive prerequisites: `UNIQUE (zone.id, zone.location_id)` and `UNIQUE (day_line.id, day_line.location_id)` — both columns already exist on the target tables.

**FK is to the composite** `(shift_session_id, day_line_id)` on `shift_session_day_line`, NOT to `shift_session_id` alone. A `shift_zone` row without a matching `shift_session_day_line` parent is structurally invalid and blocked at the DB level.

### Rule 2 — Migration ordering (Condition #2, L-0042 updated)

Four migrations, strictly ordered, timestamps all `> 20260801000000`:

| Migration | Content | Gate |
|---|---|---|
| **M1** | Backfill `schedule_shift.department_id` from position (where NULL); ADD NOT NULL constraint. Remove L-0064 comment markers (5 files). | Must pass before M2 |
| **M2** | CREATE TABLE `shift_zone` + RLS (mirror `department_location` 5-policy pattern + workspace_id trigger) + CHECK constraint | M1 applied |
| **M3** | Backfill `shift_zone` from existing `shift_session_day_line` rows (default zone per location if available; skip ad-hoc shifts with no zone) | M2 applied |
| **M4** | DROP COLUMN `schedule_shift.location_id`, `schedule_shift.zone`, `profile.location_id` | Code-rewrite sortie completed + typecheck + E2E green |

**M4 is explicitly decoupled from M1–M3.** M1–M3 may ship in the same migration sortie. M4 ships only after the Phase b code-rewrite sortie closes with all READ-rewrite + WRITE-rewrite complete and typecheck passing.

**L-0042 correction note:** The reserved stub cited `> 20260716200100`. As of 2026-05-28, the HEAD migration tip on `development` is `20260801000000_hq_workspace_location_area_reshape.sql`. Any implementation sortie must verify the current HEAD tip on the day of work and choose timestamps accordingly.

### Rule 3 — READ-rewrite first (Condition #3)

Before any WRITE-rewrite, 12 READ sites across 4 files must be switched from direct `location:location_id(name)` embed to the `shift_session → day_line → location` single-hop scalar path:

- `packages/ai/src/capabilities/schedule/tools.ts:{80, 253, 324, 414}`
- `packages/ai/src/capabilities/communication/briefing.ts:{37, 52}`

No LLM prompt template changes are required for these reads — the returned `location.name` string is the same. The join path changes; the output shape does not.

### Rule 4 — WRITE-rewrite with `gatedMutation` (Condition #4)

Three write sites must be rewritten after READ-rewrite:

- `packages/ai/src/capabilities/timeline-template/tools.ts:288` — text zone field → `shift_zone` INSERT (server-resolved `zone_id` per ADR-0151)
- `packages/ai/src/capabilities/scheduler/tools.ts:541-561, 587-610` — extend existing `gatedMutation` block to include atomic `shift_zone` INSERT after shift_session creation
- `apps/web/src/app/dashboard/_actions/add-shift-action.ts:288-313` — **CLOSE G4**: wrap entire INSERT in `gatedMutation`; extend for `zone_ids: string[]` input validation per Rule 7 (forgery defense)

The `gatedMutation` wrap on `add-shift-action.ts` is a security gate (ADR-0204 + ADR-0287), not just a style refactor. Shipping `zone_ids[]` support before closing G4 is FORBIDDEN.

### Rule 5 — Mobile rewrite (Condition #5)

Three mobile files must replace the `profile.location_id` direct read with the `profile → department → department_location → location` resolution path:

- `apps/mobile/src/components/RoutineReviewForm.tsx`
- `apps/mobile/src/hooks/queries/use-shift-session.ts:71`
- `apps/mobile/src/hooks/use-routine-extract.ts:41`

The replacement hook (`useShiftSession` or equivalent) must be placed in `packages/data/` per ADR-0133 Mobile Parity rule so both web and mobile consume the same hook. Mobile surfaces remain read-only (ADR-0133); no mobile authoring UI for `shift_zone` assignment.

**Path-verification note (added 2026-05-28):** `grep "profile.location_id" apps/mobile/` returns zero hits as of 2026-05-28 — the over-binding may already be unused on mobile. Phase b implementer must re-grep before declaring each file changed; if reads have already been refactored, that file becomes a no-op for Rule 5.

### Rule 6 — Telemetry contract (Condition #6 — HARD, already resolved)

Option β chosen. The telemetry event extended is **`"shift added_manual"`** (registry.ts:753 — note the space, not a dot). The capability gate identifier `roster.add_shift_manual` (registry.ts:751 comment, `engine_authority_config` row) is a **separate concept** — it controls authorization, not telemetry routing. Phase b implementer must NOT search for `roster.add_shift_manual` as an event key; the event lookup uses the literal string `"shift added_manual"`.

Extension shape: append `zone_ids?: string[]` (optional in the TypeScript interface so legacy callsites compile) to `ShiftAddedManual.properties.data`. Same extension applies to two adjacent events that also fire during zone-bearing shift creation — see Rule 6b.

The L-0176 constraint is satisfied: no new event names are registered, so no new emit() call-sites are required to pair with them. If a future ADR adds `shift_zone.assigned` / `shift_zone.removed` events, the pair constraint applies at that ADR.

### Rule 6b — Three emit-sites carry `zone_ids` (audit completeness)

The audit trail requires zone provenance on every emit path that triggers `shift_zone` INSERT. Three telemetry events are extended in Phase b:

| Event name | Interface | Emit-site | Notes |
|---|---|---|---|
| `"shift added_manual"` | `ShiftAddedManual` (registry.ts:752) | `apps/web/src/app/dashboard/_actions/add-shift-action.ts:326` | Manual single-shift create via web Server Action; G4 closure also lands here (Rule 4) |
| `"shift created"` | `ShiftCreated` (registry.ts:709) | `packages/ai/src/capabilities/timeline-template/tools.ts:300` | Template-driven shift create; per-item emit inside `mutateWithGate` exec |
| `"scheduler.proposal.accepted"` | (registry entry) | `packages/ai/src/capabilities/scheduler/tools.ts:640` | Bulk proposal-accept; one emit per bundle per ADR-0309, NOT per shift |

Mobile BFF emit-site `apps/web/src/app/api/mobile/shifts/route.ts` (documented emit-site for `"shift added_manual"`) also carries `zone_ids` — passes empty array `[]` since mobile is read-only on shift authoring per ADR-0133.

All three interface extensions land in the SAME commit as their respective emit-site updates (L-0176 spirit applied across existing events).

### Rule 7 — Forgery defense (Condition #7, ADR-0151)

In `add-shift-action.ts` (and in any capability tool that accepts `zone_ids[]`), the server MUST validate each supplied `zone_id` before INSERT:

1. Fetch `zone WHERE id = zone_id AND workspace_id = ctx.workspaceId`
2. Assert `zone.location_id IN (SELECT location_id FROM department_location WHERE department_id = resolved_department_id AND workspace_id = ctx.workspaceId)`
3. Fail 400 on any zone that does not belong to the resolved department's operational areas

This closes the forgery surface: a client cannot supply a `zone_id` from another workspace or a zone outside the department's areas. The CHECK constraint on `shift_zone` is the last line of defense; the capability layer is the first.

### Rule 8 — L-0064 cleanup (Condition #8)

After M1 adds the NOT NULL constraint on `schedule_shift.department_id`, remove the **2 Class-B L-0064 comment markers** that workaround the nullable column:

- `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts:299`
- `apps/web/src/app/dashboard/_hooks/use-shift-day-stats.ts:18`

**DO NOT** touch Class-A L-0064 markers. The canonical L-0064 (per `docs/learnings/0064-phase-enum-ui-vs-db-drift.md`) is **"Phase Enum UI-vs-DB Drift"** — derivation-helper signposts for the locked-phase pattern in `WebDayControl.tsx`, `derive-phase.ts`, `use-daily-reconciliation.ts`, `toggle-session-task-action.ts`, `packages/telemetry/src/registry.ts`, `compile-day-brief.ts`, `compile-preclose.ts`, `communication/tools.ts`, and `operations/tools.ts` (9 files). These are NOT workarounds and remain valid post-reform.

Two semantic classes have squatted on the same Learning ID. Phase b cleanup applies ONLY to Class B (nullable-`department_id` workarounds). The audit INDEX (2026-05-27) cited 5 files for cleanup — code-trace 2026-05-28 verified 3 of those (RosterTab.tsx, use-roster.ts, add-shift-action.ts) no longer carry markers; the audit was stale.

### Rule 9 — Channel pinning (ADR-0078)

Capability tool calls that assign `zone_ids` to a shift (`schedule.create_shift_with_zones`, `roster.add_shift_manual` with `zone_ids[]`, equivalent zone-assignment paths inside `scheduler`, `timeline-template`) are **chat-only**. Voice surface MUST NOT expose zone-assignment writes.

ADR-0367 lineage (web-only authoring per ADR-0133) implies this, but the channel guard is restated explicitly here to prevent silent voice-surface drift. Verification: `services/voice-agent/src/tools-*.ts` must NOT register any tool that writes to `shift_zone`. `engine_authority_config` row for `roster.add_shift_manual` must have `channel_constraint = 'chat_only'`.

---

### Consequences

**Good:**
- **HVOR/HVEM orthogonality enforced.** `schedule_shift` carries no location column. Area context derives exclusively from `shift_session → shift_session_day_line → day_line → location`. Cascade Invariant #1 is a schema fact, not a convention.
- **M:N native.** One Vakt can cover multiple Soner. Event-floor operations (Bar + Kitchen co-staffing a same area) and multi-zone assignments work without schema changes.
- **G4 closed.** `add-shift-action.ts` gets `gatedMutation` wrap — closes a pre-existing ADR-0204 violation independently of the zone reform.
- **Mobile path corrected.** `profile.location_id` removal forces mobile onto the session-derived path, which is accurate and multi-zone-aware.
- **L-0064 comments eliminated.** Codebase gains a NOT NULL constraint and loses 5 misleading comment workarounds.
- **Composite FK is database law.** Zone-to-area coherence (zone.location_id = day_line.location_id) is enforced at INSERT by two composite FOREIGN KEYs on `shift_zone`, not by CHECK or runtime assertion. PostgreSQL FK enforcement survives bulk INSERT, pg_dump/restore, and session_replication_role switches.

**Bad:**
- **M4 is a blocking column drop.** Dropping `schedule_shift.location_id` and `schedule_shift.zone` requires ALL read and write sites to be migrated before M4 ships. Any capability tool, Edge Function, or E2E fixture that still references the dropped columns will fail to typecheck. The code-rewrite sortie must be exhaustive.
- **E2E fixture changes.** Any E2E test that seeds `schedule_shift` with `location_id` or `zone` must be updated. After M4 the fixture pattern is: create shift → create shift_session → create shift_session_day_line → create shift_zone(s).
- **Backfill heuristic for M3 is lossy.** Existing `shift_session_day_line` rows may not have a corresponding `zone` to assign (many environments have zones undefined or unlinked to areas). M3 must handle the NULL-zone case gracefully: insert `shift_zone` only when a zone can be unambiguously resolved; log skipped rows.
- **Domain spine docs need refreshing post-M4.** `docs/domains/scheduling/DATA-MODEL.md`, `docs/domains/scheduling/USER-FLOWS.md`, and `docs/domains/scheduling/ARCHITECTURE.md` are all marked `UPDATE-pending-reform` in the 2026-05-27 audit. These must be updated after M4 ships (separate from this ADR — domain-steward skill).

---

## Agent Impact

- **`botsson-harness-builder`** — No new capability namespace needed. The existing `schedule` and `timeline-template` capabilities absorb the zone-write tools. **V1: NO intent-enum entry — zone-assignment is web-only authoring per ADR-0133.** Botsson does NOT route `shift_zone.assign` in V1. If a future ADR opens voice/chat routing for zone-assignment, ADR-0112 same-commit gate (enum entry + system-prompt prose + tool registration in one commit) applies at that ADR.
- **`system-agent-coordinator`** — Update intent classifier if a new `shift_zone`-related intent token is added. If using Option β telemetry (existing event extended), no classifier change needed for telemetry routing.
- **`frontend-designer`** — `TidslinjeTab.tsx` and `ScheduleShiftModal` must show a zone-picker that presents `zone` rows from the shift's resolved `department_location` areas, not a free-text field. Zone assignment is web-only authoring per ADR-0133.
- **`smartout-cascade-developer`** — M1–M3 migrations must be written and tested against local Supabase (`supabase db reset` → apply → `supabase gen types --local` → verify zero TS errors) before M4. Track-F live-invoke rule (MEMORY.md L-0348) applies: every new DB-read capability added in the code-rewrite sortie MUST end with a Node-script live invoke on a seeded local DB.
- **Mobile (campaign/mobile)** — Replace `profile.location_id` reads in the 3 files from Condition #5. No new mobile authoring UI. Verify `useShiftSession` hook in `packages/data/` exports the correct area context for the viewer's active shift.
- **`payroll-engine-developer`** — No change. Payroll is scoped to `(department_id, date_range)`. Zone reform is HVOR-axis only; `department_id` on `schedule_shift` is unchanged. M1's NOT NULL backfill on `department_id` is additive for payroll (makes existing department_id reads more reliable).

---

## Implementation Sequence

Phase a (this ADR — planning only). Phase b is a separate implementation sortie.

**Pre-sortie gates (before Phase b begins):**
1. Council Phase 3-9 re-confirmation that this proposed ADR is accepted.
2. Verify no in-flight feat/* branch has migrations with timestamp conflicts against M1–M4 slots (ADR-0427 collision-aliasing doctrine).
3. Confirm `shift_session_day_line` composite PK exists in current schema (migration `20260620120400`) — verified by the 2026-05-27 steward.
4. **M0.5 — Position orphan reconciliation.** Before M1, generate a reconciliation report: `SELECT COUNT(*) FROM schedule_shift s LEFT JOIN position p ON s.position_id = p.id WHERE s.department_id IS NULL AND s.position_id IS NOT NULL AND p.department_id IS NULL` — if non-zero, M1 backfill will fail. Reconcile orphans (add department_id to position rows OR triage to specific Vakt rows) before M1 NOT NULL constraint.
5. **M3 default-zone definition.** Before M3 backfill, define "default zone per location" operationally: **the single `zone` row with lowest `sort_order` WHERE `workspace_id` matches AND `location_id` matches**. No `is_default` flag exists on the zone table. If multiple zones tied on `sort_order`, skip backfill for that location (log SKIPPED). If no zones at all for a location, skip silently.
6. **M3.5 pre-M4 — `pg_depend` audit + `ensure_shift_session` trigger rewrite.** Run `SELECT * FROM pg_depend WHERE refobjid = 'schedule_shift'::regclass::oid AND deptype = 'n'` to enumerate every trigger/view/policy referencing `schedule_shift.location_id` or `schedule_shift.zone`. The `ensure_shift_session` trigger (verify exists in current schema) must be rewritten to source location from `shift_session_day_line` instead of `schedule_shift.location_id` BEFORE M4 column drops. Document each rewrite in Phase b HANDOFF.

**Phase b — implementation sortie:**

| Step | Action | Files |
|---|---|---|
| M1 | Migration: backfill `schedule_shift.department_id` from `position.department_id` where NULL; ADD CONSTRAINT NOT NULL; remove 2 Class-B L-0064 comments (use-day-timeline-events.ts:299, use-shift-day-stats.ts:18) | `supabase/migrations/202608NNNNNNNN_shift_dept_not_null_backfill.sql` |
| M2 | Migration: CREATE TABLE `shift_zone` + RLS 5-policy mirror + workspace_id trigger + CHECK constraint | `supabase/migrations/202608NNNNNNNN_shift_zone_table.sql` |
| M3 | Migration: backfill `shift_zone` from existing `shift_session_day_line` rows (skip where zone unresolvable) | `supabase/migrations/202608NNNNNNNN_shift_zone_backfill.sql` |
| READ-rewrite | Switch 12 READ sites off `location_id` embed → `shift_session → day_line → location` scalar | `schedule/tools.ts:{80,253,324,414}`, `briefing.ts:{37,52}` |
| WRITE-rewrite | Close G4 in `add-shift-action.ts`; extend `timeline-template/tools.ts:288` + `scheduler/tools.ts:541-561,587-610` for `shift_zone` inserts with forgery defense (Rule 7) | see Conditions #3+#4+#7. **Pattern B (ADR-0356) audit symmetry required:** `timeline-template/tools.ts` writing `shift_zone` rows is cross-namespace (shift_session_day_line is owned by `schedule`/`scheduler`); emit MUST include `actor_capability: "schedule"` + `delegated_via: "timeline-template"`. `scheduler` own-namespace write does NOT require Pattern B. |
| Mobile rewrite | Replace `profile.location_id` reads in 3 mobile files; place resolved hook in `packages/data/` | see Condition #5 |
| Telemetry | Extend `roster.add_shift_manual` payload with `metadata.zone_ids: string[]` in registry + emit() call-site (Option β — same commit per L-0176 spirit) | `packages/telemetry/src/registry.ts` |
| Typecheck | `pnpm turbo typecheck` — 0 errors | TURBO_CONCURRENCY=1 due to WSL2 OOM risk |
| E2E update | Update shift-creation E2E fixtures to drop `location_id`/`zone` fields; add `shift_zone` junction seed | `apps/e2e/` |
| M4 | Migration: DROP COLUMN `schedule_shift.location_id`, `schedule_shift.zone`, `profile.location_id` | `supabase/migrations/202608NNNNNNNN_drop_stale_location_columns.sql` |
| Regen types | `supabase gen types --local` → commit updated `packages/supabase/dist/database.types.ts` | Must run after M4 |
| Domain spine | Update `docs/domains/scheduling/` spine (DATA-MODEL, USER-FLOWS, ARCHITECTURE) per domain-steward skill | separate from code commits |

---

## Cross-References

- ADR-0056 — Cascade Core Foundation Schema (D1–D6 model; `schedule_shift` placement)
- ADR-0095 / ADR-0108 — Shift lifecycle (five-state machine; shift_session anchor)
- ADR-0133 — Mobile boundary: web composes, mobile executes (zone assignment = web-only authoring)
- ADR-0151 — Server-resolved IDs (forgery defense on `zone_ids[]`)
- ADR-0173 — Frozen-4 capability boundaries
- ADR-0204 — gatedMutation (G4 closure in add-shift-action.ts)
- ADR-0356 — Cross-namespace delegation symmetry (cascade tool emit fields: `actor_capability` + `delegated_via`)
- ADR-0287 — gate_action mandatory on mutation capability tools
- ADR-0367 — D6 tri-layer model (foundational; this ADR extends it)
- ADR-0392 — Domain steward 8-file spine (scheduling domain spine refresh triggered by M4)
- ADR-0427 — Forward-only repair for timestamp-collision class (migration timestamp discipline)
- ADR-0429 — Department vocabulary (Avdeling/Stilling/Sone/Område/Vakt canonical glossar used in this ADR)

---

## Open Follow-ups

- **Phase b implementation sortie** — requires Council Phase 3-9 re-confirmation of this proposed ADR before any code changes.
- **Domain spine refresh** — `docs/domains/scheduling/DATA-MODEL.md`, `USER-FLOWS.md`, `ARCHITECTURE.md` all marked `UPDATE-pending-reform` in the 2026-05-27 audit. Update after M4 (domain-steward `post` mode).
- **Zone-picker UI** — TidslinjeTab + ScheduleShiftModal need a zone-picker component. Design decision: free-text → Sone FK selector. Nordic Split tokens apply (ADR-0366).
- **`shift_zone.assigned` / `shift_zone.removed` events** — deferred to a future ADR if per-zone granularity reporting becomes a requirement. The L-0176 pair constraint applies at that ADR.
- **E2E fixture generator** — `close-feature.sh` pre-merge check for `schedule_shift` fixture rows containing `location_id` or `zone` fields (ADR-0416 schema-fixture coherence pattern). Add to fixture-coherence script.
- **`department.department_group` enum** — deferred per Option W analysis above. Separate ADR if cross-department query patterns emerge.

---

> Council reference: `docs/audits/2026-05-27-core-structure-reform-index/INDEX.md` + Track K council session 2026-05-27.
> Phase b implementation conditions: all 8 council conditions from 2026-05-27 are encoded as Rules 1–8 above.
> Status becomes `accepted` after council Phase 3-9 re-confirmation.
