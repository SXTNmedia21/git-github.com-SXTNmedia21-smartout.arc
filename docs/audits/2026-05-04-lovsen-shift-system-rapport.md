---
title: "Lovsen Phase 1 — Shift System Lov-rapport"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [audit, lovsen, arbeidsrett, shift, punch, riksavtalen, compliance]
---

# Lovsen — Phase 1 Lov-rapport: shift-system-polish

**Sortie:** `feat/mobile-shift-system-polish`
**Worktree:** `/home/sxtnl/dev/smartout.ai-mobile-wt-2`
**Dato:** 2026-05-04
**Agent:** lovsen-v0.2.0 (Phase 0c-stub)

*Disclaimer: Dette er juridisk veiledning, ikke juridisk rådgivning. Punkter merket LAV confidence bør avklares med advokat eller NHO Reiseliv juridisk før implementering i produksjon.*

---

## Spørsmål 1 — Aml. §14-6 og manuell shift-creation

### Hvilke bokstaver er affected?

Manuell shift-creation er ikke en kontraktsinngåelse — det er en driftshandling innenfor en allerede eksisterende ansettelseskontrakt. Det betyr at §14-6 bokstavene **ikke er direkte triggered** ved selve shift-inserten. Men det er viktige unntak og tilstøtende krav:

| Bokstav | Krav | Status ved shift-create |
|---|---|---|
| **d** | Tidspunkt for begynnelse | Ikke triggered — kontrakten angir allerede start-dato |
| **j** | Daglig/ukentlig arbeidstid | Indirekte: en shift som avviker vesentlig fra `agreed_weekly_hours` kan være en MATERIAL amendment |
| **l** | Særlig arbeidstidsordning | Relevant om shift opprettes utenfor kontraktert ramme (f.eks. nattskift for dagtid-ansatt) |
| **i** | Lønn og tillegg | Indirekte: shift-kategori (evening/night/weekend) bestemmer tariff-supplement |
| **b** | Arbeidsplassen | Relevant om shift opprettes i annen avdeling/lokasjon enn kontraktert |

**Konklusjon: §14-6 bokstavene a–p er ikke krav for shift-creation per se.** Kravet er at selve ansettelseskontrakten dekker disse punktene og er i orden *før* shiftet opprettes. `addShiftAction` er riktig scope — det er en driftshandling, ikke en kontraktsendring.

[HØY confidence — direkte lesning av Aml. §14-6 mot handlingens karakter]

### Når blir det en kontraktsendring?

Dette er den viktige risikoen: gjentatt bruk av shift-create for å systematisk plassere en ansatt utenfor sin kontrakterte arbeidstid/rolle/sted kan over tid konstituere en **faktisk endring av arbeidsvilkårene** — selv om ingen formell kontrakt er endret. Se spørsmål 5 om constructive-dismissal-risk.

### Audit-trail-krav for `source='manual_admin'`

Aml. har ikke et eksplisitt krav om audit-trail for shift-creation. Men:

1. **Bokføringsloven §13** — arbeidstidsregistrering som danner grunnlag for lønn MÅ oppbevares i **5 år** (bokføringsloven §13 første ledd, jf. §2 om "regnskapsmateriale"). En shift med `source='manual_admin'` er lønnsdrivende data — den faller inn her.
2. **Arbeidstilsynets tilsynspraksis** — ved kontroll ser tilsynet på om arbeidsgiveren kan dokumentere *hvem* som bestemte arbeidstid, *når*, og *med hvilken begrunnelse*. `activity_trail.data.reason` + `activity_trail.data.source='manual_admin'` + `activity_trail.data.assigned_to` + timestamp via `emit()` er **tilstrekkelig** for dette formålet.
3. **ADR-0244 `framework_snapshot`** — dette er **eksklusivt for kontrakt-send-route**. `addShiftAction` er ikke en kontrakt-dispatch, den trigger ikke DocuSeal, og `framework_snapshot` har ikke hjemmel i shift-operasjonen. Du skal ikke implementere `framework_snapshot` på `addShiftAction`.

[HØY confidence — §13 er eksplisitt; audit-trail-tilstrekkelighet er MEDIUM confidence basert på tilsynspraksis]

### HIGH-SEVERITY FUNN S1 — `create_shift` i offline-køen mangler all audit

`actionMap.create_shift` (linje 143, `action-map.ts`) gjør en **ren Supabase-insert** uten:
- `source='manual_admin'`
- `reason`/`notes` som audit-felt
- `is_published`
- `gateAction`-sjekk
- `emit()` med `override_reason`

Og `create.tsx` sender ingen `reason` til køen — feltet finnes ikke i skjemaet. Hele audit-kjeden (gate → reason → emit) er **brutt** for offline-create-path. Dette er en ekte compliance-mangel: en manager kan opprette skift uten at Arbeidstilsynet kan rekonstruere hvem som besluttet det.

**Krav:** `create_shift` i `actionMap` MÅ fjernes eller erstattes av BFF-kall som delegerer til `addShiftAction`. Se konkrete krav i slutten av rapporten.

---

## Spørsmål 2 — Aml. §10-2 og punch in/out

### Hva MÅ logges ved arbeidstidsregistrering?

Aml. §10-7 første ledd sier:

> "Arbeidsgiver skal føre oversikt over den tid den enkelte arbeidstaker arbeider."

Forskrift om arbeidstid §6 (FOR 2005-12-16 nr 1567) presiserer at oversikten MÅ inneholde:
- **Start- og slutttidspunkt** for arbeidstiden per dag
- Oversikten skal være **tilgjengelig for Arbeidstilsynet**

`timesheet.time_entry`-tabellen dekker dette:

| Felt | Status | Vurdering |
|---|---|---|
| `punch_in` | TIMESTAMPTZ, NOT NULL | Tilfredsstiller §10-7 |
| `punch_out` | TIMESTAMPTZ, nullable | Tilfredsstiller §10-7 ved completed |
| `profile_id` | UUID, NOT NULL | Knytter til ansatt |
| `shift_id` | UUID → `schedule_shift` | Knytter til planlagt arbeidstid |
| `workspace_id` | UUID, NOT NULL | Scope-guard |
| `breaks` | JSONB `[{start, end}]` | Pause-dokumentasjon |
| `status` | enum: clocked_in/completed/edited | Statusspor |

[HØY confidence — direkte mot Aml. §10-7 og arbeidstidsforskriften §6]

### Oppbevaringstid

Her er to regelsett som gjelder parallelt:

| Hjemmel | Krav | Gjelder |
|---|---|---|
| **Bokføringsloven §13** | **5 år** | Regnskapsmateriale inkl. timeregistrering som lønnsdokumentasjon |
| **GDPR art. 17** | Sletting når formålet er oppfylt | Personopplysninger |
| **Aml. §10-7** | Ingen eksplisitt lengde — "tilgjengelig for tilsyn" | Arbeidstidsoversikt |

Praktisk svar: **5 år** fra innsendelse av lønnsmelding er minimumet (bokføringsloven §13 jf. A-meldingsforskriften). Skyv ikke under dette. GDPR-kravet løses via "nødvendig for regnskapsformål" som rettsgrunnlag (GDPR art. 6(1)(c) jf. bokføringsloven) — ikke consent.

Tabellen har ingen `retention_policy`-kolonne eller soft-delete flagg. Dette er et gap, men ikke et akutt compliance-brudd — så lenge data ikke slettes for tidlig.

[HØY confidence for 5-årsregelen; MEDIUM for GDPR-vurderingen]

### HIGH-SEVERITY FUNN S2 — `punch_out` i offline-kø mangler `break_minutes` og `notes`

`use-punch.ts` linje 138 sender `break_minutes: 0` hardkodet i `emit()`-data — men selve `punchOutSchema` (schemas.ts linje 37-41) inneholder IKKE `break_minutes`, og `actionMap.punch_out` sender heller ikke faktisk pause-tid til `time_entry`-raden. Ved punch-out er `breaks`-kolonnen (JSONB) typisk allerede populert via `break_start`/`break_end`-handlinger, men dersom en bruker aldri trykker "Pause"-knappen og bare stempler ut, er den faktiske pausen (om den var tatt utenfor appen) **uregistrert**. Det er ikke en systemfeil i seg selv, men:

- `emit()` sender `break_minutes: 0` som fast verdi — dette er **misvisende telemetri** og kan gi feil lønnsdatagrunnlag.
- BFF-wrappen for punch bør beregne faktisk pause fra `breaks` JSONB ved punch-out.

---

## Spørsmål 3 — Aml. §10-9 og pauser

### Lovkravet

Aml. §10-9 første ledd:

> "Arbeidstaker skal ha minst én pause dersom den daglige arbeidstiden overstiger fem og en halv time."

Pausens lengde er ikke eksplisitt angitt i §10-9 første ledd (det er §10-9 andre ledd som sier minst 30 minutter ved 8-timers dag i praksis). Arbeidstilsynet og rettspraksis legger til grunn:
- Ved > 5,5 t arbeidsdag: **minst 30 minutter** pause
- Pausen skal legges "i rimelig tid" på midten av arbeidsdagen
- Pause < 30 min ved > 5,5 t dag = **lovbrudd**

### Tilfredsstiller create.tsx + punch-løsningen §10-9?

**create.tsx `breakMinutes`-feltet:** Dette er et **planleggings-hint**, ikke en faktisk pause-registrering. Det lagres som `breaks: 0` i `addShiftAction` (linje 228-229 — feltet sendes ikke videre fra `create.tsx` i det hele tatt; skjemaet sender det ikke i `createShift()`-kallet). Feltet er altså UX-dekorasjon uten backend-effekt i dag.

**punch `break_start`/`break_end` i `actionMap`:** Dette er den faktiske pause-registreringen. JSONB-kolonnen `breaks` lagrer `[{start: timestamptz, end: timestamptz}]` — dette gir eksakt pause-tid per ansatt per dag og tilfredsstiller §10-9 dokumentasjonskravet.

**Granularitet:** §10-9 krever ikke sekund-presisjon. Minutt-presisjon (`timestamptz` truncert til sekund i Postgres) er mer enn tilstrekkelig.

**Men:** Det er ingen serverside-validering som **blokkerer** en shift der planlagt arbeidstid > 5,5 t og `breakMinutes == 0`. En manager kan opprette en 8-timers shift uten pause. Loven sier at **arbeidstaker HAR rett til pause** — arbeidsgiveren kan ikke planlegge bort pausen. Manglende validering er en compliance-risiko ved arbeidstilsyns-kontroll.

[HØY confidence — direkte mot Aml. §10-9 første ledd]

### MEDIUM-SEVERITY FUNN M1 — Ingen serverside pause-validering ved shift-create

`addShiftAction` beregner `workHours` (linje 215), men gjør ingen sjekk på `workHours > 5.5 && breaks == 0`. Anbefaling: legg til advarsel (ikke hard block — det er lovlig å legge til pause i etterkant) i BFF-respons, f.eks. `{ warnings: ["shift_over_5h_no_break_planned"] }`.

### HIGH-SEVERITY FUNN S3 — `create.tsx` sender ikke `breakMinutes` til backend i det hele tatt

Skjemaet har et `breakMinutes`-felt (linje 149, 176-177 i `create.tsx`), men `handleSubmit` sender det ikke via `createShift()`-kallet (linje 179-189). Det er aldri med i `CreateShiftPayload`. Feltet er en blindgate — det gir brukeren inntrykk av at pausen registreres, men ingenting lagres. Dette er misvisende UX og potensielt misleading dokumentasjon.

---

## Spørsmål 4 — Riksavtalen §3, day_category-bucket og timezone-drift

### Stemmer day_category-buckets med Riksavtalen?

Her er den kritiske sammenlikningen:

| Kategori | `addShiftAction` (web) | `create.tsx` (mobile) | `resolve-tariff-rate.ts` | Riksavtalen (Lovdata TARO-79) |
|---|---|---|---|---|
| **night** | `≥22 \|\| <5` | `≥22 \|\| <5` | kveldstillegg: `≥21 \|\| <6` | kveldstillegg: 21:00–06:00 hverdager |
| **evening** | `≥16` | `≥16` | — | lørdag/søndag 14:00–24:00 (helgetillegg) |
| **afternoon** | `≥14` | `≥14` | — | ikke tariff-kategori per se |
| **midday** | `≥11` | `≥11` | — | ikke tariff-kategori per se |
| **morning** | `<11` | `<11` | — | ikke tariff-kategori per se |
| **weekend** | weekday 0 or 6 | weekday 0 or 6 | lørdag ≥15:00, søndag all dag | lørdag 14:00–24:00 + søndag 06:00–24:00 |

**Avvik 1 — night vs. kveldstillegg:**

`addShiftAction.deriveDayCategory` bruker `night: ≥22 || <5`. `resolve-tariff-rate.ts` bruker korrekt `kveldstillegg: ≥21 || <6`. Dette betyr at en vakt fra 21:00–22:00 havner i `day_category='evening'` (ikke `night`), men `resolve-tariff-rate.ts` ville allikevel gi kveldstillegg. De to systemene er **ikke alignert** — `day_category` er en sekundær klassifisering mens tariff-kalkulatoren bruker egne grenser. Så lenge tariff-kalkulatoren har korrekte grenser (21:00) og `day_category` kun brukes til D3-lookup og rapportering, er dette ikke nødvendigvis et betalingsfeil — men det er forvirrende og kan gi feil rapportering.

[MEDIUM confidence — Lovdata TARO-79 bekrefter 21:00 som grense for kveldstillegg; eksakt §3-sitat ikke verifisert mot papirkopi 2025-satser]

**Avvik 2 — helgetillegg lørdag startpunkt:**

`addShiftAction.deriveDayCategory`: `weekend` = weekday 0 or 6 (hele lørdag/søndag).
`resolve-tariff-rate.ts`: helgetillegg = lørdag fra **15:00**, ikke fra 00:00.

Det er altså en **diskrepans** mellom day_category-bucketen (som setter hele lørdag til "weekend") og tariff-kalkulatoren (som bare aktiverer helgetillegg fra lørdag 15:00). Riksavtalen ser ut til å bruke **lørdag 14:00** som grense (ref. Lovdata TARO-79 §4-3). `resolve-tariff-rate.ts` bruker 15:00. Dette kan underrapportere helgetillegg med 1 time per lørdag-vakt.

**Avvik 3 — søndag fra 00:00 vs. 06:00:**

`resolve-tariff-rate.ts` bruker `day === 0` (all søndag) for helgetillegg. Lovdata TARO-79 §4-3 angir søndag fra **06:00**. Altså: en søndag-natt-vakt 00:00–06:00 kan gi dobbelttelling (kveldstillegg + helgetillegg) der Riksavtalen kun gir ett.

[LAV confidence på eksakte klokkegrenser — kilde er Lovdata-webscrape, ikke papirkopi av Riksavtalen 2024-2026. Anbefalt: kontakt NHO Reiseliv juridisk for å bekrefte §4-3 satser og klokkegrenser mot gjeldende tariff.]

**Eskalering:** Tariff-grensene er en NHO Reiseliv-tolkning. Avvikene over bør verifiseres mot gjeldende Riksavtalen-tekst ved NHO Reiseliv juridisk avdeling.

### Timezone-drift — device vs. workspace

**create.tsx linje 81-89:** `deriveDayCategory` på mobil bruker `date.getDay()` og `parseInt(startTime.slice(0, 2))` — dette er **device-lokal tid**, ikke workspace-tid. Kommentaren på linje 78-79 innrømmer dette: "Device tz is used here, not workspace tz."

**addShiftAction.ts linje 99-107:** Server-siden bruker `toWorkspaceDateTimeParts(startAtISO, workspaceTimezone)` — korrekt.

**Worst-case scenario:**

- En norsk restaurantsjef reiser til London (UTC+0 om sommeren, Oslo er UTC+2)
- Han oppretter en vakt på mobil for lørdag 22:00 Oslo-tid
- Mobilen ser dette som lørdag 20:00 UTC → `day_category='evening'` på mobil
- Server ser det riktig som lørdag 22:00 Oslo → `day_category='night'` (eller 'evening' avhengig av bucket)
- `resolve-tariff-rate.ts` bruker UTC (linje 32: `dt.getUTCHours()`) — enda en avvik

Dersom BFF-wrap implementeres korrekt og `create.tsx` sender UTC-ISO til BFF som igjen kaller `addShiftAction`, vil server-side alltid ha workspace-tz og device-tz-drift **elimineres**. Men `resolve-tariff-rate.ts`' bruk av UTC i stedet for workspace-tz er et **separat bug** — `isEveningTime` og `isWeekendTime` bruker `getUTCHours()` og `getUTCDay()` i stedet for workspace-tz. En 21:30 Oslo-vakt om sommeren er 19:30 UTC → ikke kveldstillegg ifølge `resolve-tariff-rate.ts`. Dette er **HIGH severity**.

**HIGH-SEVERITY FUNN S4 — `resolve-tariff-rate.ts` bruker UTC i stedet for workspace-tz**

`isEveningTime` (linje ~29-31) og `isWeekendTime` (linje ~34-39) bruker `dt.getUTCHours()` og `dt.getUTCDay()`. Oslo sommertid er UTC+2 — en 21:00 Oslo-vakt er 19:00 UTC og utløser ikke kveldstillegg. Dette er en tariff-kalkulasjonsfeil som underrapporterer ansattes tillegg. Løsning: konverter `effectiveTimestamp` til workspace-tz (hent `workspace.timezone`) og bruk lokaltid i stedet for UTC.

[MEDIUM confidence på at dette faktisk er en bug — forutsetter at `effectiveTimestamp` sendes som UTC ISO. Kan verifiseres med en test-case: 21:30 Europe/Oslo sommertid.]

---

## Spørsmål 5 — Override-flow og audit for Arbeidstilsynet

### Er `activity_trail.data.override_reason` tilstrekkelig?

`addShiftAction` linje 247-271: override-reason fanges i `emit()` med `override: true, override_reason: overrideReason` — dette lander i `activity_trail.data` (JSONB) via telemetri-motoren.

For **Arbeidstilsynets tilsyns-formål**: Tilsynet ser typisk etter:
- Er arbeidstiden dokumentert? Ja (`shift_date`, `start_time`, `end_time`)
- Er det et spor av hvem som bestemte det? Ja (`actor_id` = adminens `profile_id`)
- Er det angitt begrunnelse? Ja (`reason` og `override_reason` i `activity_trail.data`)

**Konklusjon: dette er tilstrekkelig for et ordinært Arbeidstilsyn-tilsyn.**

[MEDIUM confidence — basert på kjennskap til tilsynspraksis, ikke en eksplisitt lovhjemmel]

### Trenger override `change_proposal` via ADR-0235?

ADR-0235 klassifiserer endringer i kontrakt/lønnsprofil — ikke enkelt-shifter. En shift-create (selv med override) er ikke en MATERIAL amendment av ansettelseskontrakten i ADR-0235 forstand, med ett viktig unntak:

**Constructive-dismissal-risk (ADR-0236):** Dersom en manager systematisk overstyrer en sykmeldt/unavailable ansatt og plasserer dem i skift de ikke kan møte, kan dette over tid tolkes som:
1. En faktisk endring av arbeidsvilkårene (ny funksjon, ny arbeidstid, ny lokasjon) — vesentlig endring = likestilles med oppsigelse (Aml. §15-7)
2. Press på ansatt til å si opp selv — constructive dismissal

`activity_trail` som alene mekanisme er **ikke tilstrekkelig** for å identifisere dette mønsteret på tvers av tid. Det trengs en aggregering.

**MEDIUM-SEVERITY FUNN M2 — Ingen rate-limit eller pattern-detection på gjentatt override av samme profil**

`addShiftAction` logger hvert enkelt override, men det er ingen mekanisme som varsler ved f.eks. "3 overrides av profil X innen 30 dager". Anbefaling: legg til en `engine_event`-trigger som aktiverer workflow dersom override-count > 2 for samme profil innen 30 dager. Dette er Phase 0c+ arbeid, ikke en blocking bug, men bør inn i backlog.

[LAV confidence på constructive-dismissal terskel — dette er en gråsone i norsk arbeidsrett. Kontakt advokat om det faktisk skjer.]

**Eskalering:** Constructive-dismissal er et LAV-confidence juridisk spørsmål. Ved gjentatt systematisk override av samme ansatt: kontakt arbeidsrettsadvokat før situasjonen eskaleres.

---

## Spørsmål 6 — C4-governance og `roster.add_shift_manual`

### Skal mobile-manager ha denne capability?

**ADR-0133 ("Web composes, mobile executes"):** Shift-create er et "compose"-verb — det hører til D1–D5 web-siden. Men planen er å beholde mobile shift-create UI og rute det gjennom BFF som wrapper `addShiftAction`. Dette er ikke i konflikt med ADR-0133 — mobilen er thin client, men det er en legitim use-case at en manager oppretter en vakt fra mobil i en nødsituasjon.

**Gjeldende `engine_authority_config`:** `roster.add_shift_manual` er seedet med `min_role='manager'` og `level='confirm'` (jf. addShiftAction-kommentar linje 32-36). Det er ikke noe `channel`-felt i `engine_authority_config`-skjemaet per dette seedet.

**Konklusjon:**

Mobile-manager bør og kan ha `roster.add_shift_manual`-capability. Autoriseringen styres av:
1. **Rolle** — manager eller høyere (allerede seedet)
2. **JWT** — workspace_id og profile_id verifisert server-side i BFF (ADR-0151)
3. **Channel** — `addShiftAction` bruker hardkodet `channel: "chat"` i `gateAction()`-kallet (linje 204). Dette er teknisk feil for mobile-traffic — mobilen er ikke "chat"-kanalen.

**HIGH-SEVERITY FUNN S5 — Channel i `gateAction` er hardkodet `"chat"` — feil for mobile-BFF-traffic**

`addShiftAction` linje 203-207: `channel: "chat"` er hardkodet. Når BFF kaller `addShiftAction` på vegne av en mobile-bruker, er den reelle kanalen "system" (server-to-server) eller et nytt "mobile"-hint. ADR-0078 Layer 3 sier channel guards er load-bearing. Hardkoding av "chat" for en server-action betyr:
- At `gateAction` tror det er en chat-initiated write
- Eventuelle chat-spesifikke restrictions i `engine_authority_config` kan feile feil vei

**Løsning:** BFF sender `channel: "system"` (server-initiated) i action-kallet, og `addShiftAction` må akseptere `channel` som optional parameter fra BFF-context i stedet for å hardkode.

### Trengs eget authority-flag for "mobile-authoring"?

Nei — ikke i Phase 0c. Mobile-authoring via BFF er i prinsippet identisk med web-authoring: begge ender i `addShiftAction` med same role-check. Ingen ny `engine_authority_config`-rad er nødvendig. Om man i fremtiden vil tillate/forby shift-create per kanal eksplisitt (f.eks. bare web), er det Phase 0c+ arbeid via `channel`-felt i authority-config-tabellen.

[MEDIUM confidence — ADR-0078 channel-guard-mekanismer er delvis Phase 0c+-arbeid]

---

## Gjennomgang av punch-skjerm (compliance)

**Fil:** `apps/mobile/app/(app)/(home)/punch-clock.tsx`

### Compliance-funn på punch-skjermen

**1. Pause-knapp ("Pause") i action-grid — INGEN faktisk funksjonalitet koblet til**

Linje 205: `{ key: "break", icon: Coffee, label: "Pause" }` — `onPress` er undefined. Det finnes ingen `break_start`-trigger på denne knappen. Ansatt tapper "Pause", ingenting skjer. `break_start`/`break_end` i `action-map.ts` er implementert, men ikke koblet til punch-clock-skjermens UI.

**HIGH-SEVERITY FUNN S6 — Pause-funksjon finnes i kode men er ikke tilkoblet UI**

En ansatt i en 8-timers vakt ser "Pause"-knappen, trykker den, og ingenting registreres. Fra Aml. §10-9s perspektiv: arbeidsgiver kan ikke dokumentere at pause ble gitt fordi systemet aldri registrerer den. Dette er den alvorligste compliance-mangelen i hele sortieen:

- Loven krever at pause registreres (§10-9 + arbeidstidsforskriften)
- Systemet har infrastrukturen (`break_start`/`break_end` i kø + JSONB i `time_entry`)
- UI er ikke koblet til infrastrukturen
- Konsekvens: alle punch-out-data viser `breaks: null` — ingen pause er dokumentert for noen vakt

**Krav:** `break`-action-kortet MÅ kobles til `break_start`/`break_end` via `usePunch`-hooken (eller eget `useBreak`-hook) som `enqueue("break_start", ...)`. Dette blokkerer §10-9-compliance.

**2. `punch_in_location` er alltid null ved punch-in**

`usePunch.ts` linje 47: `punch_in_location` sendes ikke i `punchInSchema`. Feltet er i tabellen (migration `20260324090000`), men ingen kode ber om GPS. `gps_verified: false` er hardkodet i emit. Dette er en **feature-mangel**, ikke et compliance-krav (Aml. §10-7 krever ikke GPS). Men det er misvisende telemetri.

**3. Live timer ved punch-clock bruker `Date.now()` — riktig**

`formatTimer` (linje 39-50) beregner elapsed fra `activeTimeEntry.punch_in` (ISO timestamp fra Supabase, UTC). Dette er korrekt og timezone-safe — ingen drift her.

**4. Ingen `emit()` fra `break_start`/`break_end` i action-map**

`actionMap.break_start` og `actionMap.break_end` gjør kun en Supabase-update. Ingen telemetri emit. ADR-0134 sier alle mutasjoner skal emitte. Dette er en **MEDIUM-severity** breach av telemetri-kontrakten.

---

## Konkrete krav til `POST /api/mobile/shifts` (BFF) og `addShiftAction`

### BFF `POST /api/mobile/shifts`

```
Request (Zod-validert):
{
  profileId:    uuid (target employee — REQUIRED)
  startAtISO:   datetime-utc
  endAtISO:     datetime-utc
  role:         string min(1)
  reason:       string min(8)              // REQUIRED — audit-krav
  departmentId: uuid optional
  overrideReason: string optional          // REQUIRED dersom ansatt er unavailable/absent
}

Server gjør:
1. JWT-dekode → actorWorkspaceId (ADR-0151 — ALDRI fra body)
2. Zod-parse request
3. Kall addShiftAction({ ...parsedInput, channel: "system" })
4. Retur { ok, error?, shiftId? }
   + warnings: string[] (f.eks. "shift_over_5h_no_break_planned")

HTTP:
- 200 { ok: true, shiftId }
- 422 { ok: false, error: "..." }   // validation / gate fail
- 401 unauthenticated
- 403 insufficient role
```

### Endringer i `addShiftAction`

| Endring | Prioritet | Begrunnelse |
|---|---|---|
| Legg til `channel?: string`-parameter, send til `gateAction` | HIGH | S5 — channel hardkodet |
| Legg til pause-validering: `workHours > 5.5 && !breaks` → `warnings[]` | MEDIUM | M1 — §10-9 UX |
| Fjern eller no-op `create_shift` fra `actionMap` | HIGH | S1 — offline-create bypasser audit |

### Endringer i `create.tsx`

| Endring | Prioritet | Begrunnelse |
|---|---|---|
| Fjern `deriveDayCategory` — server-side derivasjon | HIGH | S4 + tz-drift |
| Legg til `profileId`-select (ansatt-picker) | HIGH | addShiftAction krever profileId |
| Legg til `reason` textarea min 8 tegn | HIGH | S1 — audit-krav |
| Kall BFF i stedet for `enqueue("create_shift")` | HIGH | S1 |
| Fjern eller marker `breakMinutes` som informasjons-kun | MEDIUM | S3 |

### Endringer i `punch-clock.tsx`

| Endring | Prioritet | Begrunnelse |
|---|---|---|
| Koble "Pause"-knapp til `break_start`/`break_end` via queue | HIGH | S6 — §10-9 compliance |
| Legg til emit() i `actionMap.break_start`/`break_end` | MEDIUM | ADR-0134 telemetri |
| Korriger `break_minutes` i punch-out emit (fra faktisk JSONB) | MEDIUM | S2 |

---

## Sammendrag — severity-tabell

| ID | Funn | Fil | Severity | Lovhjemmel |
|---|---|---|---|---|
| S1 | `create_shift` i offline-kø mangler gate, reason, source, emit | `action-map.ts:143` | HIGH | Aml. §10-7, bokf.§13 |
| S2 | `break_minutes: 0` hardkodet i punch-out emit | `use-punch.ts:138` | HIGH | Aml. §10-7 (misvisende data) |
| S3 | `breakMinutes` i `create.tsx` sendes aldri til backend | `create.tsx:176-189` | HIGH | Aml. §10-9 (UX-misleading) |
| S4 | `resolve-tariff-rate.ts` bruker UTC i stedet for workspace-tz | `resolve-tariff-rate.ts:29-39` | HIGH | Riksavtalen §4-3 (underrapportert tillegg) |
| S5 | `gateAction` hardkodet `channel: "chat"` i server action | `add-shift-action.ts:204` | HIGH | ADR-0078 |
| S6 | Pause-knapp i punch-clock ikke koblet til break_start/break_end | `punch-clock.tsx:205` | HIGH | Aml. §10-9 |
| M1 | Ingen serverside pause-validering ved shift > 5,5 t | `add-shift-action.ts` | MEDIUM | Aml. §10-9 |
| M2 | Ingen pattern-detection for gjentatt override av samme profil | cross-cutting | MEDIUM | Aml. §15-7 (constructive-dismissal) |

**Alle 6 HIGH-funn MÅ addresseres før sortie merges.** MEDIUM-funnene kan deferred med ADR.

---

## Eskalerings-anbefalinger

| Tema | Hvem | Når |
|---|---|---|
| Eksakte klokkegrenser Riksavtalen §4-3 (kveldstillegg 21:00 vs. tariff-kode) | NHO Reiseliv juridisk | Før tariff-beregning i produksjon |
| `resolve-tariff-rate.ts` UTC-bug — potensielt underbetaling av tillegg | NHO Reiseliv juridisk | Akutt — verifiser mot gjeldende satser |
| Constructive-dismissal-risk ved systematisk override | Arbeidsrettsadvokat | Dersom mønster faktisk oppstår |
| GDPR-retention policy for `time_entry` | Personvernombud / advokat | Før GDPR-DPA-gjennomgang |

---

*Lovsen v0.2.0 — Phase 0c-stub. Real validator-body er Phase 0c+ work. Siterte paragraf-numre: Aml. §10-7, §10-9, §14-6, §15-6, §15-7; bokføringsloven §13; ADR-0078, -0132, -0133, -0134, -0151, -0204, -0235, -0236, -0244.*

Sources:
- [Riksavtalen — Fellesforbundet (Lovdata TARO-79)](https://lovdata.no/dokument/TARO/tariff/taro-79)
- [Riksavtalen satser fra 1. april 2025 — Fellesforbundet PDF](https://www.fellesforbundet.no/globalassets/lonn-og-tariffsaker/tariffavtaler/overenskomster-2024-2026/riksavtalens-satser-fra-1.-april-2025---nett.pdf)
- [Allmenngjøringsforskrift 2024-10-21 nr 2543 — Lovdata](https://lovdata.no/dokument/SF/forskrift/2024-10-21-2543)
- [NHO Reiseliv lønnsoppgjøret 2026](https://www.nhoreiseliv.no/jushjelp-tariff-hms/lonn-og-tariff/lonnsoppgjor/lonnsoppgjoret-2026/)
