---
title: "User Journeys — Billing Engine Fase 3B (EHF CSV/PDF-eksport)"
status: done
updated: 2026-04-18
created: 2026-04-18
module: billing
tags: [journey, billing, ehf, csv, pdf, regnskapsfører, fase-3b]
---

# User Journeys — Billing Engine Fase 3B

Fase 3B leverer et månedlig eksport-pakke som platform-admin genererer og sender til en ekstern regnskapsfører. Regnskapsfører lager EHF-fakturaene i sitt eget system og markerer betalinger mottatt i Smartout på melding tilbake. Se `ADR-0148` for full kontekst + `docs/superpowers/specs/2026-04-17-billing-engine-fase-3b-design.md` for implementasjons-detaljer.

**Scope er eksplisitt utenfor:** Peppol-transport, OAuth mot Fiken/Tripletex, automatisk inbound-poll, accountant-login. Alt dette er avvist i ADR-0148.

---

## Journey 1: Workspace-admin aktiverer EHF for sin company

**Precondition:** Workspace-admin eller owner er logget inn. Company har et gyldig org.nr registrert. EHF-fakturering er avtalt med regnskapsfører eksternt.

1. Workspace-admin navigerer til `/dashboard/billing/settings`
2. Ser "EHF-fakturering"-seksjon under "Automatiske påminnelser"
3. Ser at `EHF aktivert` toggle står av + Peppol-deltaker-ID-felt er tomt
4. Fyller inn `0192:<orgnr>` i Peppol-ID-feltet (format-hint vises under)
5. Flipper toggle til på
6. Klikker "Lagre"
7. System: `updateCompanyEhfSettings` server-action validerer Zod (format-regex + CHECK-invariant) → oppdaterer `company.ehf_enabled` + `company.peppol_participant_id`
8. UI: sonner toast "EHF-innstillinger lagret" + revalidatePath

**Postcondition:** `company.ehf_enabled = true` + `peppol_participant_id = '0192:<orgnr>'`. Fakturaer for company fra neste måned plukkes opp av EHF-eksport-spørringen.

**Error paths:**
- **Ugyldig format:** Zod-regex avviser → toast "Format: '0192:<orgnr>' ..." uten DB-skriving
- **Toggle på uten ID:** klient-guard avviser + toast "Peppol-ID må fylles ut før EHF kan slås på"
- **Auth:** ikke-admin får `code:'unauthorized'` → toast + page redirect
- **DB CHECK-avvisning (defensivt):** hvis klienten omgår guard, DB-nivå CHECK(ehf_enabled=false OR peppol_participant_id NOT NULL) avviser UPDATE → toast med DB-feil

---

## Journey 2: Platform-admin genererer månedlig EHF-eksport

**Precondition:** Platform-admin er logget inn. Minst én company har `ehf_enabled=true`. Det finnes fakturaer i `status IN ('issued', 'overdue')` innen perioden som ikke er eksportert tidligere.

1. Platform-admin navigerer til `/platform-admin/billing/ehf-export`
2. Ser form med periode (default: forrige måned), grouping-checkmarks (default: Samlet), format-checkmarks (default: CSV), filter-toggle (default: ikke-eksportert)
3. Justerer periode til ønsket måned ved behov
4. (Valgfritt) velger "Per workspace" og/eller "PDF" — ser "— kommer snart"-indikator ved siden av
5. Klikker "Generer og last ned"
6. System route: `/platform-admin/billing/ehf-export?period_from=...&period_to=...&grouping=bundled&format=csv`
7. Route kaller `generateEhfExport` action → loader faktura + line-items fra eligible workspaces → bygger én samlet CSV med UTF-8 BOM + CRLF + line_items_json
8. Action stempler `invoice.ehf_exported_at = NOW()` for alle inkluderte fakturaer (batch UPDATE)
9. Route emitter `billing ehf_export_generated` (logger + billing_activity_log) med invoice_count + workspace_count
10. Route returnerer Response med `Content-Disposition: attachment; filename="ehf-eksport-YYYY-MM.csv"`
11. Browser laster ned filen automatisk
12. Platform-admin sender filen videre til regnskapsfører (epost/Drive — utenfor Smartout-scope)

**Postcondition:** CSV-fil mottatt. `invoice.ehf_exported_at` er satt på alle inkluderte fakturaer. `billing_activity_log` har én `ehf_export_generated`-rad.

**Error paths:**
- **Ingen eligible fakturaer:** action returnerer `{ok:false, code:'no_invoices'}` → route HTTP 404 + toast
- **Ugyldig periode (fra > til):** klient-guard + server-guard HTTP 400
- **Per workspace + PDF uten fallback:** klient-guard viser "kommer snart" og avviser submit
- **Per workspace ALENE:** klient-guard avviser før request går ut (route ville returnert 501 uansett)

---

## Journey 3: Platform-admin markerer EHF-faktura betalt på regnskapsførers melding

**Precondition:** Regnskapsfører har levert EHF-fakturaen eksternt og melder til platform-admin at betalingen er mottatt i regnskapssystemet. Fakturaen finnes i Smartout med `status='issued'` eller `'overdue'`.

1. Platform-admin mottar melding utenfor Smartout (Slack/epost/SMS) med fakturanr + beløp + referanse
2. Navigerer til `/platform-admin/billing/invoices/<invoice_id>`
3. Klikker "Marker betalt"
4. Dialog åpner: velger dato, beløp (pre-fylt), kanal
5. Fra kanal-dropdown velger **"Regnskapsfører (EHF)"** (ny verdi `accountant_manual`)
6. Fyller inn betaling-referansen regnskapsfører rapporterte (KID/bilagsnr)
7. Klikker "Marker betalt"
8. System: `markInvoicePaid` server-action validerer Zod → UPDATE `invoice.status='paid' + paid_at + payment_channel='accountant_manual' + payment_date + payment_reference`
9. Emitter `invoice marked_paid` (standard Fase 2-event)
10. Emitter i tillegg `billing accountant_marked_paid` (logger + billing_activity_log + engine_event) — explicit audit for regnskapsfører-rapportert settlement
11. UI: invoice viser `status=paid` + badge-transition + revalidatePath

**Postcondition:** `invoice.status='paid'` + `invoice.payment_channel='accountant_manual'`. `billing_activity_log` har to rader: standard marked_paid + accountant_marked_paid. Engine event-bussen hører begge (reconcile-workflows + eventuell fremtidig accountant-rapportering kan skille).

**Error paths:**
- **Faktura allerede betalt:** status-guard på UPDATE rammer null rader → `code:'not_found'` + toast "invoice_not_found_or_not_in_payable_state"
- **Ugyldig beløp / referanse:** Zod-validering → toast
- **Race (flere platform-admin samtidig):** siste skriv vinner via `status IN ('issued', 'sent', 'overdue')` WHERE-klausul; andre får `not_found` på andre forsøk

---

## Journey 4: Platform-admin re-eksporterer tapt fil

**Precondition:** Regnskapsfører rapporterer at forrige CSV er mistet/slettet. Fakturaer har `ehf_exported_at IS NOT NULL` fra forrige generering.

1. Platform-admin navigerer til `/platform-admin/billing/ehf-export`
2. Velger samme periode som forrige gang
3. **Slår på** "Inkluder allerede eksporterte fakturaer (re-eksport)" filter
4. Klikker "Generer og last ned"
5. System: `excludeAlreadyExported=false` → action inkluderer alle faktura uansett `ehf_exported_at`-verdi
6. Ny CSV lastes ned med samme innhold som forrige (idempotent — samme fakturaer + line-items)
7. `invoice.ehf_exported_at` oppdateres til NY timestamp (siste eksport-tid)
8. Nytt `billing ehf_export_generated`-event emit

**Postcondition:** CSV mottatt. Tidligere `ehf_exported_at` overskrives med ny timestamp. Billing-activity-log har en ny eksport-rad.

**Error paths:**
- Hvis ingen faktura i perioden oppfyller filter (f.eks. alle gikk til 'void'): `code:'no_invoices'` → 404

---

## Settings-skjermbilde (referanse)

`/dashboard/billing/settings` viser tre seksjoner for workspace-admin / owner:

1. **Utsendelsesregler** (Fase 2) — overstyring av platform-baseline dispatch
2. **Automatiske påminnelser** (Fase 3A) — per-workspace auto-dunning opt-out
3. **EHF-fakturering** (Fase 3B) — toggle + peppol_participant_id for company

`/platform-admin/billing/ehf-export` er platform-admin-eksklusiv. Workspace-admin ser ikke denne siden.

---

## Telemetry-bekreftelse

Etter fullt gjennomført journey 1-3 på en workspace:

```sql
SELECT event_name, COUNT(*)
FROM billing_activity_log
WHERE event_name IN (
  'billing ehf_export_generated',
  'invoice marked_paid',
  'billing accountant_marked_paid'
)
GROUP BY event_name;
```

Forventet: 1 ehf_export_generated (per måned), 1 invoice marked_paid (per faktura), 1 billing accountant_marked_paid (per accountant-rapportert betaling).

---

## Ute-av-scope (dokumentert som "kommer snart" i UI)

- **Per-workspace zip:** form viser checkbox, men route returnerer 501. Krever JSZip + multi-artifact bundling.
- **PDF-format:** form viser checkbox, men route returnerer 501. Krever gjenbruk av eksisterende per-faktura PDF + cover/summary-generator.
- **Accountant-rolle / egen login:** ikke i Fase 3B. Platform-admin dekker accountant-aksjonene.
- **Automatisk levering til regnskapsfører:** platform-admin håndterer distribusjon manuelt (epost/Drive).
