---
title: "PLAN-4 — Mobile rewrite + M4 COLUMN DROP + typegen + L-0064 final cleanup"
sortie: adr-0430-shift-zone-m2m
plan: 4
tier: T3
phase: final-cleanup
created: 2026-05-28
status: pending
depends_on: [PLAN-3]
blocks: []
estimated_effort_hours: 8-12
adr_rules_covered: [Rule 5, Rule 2 M4, Rule 8 final]
adrs_referenced: [ADR-0133, ADR-0277]
---

# PLAN-4 — Mobile + M4 + final cleanup

## Purpose

Close the reform: relocate mobile shift-session hook to `packages/data/` per ADR-0133 Mobile Parity, ship the M4 COLUMN DROP migration (irrevocable schema reform endpoint), regen types, and complete final L-0064 cleanup. After PLAN-4, `schedule_shift.location_id`, `schedule_shift.zone`, and `profile.location_id` no longer exist in the database.

This is the **irreversible** plan — M4 cannot be rolled back. All prior plans (0-3) must be GREEN; M4 is the point of no return.

## Scope

### 4.1 — Mobile hook relocation (Rule 5)

**Key finding from STATE.md import:** Per orchestrator grep on 2026-05-28, all 3 mobile files cited in ADR Rule 5 already have **zero** `profile.location_id` reads. The "replace direct reads" work is largely a no-op for those specific call-sites.

**The actual mobile work is hook architecture per ADR-0133:**

| File | Current | Target |
|---|---|---|
| `apps/mobile/src/hooks/queries/use-shift-session.ts` (line 71 was cited; verify line) | Possibly app-mobile-local hook | Move to `packages/data/src/hooks/useShiftSession.ts` so both web and mobile import from the same package |
| `apps/mobile/src/components/routine/RoutineReviewForm.tsx` | Imports from `apps/mobile/src/hooks/...` | Import from `@smartout/data` |
| `apps/mobile/src/hooks/use-routine-extract.ts` (line 41 was cited) | Possibly inline area-resolution logic | Use shared `useShiftSession` hook from `packages/data/` |

The hook returns area context via `profile → department → department_location → location` resolution (ADR Rule 5 path-correct). Multi-zone aware: returns an array of locations/zones when the shift_session spans multiple.

**Per-file verification step (before editing):**
```bash
grep -n "profile.location_id\|p\.location_id" apps/mobile/src/components/routine/RoutineReviewForm.tsx apps/mobile/src/hooks/queries/use-shift-session.ts apps/mobile/src/hooks/use-routine-extract.ts
```
If 0 hits across all 3 files (expected per orchestrator pre-flight): no direct-read removal needed. Only hook relocation work applies.

If hits found (unexpected): each direct-read replaced with the `useShiftSession` hook from packages/data.

### 4.2 — M4 COLUMN DROP migration (Rule 2)

```sql
-- supabase/migrations/<timestamp>_drop_stale_location_columns.sql
-- Timestamp MUST be > <PLAN-1 M3 timestamp>
-- IRREVERSIBLE — confirm code-rewrite complete (PLAN-2 + PLAN-3) before applying
BEGIN;

-- Sanity check — fail loudly if app code still references these columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_depend d
    JOIN pg_class c ON c.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE c.relname = 'schedule_shift'
      AND a.attname IN ('location_id', 'zone')
      AND d.deptype = 'n'
  ) THEN
    RAISE EXCEPTION 'M4 BLOCKED: pg_depend rows still reference schedule_shift.location_id or .zone — PLAN-0 M3.5 audit incomplete';
  END IF;
END $$;

-- Drop in this order: schedule_shift.location_id → schedule_shift.zone → profile.location_id
ALTER TABLE schedule_shift DROP COLUMN IF EXISTS location_id;
ALTER TABLE schedule_shift DROP COLUMN IF EXISTS zone;
ALTER TABLE profile DROP COLUMN IF EXISTS location_id;

COMMIT;
```

**Pre-M4 trigger rewrites (per PLAN-0 AC-0.8 pg_depend audit):**
- `ensure_shift_session` trigger — rewrite to source location from `shift_session_day_line` instead of `schedule_shift.location_id` (per ADR-0430 §Implementation Sequence Pre-3.5). Migration file: separate, ships in PLAN-4 BEFORE M4 column drop.
- Any other trigger/view/policy enumerated by PLAN-0 — rewrite individually.

```sql
-- Example: supabase/migrations/<ts>_ensure_shift_session_trigger_rewrite.sql
-- (Detailed body depends on PLAN-0 pg_depend audit output; sketch only)
CREATE OR REPLACE FUNCTION ensure_shift_session() RETURNS trigger AS $$
DECLARE
  v_location_id UUID;
BEGIN
  -- OLD: SELECT NEW.location_id INTO v_location_id;
  -- NEW: resolve location from shift_session_day_line via day_line
  SELECT dl.location_id INTO v_location_id
  FROM shift_session_day_line ssdl
  JOIN day_line dl ON dl.id = ssdl.day_line_id
  WHERE ssdl.shift_session_id = NEW.shift_session_id
  LIMIT 1;
  -- ... rest of function body
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### 4.3 — typegen regen post-M4

```bash
supabase db reset
supabase gen types --local > packages/supabase/dist/database.types.ts
# Verify zero matches for dropped columns in generated types:
grep -E 'schedule_shift.*location_id|schedule_shift.*zone|profile.*location_id' packages/supabase/dist/database.types.ts
# Expected: 0 matches (or only matches inside `shift_zone` which IS expected)
```

### 4.4 — App-code cleanup post-typegen (the "blast radius" pass)

After typegen, `pnpm turbo typecheck` will surface any remaining call-site that still references dropped columns. Each error is a fix-site. Common patterns to expect:

- E2E fixtures that seed `schedule_shift` with `location_id` or `zone` fields (cite ADR-0416 schema-fixture coherence pattern)
- Test helpers that build mock shift rows
- Any leftover capability tool or BFF route still reading the dropped column

### 4.5 — Domain spine refresh (per ADR-0392)

After M4 ships and typecheck is green, refresh the 3 spine files marked `UPDATE-pending-reform`:

- `docs/domains/scheduling/DATA-MODEL.md` — remove `location_id` + `zone` from `schedule_shift` row description; add `shift_zone` table row; remove `location_id` from `profile` row.
- `docs/domains/scheduling/USER-FLOWS.md` — update "create shift" flow to describe zone-picker (web) + show that mobile sees zone via shift_session join.
- `docs/domains/scheduling/ARCHITECTURE.md` — update D6 tri-layer diagram if needed (shift_zone is a refinement subordinate to shift_session_day_line per ADR-0367 v1.1).
- `docs/domains/core-structure/DATA-MODEL.md` — schema reference parity.

**This is `domain-steward post` mode work** — dispatch via Skill tool after M4 application proven stable.

## Falsifiable acceptance criteria

| AC | Check | Pass condition |
|----|-------|----------------|
| AC-4.1 | Mobile per-file verification | `grep "profile.location_id" apps/mobile/src/...` returns 0 in all 3 cited files (matches orchestrator pre-flight finding). If non-zero, replace each direct read. |
| AC-4.2 | `useShiftSession` hook in packages/data | `ls packages/data/src/hooks/useShiftSession.ts` exists; exports the hook. |
| AC-4.3 | Mobile imports from @smartout/data | `grep -n "from '@smartout/data'" apps/mobile/src/hooks/queries/use-shift-session.ts apps/mobile/src/components/routine/RoutineReviewForm.tsx` returns matches (or the local file is removed entirely if fully migrated). |
| AC-4.4 | ADR-0133 parity — same hook web+mobile | Web call-site (if any) and mobile call-site both import same `useShiftSession`. |
| AC-4.5 | pg_depend pre-M4 audit clean | Manual pre-M4 query `SELECT * FROM pg_depend WHERE refobjid IN ('schedule_shift'::regclass::oid, 'profile'::regclass::oid) AND deptype = 'n' AND refobjsubid IN (SELECT attnum FROM pg_attribute WHERE attrelid IN ('schedule_shift'::regclass, 'profile'::regclass) AND attname IN ('location_id', 'zone'))` returns 0 rows after trigger/view/policy rewrites. |
| AC-4.6 | `ensure_shift_session` trigger rewritten | `\df+ ensure_shift_session` shows function body sources location from `shift_session_day_line`, NOT from `NEW.location_id`. |
| AC-4.7 | M4 applied | `\d schedule_shift` does NOT contain `location_id` or `zone`. `\d profile` does NOT contain `location_id`. |
| AC-4.8 | Typegen regen | `packages/supabase/dist/database.types.ts` does NOT contain `schedule_shift.*location_id` OR `schedule_shift.*zone` OR `profile.*location_id` patterns (allow `shift_zone` table — that IS expected). |
| AC-4.9 | App typecheck green post-typegen | `TURBO_CONCURRENCY=1 pnpm turbo typecheck` — 0 errors. |
| AC-4.10 | E2E fixtures purged of dropped columns | `grep -rn "location_id.*schedule_shift\|schedule_shift.*location_id\|schedule_shift.*zone:" apps/e2e/` returns 0 application-code hits (allow if commented as "post-M4 historic note"). |
| AC-4.11 | Full Playwright suite green (G7) | `pnpm exec playwright test` — 100% pass on continuous-mode threshold. |
| AC-4.12 | Domain spine refreshed | `git diff docs/domains/scheduling/{DATA-MODEL,USER-FLOWS,ARCHITECTURE}.md docs/domains/core-structure/DATA-MODEL.md` shows updates removing dropped columns + adding `shift_zone`. `mirror: verified` or `mirror: mixed` (verified+aspirational mix accepted) on each refreshed file. |
| AC-4.13 | M4 trigger-rewrite migration ships BEFORE M4 column-drop | Migration timestamps: trigger-rewrite < M4 column-drop. Verify via `ls supabase/migrations/ | tail -5`. |
| AC-4.14 | Decision log entry | `docs/decisions/0000-decision-log.md` has entry for "ADR-0430 Phase b complete — M4 applied, columns dropped". |
| AC-4.15 | HANDOFF.md written | `docs/HANDOFF-adr-0430-shift-zone-m2m.md` written per CLAUDE.md Feature Closure mandate; includes summary, decisions, learnings, next steps. |

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| M4 ships before PLAN-3 fully landed → column drop breaks running production app | CRITICAL — unrecoverable | PLAN-4 depends_on PLAN-3 strict. SDSM continuous mode requires PLAN-3 E2E green BEFORE PLAN-4 starts. No exceptions. |
| pg_depend audit missed a trigger → M4 raises FK/trigger violation | HIGH — migration aborts | DO-block sanity check inside M4 migration body (see SQL above). If aborts, surface PLAN-0 audit miss; re-audit + ship missed-trigger rewrite. |
| Typegen regen surfaces unexpected new types breaking unrelated code (L-0298 sibling) | MEDIUM | If `SelectQueryError` appears post-M4, do NOT add `as any`; verify migration is fully applied locally (`supabase db reset` + `gen types --local` cycle). |
| Mobile hook relocation breaks existing mobile call-sites due to subtle prop-shape change | MEDIUM | Type-driven refactor: change shape in packages/data first, fix mobile compilation errors next. |
| Domain-steward post mode loses information when refreshing spine | LOW | Spine files use `mirror:` frontmatter — keep `verified` for confirmed-shipped sections; `aspirational` for forward plan. |
| Mobile app on App Store/Play Store NOT updated → users on old mobile binary hit removed columns via cached schemas | LOW | Mobile reads use Supabase auto-typed clients; old binaries fail gracefully. Not a M4 blocker. |
| Class-A L-0064 markers accidentally touched | LOW | AC from PLAN-1 (AC-1.4) re-verifies; PLAN-4 does not touch these files. |

## Dependencies

- **PLAN-3** must pass all 16 ACs.
- **PLAN-0 AC-0.8** must have produced full pg_depend audit; PLAN-4 trigger-rewrite work depends on this.

## Files to touch

- **Create:** `packages/data/src/hooks/useShiftSession.ts` (relocated hook, ADR-0133 parity)
- **Edit:** `apps/mobile/src/components/routine/RoutineReviewForm.tsx` (import from @smartout/data)
- **Edit:** `apps/mobile/src/hooks/queries/use-shift-session.ts` (delete-or-re-export from packages/data)
- **Edit:** `apps/mobile/src/hooks/use-routine-extract.ts` (import shared hook)
- **Create:** `supabase/migrations/<ts>_ensure_shift_session_trigger_rewrite.sql` (rewrites + any other pg_depend hits)
- **Create:** `supabase/migrations/<ts>_drop_stale_location_columns.sql` (M4 — irreversible)
- **Regen:** `packages/supabase/dist/database.types.ts` (commit after `supabase gen types --local`)
- **Edit:** `docs/domains/scheduling/DATA-MODEL.md`, `USER-FLOWS.md`, `ARCHITECTURE.md` (domain-steward post mode)
- **Edit:** `docs/domains/core-structure/DATA-MODEL.md` (schema parity)
- **Edit:** `docs/domains/scheduling/STATE.md` — state → S9 closed
- **Create:** `docs/HANDOFF-adr-0430-shift-zone-m2m.md` (CLAUDE.md mandate at feature closure)
- **Decision log:** Final closure entry in `docs/decisions/0000-decision-log.md`

## Validation gate

All 15 ACs PASS. Full Playwright suite green (G7). Domain spine refreshed (G7+). HANDOFF written. STATE.md transitioned to S9 closed.

## Notes

- M4 is the **point of no return**. ADR Bad-consequence #1: "Dropping schedule_shift.location_id and schedule_shift.zone requires ALL read and write sites to be migrated before M4 ships." If ANY code path still references the dropped columns at typecheck-time, M4 will fail post-deploy.
- AC-4.1 (per-file verification) is critical because orchestrator pre-flight already confirmed zero `profile.location_id` reads on mobile. This plan should mostly be hook-architecture work, NOT direct-read-removal. If implementer claims "I replaced N direct reads" they may be hallucinating — surface immediately.
- Domain spine refresh is the LAST step before STATE.md → S9. This is when verified knowledge propagates back to the docs spine per ADR-0392 doctrine.
- Per close-feature.sh mandate (CLAUDE.md): HANDOFF.md + decision log + typecheck + user-journey docs are REQUIRED. SDSM closure (S8 → S9) invokes /close-feature which enforces these gates.
