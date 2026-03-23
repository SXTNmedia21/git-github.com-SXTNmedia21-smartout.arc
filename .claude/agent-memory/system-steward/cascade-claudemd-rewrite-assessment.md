---
name: cascade-claudemd-rewrite-assessment
description: Assessment of weaving cascade (I1+6D+4C+K1a/K1b) into CLAUDE.md — risks, traps, recommendation. Verified 2026-03-22.
type: project
---

## Key Finding: Full Weave-In Is Premature (2026-03-22)

**Why:** Framework tables are empty, bootstrap service doesn't exist, 3/9 domain concepts have zero cascade mapping. CLAUDE.md rule: "code wins." Code doesn't support cascade as organizing principle yet.

**How to apply:** Block full Domain Concepts rewrite until Phase C bootstrap is complete. Allow targeted additions (traps, enforcement rules, status marker, spec pointer).

### Concepts That DON'T Map to Cascade

- Readiness (training axis, orthogonal)
- Trainee Mode (profile status flag)
- Veikart/Reise/Protokoll (design vocabulary)
- Telemetry Registry (infrastructure)

### Critical Enforcement Rules Missing

1. Never read `operating_hours` or `company_opening_hours` for runtime scheduling
2. Never hardcode regulatory values in service code
3. Never create cascade state outside `change_proposal`
4. Cascade pipeline is independent of Event Engine (ADR-0056)
5. Every bootstrapped record needs provenance metadata
6. Never query `tariff_rate_table` without checking validity window

### Active Traps

- `hospitality.ts` has wrong Riksavtalen rates (kveldstillegg 56 vs 15.65)
- Triple operating hours tables (company_opening_hours, operating_hours, department_operating_hours)
- Event Engine line 198 says "ALL workflows" — now false for cascade
- D5 is NOT a runtime cascade dimension (parameterizes coefficients only)
- CLAUDE.md already at 472 lines (was trimmed to <280 at v7.0.0)
