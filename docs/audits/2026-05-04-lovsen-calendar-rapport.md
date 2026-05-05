---
title: "Lovsen Calendar Phase 1 — RBAC + Booking PII"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [audit, lovsen, calendar, rbac, gdpr, pii, aml]
---

# Lovsen — Juridisk rapport: Smartout mobil kalender + vaktliste

**Produsert av:** Lovsen v0.2.0 (Phase 1 lovsjekk, read-only)
**Sortie:** `feat/mobile-calendar-redesign` | Worktree: `smartout.ai-mobile-wt-3`
**Dato:** 2026-05-04

---

## Innledning

Rapporten svarer på fem spørsmål fra PLAN-calendar-redesign.md §Phase 1, basert på:
- Design handoff: `docs/design/design_handoff_calendar/README.md` + source-filer
- Phase 0 discovery: `docs/audits/2026-05-04-calendar-redesign-discovery.md`
- Kodebasis: `supabase/migrations/`, `apps/web/src/lib/cascade/`, `apps/web/src/`

Rapporten er veiledning, ikke juridisk rådgivning. Der konsekvensen er rettslig (lønnstrekk, oppsigelse, personvernsbrudd) angis disclaimer eksplisitt.

---

## Spørsmål 1 — Vaktliste-tilgangsstyring: Aml, GDPR, hjemmel

### Kontekst fra handoff

`shiftlist.jsx → ScopeChips` tilbyr fire scope-moduser:
- `Mine vakter` — bare innlogget ansatts egne skift
- `Hele teamet` — alle ansattes navn, rolle, avdeling, tid
- `Avdeling ▾` — alle ansatte i valgt avdeling
- `Ansatt ▾` — 4-kol avatar-grid med navn (fornavn + etternavninitial), avdeling, tid for én spesifikk kollega

"Hele teamet"-modusen viser `CompactShiftRow` med `owner.name`, `shift.role`, avdelingsfarge og tid for **alle ansatte i workspacet** uten noen rollesjekk i prototype-koden.

### Juridisk analyse

#### Hva er personopplysninger her?

Navn + rolle + arbeidstid per person er personopplysninger etter personopplysningsloven §2 (gjennomfører GDPR art. 4 nr. 1). At Marius jobber kjøkkenvakt 15–23 mandag er en opplysning om en identifiserbar fysisk person. Det er ikke sensitivt, men det er personopplysning.

[HØY confidence — GDPR art. 4 nr. 1 + personopplysningsloven §2]

#### Hvilket rettslig grunnlag er aktuelt?

| Grunnlag | Egnethet | Kommentar |
|---|---|---|
| **GDPR art. 6(1)(b) — kontraktsnødvendighet** | MEDIUM egnet | Arbeidsavtalen forutsetter at arbeidstaker kjenner til sin egen plan; den forutsetter ikke nødvendigvis at kollegers fulle plan er synlig |
| **GDPR art. 6(1)(c) — rettslig forpliktelse** | LAV egnet | Aml. gir ingen eksplisitt plikt til å vise vaktplan til ansatte om hverandres tider |
| **GDPR art. 6(1)(f) — berettiget interesse** | HØY egnet for driftsformål | Koordineringsbehovet i restaurant/bar er reelt og dokumenterbart; ansatte forventer å vite hvem de jobber med |
| **Riksavtalen / tariff-praksis** | Støttende, ikke selvstendig | Vaktplan-innsyn er etablert bransjenorm i NHO Reiseliv / Riksavtalen; styrker f-grunnlag |

[MEDIUM confidence — grunnlagsvalget avhenger av konkret driftsformål-dokumentasjon]

**Praktisk konklusjon:** Å vise kollegers navn, rolle og vakt-tider til andre ansatte i samme workspace er forenlig med GDPR art. 6(1)(f) forutsatt at:
1. Det er dokumentert i arbeidsreglementet / personvernreglementet at vaktplan deles internt
2. Omfanget begrenses til workspace-scope (ikke på tvers av workspaces)
3. Ekstra sensitiv informasjon (personnummer, adresse, lønn) ikke eksponeres — det gjør handoff ikke

#### Er Aml. relevant?

Aml. har ingen paragraf som direkte regulerer hvem som kan se vaktplan. Relevant er:
- **Aml. §9-1** — overvåking og kontroll: vaktplan-visning er ikke overvåking, men beveger seg mot kontroll dersom man følger spesifikke personers fremmøte over tid
- **Aml. §2A-1 til §2A-7** — varslervern: ikke direkte relevant her

Aml. gir ingen positiv hjemmel for å vise kollegers vaktplan, men heller ingen forbud. Det er GDPR/personopplysningsloven som er det operative rammeverket.

[HØY confidence for at Aml. ikke gir selvstendig hjemmel/forbud — MEDIUM for GDPR-grunnlag]

#### RLS-funn i kodebasen

`supabase/migrations/20260301300000_schedule_shift_table.sql` linje 87–89:

```sql
CREATE POLICY "jwt_read_schedule_shift"
  ON public.schedule_shift FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
```

**Alle workspace-medlemmer kan lese alle skift i workspacet.** Det er ingen rolle-betingelse på READ. En ansatt med `role = 'employee'` kan hente alle `schedule_shift`-rader i sin workspace via Supabase-klienten direkte — uavhengig av hva mobilappen viser.

Dette er juridisk akseptabelt for "Hele teamet"-scope (se over), men det betyr at det **ikke finnes noen backend-enforcement av scope-filtrering** — det er utelukkende klientstyrt i dag.

#### Trengs C4 capability-gate per scope-mode?

| Scope | Backend enforcement i dag | Juridisk krav | Anbefaling |
|---|---|---|---|
| `me` | Nei (klient-filter) | Nei — egne data | Klient-filter holder |
| `all` (Hele teamet) | Nei (RLS åpen for alle workspace-member) | GDPR art. 6(1)(f) + driftsformål-dokumentasjon | MEDIUM: bør gates av profil-rolle i BFF-route |
| `dept` | Nei | Lavere risiko enn `all` | LOW: klient-filter holder midlertidig |
| `person` | Nei | Gjelder spesifikk kollega — økt granularitet, lavere enn `all` totalt sett | LOW: klient-filter holder |

**Konklusjon spørsmål 1:**

Det finnes i dag ingen C4 capability-gate for `schedule.view_all_shifts` eller tilsvarende. `engine_authority_config` i `seed-preview.sql` har én rad: `('schedule', 'read_only')` — det er et generisk scope for hele scheduling-kapabiliteten, ikke per scope-mode.

Det er juridisk forsvarlig å vise "Hele teamet" til alle workspace-ansatte, men det bør:
1. Dokumenteres i personvernreglementet (driftsformål)
2. Gates server-side per rolle på sikt (ikke dag-1 blocker, men backlog)

| Funn | Severity | Type |
|---|---|---|
| Ingen server-side scope-gate — klient-filter eneste vern | MEDIUM | Backlog |
| `jwt_read_schedule_shift` åpner alle workspace-skift for alle ansatte — bevisst, men udokumentert driftshjemmel | MEDIUM | Backlog |
| Ingen `scheduling.view_all_shifts`-capability i `engine_authority_config` | MEDIUM | Backlog |

---

## Spørsmål 2 — Skiftleder-rettigheter: Aml-grunnlag og differensiering

### Kontekst fra handoff

Handoff README §11 spørsmål 5: "hva ser en skiftleder vs. vanlig ansatt i Vakter-tab?"

`shiftlist.jsx → CompactShiftRow` viser `LEDER`-badge på rader der `shift.isShiftLead === true`. Det er ingen kode i prototype som differensierer hva skiftlederen _kan se_ — kun at de kan _markeres som leder_ på en rad.

`ScopeChips` viser alle fire scope-moduser til alle brukere uten rollesjekk.

### Juridisk analyse

#### Hva er en skiftleder i norsk arbeidsrett?

Skiftleder er ikke en juridisk definert rolle i Aml. Det er en funksjonell/operativ rolle definert i arbeidsavtalen og stillingsbeskrivelsen. Skiftleder er ikke automatisk "arbeidsgiver" i Aml.-forstand.

[HØY confidence — Aml. definerer ikke "skiftleder"]

**Riksavtalen §4** (NHO Reiseliv / Fellesforbundet) anerkjenner ledende stillinger med forhøyet ansvar, men bruker begrepet "leder" om ledere med personalansvar — typisk hotelldirektør, restaurantsjef. En skiftleder i dagligdagse termer har sjelden "personalansvar" i Riksavtalens forstand.

[MEDIUM confidence — avhenger av stillingsbeskrivelse og tariff-krets]

#### Kan en vanlig ansatt se "Hele teamet" og "Ansatt"-dropdown?

Ja — det er GDPR art. 6(1)(f) som styrer, ikke Aml. Det er ingen norsk lovbestemmelse som forbyr en ansatt å se kollegers vaktplan. Arbeidsgivers styringsrett (Aml. §1-8 + ulovfestet rett) gir imidlertid arbeidsgiver anledning til å **begrense** innsyn dersom det er saklig begrunnet.

[MEDIUM confidence — styringsrettens grense for informasjonsbegrensning er skjønn]

#### Bør skiftleder-rolle gates for `scope='all' | 'person'`?

| Scenario | Vurdering |
|---|---|
| Vanlig ansatt ser "Hele teamet" (navn, rolle, tid) | Akseptabelt — driftsformål. Ingen juridisk plikt til å blokkere. |
| Vanlig ansatt ser "Ansatt"-dropdown med kollega X sin fulle plan | Akseptabelt i workspace-kontekst. Potensielt problem dersom man kombinerer med andre data (sykefravær, overtid) |
| Skiftleder ser hele team — nødvendig for koordinering | Klart akseptabelt, klar driftshjemmel |
| Vanlig ansatt ser telefonnummer på kollega via `contact`-felt | GDPR-risiko — se spørsmål 3 |

**Anbefaling for system-design:**

`isShiftLead` bør ikke styre tilgangen til scope-moduser — det er en per-shift-flagg, ikke en permanent rolle. Profil-rollen (`profile.role`) er det rette differensieringspunktet:

| `profile.role` | `scope='me'` | `scope='all'` | `scope='dept'` | `scope='person'` |
|---|---|---|---|---|
| `employee` | Alltid | Tillatt (GDPR f-hjemmel dokumentert) | Tillatt | Tillatt (kun navn/rolle/tid) |
| `manager` | Alltid | Alltid | Alltid | Alltid + ekstra kontaktinfo |
| `admin` / `owner` | Alltid | Alltid | Alltid | Full PII |

[MEDIUM confidence — konkret grensedragning er produkt-valg innenfor juridisk akseptabelt rom]

| Funn | Severity | Type |
|---|---|---|
| `isShiftLead`-flagg styrer kun visuel badge — ingen rolle-gate på scope | MEDIUM | Backlog |
| Ingen rolle-differensiering mellom `employee` og `manager` for scope-tilgang | MEDIUM | Backlog |
| `profile.role` er korrekt differensieringspunkt — ikke implementert i scope-logikk | MEDIUM | Backlog |

---

## Spørsmål 3 — Booking-kontakt-info PII (ADR-0078 + GDPR)

### Kontekst fra handoff

`screens.jsx → DetailSheet` linje 503–508 (isBooking-blokken):

```jsx
<div style={{ flex: 1, fontSize: 13.5 }}>{it.contact || '—'}</div>
<button ...>Ring</button>
```

`CalendarItem.contact` er definert som `string` — verdien i mock: `'Ingrid Solheim · 99 88 77 66'`. Feltet eksponerer gjestens fulle navn og mobilnummer direkte i UI uten rollesjekk.

"Ring"-knappen vil (i produksjon) trigge `tel:`-link eller Twilio-kall mot dette nummeret.

### Juridisk analyse

#### Klassifisering av gjeste-kontaktinfo

Navn + telefonnummer på en gjest er personopplysninger (GDPR art. 4 nr. 1). Behandlingen av disse dataene krever:
1. Rettslig grunnlag: typisk GDPR art. 6(1)(b) (kontraktsoppfyllelse — man har tatt imot bestilling) eller 6(1)(a) (samtykke)
2. Formålsbegrensning (art. 5(1)(b)): brukes kun til å håndtere den aktuelle bookingen
3. Tilgangsbegrensning (art. 5(1)(f)): kun relevante ansatte skal ha tilgang

[HØY confidence — GDPR art. 4, 5, 6 + Mattilsynet-analogi for gjesteopplysninger i restaurant]

#### Hvem har "trenger" tilgang?

| Rolle | Behov | Anbefaling |
|---|---|---|
| Resepsjonist / booking-ansvarlig | Høyt — tar imot og bekrefter bookingen | Full kontaktinfo |
| Restaurantsjef / skiftleder | Moderat — trenger vite om spesielle behov, ikke nødvendigvis telefonnummer | Spesielle behov ja, telefon avhengig av drift |
| Vanlig kelner | Lavt — trenger vite bord og antall, ikke gjestens identitet | Bord + antall gjester, IKKE navn + telefon |
| Kjøkkensjef | Svært lavt — trenger allergen-info og antall kuverter | Allergen-felt, ikke kontaktinfo |

[MEDIUM confidence — konkret rolle-inndeling er produkt-valg; juridisk prinsipp er "need-to-know"]

#### ADR-0078 (channel-restriksjoner) — er det relevant?

ADR-0078 forbyr PII over voice-channel. Spørsmålet er om telefonnummer er PII i denne sammenhengen — ja, det er det. Men ADR-0078 gjelder Smartout-interne AI-verktøy og capability-tools, ikke gjeste-kontaktinfo i UI generelt.

Det relevante ADR-prinsippet er likevel det samme: PII-eksponering begrenses til kanaler og roller med legitimt behov.

[HØY confidence — ADR-0078 prinsipp; MEDIUM for direkte scope-kobling til gjeste-PII]

#### Er det rimelig å vise telefonnummer i mobil-kalender uten access-control?

**Nei — ikke uten en rollesjekk.** Det er ikke ulovlig per se (booking-kontekst har legitimt grunnlag), men det bryter "need-to-know"-prinsippet i GDPR art. 5(1)(f) og eksponerer gjestens personopplysninger til alle workspace-ansatte.

[HØY confidence — GDPR art. 5(1)(f) er klar]

**Anbefaling:**

```
Scope 'me' (kalender — egne shifts):
  - Vis booking-type, bord, antall, spesielle behov
  - IKKE vis gjeste-navn + telefon til vanlig ansatt

Scope 'all' / DetailSheet (manager / admin):
  - Vis full kontaktinfo

Booking-kontakt-card "Ring"-knapp:
  - Gate på profile.role IN ('manager', 'admin', 'owner')
  - Ellers: vis "Kontakt resepsjonen" i stedet for direkte Ring-knapp
```

| Funn | Severity | Type |
|---|---|---|
| `it.contact` (gjeste-navn + telefon) vises til alle brukere uten rollesjekk i DetailSheet | **HIGH** | Blocker |
| "Ring"-knapp mot gjestens telefonnummer er ukontrollert for alle roller | **HIGH** | Blocker |
| GDPR art. 5(1)(f) need-to-know ikke implementert for booking-PII | **HIGH** | Blocker |
| Ingen felt-level access-control på `CalendarItem.contact` i BFF/hook | MEDIUM | Backlog |

> **Disclaimer:** Eksponering av gjestes kontaktinformasjon til uautoriserte ansatte kan utgjøre et brudd på personopplysningsloven / GDPR art. 5(1)(f). Konsekvens: meldeplikt til Datatilsynet etter art. 33 dersom bruddet medfører risiko for den registrerte. Implementer rolle-gate før booking-kontakt-info eksponeres i produksjon.

---

## Spørsmål 4 — Tidssone i kalender-rendering

### Kontekst

Handoff README §11 spørsmål 4: "alle tider er Europe/Oslo. Bekreft."

### Databasefunn

Fra `supabase/migrations/00001_identity_tables.sql` linje 80:

```sql
timezone text NOT NULL DEFAULT 'Europe/Oslo'
```

`workspace.timezone` eksisterer og defaulter til `Europe/Oslo`. Det er ingen `timezone`-kolonne på `profile`, `schedule_shift`, eller `position`.

Fra `supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql` linje 26–39:

```sql
v_timezone text := 'Europe/Oslo';
...
SELECT timezone INTO v_timezone FROM workspace WHERE workspace_id = v_workspace_id;
IF v_timezone IS NULL OR v_timezone = '' THEN
  v_timezone := 'Europe/Oslo';
END IF;
v_local_now := timezone(v_timezone, now());
```

`schedule_shift.shift_date` er `DATE` (uten timezone), `start_time` og `end_time` er `TIME` (uten timezone). Alle temporale beregninger skjer relativt til `workspace.timezone`.

### Juridisk / praktisk analyse

#### Hvilken tz vinner?

| Lag | Hva brukes | Status |
|---|---|---|
| **Lagring** | `shift_date DATE` + `start_time TIME` — tz-naive | Workspace-tz implisitt |
| **Beregning** (lock, derivasjon) | `workspace.timezone` eksplisitt | Verifisert i kode |
| **App-rendering** | Udefinert — handoff sier "Europe/Oslo" | Ikke implementert ennå |
| **Device-tz** | React Native `Intl` / `date-fns-tz` bruker device | Potensielt avvik |

**Svaret på handoff-spørsmålet:** `workspace.timezone` er autoritativ kilde. Konfirm: ja, "Europe/Oslo" for norske workspaces — men det er `workspace.timezone` som skal styre rendering, ikke hardkodet string.

#### For hospitality-tenant med utenlandsk personale på besøk

Arbeidsretten her er klar: Aml. gjelder for arbeid utført i Norge, uavhengig av arbeidstakers nasjonalitet (Aml. §1-7 første ledd). Arbeidstiden gjelder i henhold til arbeidsstedet, ikke arbeidstakerens hjemland.

For en ansatt fra Spania som jobber på Café Skuta i Oslo: vaktplanen skal vises i `workspace.timezone` (Europe/Oslo). Device-tz er irrelevant for arbeidsrettslig riktig tidsvisning.

[HØY confidence — Aml. §1-7 + territorialitetsprinsippet]

#### Fare for device-tz-avvik

React Native `new Date()` bruker device-tz. Dersom en ansatt har telefonen satt til feil tidssone, vil vanilla JavaScript-dato-parse av `shift_date + start_time` gi feil tid på skjermen.

Anbefaling: bruk `date-fns-tz` eller `temporal` Polyfill med eksplisitt `workspace.timezone` fra workspace-kontekst. Aldri stol på device-tz for vaktplan-rendering.

| Funn | Severity | Type |
|---|---|---|
| `workspace.timezone` eksisterer og er autoritativ — men ikke implementert i mobil-hook ennå | MEDIUM | Backlog (Phase 3c) |
| `shift_date DATE` + `start_time TIME` er tz-naive — krever eksplisitt workspace-tz ved rendering | MEDIUM | Backlog |
| Handoff-bekreftelse: "Europe/Oslo" er korrekt default — men implementer mot `workspace.timezone`, ikke hardkodet streng | LOW | Note |

---

## Spørsmål 5 — Avvik og push-notifikasjon: Aml §10-9, rettigheter og grenser

### Kontekst

Handoff README §11 spørsmål 2: "skal avvik (overdue tasks) trigge push-notifikasjon?"

I handoff er `avvik = task med status === 'overdue'`. Fra `screens.jsx`: avvik vises med rød `AVVIK · KREVER HANDLING`-badge i DetailSheet.

### Juridisk analyse

#### Har arbeidstaker krav på varsling ved pause-relatert avvik?

**Aml. §10-9 første ledd:** "Arbeidstaker som har en arbeidstid som overstiger fem og en halv time, har krav på en pause."

Det er en rettighet til arbeidstakeren — ikke en plikt for arbeidstaker til å dokumentere pausen i et system. Loven gir ikke en eksplisitt plikt for arbeidsgiver til å varsle arbeidstaker via push om at en pause ikke er registrert. Det er tvert imot arbeidsgivers plikt å **sørge** for at pausen faktisk gjennomføres.

[HØY confidence — Aml. §10-9 direkte sitat]

**Konsekvens:** Et `overdue`-avvik på en pause-oppgave er et internt drifts-signal til arbeidsgiver/skiftleder, ikke en plikt til å pushe arbeidstaker. Push til ansatt kan gjøres, men:
1. Det er ikke rettslig påkrevd
2. Det er arbeidsgivers verktøy for å minne ansatt om noe de har rett til

Overdriver man push-varsler om manglende pause-registrering, kan det oppfattes som overvåking (jf. Aml. §9-1 og personopplysningsloven — systematisk kontroll av ansattes pauser).

#### Hvilke avvik er det greit å pushe?

| Avvikstype | Push til ansatt? | Grunnlag |
|---|---|---|
| Overdue task (generell) | Ja — informasjonsvarsling | Driftsformål, arbeidstakers interesse i å vite om egne gjenstående oppgaver |
| Pause ikke registrert (Aml. §10-9) | Ja — men forsiktig, maks 1 per vakt | Påminnelse om rettighet, ikke kontrollverktøy |
| Hygiene / sikkerhet / skade-avvik | Ja — høy prioritet | HMS-plikt (Aml. §3-1 + IK-forskriften) |
| Annen kollegas avvik | **Nei** — unntatt skiftleder/manager | Need-to-know; ikke arbeidstakers ansvar |
| Lønnsrelaterte avvik | Nei — ikke push | Sensitive — følg ADR-0078-prinsipp, kun chat/admin-notifikasjon |

[HØY confidence for HMS-kategorien — Aml. §3-1 + IK-forskriften; MEDIUM for øvrige]

#### Anbefalte push-regler

```
Kan pushes direkte til ansatt:
  - "Du har en overdue oppgave: [tittel]" (uten andres info)
  - "Husk pause — du har jobbet X timer" (Aml. §10-9 reminder)
  - "HMS-avvik registrert på ditt skift — bekreft mottak"

Skal IKKE pushes direkte til vanlig ansatt:
  - "[Kollega X] har ikke registrert pause"
  - "[Kollega X] har overdue avvik"
  - Lønns- eller timelisteinformasjon
  - Booking-kontaktinfo

Kan pushes til manager / skiftleder:
  - Sammendrag: "3 avvik på kveldsskiftet — krever handling"
  - Ansatt-spesifikke avvik med navn (innenfor skiftlederansvaret)
```

| Funn | Severity | Type |
|---|---|---|
| Ingen push-implementasjon ennå (ut av scope per plan) — definér regler nå | LOW | Note / blocker for fremtidig sortie |
| Avvik-push til vanlig ansatt med andres PII er GDPR-risiko | **HIGH** | Blocker for push-sortie |
| Pause-avvik-push til ansatt er lovlig men bør throttles (maks 1/vakt) — ellers overvåkings-risiko under Aml. §9-1 | MEDIUM | Design-retningslinje |
| HMS-avvik (hygiene, sikkerhet, skade) bør ha høy push-prioritet — Aml. §3-1 | MEDIUM | Backlog for push-sortie |

> **Disclaimer:** Systematisk digital overvåking av ansattes pauser uten hjemmel kan utgjøre ulovlig kontroll etter Aml. §9-1 og GDPR. Dersom push-systemet implementeres slik at det i praksis overvåker individuelle pauser løpende, anbefales det å kontakte advokat med arbeidsrettslig spesialisering (eller NHO Reiseliv juridisk) før produksjons-utrulling.

---

## Tilleggsoppgave — Capability-gate-analyse

### Eksisterende capability-seeds i `engine_authority_config`

| Capability | Level | Min-role | Kilde |
|---|---|---|---|
| `schedule` | `read_only` | Ikke satt | `seed-preview.sql:63` |
| `roster.add_shift_manual` | `confirm` | `manager` | `20260517100000_seed_roster_add_shift_authority.sql:80` |
| `shift_swap.*` | — | — | `20260518100000_seed_shift_swap_authority.sql:80` |
| `session.signoff` / `session.close` | — | — | Kommentar i 0517-fil |
| `billing_query` | — | — | Kommentar i 0517-fil |

**Konklusjon:** Det finnes ingen `scheduling.view_all_shifts`, `schedule.view_team`, `scope.all`, eller tilsvarende capability seeded i `engine_authority_config`.

---

## Samlet funn-oversikt

| # | Funn | Spørsmål | Severity | Type | Anbefalt neste steg |
|---|---|---|---|---|---|
| F-01 | `it.contact` (gjeste-navn + tlf) vises uten rollesjekk i DetailSheet | Q3 | **HIGH** | Blocker | Gate på `profile.role IN ('manager','admin','owner')` i BFF-hook |
| F-02 | "Ring"-knapp mot gjestes mobilnr. ukontrollert | Q3 | **HIGH** | Blocker | Mask til "Kontakt resepsjonen" for `employee`-rolle |
| F-03 | GDPR art. 5(1)(f) need-to-know ikke implementert for booking-PII | Q3 | **HIGH** | Blocker | Felt-level access i `useCalendarItems`-hook |
| F-04 | Avvik-push med andres PII (f.eks. "Kari har ikke stemplet inn") er GDPR-risiko | Q5 | **HIGH** | Blocker for push-sortie | Definer push-regler i ADR før push-sortie startes |
| F-05 | Ingen server-side scope-gate — klient-filter eneste vern for "Hele teamet" | Q1 | MEDIUM | Backlog | Legg til BFF-route med rolle-check ved `scope=all` |
| F-06 | `jwt_read_schedule_shift` åpner alle workspace-skift for alle — udokumentert GDPR-hjemmel | Q1 | MEDIUM | Backlog | Dokumenter driftsformål i personvernreglementet |
| F-07 | `isShiftLead`-flagg styrer kun badge — ingen rolle-gate på scope-tilgang | Q2 | MEDIUM | Backlog | Bruk `profile.role` for scope-differensiering |
| F-08 | Ingen `scheduling.view_all_shifts`-capability i `engine_authority_config` | Q1/Q2 | MEDIUM | Backlog | Seed `schedule.view_team` med `min_role='employee'` (åpen) + `schedule.view_person_detail` med `min_role='manager'` |
| F-09 | `workspace.timezone` er autoritativ men ikke implementert i mobil-hook | Q4 | MEDIUM | Backlog (Phase 3c) | Hent `workspace.timezone` i `useCalendarItems`; bruk `date-fns-tz` for rendering |
| F-10 | Pause-avvik-push bør throttles — systematisk overvåking gir Aml. §9-1-risiko | Q5 | MEDIUM | Design-retningslinje | Maks 1 push per vakt for pause-reminder |
| F-11 | `shift_date DATE` + `start_time TIME` er tz-naive — krever eksplisitt tz ved rendering | Q4 | MEDIUM | Backlog | Bruk `workspace.timezone` + `date-fns-tz` konsistent |
| F-12 | "Europe/Oslo" i handoff er korrekt for norske WS — men ikke hardkod | Q4 | LOW | Note | Bruk `workspace.timezone` API-felt |
| F-13 | HMS-avvik (hygiene/sikkerhet/skade) bør ha prioritet i push-design | Q5 | MEDIUM | Backlog for push-sortie | Aml. §3-1 + IK-forskriften gir hjemmel |
| F-14 | Ingen cascade-pattern for scope-gating i `apps/web/src/lib/cascade/` | Q1/Q2 | MEDIUM | Backlog | Vurder `evaluateScopePermission(profile, scope)` utility |

---

## Juridiske sources

- **Arbeidsmiljøloven:** §1-7 (territorialitet), §3-1 (HMS-plikt), §9-1 (kontroll og overvåking), §10-9 (pauser), §15-3 (oppsigelsesfrist)
- **GDPR:** art. 4 nr. 1 (personopplysning), art. 5(1)(b) formålsbegrensning, art. 5(1)(f) integritet og konfidensialitet, art. 6(1)(b)(f) rettslig grunnlag
- **Personopplysningsloven:** §2 (gjennomfører GDPR art. 4)
- **IK-forskriften (FOR-1996-12-06-1127):** §5 systematisk HMS-arbeid
- **Riksavtalen (NHO Reiseliv / Fellesforbundet):** §4 stillingsinnhold / lederbegrep
- **ADR-0078** (channel-restriksjoner, PII voice-forbud): prinsipp overførbart til push

---

## Eskalerings-anbefalinger

| Tema | Anbefaling | Grunnlag |
|---|---|---|
| Booking-PII i produksjon | Kontakt Datatilsynet (veiledning) eller personvernadvokat FØR push til produksjon | GDPR art. 5(1)(f) + art. 33 (bruddmeldeplikt) |
| Push-notifikasjoner og overvåkings-risiko | NHO Reiseliv juridisk eller arbeidrettsadvokat FØR push-sortie igangsettes | Aml. §9-1 + GDPR |
| Tariff-tolkning for skiftleder-rettigheter | NHO Reiseliv juridisk for WS med Riksavtale-tilknytning | Riksavtalen §4 |

---

## Fase 1 — Lovsen-konklusjon for Phase 2 (system-steward)

**Blokkerende funn (HIGH):** F-01, F-02, F-03, F-04 — alle gjelder booking-PII og avvik-push-design. Disse må adresseres i ADR før Phase 3e (DetailSheet) og before push-sortie.

**Phase 3d (ShiftList-redesign) kan starte** uten blokkering — scope-chip-logikken er juridisk akseptabel midlertidig (klient-filter). Backlog-funn F-05 til F-08 trenger ADR men blokkerer ikke bygg.

**ADR-forslag for Phase 2:**
1. `XXXX-vaktliste-scope-rbac.md` — RBAC per scope-mode (allerede planlagt i PLAN §Phase 2)
2. `XXXX-booking-pii-access-control.md` — rolle-gating for gjeste-kontaktinfo (ikke i PLAN — **ny ADR nødvendig**)
3. `XXXX-push-notification-rules.md` — avvik-push-regler og Aml-grenser (out of scope per plan — defer til push-sortie, men dokumenter regelsettet nå)

**Confidence-oppsummering per spørsmål:**

| Spørsmål | Confidence | Kommentar |
|---|---|---|
| Q1 Vaktliste-hjemmel | MEDIUM | GDPR f-grunnlag egnet; konkret dokumentasjon mangler |
| Q2 Skiftleder-rettigheter | MEDIUM | Juridisk rom klart; produkt-grensedragning er skjønn |
| Q3 Booking-PII | HØY | GDPR art. 5(1)(f) direkte anvendelig — det er et gap |
| Q4 Tidssone | HØY | `workspace.timezone` er autoritativ — verifisert i kode |
| Q5 Push + Aml §10-9 | HØY for HMS; MEDIUM for øvrig | §10-9 er klar; overvåkings-grense er skjønn |

---

*Lovsen v0.2.0 — Phase 0c stub, read-only authority. Real validator-body er Phase 0c+ work.*
