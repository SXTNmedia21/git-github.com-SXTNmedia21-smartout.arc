---
title: Payroll — Tidskonto-lovgrunnlag + O11/O12 verifisering
status: archived
updated: 2026-05-23
created: 2026-05-06
module: payroll
author: lovsen
tags: [payroll, legal, ferieloven, TOIL, avspasering, nattillegg, tidskonto, feriekonto, velferdsdager]
superseded_by: docs/domains/payroll/
---
> Archived 2026-05-23 — see [payroll domain](../../domains/payroll/).


# Tidskonto-lovgrunnlag + O11/O12 verifisering

> Authored by **Lovsen** (norsk arbeidsrett-rådgiver, `packages/ai/src/capabilities/legal/`).
> Confidence-merket HØY/MEDIUM/LAV per påstand.
> **Veiledning, ikke juridisk rådgivning** — se disclaimer nederst.

---

## DEL 1 — Verifisering av O11 + O12

### O11 — Nattillegg-sats Riksavtalen

**Paragrafreferanse:** Riksavtalen (Fellesforbundet/NHO Reiseliv) 2024–2026, §6 tillegg for ubekvem arbeidstid (i Lovdata TARO-79 strukturert under §4-3 tilleggssatser).

**Tidsvindu:** Kl. **00:00–06:00** (ikke 21–06, ikke 18–06). Aml. §10-11 definerer nattarbeid som kl. 21–06, men Riksavtalen-tillegget gjelder kun 00–06. [HØY — bekreftet fra Lovdata TARO-79 og Fellesforbundets satsark]

**Satser per 1. april 2025 (mellomoppgjøret, regulert 2,3% fra 2024-satsene):**

| Arbeidstakergruppe | Sats | Tidsvindu |
|---|---|---|
| Nattvakter og sikkerhetspersonell | **42,41 kr/t** | kl. 00–06 |
| Manuelt arbeid (rengjøring, oppvask o.l.) kl. 01–06 | **24,01 kr/t** + alternativt **143,92 kr/natt** (flat) | kl. 01–06 (spesialregel) |
| Alle øvrige arbeidstakere | **56,02 kr/t** | kl. 00–06 |

[MEDIUM confidence på eksakte kronetall — hentet via Lovdata TARO-79 og satsark-referanser i websøk; PDF-versjon av satsarket (fellesforbundet.no) ikke lesbar maskinelt. Anbefal Pontus å verifisere tall mot oppdatert Riksavtalen-PDF eller NHO Reiselivs innloggede satsside.]

**Stack mot kveldstillegg:** Kveldstillegg (Riksavtalen §6) = 15,65 kr/t kl. 18–24 (man–fre). Nattillegg gjelder 00–06. De overlapper **ikke** — kveldstillegget opphører ved midnatt, nattillegget starter. En vakt 22:00–03:00 gir:
- 22:00–00:00: kveldstillegg 15,65 kr/t (2 t)
- 00:00–03:00: nattillegg 56,02 kr/t (øvrige, 3 t)

De adderes ikke for samme timeintervall. [HØY — logisk av tidsvindu-definisjonene]

**Hotelloverenskomsten (Virke/Fellesforbundet) — separat avtale:** Hotelloverenskomsten gjelder virksomheter tilknyttet Virke (ikke NHO Reiseliv). Kunnskaps-snapshot nevnte 55 kr/t kl. 00–06. Denne avtalen er en parallell til Riksavtalen for samme bransje, men med andre satser. [MEDIUM — kan ikke verifisere nøyaktig sats uten tilgang til Hotelloverenskomstens satsark 2025. For NHO Reiseliv-bundne virksomheter: Riksavtalen-satsen (56,02 kr/t) er korrekt kilde.]

**Engine-konsekvens:**
- Seed `tariff_rate_table` med tre rader: `nattillegg_nattvakt` (42,41), `nattillegg_manuelt_01_06` (24,01), `nattillegg_ordinaer` (56,02), alle med `effective_from = '2025-04-01'`
- `shift_hour_interpretation` lager `night_hours` for perioden 00:00–06:00 per vakt
- Engine velger rate basert på `job_category` på `employment_contract` (nattvakt / manuelt / ordinaer)
- Kombinasjonsregel: kvelds og natt er gjensidig ekskluderende per time

**Anbefaling O11:** Pontus verifiserer kronetallene direkte mot Riksavtalen §6 (2025-satsarket fra fellesforbundet.no eller NHO Reiselivs innloggede side) før seed. Tall over er MEDIUM confidence og bør ikke gå i prod uten Pontus' bekreftelse.

---

### O12 — Delt vakt-terskel + sats

**Paragrafreferanse:** Riksavtalen 2024–2026 §4-3 / §2-4 om arbeidstidsordning og inndeling.

**Funn etter WebSearch + Lovdata TARO-79 gjennomgang:**

Riksavtalen (Fellesforbundet/NHO Reiseliv) **inneholder ikke et fast pengemessig delt-vakt-tillegg** i den verifiserbare avtaleteksten. Bestemmelsen (§2-4 pkt. 4.4.1) gir arbeidstaker rett til å be om delt arbeidstid én dag per uke — men terskel og sats for tillegg er ikke spesifisert som fast nasjonalt beløp. [MEDIUM confidence — Lovdata TARO-79 gjennomgang fant ingen flat delt-vakt-sats]

**Hva som eksisterer av delt-vakt-regulering i Riksavtalen:**
- Delt arbeidstid etter ansatts skriftlige anmodning, maks 1 dag/uke
- Pause-lengde og dag avtales skriftlig på arbeidsstedet
- Ingen nasjonal flat-sats for tillegget (i motsetning til kvelds/natt/helg)

**Gråsone:** Noen lokale særavtaler og tariffoppgjør-protokoller fra NHO Reiseliv/Fellesforbundet kan ha lokalt avtalte delt-vakt-satser som ikke fremkommer i Lovdata-fullversjonen. Det er også mulig at "§6 delt vakt" i eksisterende LEGAL-FRAMEWORK.md bygger på en eldre versjon av Riksavtalen eller en lokal tariff. [LAV confidence på om en flat nasjonal sats finnes]

**Engine-konsekvens:**
- Delt vakt-tillegg bør foreløpig implementeres som workspace-konfigurerbar regel i `payroll_supplement_rule` med `supplement_type = 'split_shift'`
- Default: ingen nasjonal seed — Pontus setter lokal sats per workspace etter å ha verifisert med NHO Reiseliv
- Terskel (typisk bransje-praksis: 2–3 timers opphold mellom vakter) lagres som `split_shift_threshold_minutes` i `payroll_workspace_settings`

**Anbefaling O12:** Kan ikke verifiseres fra åpne kilder. Anbefal **direkte forespørsel til NHO Reiseliv juridisk** om det finnes nasjonal delt-vakt-sats, terskel, og paragraf-referanse i gjeldende Riksavtalen. Alternativt: bekreft at sats er 0 nasjonalt og lokalt konfigurerbart. Dette er ikke-blokkerende for Phase 1 dersom delt-vakt-tillegg implementeres som konfigurerbar regel med default 0.

---

## DEL 2 — Tidskonto-lovgrunnlag

### A. Feriekonto

#### A.1 Lovgrunnlag

Ferieloven av 29. april 1988 nr. 21, særlig §§5, 10, 11. Ufravikelig lov — kan ikke fravikes til ugunst for arbeidstaker (§2). [HØY]

#### A.2 Opptjening og satser

Feriepenger = prosent av **feriepengegrunnlaget** fra opptjeningsåret (foregående kalenderår).

| Situasjon | Sats | Grunnlag |
|---|---|---|
| Standard (alle arbeidstakere) | **10,2%** | Ferieloven §10 første ledd |
| Over 60 år + ekstra ferieuken | **12,5%** (10,2% + 2,3%) | Ferieloven §10 tredje ledd |
| Tariffavtale med 5. ferieuke (inkl. Riksavtalen) | **12,0%** | Ferieloven §10 andre ledd + tariffavtale |

[HØY — direkte fra ferieloven §10]

**NB:** 12,0%-satsen fra Riksavtalen (5. ferieuke) erstatter ikke 10,2% — den gjelder for den ekstra ferieuken. Tolkning: arbeidstakere dekket av Riksavtalen opptjener reelt 12,0% totalt. [MEDIUM — praktisk tolkning av kombinasjonen §10 andre ledd + tariffavtalens ferieuke]

#### A.3 Feriepengegrunnlag

Hva **inngår** i grunnlaget (Ferieloven §10 første ledd):
- Arbeidsvederlag betalt i opptjeningsåret (lønn, overtidstillegg, kveldsavlegg, helgetillegg)
- Sykepenger betalt av arbeidsgiver i arbeidsgiverperioden (de første 16 dagene)
- NAV-sykepenger: gir feriepenger for maks 48 sykedager per opptjeningsår (Ftrl. §8-33)
- Foreldrepenger fra arbeidsgiver: første 12 uker ved 100%, eller 15 uker ved 80%

Hva **ikke** inngår:
- Naturalytelser (fri bil, fri telefon, fri bolig)
- Utgiftsdekning (diett, kjøregodtgjørelse, reise)
- Feriepenger fra foregående år (ikke dobbel-opptjening)
- Ytelser direkte fra NAV (sykepenger fra NAV etter arbeidsgiverperioden er ikke grunnlag)

[HØY — ferieloven §10 + bekreftet via LO-advokatene og Arbeidstilsynet]

#### A.4 Utbetalingstidspunkt

Ferieloven §11 tredje ledd: feriepenger utbetales **siste ordinære lønnskjøring før ferien tar til**. Arbeidstaker kan kreve utbetaling senest én uke før ferien starter. [HØY]

Beløp som overstiger det som erstatter normal lønn under ferie, kan utbetales i tilknytning til hauptferien eller samlet i lønn for juni måned. [HØY — ferieloven §11 tredje ledd]

**Månedlig utbetaling:** Ikke tillatt etter ferieloven som default — feriepenger skal holdes tilbake og utbetales ved ferieuttak. Unntak: tariffavtale kan gi annen løsning. [HØY]

#### A.5 Carry-over

Ferie som ikke er avviklet grunnet sykdom, foreldrepermisjon, eller arbeidsgivers beslutning, kan overføres til neste ferieår — maks 2 uker (Ferieloven §7 tredje ledd). Ingen generell adgang til å bygge opp flereårig ferie-saldo. [HØY]

#### A.6 Sluttoppgjør

Ferieloven §11 fjerde ledd: alle opptjente feriepenger utbetales siste ordinære lønnskjøring før fratredelse. Det som ikke kan beregnes til da, utbetales ved sluttoppgjøret. Feriepenger kan aldri beholdes av arbeidsgiver. [HØY]

#### A.7 Edge cases

| Situasjon | Regel | Confidence |
|---|---|---|
| Ansatt over 60 år | Ekstra ferieuke (§5 andre ledd), sats 12,5% totalt | HØY |
| Riksavtalen 5. ferieuke | Sats 12,0% | HØY |
| Sykmelding i opptjeningsåret | Feriepengergrunnlag inkl. AG-perioden + NAV maks 48 dager/år | HØY |
| Foreldrepermisjon | Grunnlag for første 12/15 uker (§10 fjerde ledd) | HØY |
| Ny ansatt uten opptjening | Ingen utbetaling — men har lovfestet rett til ferieuttak (§7) | HØY |

#### A.8 Engine-konsekvens

Persist per ansatt per opptjeningsår:
- `payroll.absence_quota` med `absence_type = 'vacation'` for feriedager
- Nytt behov: `payroll.vacation_pay_balance` — saldo-tabell per `profile_id` per `accrual_year`
  - Kolonner: `accrual_year`, `gross_basis_amount`, `rate_pct`, `accrued_amount`, `paid_out_amount`, `balance_remaining`
- `paid_out_amount` oppdateres ved hvert ferieuttak eller sluttoppgjør
- Slettforbud: Bokføringsloven §13 — 5 års retensjon på `vacation_pay_balance`-bevegelser

---

### B. Overtidskonto / avspaseringskonto (TOIL)

#### B.1 Lovgrunnlag

Aml. §10-6 **tolvte ledd** (korrekt referanse — ikke §10-12 som nevnt i oppdraget): "Arbeidsgiver og arbeidstaker kan skriftlig avtale at overtidstimer helt eller delvis skal tas ut i form av arbeidsfri på et avtalt tidspunkt." [HØY — bekreftet via Lovdata kap10 og advokatsmart.no]

#### B.2 Er TOIL lovlig som default?

Nei. TOIL krever **skriftlig avtale per ansatt**. Arbeidsgiver kan ikke unilateralt beslutte avspasering istedenfor lønn. Ansatt kan heller ikke kreve det uten avtale. [HØY]

Engine-konsekvens: `overtime_mode = 'banked'` krever at det foreligger en signert tilleggsavtale. Systemet bør ikke aktivere `banked`-modus uten at `toil_agreement_signed_at IS NOT NULL` på `employee_payroll_profile`. Default = `paid_out`.

#### B.3 Hva skjer med OT-tillegget?

Kritisk distinksjon: **Kun timene** kan avspaseres. Tillegget (minst 40% etter Aml. §10-6 ellevte ledd — minimum for timeansatte; Riksavtalen §7 gir 50% de første 3 OT-timene per dag, 100% deretter) **MÅ alltid utbetales i penger**. [HØY]

Eksempel: ansatt jobber 3 OT-timer. Med TOIL-avtale: 3 timer avspasering + 50% av 3 timers timelønn utbetales kontant samme periode.

Engine: ved `overtime_mode = 'banked'` produserer kalkulatoren:
1. `payroll_calculation_line` av type `overtime_banked_hours` (+ til konto, ikke utbetalt)
2. `payroll_calculation_line` av type `overtime_supplement_payout` (tillegget utbetales kontant)

#### B.4 Riksavtalen §7 om avspasering

Riksavtalen §7 gir primært OT-satser (50%/100%). Avtaleformen for avspasering reguleres av Aml. §10-6 tolvte ledd. Riksavtalen inneholder ikke egne bestemmelser om avspaseringskonto-oppbygging eller sluttoppgjør utover det som følger av loven. [MEDIUM — ingen eksplisitt Riksavtalen §7-avspaserings-klausul funnet]

#### B.5 Carry-over og realisering

Aml. setter **ingen eksplisitt grense** for avspaseringssaldo. Men:
- Arbeidsgiver og ansatt bør i avtalen sette tidshorisont for uttak
- Lang oppspart saldo er arbeidsgivers risiko ved sluttoppgjør
- **Sluttoppgjør:** Alle opsparede TOIL-timer MÅ utbetales ved fratredelse (verdi = timer × timelønn + allerede utbetalt tillegg. Tillegget er betalt, timene er ikke). [MEDIUM — direkte lovkrav ikke presisert for TOIL-saldo, men generelle lønnsregler i Aml. §14-15 impliserer det]

#### B.6 Hvem velger mode?

Partene avtaler skriftlig — verken arbeidsgiver eller ansatt kan påtvinge det. Mid-period endring krever ny skriftlig avtale. [HØY]

**Amendment-klassifisering (ADR-0236):** Endring av `overtime_mode` fra `paid_out` til `banked` = ADMIN (ikke MATERIAL) dersom det ikke endrer effektiv totalkompensasjon (tillegget betales uansett). Endring fra `banked` til `paid_out` med umiddelbar utbetaling av akkumulert saldo = ADMIN + regnskapshendelse. [MEDIUM]

#### B.7 Skatte-effekt

Avspasering og lønn er skattemessig ekvivalent — begge er arbeidsinntekt. Ingen skattefordel ved TOIL. Timing: tillegget beskattes samme periode det utbetales; timeverdien beskattes ved utbetaling (sluttoppgjør eller planlagt uttak). [HØY — skattebetalingsloven §5-1]

#### B.8 Engine-konsekvens (ny tabell)

```sql
-- payroll.toil_balance (nytt forslag)
profile_id          uuid  NOT NULL FK(public.profile)
workspace_id        uuid  NOT NULL
accrual_period_id   uuid  FK(payroll.period)  -- perioden timene ble opptjent
banked_hours        numeric(6,2)  -- OT-timer i banken
supplement_paid_out numeric(10,2) -- tillegg som er betalt kontant for disse timene
used_hours          numeric(6,2)  -- timer tatt ut i friperiode
remaining_hours     numeric(6,2)  GENERATED ALWAYS AS (banked_hours - used_hours)
agreement_ref       uuid  FK(employment_contract_detail) -- skriftlig avtale-anker
created_at, updated_at
```

Bokføringsloven §13: 5-års retensjon på saldo-bevegelser.

---

### C. Velferdskonto / psyk-helse-konto

#### C.1 Finnes det lovbestemmelser for "psykiske helse-dager"?

**Kort svar: Nei — som selvstendig rettighetstype.** Det finnes ingen paragraf i norsk lov som gir arbeidstakere et definert antall "psykiske helse-dager". [HØY]

Relaterte lovparagrafer:

| Lov | Paragraf | Innhold | Relevans |
|---|---|---|---|
| Ftrl. §8-23 | Egenmelding | Inntil 3 dager per sykefravær, 4 ganger per 12 mnd | Kan brukes ved psykisk uhelse |
| Ftrl. §8-24 | IA-avtale utvidelse | Bedrifter med IA-avtale: 8 dager sammenhengende, 24 dager/år | Utvidet egenmelding |
| Aml. §4-3 | Psykososialt arbeidsmiljø | Plikt på arbeidsgiver — ikke rettighet til fridager | Ikke relevant for konto |
| Aml. §12-1 til §12-9 | Permisjon | §12-9: barns sykdom (omsorgspenger), ikke eget psykhelse-begrep | Indirekte |

[HØY — direkte lov-gjennomgang]

#### C.2 Riksavtalen / tariffavtaler — velferdsdager

Riksavtalen (Fellesforbundet/NHO Reiseliv) inneholder ingen eksplisitte "velferdsdager" eller "wellness days" som tariff-rettighet i den verifiserbare teksten. [MEDIUM — basert på Lovdata TARO-79 gjennomgang; detaljerte bilag kan inneholde lokale tillegg som ikke er verifisert]

**"Trivselsdager" / "Wellness days":** Ikke norsk lovbegrep. Er **bedriftspolitikk** — arbeidsgiver kan gi dem, men de er ikke rettighetsbasert. [HØY]

#### C.3 IA-avtale og utvidet egenmelding

Bedrifter med Inkluderende Arbeidsliv (IA)-avtale med NAV kan tilby utvidet egenmelding: 8 sammenhengende dager, inntil 24 dager per 52 uker (Ftrl. §8-24). Dette er **ikke** en "psykkonto" — det er utvidet egenmeldingsrett, tilgjengelig for alle diagnoser. [HØY]

Engine-konsekvens: IA-avtale-status lagres på `payroll_workspace_settings.ia_agreement = true`. Egenmeldings-tersklene leses fra `regulatory_threshold`-tabellen (samme mønster som O10/O14).

#### C.4 Engine-konsekvens

Psyk/velferds-"konto" er **ikke en separat juridisk entitet** i norsk rett. To mulige implementasjoner:

1. **Bedriftspolitikk som `absence_type`:** Legg til `absence_type = 'wellness'` med quota-felt i `absence_quota`. Ingen lovfestet verdi — workspace setter antall dager (f.eks. 2 per år). Ingen NAV-refusjon.
2. **IA-egenmelding som konfigurasjon:** `payroll_workspace_settings.ia_extended_sick_leave = true` endrer grenseverdiene i `absence_quota` for `absence_type = 'sick_leave'`.

Ingen ny tabell nødvendig — `absence_quota + absence_type` dekker begge. [MEDIUM — pragmatisk tolkning]

**Dokumentasjonskrav:** Egenmelding = ingen dokumentasjon. Sykmelding = lege-attest etter 3 (eller 8 IA) dager. NAV-refusjon ved sykefravær forutsetter sykmelding.

---

### D. Felles tidskonto-arkitektur

#### D.1 Tabell-struktur: generell vs. dedikert

Anbefalt: **én generell `payroll.time_account_balance`** med `account_type` discriminator.

```
account_type: 'vacation_pay' | 'toil_hours' | 'wellness_days' | 'overtime_supplement_pending'
```

Fordeler over én tabell per type:
- Felles audit-mønster
- Ingen schema-endring ved nye konto-typer
- Konsistent med `absence_quota + absence_type`-mønsteret som allerede finnes

Men: feriekonto er NOK-denominert, TOIL-konto er timer-denominert. Bruk `value_amount numeric(12,2)` + `value_unit: 'NOK' | 'hours' | 'days'`. [MEDIUM — arkitekturvurdering]

#### D.2 Audit — event-sourced vs. point-in-time

Anbefalt: **event-sourced** (saldo-bevegelser som hendelser, saldo derivert). Begrunnelse:
- Bokføringsloven §13 krever sporbarhet (hvem, hva, når) — event-rader gir dette naturlig
- Sluttoppgjørs-rekalkulasjon trenger historikk, ikke bare saldo
- Konsistent med `shift_pay_calculation_event`-mønsteret (ADR-0251)
- `tip_pool + tip_distribution` er analogt mønster

Tabell-forslag:
```sql
payroll.time_account_ledger    -- hendelser (append-only)
payroll.time_account_balance   -- derivert saldo-view (eller materialisert)
```

[MEDIUM — arkitekturvurdering, ikke ADR-ratifisert ennå]

#### D.3 Bokføringsloven §13 retensjon

Alle saldo-bevegelser i `payroll.time_account_ledger` = regnskapsmateriale. 5-års retensjon fra utløpet av regnskapsåret bevegelsen tilhører. [HØY — Bokføringsloven §13]

Slettjobb-logikk: `shift_period_end_date < date_trunc('year', now()) - interval '5 years'`. Samme mønster som W11.

#### D.4 A-melding-rapportering

| Konto-type | A-melding | Begrunnelse |
|---|---|---|
| Feriekonto (saldo) | Nei (saldo) | Feriepenger rapporteres ved utbetaling (`beregnetFeriepengerMnd` løpende, `ferie` ved uttak) |
| TOIL-tillegg (supplement) | Ja — samme periode utbetalt | `overtidsgodtgjoerelse` for tillegget, uansett om timer avspaseres |
| TOIL-timer i konto | Nei — ikke utbetalt | Rapporteres ved uttak/sluttoppgjør |
| Velferds-/wellness-dager | Nei | Ikke ytelse — bedriftspolitikk |
| IA-egenmelding | Via sykepenger-rapportering | Eksisterende `sykepenger`-kode |

[HØY på feriekonto-rapportering; MEDIUM på TOIL-timer — ingen eksplisitt A-meldingsregel for "banked hours" funnet]

#### D.5 Integrasjon med `absence_*`-tabeller

| Entitet | Rolle | Kobling |
|---|---|---|
| `absence_type` | Definerer fraværstypen | `wellness` legges til som ny rad |
| `absence_quota` | Antall dager/timer per type per år | Brukes for velferds- og TOIL-uttak |
| `absence_ledger` | Per-dag debit/credit | Brukes ved uttak av TOIL eller velferdsdager |
| `absence_balance` | Derivert saldo | Eksisterer — ingen endring |
| `payroll.toil_balance` (ny) | Timer-konto for OT i bank | Eget siden knyttet til OT-beregning, ikke fravær |

Feriekonto er egen tabell (`vacation_pay_balance`) pga. NOK-denominasjon og kompleks opptjeningslogikk.

#### D.6 `tip_pool + tip_distribution` som referansemønster

Ja — relevant analogt mønster: `tip_pool` er header (kampanje/periode), `tip_distribution` er per-ansatt allokering. Tidskonto bør bruke samme topp-ned-struktur: `time_account_period` (header) + `time_account_ledger` (bevegelser per ansatt). [MEDIUM]

---

### E. Per-ansatt OT-mode-flagg

#### E.1 Kolonne-plassering

Anbefalt: ny kolonne `overtime_mode enum('paid_out', 'banked')` på `public.employee_payroll_profile`. Default: `'paid_out'`.

Begrunnelse: `employee_payroll_profile` er allerede det kanoniske stedet for per-ansatt lønns-parametre (`tariff_override_id`, `salary_type`, `holiday_allowance_pct`, skattkort-felter). [HØY — konsistent plassering]

Tillegg: `toil_agreement_signed_at timestamptz` — kan ikke sette `banked` uten denne. `toil_agreement_document_id uuid FK(employment_contract_detail)` — dokument-anker.

#### E.2 Aml. §14-6 — krever mode kontraktsfesting?

OT-mode er ikke et av de 16 bokstav-kravene i §14-6. Aml. §14-6 nevner:
- (i) lønn og tillegg — ja, OT-tillegget er relevant
- (j) arbeidstid — ja, men mode er ikke arbeidstid

**Vurdering:** TOIL-avtalen er en separat skriftlig avtale etter Aml. §10-6 tolvte ledd, ikke et §14-6-krav. Den behøver ikke stå i arbeidsavtalen, men MÅ være skriftlig og tilgjengelig for begge parter. [MEDIUM — tolkning av §14-6 og §10-6 samlet]

**Amendment-klassifisering (ADR-0236):** Endring av `overtime_mode` = ADMIN, ikke MATERIAL, dersom tillegget fortsatt betales kontant (som loven krever). Aktivering av `banked`-mode som impliserer at tillegget *ikke* betales = BLOCKED (lovbrudd). [MEDIUM]

#### E.3 Kan ansatt endre selv?

Nei — endring av `overtime_mode` krever ny skriftlig TOIL-avtale mellom partene. Ingen av partene kan endre unilateralt. I engine: endring av `overtime_mode` = admin-commit etter at `toil_agreement_signed_at` er oppdatert. [HØY — følger av Aml. §10-6 tolvte ledd]

#### E.4 Default-policy

`paid_out` = lovens default (OT utbetales). `banked` aktiveres kun ved signert TOIL-avtale. Engine BLOCK på `banked` uten `toil_agreement_signed_at`. [HØY]

---

## DEL 3 — Nye Open Questions (O16+)

### O16 — Nattillegg: gruppe-klassifisering (nattvakt vs. ordinaer)

**Situasjon:** Riksavtalen har ulike satser per arbeidstakergruppe: nattvakter (42,41 kr/t) vs. ordinaere (56,02 kr/t). Engine trenger et felt som klassifiserer den ansatte eller vakten som "nattvakt" eller "ordinaer".
**Spørsmål:** Klassifiseres dette per stilling (kontraktnivå), per vakt (skift-type), eller per arbeidssted?
**Gråsone:** En kokk som dekker nattskiftet uten å ha "nattvakt" som tittel — hvilken sats gjelder?
**Anbefalt:** Pontus bestemmer default-regel; anbefalt: klassifisering per `payroll_shift_type` (ikke per kontrakt), slik at samme ansatt kan ha ulik rate avhengig av hvilken vakttype de er satt opp på.

---

### O17 — TOIL sluttoppgjør — utbetalingsplikts-hjemmel

**Situasjon:** Ansatt slutter med 40 timers TOIL-saldo. Loven har ingen eksplisitt paragraf som sier "TOIL-saldo utbetales ved fratredelse".
**Spørsmål:** Er dette tilstrekkelig dekket av Aml. §14-15 (lønnstrekk-forbudet og opptjent lønn-kravet), eller kreves eksplisitt klausul i TOIL-avtalen?
**Gråsone:** LAV confidence — potensielt tvist-materie.
**Anbefalt:** NHO Reiseliv juridisk eller arbeidsrettsadvokat. Inntil avklart: TOIL-avtalen bør inneholde eksplisitt sluttoppgjørs-klausul.

---

### O18 — TOIL carry-over mellom perioder/år

**Situasjon:** Aml. setter ingen eksplisitt grense for TOIL-saldo. Risikoen for arbeidsgiver øker med lang akkumulering.
**Spørsmål:** Bør workspace-policy sette et maks antall TOIL-timer, og hva skjer ved overskridelse (tvangsutbetaling, forfall)?
**Gråsone:** MEDIUM — ingen lov-krav, men bransje-risiko ved høy saldo.
**Anbefalt:** Pontus setter workspace-policy-default (forslag: maks 80 timer, tvangsutbetaling av overskudd ved periodeslutt). Implementeres som `payroll_workspace_settings.toil_max_banked_hours`.

---

### O19 — Hotelloverenskomsten vs. Riksavtalen nattillegg

**Situasjon:** Hotelloverenskomsten (Virke/Fellesforbundet) og Riksavtalen (NHO Reiseliv/Fellesforbundet) er to separate tariffavtaler for overlappende bransje med ulike satser. Smartout støtter begge arbeidsgiver-organisasjoner.
**Spørsmål:** Må engine håndtere to separate tariff-rader for nattillegg, og hvordan kobles riktig tariff til workspace?
**Gråsone:** MEDIUM — tariff-ID-feltet (`tariff_id`) finnes allerede på `employment_contract`, men koblingen til nattillegg-rate er ikke eksplisitt.
**Anbefalt:** Seed separate `tariff_rate_table`-rader per tariffavtale-kilde. `employment_contract.tariff_id` peker på riktig rad. ADR-0252-prosessen bør inkludere begge.

---

### O20 — Velferdsdager og sykepenge-integrasjon

**Situasjon:** Dersom workspace gir "wellness days" som bedriftspolitikk, og ansatt bruker en slik dag — skal dette rapporteres som fravær, eller er det fri dag uten fraværsregistrering?
**Spørsmål:** Hvilken `absence_type` brukes, og påvirker dette sykepengerettigheter, karensdag, eller egenmeldings-telling hos NAV?
**Gråsone:** MEDIUM — ingen norsk lovregulering av "wellness days", dermed uklart NAV-grensesnitt.
**Anbefalt:** Behandle som bedriftspolitikk-fridag (ikke sykefravær). Registreres som `absence_type = 'wellness'` med `is_paid = true` og `nay_reportable = false`. Påvirker ikke egenmeldingstelling.

---

### O21 — Feriekonto multi-arbeidsgiver (jf. O1)

**Situasjon:** Ansatt har to aktive kontrakter i to workspaces under samme company. Feriepenger opptjenes hos begge. Sluttoppgjør ved én kontrakt utløses ikke automatisk av den andre.
**Spørsmål:** Koordinerer Smartout feriepenge-saldo på tvers av workspaces under samme orgnr?
**Gråsone:** LAV — avhenger av O1-resolusjon (multi-workspace per orgnr).
**Anbefalt:** Defer til O1-ADR. Inntil da: feriekonto er workspace-isolert. Dokumentér som kjent begrensning.

---

*Disclaimer: Alle paragraf-referanser er verifisert mot norsk lovtekst og Riksavtalen per tilgjengelige åpne kilder (Lovdata, Fellesforbundet, Arbeidstilsynet). Kronetall for nattillegg (O11) og delt-vakt-status (O12) er MEDIUM confidence — verifiser mot NHO Reiselivs innloggede satsside eller gjeldende Riksavtalen-PDF før produksjons-seed. Dette dokumentet er juridisk veiledning, ikke rådgivning. Tvister om konkrete ansettelsesforhold bør avklares med arbeidsrettsadvokat eller NHO Reiseliv juridisk.*
