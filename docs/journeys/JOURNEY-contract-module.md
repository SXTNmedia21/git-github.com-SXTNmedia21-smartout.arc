---
title: Contract Module — User Journeys
status: draft
updated: 2026-04-29
created: 2026-04-29
module: contract
tags: [contract, journeys, ux, payroll, obligations, paragraf-14-6]
---

# Contract Module — User Journeys

Fem ende-til-ende journeys som dekker kontraktmodulens livssyklus. Hver journey følger format:

```
## Journey: [Role] [Action]
**Precondition:** what must be true before starting
1. User does X → System does Y → User sees Z
**Postcondition:** what is true after completion
**Error paths:** what happens when things go wrong
```

Roller:
- **Admin** = manager / owner med tilgang til kontrakter og ansatte
- **Ansatt** = employee i workspace
- **Botsson** = AI-kollega (brukerassistent, ikke autonom committer)

Felles preconditions:
- Workspace finnes
- Aktiv `regulatory_framework` + `tariff_rate_table` bundet til workspace via `workspace_framework_binding`
- Mal eksisterer i `contract_template`-tabell (minst én aktiv, ikke deprecated)

---

## Journey 1: Admin definerer kontraktgrunnlag på ansatt-profil

**Mål:** Admin samler all data som §14-6 + Tripletex krever, før kontrakt komponeres.

**Precondition:**
- Profil eksisterer i `profile`-tabellen (ansatt invitert / opprettet)
- Personlig info delvis utfylt (eller tomt)
- Ingen aktiv kontrakt i `employment_contract` for denne profilen

### Steg

1. **Admin** åpner `/dashboard/people/[id]` for ansatt
   → System laster profil + identity + dept-info
   → Admin ser HR-tab (default eller manuelt valgt)

2. **Admin** klikker `Ansettelse`-seksjon (kollapset eller tom)
   → System rendrer skjema med 15 §14-6-felt:
     - Stillingstittel, avdeling, ansettelsesform, ansettelseskategori
     - Stillingsprosent, ukentlig arbeidstid, arbeidstidsordning, yrkeskode
     - Startdato, sluttdato (hvis temporary), prøvetid
     - Pauser, oppsigelsesfrist, variabel arbeidstid, rett til opplæring
   → Felt forhåndsutfylt fra eksisterende profil-data der mulig

3. **Admin** fyller inn data → klikker `Lagre ansettelse`
   → System validerer: prøvetid ≤ 6 mnd, oppsigelse ≥ 1 mnd, sluttdato > startdato
   → System lagrer i `employment_contract` med `status='draft'`
   → System emit `employment_contract.upserted_inline`
   → Admin ser badge "Lagret · utkast"

4. **Admin** klikker `Lønnsprofil`-seksjon
   → System rendrer Tripletex-aligned skjema:
     - Lønnstype, timelønn / månedslønn, lønningsdag
     - Skatt: tabell-nummer, kort-type, trekk-%
     - Feriepenger: sats, 6. ferieuke
     - Pensjon, fagforening
     - Tariff (readonly fra workspace binding)
   → Felt suggested fra `framework_rule` der mulig (timelønn-min, feriepenger-default)

5. **Admin** justerer lønn → klikker `Lagre lønnsprofil`
   → System validerer: timelønn ≥ tariff-min, skatt-data konsistent
   → System upsert i `employee_payroll_profile`
   → System emit `payroll_profile.updated`

6. **Admin** klikker `Tipsregel` (modal)
   → System rendrer fordelingsmetode-velger
   → Admin velger metode + deltakelse → lagre
   → System upsert i `contract_tip_rule`

7. **Admin** ser i sidetopp: "Klar til å sende kontrakt"
   → Knapp `Send kontrakt` blir aktiv

**Postcondition:**
- `employment_contract`-rad med status `draft`, alle §14-6-felt utfylt
- `employee_payroll_profile` opprettet/oppdatert med Tripletex-felt
- `contract_tip_rule` (hvis sat opp)
- Profilen viser status "Klar til å signere"

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Personnr mangler | Validering stopper Save · admin må fylle ut Personlig info først |
| Bankkonto mangler | Soft warning · save tillatt · advarsel om "Kan ikke sende" |
| Sluttdato før startdato | Validering blokkerer Save |
| Prøvetid > 6 mnd | Validering blokkerer Save (lov-trap) |
| Timelønn < tariff-min | Compliance warning · save tillatt med flag i `compliance_overrides` |
| Skatt-data inkonsistent (percentage uten %) | Validering blokkerer Save |
| Network feil under save | Toast error · in-memory data beholdes · retry-knapp |

---

## Journey 2: Admin sender kontrakt til signering (forenklet drawer)

**Mål:** Admin velger mal, ser preview, sender for signering. Ingen cascade-deriv blokkere flyten.

**Precondition:**
- Journey 1 fullført (alle §14-6-felt utfylt)
- `employment_contract`-rad finnes med status `draft`
- Personnr + bankkonto utfylt på profil

### Steg

1. **Admin** klikker `Send kontrakt` på people-page
   → System åpner CompositionDrawer (forenklet, 2 steg)
   → URL oppdateres til `/dashboard/contracts?open=compose&profileId=...`

2. **Step 1: Velg mal**
   → System auto-suggester mal basert på stilling (`contract_template.target_role`)
   → Admin ser liste over aktive maler · klikker en
   → System emit `contracts.compose.template_selected`

3. **Step 2: Preview + Send**
   → System resolve placeholders mot kontrakt + lønnsprofil
   → ContractPreviewEditor rendrer ferdig dokument
   → Admin ser AcknowledgementRing: 4 nøkkelblokker (stilling, lønn, kategori, framework)
   → Admin klikker hver blokk for å bekrefte forståelse → ring fyller seg
   → Admin ser klausuler + obligations som arves fra mal

4. **Admin** klikker `Send for signering`
   → System validerer: PII komplett, blockers tom
   → System kaller `/api/contracts/send`
   → System frosner snapshot (kontrakt + payroll + framework) i `framework_snapshot`
   → System oppretter `signing_contract_id` mot DocuSeal
   → System sender e-post / mobile push til ansatt
   → Drawer lukker · admin ser toast "Kontrakt sendt for signering"
   → Profilen viser status "Sendt · venter på signatur"

**Postcondition:**
- `employment_contract.status = 'sent'`
- `framework_snapshot` JSONB låst med versjon av tariff + rules ved sendetidspunkt
- DocuSeal-prosess pågår
- Telemetri-event `contract.send_initiated` emit

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Mal mangler i workspace | Empty-state · CTA "Lag ny mal" → /maler/ny |
| Mal er deprecated | Warning-banner · admin kan fortsette eller bytte mal |
| Placeholder kunne ikke resolves | Vis liste over manglende felt · link til people-page |
| DocuSeal-feil | Toast error · contract beholdes som draft · retry-knapp |
| Acknowledgement-ring < 4/4 | Send-knapp disabled |
| Compliance blocker (timelønn < min) | Send-knapp disabled · vis i ComplianceBadge |

---

## Journey 3: Ansatt signerer kontrakt og ser sine forpliktelser

**Mål:** Ansatt får tilgang, leser kontrakt, signerer, ser hva som forventes av dem.

**Precondition:**
- Journey 2 fullført (kontrakt sendt)
- Ansatt har gyldig e-post/telefon i `user_identity`
- Ansatt logger inn første gang (eller eksisterende konto)

### Steg

1. **Ansatt** mottar e-post / push-notifikasjon: "Du har en kontrakt klar til signering"
   → Klikker lenke → DocuSeal-flow åpner i ny tab
   → System logger event `contract.signing_link_opened`

2. **Ansatt** leser PDF-kontrakt
   → DocuSeal viser dokument med markerte signatur-felt
   → §14-6-felt synlige + tariff-info + obligations-liste
   → Ansatt scroller gjennom alle sider

3. **Ansatt** signerer
   → DocuSeal kaller webhook `/api/docuseal/webhook`
   → System oppdaterer `employment_contract.status = 'signed'`, `signed_at = now()`
   → System emit `contract.signed`
   → System trigger engine_event for cascade-coupling (D2 update, C4 authority)

4. **Ansatt** kommer tilbake til Smartout-app (web/mobile)
   → Smartout viser welcome-skjerm: "Du er nå ansatt!"
   → Ansatt navigerer til `/dashboard/my-contract`

5. **Ansatt** ser:
   - Stilling, lønn, lønningsdag, ansiennitet-start
   - Forpliktelser (3 av 5 fullført): hver linket til protokoll
   - Tariff-info: "Riksavtalen Hospitality 2024 — Sist oppdatert: ..."
   - [Last ned PDF-kontrakt]-knapp

6. **Ansatt** klikker en uoppfylt forpliktelse (f.eks "HMS-opplæring")
   → System router til `/dashboard/competence/protocol/[protocol_id]`
   → Ansatt starter protokoll
   → Ved fullføring: `contract_obligation.status = 'done'`, `completed_at` settes
   → System emit `contract.obligation_completed`

**Postcondition:**
- Kontrakt signert, lov-gyldig
- Ansatt har tilgang til sine forpliktelser
- Cascade-coupling aktiv: D2 (resource), C4 (authority basert på status `trainee` → `active`)
- `engine_state` for onboarding-prosessen kan progressere

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Ansatt avviser å signere | DocuSeal sender decline-event · `status = 'declined'` · admin notifiseres |
| Signering forfalt (>30 dager) | Status `expired` · admin må forlenge eller resende |
| Ansatt mangler konto | Auto-magic-link til signup → så til DocuSeal-flow |
| Webhook fra DocuSeal feiler | Manual reconciliation-job kjører hver time · cron-fix |
| Ansatt åpner my-contract uten kontrakt | Empty-state: "Ingen aktiv kontrakt · kontakt admin" |
| Forpliktelse-link broken | 404 · system emit broken-link-event for admin |

---

## Journey 4: System enforce'r kontrakt i hverdagen

**Mål:** Kontrakt blir levende komponent — driver shift-cost, blokkerer overdue obligations, surface'er info i Botsson-svar.

**Precondition:**
- Journey 3 fullført (kontrakt signert, ansatt aktiv)
- Ansatt har shifts tildelt (`schedule_shift`)
- Minst én forpliktelse pending eller in_progress

### Steg

1. **Ansatt** prøver å clock-in på shift
   → System leser `schedule_shift.profile_id` → finner aktiv `employment_contract`
   → System sjekker `contract_obligation` for blocker-flag + overdue-status
   → Hvis overdue blocker: clock-in nektes
   → Ansatt ser melding: "Du har overdue forpliktelse: HMS-opplæring (frist 2026-04-15). Fullfør først."
   → Link til protokoll

2. **Ansatt** fullfører blocker-protokoll
   → `contract_obligation.status = 'done'`
   → Engine_event: re-evaluate clock-in-eligibility
   → Ansatt prøver clock-in igjen → tillatt

3. **System** beregner shift-cost ved clock-out
   → Leser `contract_pay_rule` for kontrakten
   → Anvender base hourly + tillegg basert på tidsrom (f.eks 25% kveldstillegg etter 18)
   → Skriver til `shift_cost_snapshot` med audit-trail
   → Ansatt ser i my-salary: "Vakt 14. apr: 6t × 195 base + 25% kveldstillegg = 1462 kr"

4. **Ansatt** spør Botsson: "Hvor mye fikk jeg betalt for vakten i går?"
   → Botsson kaller `salary_query`-capability
   → Capability leser `shift_cost_snapshot` + `contract_pay_rule`
   → Botsson svarer med breakdown + kilde-referanse: "Ifølge kontrakt §3 og Riksavtalen §3.2..."

5. **Admin** endrer tariff (workspace_framework_binding peker på ny versjon)
   → System trigger engine_event `tariff_version_changed`
   → For hver kontrakt med berørt tariff: opprett amendment-tilbud
   → Admin ser i contracts-hub: "5 kontrakter har amendment-tilbud klare"
   → (Journey 5 fortsetter herfra)

6. **System** detekterer obligation-frist nær
   → Cron-job kjører daglig: les `contract_obligation` med due_within_days = 3
   → For hver: emit `contract.obligation_due_soon` notification
   → Ansatt får push: "Frist om 3 dager: Sertifisering Vinkonsulent"

**Postcondition:**
- Cascade-coupling aktiv: kontrakt brukes i D2/D6/C3/C4-beslutninger
- Shift-cost beregnet basert på kontrakt-pay-rules
- Obligations enforce'r blocker-tilstander
- Botsson kan referere kontrakt-data i svar

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Kontrakt mangler `contract_pay_rule` | Fallback til workspace tariff-default · log warning |
| Obligation policy_id peker på slettet policy | Soft-delete · obligation marked `waived` · admin notifiseres |
| Ansatt har overlappende kontrakter | Velg den med senest `start_date` ≤ shift-dato |
| Tariff-bytte mens kontrakt sendes | Snapshot ved send-tidspunkt brukes · ny tariff = amendment-tilbud |
| Botsson-capability får ikke kontrakt-data | Generic svar · log capability-failure |
| Cron-job feiler | Retries med exponential backoff · admin alert ved 3x feil |

---

## Journey 5: Admin endrer kontrakt (amendment-flow)

**Mål:** Admin endrer kontrakt-data → ansatt godkjenner med ny signering hvis material endring.

**Precondition:**
- Aktiv signert kontrakt (`status = 'signed'`)
- Endring som krever amendment (lønn, stilling, prosent, tariff-versjon)

### Steg

1. **Admin** åpner people-page → klikker `Endre ansettelse`
   → System åpner amendment-flow (drawer eller dialog)
   → System sammenligner gjeldende kontrakt vs ny inputs

2. **Admin** justerer lønn fra 195 → 210 kr/t
   → System klassifiserer endringen som "material" (lønn = ja)
   → Banner: "Material endring. Krever ny signering."
   → Ikke-material endringer (f.eks pårørende) commit'es uten amendment

3. **Admin** klikker `Lag amendment`
   → System oppretter rad i `contract_amendment`-tabellen:
     - `parent_contract_id` peker på opprinnelig kontrakt
     - `change_summary` med diff
     - `requires_resigning = true`
   → System lager ny `employment_contract`-rad (versjon 2) med pending-status
   → Original kontrakt's `status` settes til `superseded`

4. **System** sender push/e-post til ansatt: "Kontrakt-endring krever din godkjenning"
   → Ansatt åpner my-contract → ser amendment-banner
   → Ansatt ser side-by-side diff: gammelt vs nytt

5. **Ansatt** godkjenner endringen → DocuSeal-signering
   → Ny kontrakt status `signed`
   → Engine_event: re-evaluate cascade (oppdater D2 + C3 pay-rules)
   → Admin notifiseres: "Lise har signert amendment"

6. **System** oppdaterer alle relaterte cascade-data
   → Nye `contract_pay_rule`-rader generert hvis lønn endret
   → `framework_snapshot` oppdatert med endring-grunnlag
   → Audit-trail i `activity_trail` med hele endring-historikken

**Postcondition:**
- Original kontrakt = `superseded`
- Ny kontrakt-versjon = `signed`
- `contract_amendment`-rad linker dem
- Cascade-coupling oppdatert med ny lønn/stilling
- Audit-trail komplett

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Ansatt avviser amendment | Original kontrakt forblir aktiv · admin må re-foreslå eller akseptere status quo |
| Amendment-frist (30 dager) utløper | System auto-archives amendment som `expired` · admin må lage ny |
| Material endring uten ansatt-respons | Daglig reminder push i 14 dager, så admin alert |
| Tariff-trigger amendment for 100+ kontrakter | Bulk-flow: én amendment per ansatt, status-aggregert i contracts-hub |
| Ansatt allerede sluttet (`status = inactive`) | Amendment kan ikke trigges · admin må first reactivate eller skip |
| Tilbake-i-tid amendment (effective_from < today) | Validering blokkerer · alle amendments må gjelde fra dato i fremtid |

---

## Journey-oversikt — cascade-touchpoints

| Journey | Cascade-dimensjoner berørt | Kritiske entiteter |
|---------|---------------------------|-------------------|
| 1. Definer grunnlag | D2 (Resource pre-bind) | `employment_contract`, `employee_payroll_profile`, `contract_tip_rule` |
| 2. Send kontrakt | D2 + C4 | `framework_snapshot`, DocuSeal `signing_contract_id` |
| 3. Signering | D2 (active), C4 (authority), K1b (memory) | `engine_state` (onboarding) |
| 4. Hverdag-enforce | D6 (production), C1 (calibration), C3 (cost) | `shift_cost_snapshot`, `contract_obligation`, `engine_event` |
| 5. Amendment | D2 + D4 + C3 + C4 | `contract_amendment`, `framework_snapshot`-revision |

## Telemetri pr journey

| Journey | Key events |
|---------|-----------|
| 1 | `employment_contract.upserted_inline`, `payroll_profile.updated`, `contract.tip_rule_changed` |
| 2 | `contracts.compose.opened`, `contracts.compose.template_selected`, `contract.send_initiated` |
| 3 | `contract.signing_link_opened`, `contract.signed`, `contract.obligation_assigned`, `contract.obligation_completed` |
| 4 | `contract.obligation_due_soon`, `contract.obligation_overdue`, `shift.cost_calculated` |
| 5 | `contract.amendment_initiated`, `contract.amendment_signed`, `contract.amendment_declined` |

## Dependencies mellom journeys

```
Journey 1 ──→ Journey 2 ──→ Journey 3 ──→ Journey 4
                                   │
                                   └──→ Journey 5 (kan skje når som helst etter J3)
```

- J2 kan ikke starte uten J1 fullført
- J3 starter passivt (e-post-trigger fra J2)
- J4 starter passivt (cron + ansatt-aktivitet)
- J5 kan trigges av admin når som helst etter J3, eller av tariff-endring

---

## Endringshistorikk

| Dato | Endring | Forfatter |
|------|---------|-----------|
| 2026-04-29 | Initial — 5 journeys for kontraktmodul | Claude (caveman) |
