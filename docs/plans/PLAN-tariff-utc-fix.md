---
title: "Plan — tariff-utc-fix"
status: draft
updated: 2026-05-04
created: 2026-05-04
module: cascade
tags: [plan, cascade, d3, riksavtalen, tariff, lov-compliance, payroll-impact]
---

# Plan — tariff-utc-fix

> Branch: `feat/schedule-harness-tariff-utc-fix` | Worktree: `~/dev/smartout.ai-schedule-harness-wt-1` | Base: `campaign/schedule-harness` | Module: cascade | Started: 2026-05-04

## Trigger

Phase 1 lovsen-rapport (Smartout `mobile-shift-system-polish` sortie 2026-05-04, S4-finding): `apps/web/src/lib/cascade/resolve-tariff-rate.ts` bruker `getUTCHours()` + `getUTCDay()` i `isEveningTime`/`isWeekendTime`-helpers. Riksavtalen TARO-79 §4-3 angir kveldstillegg fra 21:00 og helgetillegg fra lørdag 14:00 / søndag 06:00 — i Norge-tid, ikke UTC. Oslo sommertid = UTC+2 → en 21:00 Oslo-vakt er 19:00 UTC og utløser **ikke** kveldstillegg per gjeldende kode.

**Konsekvens:** Underbetaling av ansatte hver gang en kveld/helg-vakt krysser DST-grensene. Rammer alle hospitality-tenants på Smartout som bruker tariff-resolution-laget.

## Goal

Konverter `effectiveTimestamp` (UTC ISO) til workspace-lokal tid via `workspace.timezone` før kveld/helg-tillegg-evaluering. Verifiser klokkegrenser mot Riksavtalen TARO-79 §4-3. Etabler regression-tests for DST-overgang + workspace-tz-drift.

## Hard constraints

- **Cascade D3 layer ownership** — `resolve-tariff-rate.ts` er D3 (Rules & Constraints). Endring må respektere D3-grensene; ingen D2 (resource) eller D6 (production) data inn i denne funksjonen.
- **NHO Reiseliv juridisk-verifisering kreves før produksjons-deploy** — eksakte klokkegrenser i §4-3 er LAV confidence til verifisering. Lovsen flagget tre tall som usikre: 21:00 (kveld), 14:00 (lørdag), 06:00 (søndag).
- **Bakoverkompatibel signature** — funksjonen kalles fra payroll + schedule + reconciliation. Endring av signatur = bredere ringeffekt. Foretrekk å lese `workspace.timezone` internt.
- **Test-coverage må reflektere DST** — sommerlid og vintertid har ulik UTC-offset i Oslo (UTC+1 / UTC+2). Begge må testes.
- **Ingen migration på `tariff_rate_table`** — bug ligger i kalkulator, ikke schema.

## Surfaces in scope

| Surface | Path | Hva sjekkes |
|---|---|---|
| Tariff resolver | `apps/web/src/lib/cascade/resolve-tariff-rate.ts` | UTC → workspace-tz konvertering, klokkegrenser |
| Tariff context | `apps/web/src/lib/cascade/get-tariff-context.ts` | Hentes `workspace.timezone` allerede? Hvis ikke, propager. |
| Hours resolver | `apps/web/src/lib/cascade/resolve-hours.ts` | Sjekk om samme UTC-bug finnes her |
| Tariff context tests | `apps/web/src/lib/cascade/__tests__/` | Eksisterende tests; kan eksistensfeil med UTC-grenser |
| Riksavtalen seed (K1a) | `supabase/templates/restaurant/*tariff*.sql` | Sjekk om seedet matcher §4-3 |
| Day-category derivation | `apps/web/src/app/dashboard/_actions/add-shift-action.ts:99-107` | Mismatch mot tariff-grenser? |

## Phases

### Phase 0 — Lov-rapport spesifikt for tariff-grenser (lovsen, sonnet, read-only)

Lovsen utfører **dyp** verifisering av Riksavtalen TARO-79 §4-3 mot:
1. Lovdata-tekst
2. NHO Reiseliv-dokumentasjon (PDF + nettside)
3. Allmenngjøringsforskrift 2024-10-21 nr 2543
4. Sammenlikning med kodens nåværende grenser (21:00, 14:00, 15:00, 00:00, 06:00)

**Output:** `docs/audits/2026-05-04-tariff-thresholds-rapport.md` med eksakte sitater + LAV/MEDIUM/HØY confidence per grense.

**Eskaleringsanbefaling:** Hvis LAV på noen grense → kontakt NHO Reiseliv juridisk avdeling før Phase 2.

### Phase 1 — Code trace + impact-analyse (Explore agent, haiku)

Map alle call-sites av `resolve-tariff-rate.ts` + `isEveningTime` + `isWeekendTime`. Hvor påvirker UTC-bug konkret? Hvilke API-endpoints + UI-vues + payroll-rapporter ser feilbeløp?

**Output:** `docs/audits/2026-05-04-tariff-utc-impact-map.md`

### Phase 2 — Build + test (botsson-harness-builder, sonnet)

1. Importere `workspace.timezone` i `get-tariff-context.ts` (hvis ikke allerede gjort)
2. Konvertere `effectiveTimestamp` UTC → workspace-tz i `isEveningTime` + `isWeekendTime`
3. Justere klokkegrenser per Phase 0 lov-rapport (21:00, 14:00, 06:00 — eller hva lovsen verifiserer)
4. Skrive regression-tests for:
   - Sommer-tid (Europe/Oslo UTC+2): 21:00 Oslo skal trigge kveldstillegg
   - Vinter-tid (Europe/Oslo UTC+1): 21:00 Oslo skal trigge kveldstillegg
   - Lørdag 13:59 Oslo: ingen helgetillegg
   - Lørdag 14:00 Oslo: helgetillegg starter
   - Søndag 05:59 Oslo: kveldstillegg + nattillegg, ikke helgetillegg
   - Søndag 06:00 Oslo: helgetillegg starter
   - Cross-tz workspace (Europe/London): ulike grenser per workspace-tz
5. Oppdater `add-shift-action.ts:99-107` `deriveDayCategory` til å matche samme grenser (alignment)

### Phase 3 — Review (code-reviewer, sonnet)

Diff-review + verify alle tester grønne + ADR-utkast clear.

**Output:** `docs/reviews/2026-05-04-tariff-utc-fix-review.md`

## ADR (kreves)

`docs/decisions/00XX-tariff-resolver-uses-workspace-timezone.md` (proposed)
- Context: UTC-bug i tariff-grense-evaluering
- Decision: alle klokkegrenser i `resolve-tariff-rate.ts` evalueres i workspace-tz
- Consequences: bakoverkompatibel signatur (fetch tz internt), tariff-rapporter får retroaktivt korrekte tall, ingen migration nødvendig
- References: ADR-0095 (shift lifecycle), Riksavtalen TARO-79 §4-3, Aml §10-7

## Acceptance criteria

- [ ] Lovsen Phase 0 rapport med eksakte klokkegrenser + confidence
- [ ] NHO Reiseliv-eskalering loggført hvis LAV confidence på noen grense
- [ ] Alle DST-regression-tests grønne (sommer + vinter, Oslo + London workspace)
- [ ] `pnpm --filter web typecheck` grønn
- [ ] `pnpm --filter web test` grønn
- [ ] ADR `00XX-tariff-resolver-uses-workspace-timezone.md` proposed + registrert
- [ ] HANDOFF skrevet
- [ ] Linear-ticket åpnet for retrospective payroll-recalc (out-of-scope men logged)

## Out of scope

- Retrospective payroll-recalc (separate sortie under campaign/payroll)
- NHO Reiseliv-konsultasjon-koordinering (Pontus eier dialogen)
- `tariff_rate_table`-schema-endringer
- Allmenngjøringsforskrift-coverage utvidelse (separate sortie hvis trengs)

## Risks

- **NHO Reiseliv-grensene kan være andre enn antatt** — Phase 0 LAV confidence-funn vil blokkere Phase 2 til verifisering.
- **Bakoverkompatibilitet** — andre kalkulatorer kan stole på UTC-input. Test alle call-sites.
- **DST-edge-cases** — DST-overgangsdøgn (siste søndag i mars / oktober) er 23 / 25 timer lange. Testene må håndtere dette.
- **Workspace-tz default fallback** — workspaces uten tz settet faller back til Europe/Oslo per `add-shift-action.ts:171`. Verifiser at fallback gjelder også her.

## Mantra

> "Tariff er stedets tid, ikke serverens tid." Workspace-tz vinner alltid.
