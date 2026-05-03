---
title: "ADR-0218: Operating-hours source-of-truth and writer contract"
status: proposed
updated: 2026-04-28
created: 2026-04-28
module: cascade
tags: [adr, cascade, d1, operating-hours, ontology]
supersedes: []
superseded-by: []
---

# ADR-0218: Operating-hours source-of-truth and writer contract

## Status

**proposed** — 2026-04-28

## Context

Council 2026-04-28 (run-council, 4 reviewers) avdekket "quadruple-hours-trap": fire tabeller hevder autoritet over åpningstider uten synkroniseringslag.

| Tabell | Skriver i dag | Formål | Cascade-rolle |
|---|---|---|---|
| `company_opening_hours` | onboarding-wizard (`/join/_lib/setupActions.ts:271`), website-modul, setup-wizard | Customer-facing (restaurant-website-timer) | Marketing layer |
| `workspace_operating_hours` | `dashboard/settings/opening-hours-settings.tsx` | Workspace base envelope | D1 base |
| `department_operating_hours` | dept-detail-tab, season-tab, year-wheel | Per-dept, per-season cascade D1-sannhet | D1 truth |
| `department_hours_override` | TBD | Exception-day overstyringer | D1 override |

Cascade RPC `resolve_cascade_tasks` LESER `workspace_operating_hours` for `workspace.missing_base_hours`-task. Wizard SKRIVER til `company_opening_hours`. Konsekvens: bruker fullfører onboarding → drawer fortsetter å fyre `workspace.missing_base_hours` som critical task. I1 bootstrap-completeness brutt.

Cascade-spec (`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` §D1) sier: `department_operating_hours` er D1-sannheten. Men i dag skriver settings-siden til `workspace_operating_hours`, og RPC leser den. Det er pragmatisk reality-vs-spec-divergens.

## Decision

For v1 (denne sortien):

1. **`workspace_operating_hours` er kanonisk D1 base-truth** for nå. RPC fortsetter å lese herfra. Settings-side fortsetter å skrive hit. Inline-editor skriver hit.
2. **Wizard MÅ dual-write** til både `company_opening_hours` (uendret, customer-facing) OG `workspace_operating_hours` (ny, cascade-sannhet) ved fullført onboarding. Idempotent upsert.
3. **`department_operating_hours` er per-dept override-truth** — uendret rolle. Brukes når dept har avvikende tider fra workspace base.
4. **`company_opening_hours` deprekeres ikke** men anses som downstream/customer-facing copy. Sync-strategi: wizard skriver til begge ved bootstrap. Etter dette diverger de bevisst (admin endrer interne timer i settings, marketing endrer kunde-vendte timer i website-modul).
5. **`department_hours_override` ligger urørt** — backlog.

## Consequences

### Positive

- Quadruple-hours-trap delvis løst: wizard-bootstrap fullfører ekte D1-base-skriv.
- RPC og settings-siden er allerede konsistente. Ingen breaking change i settings.
- Inline-editor i drawer kan trygt gjenbruke `useWorkspaceOperatingHours` hook.
- Gap-deteksjon `workspace.missing_base_hours` slutter å være falskt positiv etter wizard.

### Negative (skuld bevisst tatt)

- **Ingen ekte sync** mellom `company_opening_hours` og `workspace_operating_hours` etter bootstrap. Ved divergence er customer-facing og internal source-of-truth uavhengige. Akseptert for v1 — flagget i HANDOFF.
- **Cascade-spec-divergens:** Spec sier `department_operating_hours` er D1-sannhet. Vi velger `workspace_operating_hours` som base og dept-tabell som override. Pragmatisk. Hvis spec må følges strengt → fremtidig ADR-0221.
- **Ingen synkronisering for senere endringer** — admin endrer base i settings, kunde-vendt i website. Disse divergerer over tid. Mitigation: workspace-side kan vise "kunde-vendt åpningstid: X" som info-banner (backlog).

### Neutral

- `tariff_rate_table` ikke berørt (annet domain).
- Mobile (ADR-0133) ikke berørt — drawer-edit er web-only.

## Alternatives considered

**Alt 1: `department_operating_hours` blir D1-sannhet (per cascade-spec).**
- Fordeler: spec-compliant. Hver dept har eksplisitt timer.
- Ulemper: Krever migrasjon av all eksisterende `workspace_operating_hours`-data til per-dept rader. Krever default-dept-resolution når workspace har 1 dept. Settings-siden må skrive til alle depts i workspace. Stor refaktor.
- Avvist: for stort scope. Backlog som ADR-0221.

**Alt 2: `workspace_operating_hours` er materialisert view fra `department_operating_hours`-aggregering.**
- Fordeler: én sannhet (per-dept), workspace-base er beregnet.
- Ulemper: Hvor lagres det når workspace HAR base men ingen dept-overrides? Krever default-dept-pattern eller egen "workspace_default"-rad. Aggregering er ikke entydig.
- Avvist: kompliserer mer enn det forenkler.

**Alt 3: Kun `workspace_operating_hours` — fjerne `company_opening_hours`.**
- Fordeler: én tabell, ingen sync.
- Ulemper: customer-facing website-modul mister sin egne timer-kilde. Marketing og admin må enes om timer (de kan legitimt være ulike — admin-only-day vs kunde-vendt).
- Avvist: legitimt to ulike formål.

## References

- Council 2026-04-28 verdict (Steward Phase 5 synthesis)
- Cascade-spec §D1: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- L-0148 quadruple-hours-trap (skrives ved closure)
- ADR-0133: mobile boundary (web composes, mobile executes)
- RPC: `supabase/migrations/20260503100000_update_cascade_task_hrefs_year_wheel.sql:23-36`
- Wizard write: `apps/web/src/app/join/_lib/setupActions.ts:271`
- Settings hook: `apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts:83-117`

## Follow-ups (logged in HANDOFF)

- ADR-0219 catalog-rename `cascade_task` → `dashboard_setup_task` (backlog)
- ADR-0220 drawer-as-workbench formell mønster-ADR (skrives etter ship, post-hoc)
- ADR-0221 sync-strategi `company_opening_hours` ↔ `workspace_operating_hours` (når divergence blir problem)
- D5/C1/C3 catalog-utvidelse (backlog)
- Per-dept-override-detection-split (backlog)
