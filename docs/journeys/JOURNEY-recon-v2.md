---
title: "Journey — recon-v2"
feature: recon-v2
status: verified
updated: 2026-04-20
created: 2026-04-20
module: reconciliation
tags: [journey, recon, avstemming, admin]
---

# JOURNEY — daily-operation recon-v2

> 5 journeys. Alle admin-perspektiv. Fyll inn eksakt system-output under implementering. Hver journey trenger både happy path OG error path før close.

---

## J1 — Admin velger dag å gjennomgå

**Precondition:**
- Admin logget inn, `workspace_id` resolved via `workspaceData`.
- Minst én `department_session` med status ∈ {`pending_signoff`, `closed`} for workspace.

**Happy path:**
1. Admin navigerer til `/dashboard/reconciliation` → System rendrer list-view → Admin ser uke-grid med status-pills, filter-chips og header-counters (Venter: X, Klar til å låse: Y, Avvik denne uka: Z).
2. Admin klikker filter-chip "Bar" → System filtrerer liste til kun bar-avdeling → Admin ser 3 rader for bar.
3. Admin klikker en rad med status `pending_signoff` → System navigerer til `/dashboard/reconciliation/[date]?dept=[id]` → Admin ser detail-view i 1fr + 380px layout.

**Postcondition:** Detail-view aktiv, sticky approve-panel synlig høyre, preflight-gate rendret.

**Error path:**
- **Ingen sessions:** list er tom → System viser empty-state "Ingen oppgjør registrert denne uka" + CTA "Se forrige uke".
- **Workspace_id null:** System viser loading-skeleton, ingen crash.
- **Filter-chip returnerer 0 rader:** System viser "Ingen avdelinger matcher filteret" + "Nullstill filter"-knapp.

---

## J2 — Admin godkjenner via preflight-gate (happy path)

**Precondition:**
- Admin i detail-view for gitt date+dept.
- `daily_reconciliation.status = 'pending_signoff'`.
- 2 åpne avvik + 1 manglende compliance-evidence (3 blockers).

**Happy path:**
1. Admin ser preflight-gate øverst: "3 punkter må løses før godkjenning" → Admin ser blocker-liste med 3 rader.
2. Admin klikker "Kjølerom temp > 6°C" → System scroller smooth til Avvik-tab + highlighter avviks-raden → Admin markerer avvik som løst.
3. Blocker-liste krymper til 2 → Admin gjentar for avvik 2.
4. Admin klikker "Manglende bilde HACCP-logg kl 18" → System hopper til Oppgaver-tab → Admin uploader bilde.
5. Blockers = 0 → Preflight-kort fader ut (opacity 1→0, height auto→0, 400ms spring) → Grønn banner "Klar for godkjenning" fader inn.
6. Approve-knapp på sticky-panel aktiveres (disabled→enabled 250ms spring) → Admin klikker "Godkjenn oppgjør".
7. System skriver `daily_reconciliation.status = 'closed'` + `approved_by = admin.profile_id` + `activity_trail`-rad (event `reconciliation.approved`) → Admin ser toast "Oppgjør godkjent" + redirect til list-view.

**Postcondition:**
- `daily_reconciliation.status = 'closed'`.
- `daily_reconciliation.approved_by` satt.
- `activity_trail` har ny rad med entity ref.

**Error path:**
- **Optimistic failure:** Server Action rejecter (RLS, nettverk) → Admin ser error-toast "Kunne ikke godkjenne, prøv igjen" → Knapp re-aktiveres → `daily_reconciliation.status` uendret.
- **Concurrent modification:** Annen admin har allerede godkjent → 409-response → Admin ser "Denne dagen er allerede godkjent av Pontus 09:47" → redirect til list.
- **Authority mismatch:** Admin har ikke `reconciliation.approve` capability → Knapp skjult, preflight-gate viser "Denne oppgjøret må godkjennes av admin-rolle".

---

## J3 — Admin overstyrer preflight (Invariant #9)

**Precondition:**
- Admin i detail-view med ≥1 blocker som ikke kan løses i UI (ekstern avhengighet, f.eks. "tekniker bekrefter reparasjon i morgen").

**Happy path:**
1. Admin ser preflight-gate med blocker "Kompressor-reparasjon bekreftes av tekniker".
2. Admin klikker "Overstyr og godkjenn" (sekundær CTA på approve-panel) → System åpner AlertDialog "Overstyr preflight" med reason-felt (min 20 tegn, zod-validated).
3. Admin skriver "Kompressor fikset 13:45, dokumentert i ticket #1234, tekniker bekrefter muntlig" (62 tegn) → System tillater submit.
4. Admin klikker "Bekreft overstyring" → System skriver `daily_reconciliation.status = 'closed'` + `approved_by` + `activity_trail`-rad tagget `override=true` med reason i payload + `audit_flag='override_used'`.
5. System viser toast "Oppgjør godkjent med overstyring. Loggført i revisjonslogg."

**Postcondition:**
- `daily_reconciliation.status = 'closed'`.
- `activity_trail` har `override=true` + reason.
- Revisjonslogg-tab viser override-hendelsen.

**Error path:**
- **Reason for kort:** <20 tegn → Submit-knapp disabled, hint-tekst "Minst 20 tegn påkrevd".
- **Admin ikke autorisert for override:** Override-CTA skjult (capability `reconciliation.override` ikke tildelt).
- **Override-rate high (telemetri):** etter 10 overstyringer på 30 dager → System viser advarsel "Høy override-frekvens — sjekk at preflight-blockers er riktig konfigurert".

---

## J4 — Admin eksporterer CSV (Hospitality F-2)

**Precondition:**
- Admin i list-view med ≥1 rad.

**Happy path:**
1. Admin klikker "Eksporter CSV" i header → System genererer CSV klient-side.
2. CSV inneholder kolonner: `Dato, Avdeling, Omsetning, Arbeidstid, Lønn, Labor %, Margin, Status` for alle rader i gjeldende filter.
3. Nummer-formatering: norsk locale (f.eks. `87 400,00` / `13,6%`). Dato-format `DD.MM.YYYY`.
4. Fil-navn: `avstemming-uke-17-2026.csv` (basert på filter).
5. Nedlasting triggers via `URL.createObjectURL` + synthetic click.

**Postcondition:** Fil lastet ned til admin's disk. `activity_trail` logger eksport-event.

**Error path:**
- **Tomt datasett:** System viser "Ingen data å eksportere" + ingen nedlasting.
- **Browser-blokkering:** System viser feilmelding "Tillat nedlastinger og prøv igjen".

---

## J5 — Admin leser Revisjonslogg

**Precondition:**
- Admin i detail-view.
- `activity_trail` har ≥1 entry for entity `daily_reconciliation` med matching id.

**Happy path:**
1. Admin klikker "Revisjonslogg"-tab (tab 6) → System queryer `activity_trail WHERE entity_type='daily_reconciliation' AND entity_id=[recon_id]` ordered by `created_at DESC`.
2. Admin ser kronologisk liste:
   - "2026-04-18 23:47 — Marcus Lien registrerte omsetning 91 200 kr"
   - "2026-04-19 09:12 — Pontus Sjögren redigerte omsetning til 89 500 kr · Grunn: POS-feil med kredittkort"
   - "2026-04-19 10:03 — Pontus Sjögren godkjente oppgjør"
3. Liste er read-only. Hver rad viser actor-avatar, tidsstempel (relative + absolute på hover), handling, og evt. reason.

**Postcondition:** Admin forstår full historikk. Ingen mutasjon skjer.

**Error path:**
- **Ingen audit-rader:** System viser "Ingen historikk registrert" + help-tekst "Revisjonslogg fylles automatisk ved hver endring".
- **Telemetri-emit feilet tidligere:** Rader mangler men session har status — System viser banner "Audit-trail kan være inkomplett — kontakt support".

---

## Cross-cutting: Source-of-truth discipline

Alle 5 journeys krever at **ingen knapp, KPI, eller funksjon** rendret i recon-v2 er mock. Grep-gate før close: `rg 'mock|TODO|placeholder|console\.log' <touched-files>` = 0 treff i UI. Hver interaksjon går via Server Action eller TanStack Query mot live data.
