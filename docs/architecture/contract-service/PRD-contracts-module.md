# PRD — Contracts Module

**Status:** Draft
**Dato:** 2026-04-29
**Eier:** Pontus Lindroth
**Relaterte dokumenter:** [ADR-0001](./ADR-0001-kontrakt-og-lonnsprofil-fundament.md), [Architecture](./ARCHITECTURE-contracts-module.md)

---

## 1. Sammendrag

I dag er kontrakten en signert PDF som blir glemt etter dag 1. Den brukes verken til å kommunisere lønnsbetingelser tydelig til ansatte, til å enforce'e opplæringskrav, eller til å koble seg til Smartouts hverdagsdrift. Resultatet er at vi ikke kan referere til kontrakten når ting skjer ("ifølge kontrakten din...") og at admins må følge opp opplæring, sertifiseringer og aktivitetskrav i parallelle systemer.

Contracts-modulen gjør kontrakten om til en levende komponent: strukturert data som er sannhet, der PDF kun er en projeksjon. Modulen dekker juridisk kontrakt (§14-6), lønnsprofil (Tripletex-aligned), lønns-regler, og operasjonelle forpliktelser knyttet til stillingen — alt koblet inn i cascade så Smartout daglig kan bruke kontrakten til kommunikasjon og enforcement.

---

## 2. Problem

### 2.1 Hva som er galt i dag

**For admins:**
- Kontrakt = død PDF. Ingen kobling til opplæring, sertifisering, vakter
- Følge opp opplæringskrav skjer manuelt eller ikke i det hele tatt
- Endringer i lønn/stilling håndteres ad-hoc, ofte uten ny signering
- Ingen oversikt over "hvem mangler hva" på tvers av ansatte
- Drawer for kontrakts-opprettelse har 5 steg — for mye friksjon

**For ansatte:**
- Kontrakts-PDF leses én gang og forsvinner i innboks
- Lønnsbetingelser (timelønn + tillegg + tips) er ikke synlige i app
- Ingen oversikt over hva som forventes (opplæring, sertifiseringer)
- Endringer kommuniseres uformelt, uten klart juridisk spor

**For systemet:**
- Kontrakt-data er ikke koblet til shift, opplæring, KPI, payroll
- Smartout kan ikke svare "ifølge kontrakten din skal du..."
- Botsson har ingen pålitelig kilde for lønns- og stillingsdata
- Ingen audit-trail på endringer

### 2.2 Konsekvenser

- **Compliance-risiko**: §14-6, A-melding, og endringer post juli 2024 ikke konsekvent oppfylt
- **HR-arbeid**: oppfølging av opplæring og sertifisering er manuelt
- **Tap av tillit**: ansatte vet ikke hva som gjelder, leder vet ikke hva som er enforce-bart
- **Skalerings-bremse**: ny ansatt = ny manuell oppgave-liste i parallellsystem

---

## 3. Mål

### 3.1 Primære mål

1. **Kontrakten skal være en aktiv komponent**, ikke et arkivert dokument. Smartout skal kunne referere til den i hverdagen.
2. **Lønnsbetingelser skal være tydelige og synlige** for ansatte til enhver tid — uten å lete i PDF.
3. **Operasjonelle forpliktelser skal enforces**: opplæring og sertifisering blokkerer vakter når påkrevd.
4. **Compliance med §14-6** og A-melding skal være innebygd, ikke en manuell sjekk.
5. **Endringer skal være sporbare og juridisk gyldige**: amendment-flow med korrekt re-signering.

### 3.2 Sekundære mål

- Tripletex-aligned naming og struktur for fremtidig integrasjon
- Mal-system som arver fra rolle-baseline → reduserer dobbeltarbeid
- Tipsregler strukturert (per shift, per stilling, pool) → riktig fordeling

### 3.3 Eksplisitte non-goals (denne fasen)

- Variable-hours kontrakter (komplisert, sjelden)
- Multi-arbeidsgiver-kontrakter (konsern-deling)
- Tariff-forhandlinger som modul
- Pension scheme management UI (lagres, men admin-UI kommer senere)
- Lærlinge-kontrakter (egen ADR)
- Frilans/oppdragsavtale
- Skatteetaten-integrasjon i Fase 0 (planlagt før go-live)

---

## 4. Suksesskriterier

| Kriterium | Måling | Mål |
|---|---|---|
| Kontrakts-opprettelse er rask | Sekunder fra "ny ansatt" til "send for signering" | < 90 sek for standard mal |
| Ansatte forstår betingelsene sine | NPS-spørsmål "Vet du hva som gjelder i kontrakten din?" | > 8/10 |
| Opplæring fullføres i tide | % obligations completed innen frist | > 90% |
| Compliance-feil reduseres | A-melding-avvik per måned | 0 forventet |
| Manuell HR-oppfølging reduseres | Timer/uke brukt på oppfølging | -50% innen 3 mnd |
| Endringer er signert | % MATERIAL-endringer med ny signering | 100% |

---

## 5. Brukere og personas

### 5.1 Persona A — Admin (HR / driftsleder)

**Mål:** Få ansatte i jobb raskt, holde oversikt, unngå compliance-feil.

**Smerter i dag:** Manuell oppfølging, parallelle systemer, kontrakts-PDF som ikke forteller noe om operasjonelt status.

**Bruksmønster:** Daglig oversikt over team, ukentlig oppfølging av nye ansatte og forpliktelser.

### 5.2 Persona B — Ansatt

**Mål:** Vite hva som gjelder, hva som forventes, hva man tjener.

**Smerter i dag:** Kontrakts-PDF leses én gang og glemmes. Lønnsslipp er kryptisk. Aner ikke hva som er pålagt opplæring vs frivillig.

**Bruksmønster:** Sjekke app før vakt, etter lønnsutbetaling, ved store hendelser (ny stilling, lønnsendring).

### 5.3 Persona C — Payroll runner (kan være admin eller ekstern)

**Mål:** Korrekt lønnskjøring, korrekt A-melding-rapport.

**Smerter i dag:** Må manuelt sjekke kontrakt-data mot Tripletex-data, fanger ikke endringer.

**Bruksmønster:** Månedlig kjøring + spot-checks ved avvik.

### 5.4 Persona D — Botsson (AI-assistent som persona)

**Mål:** Kunne svare på spørsmål om kontrakt og lønn med kilde-referanse.

**Smerter i dag:** Ingen pålitelig kilde — må gjette eller si "vet ikke".

**Bruksmønster:** Konstant — spørsmål fra både admin og ansatt.

---

## 6. Bruksområder

### 6.1 Opprette kontrakt for ny ansatt (Admin)

> Som admin vil jeg opprette en kontrakt for en ny bartender på 2 minutter, med riktig tariff, opplæringsforpliktelser og lønn — uten å fylle ut 5 steg.

**Akseptkriterier:**
- Velg ansatt + mal i drawer (2 steg)
- Mal pre-fyller §14-6-felt fra workspace-defaults og rolle-baseline
- Obligations genereres automatisk fra mal (HMS, alkoholservering, åpne/stenge)
- Admin kan justere lønn, prosent, custom obligations i preview
- "Send for signering" trigger PDF-generering + ansatt-varsel

### 6.2 Ansatt signerer kontrakt (Ansatt)

> Som ansatt vil jeg se hva jeg signerer på en forståelig måte — ikke bare en PDF — og forstå hva som forventes av meg fra dag 1.

**Akseptkriterier:**
- App viser strukturerte fakta før signering: stilling, lønn, prosent, tariff, obligations med frister
- Eksplisitt aksept av hver del (ikke bare én "godta alt"-knapp på PDF)
- BankID eller intern e-signering
- Etter signering: kontrakt + obligations synlig i "Min kontrakt"-side

### 6.3 Ansatt sjekker hva som gjelder (Ansatt)

> Som ansatt vil jeg når som helst kunne sjekke hva som gjelder i kontrakten min — lønn, tillegg, frister på opplæring — uten å lete i e-post.

**Akseptkriterier:**
- "Min kontrakt"-side i app viser:
  - Stilling, prosent, arbeidssted
  - Lønn (timelønn/månedslønn) + alle tillegg-regler i klartekst
  - Obligations med status og frister, inkl. start-knapp
  - Lønningsdag, feriepenge-sats
- Last ned PDF om ønsket
- Kontrakts-info kan også hentes via Botsson-spørsmål

### 6.4 Admin endrer lønn (Admin)

> Som admin vil jeg gi en ansatt 5% lønnsøkning, og systemet skal tvinge meg gjennom riktig prosess (amendment + ny signering) — slik at vi alltid har juridisk gyldig avtale.

**Akseptkriterier:**
- Admin endrer `monthly_salary` eller `hourly_rate` i UI
- System klassifiserer som MATERIAL → blokkerer direkte commit
- Genererer amendment med diff-summering
- Ansatt får varsel + signerings-flow
- Etter ansatt-aksept: ny PDF, gammel kontrakt-PDF beholdes som versjon

### 6.5 Admin endrer skattetabell (Admin)

> Som admin vil jeg oppdatere skattetabell uten å plage ansatt med ny signering.

**Akseptkriterier:**
- Skattefelt klassifisert DERIVED — admin kan i prinsippet ikke endre direkte
- I produksjon: hentes fra Skatteetaten
- I fase 0 (før integrasjon): ADMIN-felt med audit
- Ingen ansatt-varsel, ingen re-signering

### 6.6 Bartender prøver å bytte vakt før HMS er fullført (System enforcement)

> Når en ansatt prøver å bytte vakt, skal systemet sjekke om hen har fullført alle blocker-obligations. Hvis ikke: blokkering med kontrakt-referanse.

**Akseptkriterier:**
- Shift-engine spør obligation-service ved hver shift-tildeling/bytte
- Hvis blocker pending: handling avvises med tekst "Ifølge kontrakten din §3 må HMS fullføres innen 14 dager (frist 2026-05-12). Status: ikke startet."
- Admin får varsel om blokkering
- Ansatt får direkte-link til å starte opplæring

### 6.7 Frist for opplæring nærmer seg (System enforcement)

> 7 dager før obligation-frist, skal ansatt og leder få varsel.

**Akseptkriterier:**
- Daglig job evaluerer obligations
- Engine_event ved 7d / 3d / 0d / overdue
- Ansatt får app-varsel
- Leder får oversikt-varsel hvis flere ansatte har frister

### 6.8 Botsson svarer på lønns-spørsmål (Botsson)

> Når ansatt spør "hvorfor tjente jeg X på vakta i går", skal Botsson svare med konkret kontrakt-referanse.

**Akseptkriterier:**
- Botsson henter shift_pay_calculation for shifts
- Forklarer hver linje: base × timer + tillegg-prosent (kilde: Riksavtalen §X.Y, contract_pay_rule rule_id)
- Hvis avvik fra forventet: foreslår admin-kontakt
- Botsson kan ikke endre kontrakt direkte (C4 governance gate)

### 6.9 Ansatt slutter (Admin)

> Som admin vil jeg avslutte et ansettelsesforhold riktig, slik at A-melding-rapporten blir korrekt og oppsigelsesfristen overholdes.

**Akseptkriterier:**
- "Si opp"-knapp på kontrakt
- Påkrevd: end_date_reason (A-melding-kode, dropdown med offisiell liste)
- System kalkulerer faktisk siste arbeidsdag fra notice_period
- Outstanding obligations: admin velger slett / behold som overdue / waive med begrunnelse
- Ved siste arbeidsdag: status `terminated`
- A-melding-rapport oppdateres

---

## 7. Funksjonelle krav

### 7.1 Datamodell

Detaljert i [Architecture-doc seksjon 3](./ARCHITECTURE-contracts-module.md#3-datamodell). PRD-nivå krav:

- F-1.1: Lagre alle §14-6-felt strukturert
- F-1.2: Lagre alle Tripletex-aligned lønnsprofil-felt
- F-1.3: Støtte parallelle kontrakter per ansatt (main + secondary)
- F-1.4: Versjonere lønns-regler med effective_from/until
- F-1.5: Versjonere maler med snapshot ved signering

### 7.2 Opprettelse

- F-2.1: Drawer for opprettelse skal være maks 2 steg
- F-2.2: Mal pre-fyller alle felt fra workspace-defaults + rolle-baseline
- F-2.3: Admin kan overstyre alle felt før send-for-signering
- F-2.4: Validering av §14-6-fullstendighet før signerings-utsendelse

### 7.3 Signering

- F-3.1: Strukturerte fakta vises før signering, ikke bare PDF
- F-3.2: Eksplisitt aksept-segmenter (stilling, lønn, obligations, tariff)
- F-3.3: BankID eller intern e-signering, workspace-konfigurert
- F-3.4: Begge parter signerer; rekkefølge konfigurerbar
- F-3.5: PDF genereres ved siste signatur, lagres i workspace-storage

### 7.4 Endring

- F-4.1: Felt-klassifisering håndheves av amendment-handler (ADR-0001)
- F-4.2: MATERIAL-endring krever amendment + re-signering
- F-4.3: ADMIN-endring tillater direkte commit + audit-log + ansatt-varsel
- F-4.4: DERIVED-felt kan ikke redigeres manuelt i produksjon (kommer fra ekstern kilde)
- F-4.5: Endring av stilling tilbyr to flows: amendment vs ny kontrakt

### 7.5 Obligations

- F-5.1: Generere fra mal ved kontrakt-opprettelse
- F-5.2: Status-tracking pending → in_progress → completed/overdue
- F-5.3: Blocker-obligations blokkerer shift-tildeling
- F-5.4: Frist-varsel på 7d / 3d / 0d / overdue
- F-5.5: Admin kan waive med begrunnelse (audit)

### 7.6 Lønns-regler

- F-6.1: contract_pay_rule per kontrakt med Tripletex salaryType-mapping
- F-6.2: Trigger-condition (jsonb) evalueres ved shift
- F-6.3: Stacking-orden definert per regel (`stacks_with`)
- F-6.4: Overtime-cap evaluering hybrid (engine-default + kontrakt-override innen lov-grense)
- F-6.5: Source-text vises i ansatt-app ("Riksavtalen §3.2")

### 7.7 Tipsregler

- F-7.1: Per kontrakt, ikke per profil (samme person kan ha forskjellig tip-share i forskjellige kontrakter)
- F-7.2: tip_share som numerisk verdi (0.00–1.50)
- F-7.3: tip_share_modifier dokumenterer avvik (trial_period_reduced, etc.)
- F-7.4: Distribusjons-metoder: per_shift_hours / per_position / fixed_percentage / pool

### 7.8 Visning for ansatt

- F-8.1: "Min kontrakt"-side med strukturerte fakta
- F-8.2: Obligations gruppert per type (training/cert/activity), ikke flat liste
- F-8.3: Lønnsbetingelser i klartekst (ikke bare tall)
- F-8.4: Last ned PDF tilgjengelig
- F-8.5: Endringshistorikk synlig (amendments)

### 7.9 Visning for admin

- F-9.1: People-page Ansettelse-seksjon viser alle §14-6-felt
- F-9.2: Lønnsprofil-seksjon separat
- F-9.3: Tipsregel-editor (modal)
- F-9.4: Obligations-status med frist-indikator
- F-9.5: Endre kontrakt / Forny kontrakt / Si opp som distinkte flows

### 7.10 Cascade-coupling

- F-10.1: D2 aggregerer agreed_weekly_hours over aktive kontrakter
- F-10.2: D6 leser pay_rule + tip_rule for shift-cost
- F-10.3: C4 leser trial_period + obligation-blocker for autonomi-flagg
- F-10.4: K1b indekserer kontrakt-felt for Botsson-svar

---

## 8. Ikke-funksjonelle krav

### 8.1 Performance

- NF-1.1: Kontrakt-opprettelse < 2 sek (UI til preview)
- NF-1.2: Obligation-blocker-sjekk < 100ms (på shift-tildeling)
- NF-1.3: Pay-rule lookup ved shift < 50ms
- NF-1.4: PDF-generering async, ikke blokker UI

### 8.2 Skalering

- NF-2.1: Skal håndtere 10 000+ ansatte uten degradering
- NF-2.2: Reconciliation-pull fra Tripletex skal pagineres

### 8.3 Compliance

- NF-3.1: §14-6 fullstendighet validert ved aktivering
- NF-3.2: Bokføringsloven 5 års lagring av amendment + shift_pay_calculation
- NF-3.3: A-melding-koder mot offisiell Skatteetaten-kodeliste
- NF-3.4: GDPR — data-portabilitet for ansatt
- NF-3.5: Aml. §10-6 overtid-tak håndheves

### 8.4 Sikkerhet og PII

- NF-4.1: Row-level security på sensitive felt (personal_number, tax_*, bank_account)
- NF-4.2: Audit-log på alle leser av "Høy"-sensitivitet
- NF-4.3: Soft-delete; hard delete kun etter 5 år

### 8.5 Tilgjengelighet

- NF-5.1: WCAG 2.1 AA på "Min kontrakt"-side
- NF-5.2: Norsk språk som primær, engelsk som sekundær (ansatte uten norsk-kunnskap)

### 8.6 Internasjonalisering

- I første runde: norsk arbeidsrett (§14-6, Aml., A-melding)
- Datamodellen utelukker ikke andre jurisdiksjoner senere, men det er ikke i scope nå

---

## 9. UI/UX-krav

### 9.1 Drawer for opprettelse

- 2 steg max
- Step 1: velg mal (med rolle-baseline-info synlig)
- Step 2: preview med alle felt redigerbare + send-knapp

### 9.2 People-page Ansettelse-seksjon

- §14-6-felt synlig for admin
- Inline-redigering med klassifiserings-feedback ("Dette felt krever amendment")
- Endre stilling / Forny / Si opp som distinkte action-knapper

### 9.3 People-page Lønnsprofil-seksjon

- Skatt / Feriepenger / Pensjon / Fagforening / Lønningsdag som collapsible
- Tipsregel som egen modal-editor
- Tariff readonly fra kontrakt + link til lokale avvik

### 9.4 "Min kontrakt"-side (ansatt)

- Hovedfakta øverst (stilling, prosent, arbeidssted)
- Lønn-seksjon (klartekst)
- Obligations-seksjon (gruppert)
- Last ned PDF-knapp
- Endringshistorikk

### 9.5 Amendment-flow

- Diff-visning før utsendelse
- "Dette er en materiell endring som krever ny signering"
- Ansatt får same strukturerte aksept som ved første signering

---

## 10. Compliance-krav

| Lov | Krav | Implementasjon |
|---|---|---|
| Aml. §14-6 | Skriftlig avtale med spesifikke felt | Validering ved aktivering, alle felt lagret |
| Aml. §14-6 (juli 2024) | Pauser, opplæring, variabel arbeidstid | Felt lagt til datamodellen |
| Aml. §10-6 | Overtid-tak | Engine-enforcement (D3 hybrid) |
| Aml. §15-6 | Prøvetid og pause ved sykdom | Åpent spørsmål — manuell registrering i Fase 0 |
| A-meldingforskriften | Riktige koder for stilling og opphør | Enum-låst end_date_reason, occupation_code |
| Bokføringsloven §13 | 5 års lagring | Soft-delete, audit-trail på amendment |
| Skattetrekkforskriften | Riktig skattetrekk | Skatteetaten-integrasjon (go-live blocker) |
| Personopplysningsloven | PII-beskyttelse | RLS, audit-log, data-portabilitet |
| OTP-loven | Pensjon (min 2%) | pension_scheme med min-validering |

---

## 11. Dependencies

| Avhengighet | Status | Eier |
|---|---|---|
| Profile-modul (D2) | Eksisterer | — |
| Policy / protocol (C4) | Eksisterer | — |
| Role_capability (I1) | Eksisterer | — |
| Tariff-modul | Eksisterer | — |
| PDF-renderer | Eksisterer | — |
| Engine_event-system | Eksisterer | — |
| Skatteetaten-integrasjon | Ikke startet | TBD — go-live blocker |
| Tripletex-sync | Ikke startet | Kan utsettes |
| Shift-engine pay-calculation | Egen ADR senere | TBD |
| BankID / e-signering | Workspace-config | Eksisterer eller integrasjon |

---

## 12. Faseplan

### Fase 0 — Fundament

**Mål:** Strukturert kontrakt-data og lønnsprofil i databasen, basis-UI for opprettelse og visning.

**Leveranser:**
- ADR-0001 godkjent
- DB-migrasjon: §14-6-utvidelser, lønnsprofil-felt, contract_status, employment_role
- People-page Ansettelse-seksjon (§14-6 visning og redigering)
- People-page Lønnsprofil-seksjon
- Tipsregel-editor
- Drawer-forenkling (5 → 2 steg)
- Amendment-handler (klassifisering + flow for MATERIAL)

**Suksess:** Admin kan opprette og endre kontrakter med riktig signerings-flow. Ansatte ser strukturerte fakta i app.

### Fase 1 — Forpliktelser

**Mål:** Operasjonelle forpliktelser strukturert og visuelt.

**Leveranser:**
- contract_obligation-tabell + service
- Obligation-display på people-page (admin + ansatt)
- Generering fra mal ved kontrakt-opprettelse
- Frist-varsler via engine_event

**Suksess:** Admin og ansatt har klar oversikt over hva som er pålagt og frist-status.

### Fase 2 — Mal-arv og snapshot

**Mål:** Maler arver fra rolle-baseline med snapshot ved signering.

**Leveranser:**
- contract_template utvidet med obligations_template + default_pay_rules
- Snapshot-pattern via framework_rule_id
- Amendment-tilbud ved mal-endring (ikke silent overskriving)

**Suksess:** Endring i workspace-baseline propageres riktig (amendment-tilbud), ikke ulovlig retroaktivt.

### Fase 3 — Enforcement

**Mål:** Obligations enforces i shift-tildeling og frist-overgang.

**Leveranser:**
- Shift-engine spør obligation-service ved tildeling
- Cron evaluerer frister daglig
- Engine_event ved overdue + 7d/3d/0d
- Botsson kan referere kontrakt og obligations

**Suksess:** Ansatte uten fullført HMS blokkeres fra vakter. Admin og ansatt får tidlig varsel.

### Fase 4 — Endringer og lønn

**Mål:** Tariff-endring propageres som amendment, lønn-beregning på shift.

**Leveranser:**
- Tariff-revisjon → amendment-tilbud til alle berørte kontrakter
- shift_pay_calculation (egen modul, separat ADR)
- Botsson lønns-svar med kilde-referanse

**Suksess:** Lønn er beregnet, sporbart, forklart for hver vakt.

### Fase 5 — Integrasjoner

**Mål:** Tripletex-sync + Skatteetaten-pull.

**Leveranser:**
- Tripletex push for kontrakt og lønnsprofil
- Reconciliation-pull
- Skatteetaten skattekort-pull (sertifisering kreves)
- A-melding-modul leser fra contracts

**Suksess:** Lønnskjøring kan gjøres uten manuelt arbeid mellom systemer. Compliance er full.

---

## 13. Out of scope

- Variable-hours kontrakter
- Multi-arbeidsgiver / konsern-deling av ansatte
- Tariff-forhandlings-modul
- Lærlinge-kontrakter (egen ADR senere)
- Frilans/oppdragsavtale (ikke ansettelses-flow)
- Pension scheme admin UI (lagres, men admin-UI senere)
- Andre jurisdiksjoner enn Norge
- Forsikring, sportsmidler, frynsegoder (workspace-policy, ikke kontrakt)

---

## 14. Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigasjon |
|---|---|---|---|
| Skatteetaten-integrasjon blokkerer go-live | Høy | Høy | Start eier-utpeking nå; manuell tax_table i Fase 0 |
| Felt-klassifisering blir feil for noen felt | Medium | Medium | Eksplisitt review i ADR + tester |
| Multi-contract-aggregering bryter D2 | Medium | Høy | Implementeres i Fase 0, ikke senere |
| PDF-snapshot divergerer fra DB | Lav | Høy | Snapshot ved signering, immutable; aldri parse PDF |
| Ansatte forstår ikke amendments | Medium | Medium | Tydelig diff-visning + UX-test |
| Tripletex API-endringer | Medium | Lav | Versjonert mapping; reconciliation oppdager drift |
| Riksavtalen-revisjon midt i fase | Medium | Medium | Snapshot beskytter signerte kontrakter; amendment-flow for nye |
| Trial-period håndtering ved sykefravær | Lav | Medium | Manuell i Fase 0; automatisk senere |

---

## 15. Åpne spørsmål

1. Skatteetaten-leverandør og sertifiseringsløype — hvem er eier?
2. BankID vs intern e-signering — workspace-default?
3. Hvor lenge holdes outstanding obligations etter terminering — slett vs behold?
4. Engine-default for overtime-cap: workspace eller tariff som primær?
5. Hvordan håndtere ansatte som migreres fra eksisterende system uten signert ny kontrakt?
6. Skal ansatt kunne be om amendment selv (lønnskrav, stillings-bytte)?

---

## 16. Beslutningssjekklist før Fase 0a

Fra ADR-0001 + denne PRD:

- [ ] D1 — Smartout som master, Tripletex som integrasjonsmål
- [ ] D2 — Parallelle kontrakter tillatt, employment_role fra dag én
- [ ] D3 — Overtid-tak hybrid
- [ ] Felt-klassifisering godkjent (ADR-0001 tabeller)
- [ ] Skatteetaten-eier utpekt
- [ ] BankID-leverandør valgt eller intern e-signering vedtatt
- [ ] PRD-suksesskriterier akseptert (NPS-mål, blocker-effekt, etc.)
- [ ] Faseplan godkjent (5 faser, eller justert)

---

## Referanser

- ADR-0001: Kontrakt og lønnsprofil — fundamentale valg
- ARCHITECTURE-contracts-module.md
- Aml. §14-6, §10-6, §15-6
- Bokføringsloven §13
- A-meldingforskriften
- Tripletex API-dokumentasjon
- OTP-loven