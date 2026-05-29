---
title: "PLAN-4b — Mobile hook + M4 COLUMN DROP + typegen + spine refresh + JOURNEY + HANDOFF"
sortie: adr-0430-shift-zone-m2m
plan: "4b"
tier: T3
phase: final-cleanup
created: 2026-05-29
status: pending
depends_on: [PLAN-4a]
blocks: []
estimated_effort_hours: 6-9
adr_rules_covered: [Rule 5, Rule 2 M4, Rule 8 final]
adrs_referenced: [ADR-0133, ADR-0367, ADR-0392, ADR-0430]
council_session: COUNCIL-PLAN-4-strategy-17-site.md
---

# PLAN-4b — Mobile + M4 + typegen + spine + HANDOFF

## Purpose

Close the reform. After PLAN-4a verifies all display sites consume `zones[]` and
typecheck is green, this plan:
1. Relocates the mobile shift-session hook to `packages/data/` (ADR-0133 parity).
2. Rewrites the `ensure_shift_session` trigger (DROP + CREATE — not OR REPLACE).
3. Ships M4: the irreversible column drop of `schedule_shift.location_id`,
   `schedule_shift.zone`, `profile.location_id` (with explicit FK drop first).
4. Regens `packages/supabase/src/database.types.ts` (NOT dist/).
5. Refreshes domain spine docs (scheduling + day-session + core-structure).
6. Writes JOURNEY + HANDOFF (required close-feature.sh gates).
7. Updates ADR-0430 frontmatter status: `accepted` → `implemented`.

This is the **point of no return.** M4 cannot be rolled back. All prior plans
(0–4a) must be GREEN before PLAN-4b begins.

---

## Pre-conditions

All of the following must be confirmed GREEN before any PLAN-4b work:

- [ ] PLAN-0: all pre-flight gates passed (pg_depend audit clean, M0.5 reconciliation done)
- [ ] PLAN-1: M1 + M2 + M3 applied and typecheck green
- [ ] PLAN-2: READ-rewrite complete (12 sites)
- [ ] PLAN-3: WRITE-rewrite + G4 closure + emit complete
- [ ] PLAN-4a: all 10 ACs passed, pre-grep gate = 0, typecheck green, live-invoke confirmed
- [ ] M4 pg_depend check: `SELECT * FROM pg_depend WHERE refobjid IN ('schedule_shift'::regclass::oid, 'profile'::regclass::oid) AND deptype = 'n'` returns 0 rows for `location_id` / `zone` column references

Do NOT proceed past this checklist if any item is unchecked.

---

## Scope

### 4b.1 — Mobile hook relocation (Rule 5, MF-Prior-6)

Relocate the shift-session hook to `packages/data/src/day-session/` (kebab-case
convention per MF-Prior-6 — directory mirrors `apps/mobile/src/hooks/queries/`
but lives in the shared package).

**Target path:** `packages/data/src/day-session/use-shift-session.ts`

The hook resolves area context via the correct path:
```
profile → department → department_location → location
```
(NOT `profile.location_id` — that column is dropped by M4.)

Multi-zone aware: returns `zones: Array<{ name: string; location_id: string }>`
sourced from `shift_session → shift_session_day_line → shift_zone → zone`.

**Per-file verification (before editing):**
```bash
grep -n "profile\.location_id\|p\.location_id" \
  apps/mobile/src/components/routine/RoutineReviewForm.tsx \
  apps/mobile/src/hooks/queries/use-shift-session.ts \
  apps/mobile/src/hooks/use-routine-extract.ts
```

If 0 hits (expected per orchestrator pre-flight 2026-05-28): no direct-read
removal needed. Only hook relocation applies. If hits found (unexpected): replace
each direct read with the relocated hook before M4.

After relocation, update imports in:
- `apps/mobile/src/components/routine/RoutineReviewForm.tsx` → `from '@smartout/data'`
- `apps/mobile/src/hooks/queries/use-shift-session.ts` → delete local body, re-export from `@smartout/data`
- `apps/mobile/src/hooks/use-routine-extract.ts` → `from '@smartout/data'`

---

### 4b.2 — Trigger rewrite (MF-Prior-1)

The `ensure_shift_session` trigger must be rewritten as a full DROP + CREATE pair
(not `CREATE OR REPLACE FUNCTION` alone), per MF-Prior-1.

**Important:** The old trigger definition may contain `OF location_id` in its
`AFTER UPDATE OF location_id ON schedule_shift` clause. The new trigger must NOT
include `OF location_id` — that column is dropped by M4. If the trigger fires on
`INSERT OR UPDATE` with no column filter, or on `shift_session_day_line`, that is
the correct replacement.

Migration file: `supabase/migrations/<ts>_ensure_shift_session_trigger_rewrite.sql`
Timestamp must be `> 20260801000004` AND less than M4 timestamp.

```sql
-- supabase/migrations/<ts>_ensure_shift_session_trigger_rewrite.sql
BEGIN;

DROP TRIGGER IF EXISTS trg_ensure_shift_session ON schedule_shift;
DROP TRIGGER IF EXISTS trg_ensure_shift_session ON shift_session_day_line;

CREATE OR REPLACE FUNCTION ensure_shift_session()
RETURNS trigger AS $$
DECLARE
  v_location_id UUID;
BEGIN
  -- Resolve location from shift_session_day_line → day_line (NOT from schedule_shift.location_id)
  SELECT dl.location_id INTO v_location_id
  FROM shift_session_day_line ssdl
  JOIN day_line dl ON dl.id = ssdl.day_line_id
  WHERE ssdl.shift_session_id = NEW.id  -- or NEW.shift_session_id depending on trigger table
  LIMIT 1;

  -- Remainder of function body derived from PLAN-0 pg_depend audit output
  -- (implementer: replace sketch with actual function body from audit)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-attach trigger WITHOUT OF location_id clause
-- (exact table + event depends on PLAN-0 audit findings)
CREATE TRIGGER trg_ensure_shift_session
  AFTER INSERT ON shift_session_day_line
  FOR EACH ROW EXECUTE FUNCTION ensure_shift_session();

COMMIT;
```

> Note: The exact trigger body and attachment point depend on PLAN-0 `pg_depend`
> audit output. The sketch above is illustrative. Implementer MUST load
> `PLAN-0-pre-flight-gates.md` + the produced `pg-depend-audit.txt` before writing
> the actual migration.

---

### 4b.3 — M4: column drop (Rule 2, MF-Prior-5)

M4 migration timestamp must be `> 20260801000004` AND greater than the trigger
rewrite migration above.

```sql
-- supabase/migrations/<ts>_drop_stale_location_columns.sql
BEGIN;

-- Explicit FK drop BEFORE column drop (MF-Prior-5)
ALTER TABLE profile
  DROP CONSTRAINT IF EXISTS fk_profile_location;

-- Sanity check: fail loudly if pg_depend still has references
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_depend d
    JOIN pg_class c ON c.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE c.relname IN ('schedule_shift', 'profile')
      AND a.attname IN ('location_id', 'zone')
      AND d.deptype = 'n'
  ) THEN
    RAISE EXCEPTION
      'M4 BLOCKED: pg_depend rows still reference schedule_shift.location_id, '
      'schedule_shift.zone, or profile.location_id — trigger/view/policy rewrite incomplete';
  END IF;
END $$;

-- Drop in order: schedule_shift first, then profile
ALTER TABLE schedule_shift DROP COLUMN IF EXISTS location_id;
ALTER TABLE schedule_shift DROP COLUMN IF EXISTS zone;
ALTER TABLE profile        DROP COLUMN IF EXISTS location_id;

COMMIT;
```

---

### 4b.4 — Typegen regen (MF-Prior-2)

After M4 is applied on the local Supabase instance:

```bash
supabase db reset
supabase gen types --local > packages/supabase/src/database.types.ts
```

Target is `packages/supabase/src/database.types.ts` (the `src/` path, **NOT**
`dist/`). The `dist/` version is a build output, not the source file that gets
committed.

Verify dropped columns are gone:
```bash
grep -E "schedule_shift.*location_id|schedule_shift.*zone[^_]|profile.*location_id" \
  packages/supabase/src/database.types.ts
# Expected: 0 matches (allow "shift_zone" — that table IS expected)
```

---

### 4b.5 — App-code cleanup post-typegen

After typegen, `pnpm turbo typecheck` may surface remaining call-sites. Common
patterns:

- E2E fixtures seeding `schedule_shift` with `location_id` or `zone` fields
- Test helpers that build mock shift rows
- Capability tool or BFF route still reading the dropped column (should be 0 after
  PLAN-2 + PLAN-3 + PLAN-4a, but verify)

For each TS error: fix the call-site. Do NOT add `as any` — use the correct type
or remove the field reference. E2E fixtures: update to drop the stale fields and
add `shift_zone` junction seeds per the new pattern.

---

### 4b.6 — Domain spine refresh (ADR-0392, MF-Prior-7)

After M4 and typecheck GREEN, refresh four spine files in `domain-steward post`
mode:

**`docs/domains/scheduling/DATA-MODEL.md`**
- Remove `location_id` + `zone` from `schedule_shift` table row
- Add `shift_zone` table entry (columns: id, workspace_id, shift_session_id, day_line_id, zone_id, location_id; note composite FK + two-hop location coherence)
- Remove `location_id` from `profile` table row
- Update `mirror:` frontmatter to `verified` for updated rows

**`docs/domains/scheduling/USER-FLOWS.md`**
- Update "create shift" flow: zone-picker (web) → `shift_zone` row created
- Add: "mobile reads zones via `shift_session → shift_session_day_line → shift_zone → zone`"
- Remove: any flow that reads `schedule_shift.zone` scalar

**`docs/domains/scheduling/ARCHITECTURE.md`**
- Update D6 tri-layer diagram if `shift_zone` isn't shown as `shift_session_day_line` child
- Reference ADR-0367 v1.1 tri-layer + ADR-0430 `shift_zone` subordination

**`docs/domains/day-session/DATA-MODEL.md`**
- Line ~343: remove drop-candidate annotation for `shift_session.location_id` (MF-Prior-7 — this annotation becomes stale after M4 lands; the reform is complete, not pending)
- Update `mirror:` frontmatter accordingly

**`docs/domains/core-structure/DATA-MODEL.md`**
- Schema reference parity with new `shift_zone` table

Keep `mirror: verified` only for sections confirmed against the post-M4 schema.
Mark sections that are forward-only as `mirror: aspirational`.

---

### 4b.7 — JOURNEY file (MF-Prior-3)

Required by `close-feature.sh` gate (CLAUDE.md mandate).

**File:** `docs/journeys/JOURNEY-adr-0430-shift-zone-m2m.md`

Must cover:
1. **Manager assigns zone to shift (web)** — happy path + error path (zone not in department's areas)
2. **Employee views zone on mobile** — BeforeShiftView, DuringShiftView, ShiftCard
3. **Agent creates shift with zones** — via `schedule.create_shift_with_zones` capability
4. **M4 migration path** — operator runs migration; column drop; typecheck verifies

Format per CLAUDE.md:
```markdown
## Journey: [Role] [Action]
**Precondition:** ...
1. User does X → System does Y → User sees Z
**Postcondition:** ...
**Error paths:** ...
```

---

### 4b.8 — HANDOFF file (MF-Prior-4)

Required by `close-feature.sh` gate (CLAUDE.md mandate).

**File:** `docs/HANDOFF-adr-0430-shift-zone-m2m.md`

Required sections:
1. Summary — what was built and why (ADR-0430 context in 3 paragraphs)
2. All decisions — link each to its ADR entry
3. All learnings — L-0348 (3rd occurrence promotion), L-NEW phantom-display, any
   new learnings discovered during implementation
4. Known issues / debt

**Mandatory section: Deferred enforcement (MF-Prior-4 carryover from PLAN-3 MF-A)**

```markdown
## Deferred enforcement

### Rule 9 gate-RPC dead-letter
The `engine_authority_config` row for `roster.add_shift_manual` channel constraint
is set to `channel_constraint = 'chat_only'` per Rule 9. However, the gate-RPC
verification path (PLAN-0 AC-0.9) may surface that the RPC function itself is not
wired to the enforcement runtime. This is a known dead-letter risk.

Three-layer defense (per PLAN-3 MF-A carryover):
1. **DB constraint** — `engine_authority_config.channel_constraint = 'chat_only'`
   is enforced at DB level; any insert/update to this row is audited.
2. **Capability tool channel guard** — `use-schedule-voice-tools.ts` does NOT
   register any zone-write tool; voice surface is read-only for zones.
3. **ADR paper trail** — ADR-0430 Rule 9 + ADR-0078 channel-pinning doctrine are
   cross-referenced in `docs/decisions/`; any future tool registering a zone-write
   on voice must violate both ADRs explicitly.

Active risk: if the gate-RPC is never called (dead-letter), the `channel_constraint`
value is documentation, not enforcement. To close: wire gate-RPC to pre-commit tool
registration check (separate ADR needed).
```

5. Next steps

---

### 4b.9 — Decision log entry + ADR status flip

**Decision log:** `docs/decisions/0000-decision-log.md`
Add entry: "ADR-0430 Phase b complete — M4 applied, columns dropped, reform closed."

**ADR-0430 frontmatter:** After feature is merged to development, update:
```yaml
status: implemented
updated: <date of merge>
```

> This flip happens as the LAST commit of PLAN-4b, not during M4 application.
> `implemented` means: M4 is in production, spine is refreshed, HANDOFF is written.

---

## Acceptance criteria

| AC | Check | Pass condition |
|----|-------|----------------|
| AC-4b.1 | Mobile hook relocated | `packages/data/src/day-session/use-shift-session.ts` exists (kebab-case). Mobile files import from `@smartout/data`. |
| AC-4b.2 | Trigger migration: DROP + CREATE | Migration contains `DROP TRIGGER IF EXISTS trg_ensure_shift_session` AND `CREATE TRIGGER` (no `OF location_id` clause in new trigger). `CREATE OR REPLACE FUNCTION` is present but the trigger attachment is a fresh CREATE. |
| AC-4b.3 | M4 migration ships | `\d schedule_shift` contains neither `location_id` nor `zone`. `\d profile` contains no `location_id`. |
| AC-4b.4 | M4 timestamps ordered | Trigger-rewrite migration timestamp < M4 migration timestamp. Both `> 20260801000004`. Verify via `ls supabase/migrations/ | grep -E "ensure_shift|drop_stale"`. |
| AC-4b.5 | Typegen target src/ | `packages/supabase/src/database.types.ts` updated. `dist/` version is NOT the committed target. `grep -E "schedule_shift.*zone[^_]|profile.*location_id" packages/supabase/src/database.types.ts` → 0 hits. |
| AC-4b.6 | Typecheck GREEN post-typegen | `TURBO_CONCURRENCY=1 pnpm turbo typecheck` — 0 errors. |
| AC-4b.7 | Spine refreshed | `git diff docs/domains/scheduling/{DATA-MODEL,USER-FLOWS,ARCHITECTURE}.md docs/domains/day-session/DATA-MODEL.md docs/domains/core-structure/DATA-MODEL.md` shows updates. `DATA-MODEL.md:~343` drop-candidate annotation removed. |
| AC-4b.8 | JOURNEY written | `docs/journeys/JOURNEY-adr-0430-shift-zone-m2m.md` exists; covers 4 journeys (manager-assign, employee-view-mobile, agent-create, M4-migration). |
| AC-4b.9 | HANDOFF written | `docs/HANDOFF-adr-0430-shift-zone-m2m.md` exists; contains Deferred-enforcement section per MF-Prior-4. |
| AC-4b.10 | Decision log updated | `docs/decisions/0000-decision-log.md` has ADR-0430 Phase b closure entry. |
| AC-4b.11 | ADR-0430 status flip | `docs/decisions/0430-core-structure-reform-shift-zone-m2m.md` frontmatter `status: implemented` after merge. |

---

## Files to touch

- **Create:** `packages/data/src/day-session/use-shift-session.ts`
- **Edit:** `apps/mobile/src/components/routine/RoutineReviewForm.tsx` (import from @smartout/data)
- **Edit:** `apps/mobile/src/hooks/queries/use-shift-session.ts` (delete/re-export)
- **Edit:** `apps/mobile/src/hooks/use-routine-extract.ts` (import from @smartout/data)
- **Create:** `supabase/migrations/<ts>_ensure_shift_session_trigger_rewrite.sql`
- **Create:** `supabase/migrations/<ts>_drop_stale_location_columns.sql` (M4 — IRREVERSIBLE)
- **Regen:** `packages/supabase/src/database.types.ts` (commit after M4 applied)
- **Edit:** `docs/domains/scheduling/DATA-MODEL.md` (remove dropped cols, add shift_zone)
- **Edit:** `docs/domains/scheduling/USER-FLOWS.md` (zone-picker flow)
- **Edit:** `docs/domains/scheduling/ARCHITECTURE.md` (D6 diagram update)
- **Edit:** `docs/domains/day-session/DATA-MODEL.md` (~line 343 annotation removal)
- **Edit:** `docs/domains/core-structure/DATA-MODEL.md` (schema parity)
- **Create:** `docs/journeys/JOURNEY-adr-0430-shift-zone-m2m.md` (REQUIRED gate)
- **Create:** `docs/HANDOFF-adr-0430-shift-zone-m2m.md` (REQUIRED gate)
- **Edit:** `docs/decisions/0000-decision-log.md` (closure entry)
- **Edit:** `docs/decisions/0430-core-structure-reform-shift-zone-m2m.md` (status flip last)

---

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| M4 ships before PLAN-4a pre-grep gate = 0 | CRITICAL | Hard pre-condition: PLAN-4a AC-4a.8 MUST be verified before running M4 migration. |
| `OF location_id` left in new trigger → trigger fires on non-existent column | HIGH | Review full trigger DDL against PLAN-0 pg_depend audit. `grep "OF location_id" supabase/migrations/` must return 0 in new file. |
| Typegen target `dist/` instead of `src/` | HIGH | `AC-4b.5` explicitly verifies path. Double-check `supabase gen types` command output path. |
| `fk_profile_location` FK constraint not dropped before column → ALTER fails | HIGH | Explicit `DROP CONSTRAINT IF EXISTS fk_profile_location` in M4 (MF-Prior-5). |
| WSL2 OOM on TURBO_CONCURRENCY default | MEDIUM | Always use `TURBO_CONCURRENCY=1` for typecheck. Pre-flight: `free -h` → ≥ 6.5 Gi available. |
| Mobile hook naming camelCase in packages/data | MEDIUM | File MUST be `use-shift-session.ts` (kebab-case per convention MF-Prior-6). |
| Domain spine stale annotations not removed | LOW | MF-Prior-7: `DATA-MODEL.md:~343` drop-candidate annotation explicitly in AC-4b.7. |

---

## Notes

- M4 is the **point of no return.** Run `supabase db reset` and verify locally
  before applying in any staging environment.
- The trigger sketch in §4b.2 is illustrative only. Implementer MUST load the
  PLAN-0 `pg-depend-audit.txt` and write the actual function body from the audit
  findings.
- Domain spine refresh is `domain-steward post` mode. If dispatching a subagent,
  pass `mode: post` and the list of spine files explicitly.
- After `/close-feature`, `close-feature.sh` will gate on JOURNEY + HANDOFF +
  typecheck + decision log. All four must be present or merge is blocked.
- ADR-0430 status flip (`accepted` → `implemented`) is the LAST edit — it signals
  that the reform is in production, not just planned.
