---
name: cascade-review-findings
description: Cascade Core Foundation review against current system — alignment, gaps, conflicts, risks. Verified 2026-03-22.
type: project
---

## Cascade Implementation Status (2026-03-22)

### Phase A Schema: COMPLETE

- 7 migration files in `supabase/migrations/20260421*` and `20260422*`
- 17 new tables, 16 new enums, 8 ALTER TABLEs on existing tables
- RLS correct on all tables. ADR-0056 registered.
- Backfill from legacy `operating_hours` to `department_operating_hours` done.

### Phase B Pure Functions: 4/6 DONE

- DONE: `resolveEffectiveHours`, `computeAnchoredTime`, `evaluateFrameworkRules` (skeleton), `validateProposalFreshness`
- Location: `apps/web/src/lib/cascade/`
- MISSING: `deriveImpacts()`, `computeCascadePreview()`, `persistChangeProposal()`, `applyCascade()`

### Critical Active Conflict: Settings Operating Hours

- `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts` still reads/writes LEGACY `operating_hours` table
- Cascade runtime reads `department_operating_hours` — edits via Settings are invisible to cascade
- MUST be migrated before any cascade runtime feature goes live

### Blocking Gap: Mostly Empty Framework Tables

- `regulatory_framework`, `framework_rule`, `framework_trigger`, and `tariff_rate_table` are still effectively unseeded for hospitality bootstrap
- `public_holiday` is no longer empty: Norway 2026 data is seeded, so holiday truth exists but the broader framework layer is still missing
- Incomplete seed data still blocks meaningful Phase C bootstrap
- Need hospitality.no.default.v1 framework + Norwegian AML rules + correct Riksavtalen rates

### hospitality.ts Wrong Rates (still in codebase)

- File: `apps/web/src/lib/industry/packages/hospitality.ts`
- kveldstillegg: 56 kr/t (correct: 15.65), helgetillegg: 56 kr/t (correct: 29.74), helligdagstillegg: 133% (correct: 100%)
- tariff_rate_table is the cascade source of truth, but hospitality.ts is still referenced by setup wizard

### Triple Operating Hours Tables

- `company_opening_hours` — join wizard intake (keep, reclassify)
- `operating_hours` — legacy settings (MUST migrate away)
- `department_operating_hours` — cascade runtime truth (new)

### Phase C Bootstrap: PARTIAL

- 13 SQL templates exist in `supabase/templates/restaurant/`, but they are not integrated into workspace creation
- `_apply.sql` exists, but no bootstrap service calls it during workspace creation
- `bootstrapWorkspaceFromHospitalityPackage()` function does not exist
- Setup wizard is still not wired to create cascade records
- Phase D Integration: correctly deferred
