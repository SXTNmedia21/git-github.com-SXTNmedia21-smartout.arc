---
title: "HANDOFF — SMA-328 AML §14-15 Trekk-Samtykke (T2)"
status: done
created: 2026-05-14
updated: 2026-05-14
module: payroll
feature: sma-328-aml-14-15-trekk-consent
tags: [handoff, payroll, aml-14-15, consent, trekk, lovsen]
---

# HANDOFF: SMA-328 AML §14-15 Trekk-Samtykke (T2)

**Sortie:** `feat/sma-328-aml-14-15-trekk-consent` (wt-1)
**Merge order:** T2 (3rd). T4 + T3 already on development before T2 built.
**ADR:** ADR-0311 (proposed)
**Linear:** SMA-328

---

## Summary

Implementerer Aml. §14-15 tredje ledd nr. 1-6 compliance for lønns-trekk i `LineOverrideModal`.

**Hva ble bygget:**
1. Ny `payroll.consent_document` tabell med RLS, DocuSeal-binding, og Aml.-referanse per rad
2. FK `consent_document_id` + `deduction_type` på `change_proposal`
3. Backfill: historiske trekk-forslag uten samtykke flagges som `consent_gap_aml_14_15_tredje_ledd` deviation (ikke-blokkerende)
4. Shared utility `validateAml1415Logic` — delt regellogikk mellom BFF og capability tool
5. `validateAml1415` capability tool (system-kanal, `systemTools`-tier, ADR-0311)
6. BFF GET `/api/payroll/deduction-consents` — henter aktive samtykker for ansatt (JWT-derivert workspace, ADR-0151)
7. BFF POST `/api/payroll/propose-line-override` — utvidet med `category='deduction'` + Step 5b consent-validering
8. UI: `LineOverrideModal` — consent-picker + union_dues advisory + negative amount support
9. 3 telemetri-events i registry.ts + routing map
10. ADR-0311 + decision log entry

**Hvorfor:**
`LineOverrideModal` hadde bare et fritekstfelt for "grunn" — compliance-teater. Med aml. §14-15
krever hvert trekk lovhjemmel eller skriftlig samtykke. Denne T2 kobler trekk-forslag til faktisk
signerte samtykke-dokumenter fra DocuSeal.

---

## Decisions Made (all registered in ADR-0311)

| Decision | Valg | Alternativ avvist |
|----------|------|-------------------|
| Schema placement | Ny `payroll.consent_document` | Extend `confirmation_signature` — FK chain violation + cascade invariant 2 brudd |
| Shared utility | `validateAml1415Logic` i `capabilities/legal/aml-14-15.ts` | Duplisere logikk i BFF og tool — avvik-risiko |
| Tool tier | `systemTools` (ikke `readOnlyTools`) | readOnlyTools → chat-sessions ville fått tilgang |
| Court order path | Consent_document rad kreves (consent_type='court_order' + reference) | Bypass all validation — for svak compliance-garanti |
| Union dues | Advisory-mode, ikke-blokkerende | Hard block — tariffavtale er lovhjemmel, ikke krav om individuelt samtykke |
| Backfill | Deviation-flag, ikke retroaktiv blokkering | Blokkere eksport — ville brutt Bokf.lov §7 |
| Amount sign | Negative for deduction, server superRefine + UI | Positiv (ville vært non-semantisk for trekk) |

---

## Learnings Discovered

### L-1: `payroll.deviation` kolonner — ikke `entity_type`/`entity_id`/`deviation_class`
Planen refererte til felter som ikke finnes i `payroll.deviation`-tabellen (som er `public.payroll_deviation`
renamed via `20260422110700_payroll_schema.sql`). Faktiske kolonner: `check_id`, `severity`, `message`,
`profile_id`, `period_id`, `details`. Brukte `check_id = 'consent_gap_aml_14_15_tredje_ledd'` og
`details JSONB` for å lagre `change_proposal_id`. Backfill-query bruker NOT EXISTS på `(check_id, details->>'change_proposal_id')`.

### L-2: `pnpm install` fjerner stale `node_modules` i worktree
Første build av `@smartout/telemetry` feilet med "cannot find tsc" fordi `node_modules` manglet
i worktree. Fix: `pnpm install` fra worktree root. Etter dette er bygg konsistente.

### L-3: `PayrollLineOverrideProposed` event-type trengte category-utvidelse
Eksisterende `PayrollLineOverrideProposed` interface i `registry.ts` hadde `category` begrenset til
4 verdier uten `"deduction"`. BFF-route bruker typen direkte i `emit()` og TypeScript fanget det.
Fix: legg til `"deduction"` i event-typens category union.

### L-4: `OverrideLine.profileId` trengs av LineDrawer
Eksisterende `LineDrawer.tsx:414` bygde `OverrideLine` uten `profileId`. Etter at vi la til
`profileId` som required field, kompilerte ikke `LineDrawer` lenger. Fix: legg til
`profileId: line?.profileId ?? ""` i `handleOpenOverrideModal`.

### L-5: Telemetry dist MUST be rebuilt before downstream typecheck
Etter endring av `registry.ts` MÅ `pnpm --filter @smartout/telemetry build` kjøres FØR
`@smartout/ai` eller `web` typecheck. Stale dist blokkerer alle downstream consumers (L-0190 klasse).

---

## Known Issues / Debt

### 🚨 DocuSeal callback chain — NEEDS FOLLOW-UP SORTIE

**Status:** DocuSeal grep utført (se nedenfor). Ingen `apps/web/src/app/api/contracts/` eller
`services/contract-service/` routes refererer `confirmation_signature` direkte. Men:

**Callback-routing er IKKE implementert i T2:**
- `payroll.consent_document` har `docuseal_submission_id` kolonne klar
- DocuSeal callback-handler (likely `supabase/functions/` eller `services/contract-service/`) 
  sender i dag completion til `confirmation_signature`
- Callback MÅ branche på submission type: `deduction_consent` → INSERT `payroll.consent_document`
- **Uten dette:** consent_document-rader kan ikke opprettes via DocuSeal-flyt automatisk.
  Workaround: manuell INSERT via service_role (admin + SQL eller migration seed).

**Påkrevd neste sortie:** Identifiser DocuSeal callback, legg til discriminator + branch.

### ⚠️ UI mangler direktelenke til DocuSeal for å sende ny samtykke-avtale
Empty-state i consent-pickeren sier "Send avtale via DocuSeal først" men lenker ikke til
DocuSeal-flaten. Manager må navigere manuelt. Low-priority for V1.

### ⚠️ Union dues tariff_framework FK deferred
Advisory-modus er implementert, men ingen verifisering av faktisk tariffavtale-binding.
Fremtidig ADR for tariff_framework FK-kobling.

### ⚠️ Journeys ikke pgTAP/E2E-verifisert
3 journey-filer er i `in_progress` (ikke `verified`). Ingen pgTAP eller Playwright tests for
consent-validation. Dette er et gjeldspost for neste sortie.

---

## DocuSeal Grep Classification Table

```bash
grep -rn "confirmation_signature" supabase/functions/ services/ apps/web/src/app/api/ \
  --include="*.ts" --include="*.sql" | grep -v node_modules | grep -v .next
```

| Path | Classification |
|------|----------------|
| `packages/training/src/hooks/use-assigned-protocols.ts:79` | SAFE — training/governance read path, no deduction_consent overlap |
| `packages/training/src/hooks/use-step-completion.ts:141` | SAFE — training completion write path, no deduction_consent overlap |
| `packages/supabase/src/database.types.ts` | SAFE — auto-generated, regenerated after migration |
| `packages/Botsson/blueprints/database-spread.md` | SAFE — documentation only, update after schema ships |
| `supabase/functions/` | NO HITS — DocuSeal callback writes here via separate flow, needs investigation |
| `services/contract-service/` | NO HITS — may handle DocuSeal; verify independently |
| `apps/web/src/app/api/contracts/` | NO HITS — BFF routes don't touch confirmation_signature directly |

**Verdict:** Ingen eksisterende `apps/web/src/app/api/contracts/` eller `services/` paths trenger
oppdatering for T2. DocuSeal callback-routing er den eneste udekket debt-en (flagget over).

---

## Next Steps

1. **DocuSeal callback sortie:** Finn callback-handler, legg til `submission_type` discriminator,
   branch på `deduction_consent` → INSERT `payroll.consent_document`.
2. **E2E tests:** Skriv Playwright specs for de 3 journeys (med consent + uten consent → rejected).
3. **pgTAP:** Skriv RLS-tester for `payroll.consent_document` (workspace isolation, service_role INSERT).
4. **Tariff framework FK:** ADR for union_dues tariffavtale-verifisering.
5. **UI DocuSeal-lenke:** Legg til direktelenke fra empty-state til DocuSeal send-flate.
6. **ADR-0311 → accepted:** Fremmes til `accepted` etter DocuSeal callback-sortie er lukket.

---

## Files Written / Modified

**New files:**
- `supabase/migrations/20260615110000_create_payroll_consent_document.sql`
- `supabase/migrations/20260615110100_change_proposal_consent_fk.sql`
- `packages/ai/src/capabilities/legal/aml-14-15.ts`
- `apps/web/src/app/api/payroll/deduction-consents/route.ts`
- `docs/decisions/0311-consent-document-payroll-deductions-aml-14-15.md`
- `docs/HANDOFF-sma-328-aml-14-15-trekk-consent.md` (this file)

**Modified files:**
- `packages/ai/src/capabilities/legal/tools.ts` (added validateAml1415 tool)
- `packages/ai/src/capabilities/legal/index.ts` (added validateAml1415 to systemTools)
- `packages/ai/package.json` (added `./capabilities/legal/aml-14-15` export)
- `packages/telemetry/src/registry.ts` (3 new interfaces + 3 routing entries + SmartoutEvent union additions + category extension for PayrollLineOverrideProposed)
- `apps/web/src/app/api/payroll/propose-line-override/route.ts` (RequestSchema extension + Step 5b consent validation + deduction telemetry)
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineOverrideModal.tsx` (deduction category + consent picker + negative amounts + union_dues advisory)
- `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-line-overrides.ts` (useDeductionConsents hook + ProposeOverridePayload type extension)
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx` (profileId in OverrideLine)
- `packages/supabase/src/database.types.ts` (regenerated)
- `docs/decisions/0000-decision-log.md` (ADR-0311 entry added)
- `docs/journeys/JOURNEY-sma-328-*.md` (status: draft → in_progress, updated date)
