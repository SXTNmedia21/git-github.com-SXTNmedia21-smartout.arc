---
title: Payroll Legal Framework — Norwegian Hospitality
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
author: lovsen
tags: [payroll, legal, arbeidsrett, riksavtalen, ferieloven, otp, a-melding, bokføringsloven]
---

# Payroll Legal Framework

> Authored by **Lovsen** (norsk arbeidsrett-spesialist, `packages/ai/src/capabilities/legal/`). Confidence-merked HØY/MEDIUM/LAV per påstand. **Veiledning, ikke juridisk rådgivning** — se §8 disclaimer.

---

## 1. Legal Pillars — De seks lovene payroll-engine MÅ tilfredsstille

### 1.1 Arbeidsmiljøloven (Aml.) — Kapittel 10 + §14-15

| Paragraf | Krav | Engine: MÅ enforce | Kan delegeres til admin/manager |
|---|---|---|---|
| §10-4 | Alminnelig arbeidstid: maks 9t/dag, 40t/uke. Gjennomsnittsberegning tillatt ved skriftlig avtale (§10-4 tredje ledd) | Gjennomsnittsberegning flagges ved beregning av normtid per periode | Admin setter avtalegrunnlag |
| §10-6 | Overtid: standard 10t/uke, 25t/4-uke, 200t/år. Med lokal tariffavtale: 20t/uke, 50t/4-uke, 300t/år. Arbeidstilsynet-vedtak: eksplisitte tall. **2024-revisjon: femte ledd fjernet** (ADR-0254 §4.A) | Hard DB CHECK-constraint per `overtime_cap_policy`. BLOCK shift som overskrider cap. Emit `contract.overtime_cap_hit` | Admin velger `agreement_type` og tildeler `overtime_cap_policy_id` |
| §10-8 | Hvile: min 11 timer sammenhengende per 24 timer; 35 timer per uke | Beregn `rest_period_hours` fra forrige vaktslutt til ny vaktstart. W01: BLOCK ved < 11t | Vaktbytte under 11t: manager kan overstyre med dokumentasjon |
| §10-9 | Pauser: min 30 min ved arbeidstid > 5,5 timer. Pausen ikke betalingspliktig med mindre annet er avtalt | Kontroller `break_minutes_per_day` mot avtalt arbeidstid per vakt | Admin konfigurerer om pause er betalt (tariffavtale kan gi det) |
| §10-10 | Søndagsarbeid: tillatt i hospitality (§10-10 tredje ledd, "særlig fritidsformål") | Registrer søndagsvakter for tilleggsbetaling | Manager godkjenner søndagsvakt; engine beregner helgetillegg |
| §10-11 | Nattarbeid: forbudt kl. 21–06 unntatt nødvendig drift. Helsekontroll hvert 3. år for faste nattarbeidere | Registrer nattimer (21–06); flag for nattillegg + helsekontroll | Admin dokumenterer driftsgrunnlag |
| §14-15 | Lønnstrekk: kun lovbestemt, skriftlig forhåndsavtale, eller erstatningskrav (tredje ledd). Forbud mot trekk for arbeidsgivers risiko | BLOCK enhver trekk uten dokumentert grunnlag (W14). Se §4 detaljer | Manager kan foreslå, men IKKE gjennomføre uten grunnlag |

[**HØY confidence** — direkte sitat fra Aml. §10-4, §10-6 (2024-versjon per ADR-0254), §10-8, §10-9, §10-10, §10-11, §14-15]

---

### 1.2 Ferieloven

| Paragraf | Krav | Engine |
|---|---|---|
| §5 | 25 virkedager ferie = 4 uker + 1 dag. Over 60 år: 6 ekstra | `holiday_allowance_days` valideres mot alder + kontraktstype |
| §10 | Feriepenger: **10,2%** standard, **12,0%** over 60 år, **14,3%** der tariffavtale gir 5. ferieuke | `holiday_allowance_pct` mot 10.20–20.00. Under 10,2% = BLOCK (Aml. §14-6 g) |
| §11 | Utbetaling: feriepenger utbetales siste lønnskjøring FØR ferien påbegynnes (§11 tredje ledd). Ikke månedlig med mindre tariff/avtale tillater det | Engine beregner `holiday_pay_balance` løpende, flagger ved ferieuttak |

[**HØY confidence**]

---

### 1.3 OTP-loven (Lov om obligatorisk tjenestepensjon)

- **Minimum:** 2% av lønn mellom 1G og 12G (OTP-loven §4) [**HØY**]
- **Vesting:** Ansatte med > 20% stilling **og** > 12 mnd ansettelse **og** alder 13–75 (§2 annet ledd)
- **Unntak:** Deltid < 20% kan ekskluderes — hospitality med mange deltidsansatte bør avklare eksplisitt
- **Engine:** `otp_pct >= 2.0` valideres per `employee_payroll_profile`. Under 2,0% uten unntak = W06 BLOCK

[**MEDIUM** på vesting-vilkårene — bransjetolkning. **HØY** på 2%-minstesats]

---

### 1.4 Folketrygdloven §23-2 — Arbeidsgiveravgift (AGA)

- **Sats:** Sone-avhengig. Sone I (Oslo + sentrale strøk): **14,1%**. Frittakssone (Finnmark): 0%. [**HØY** — bekreftet i seeded `tariff_rate_table`]
- **Grunnlag:** All skattepliktig lønn inkl. OT, kveldsavlegg, diett over skattefri sats
- **Engine:** AGA per `payroll_calculation_line` = `grunnlag × aga_rate`. Per periode + A-melding-rapport
- **Edge case:** AGA-fritak for lønn under 850 kr/mnd per person (§23-2 niende ledd) — relevant for ekstravakter

---

### 1.5 Skattetrekkforskriften + Skattebetalingsloven

- **Trekkplikt:** Arbeidsgiver MÅ trekke skatt ved lønnsutbetaling (Skattebetalingsloven kap. 5) [**HØY**]
- **Tre korttyper:** Tabelltrekk, prosenttrekk, frikort (0% opp til fribeløp)
- **DERIVED-felter:** `tax_table_number`, `tax_card_type`, `tax_percentage` MÅ hentes fra Skatteetaten — aldri manuell input (ADR-0250)
- **Feil skattekort:** Arbeidsgiver er ansvarlig for undertrukkede beløp (§5-1). Engine BLOCK ved `tax_card_type IS NULL` eller `tax_card_year != CURRENT_YEAR`
- **Frikort-grense 2025:** 70 000 kr [**MEDIUM** — endres årlig]
- **Forskuddstrekk fra januar 2026:** MÅ betales til Skatteetaten første arbeidsdag etter utbetaling

---

### 1.6 Bokføringsloven §13 + §3-4 (GBS)

- **Oppbevaringskrav:** Regnskapsmateriale (lønnslipper, lønnsberegninger, A-meldingsgrunnlag, tariff-snapshot, skattetrekksgrunnlag) MÅ oppbevares **5 år** fra utløpet av regnskapsåret materialet tilhører — ikke fra ansettelsesoppør eller `created_at` (ADR-0251 §E) [**HØY**]
- **Slettforbud:** `shift_pay_calculation_event` og `payroll_calculation_line` SKAL IKKE slettes i retensjonsvindaet. RLS `no_delete_shift_pay_calc` håndhever
- **GBS §3-4:** Sporbarhet — enhver lønnspost har kilde (regel + rate + vakt). Løses av `shift_pay_calculation_event.provenance JSONB` + `source_text_applied`
- **Retensjonsanker:** `shift_period_end_date`, IKKE `created_at`. Slettjobb evaluerer `shift_period_end_date < date_trunc('year', now()) - interval '5 years'`

---

## 2. A-melding — Mandatory Fields per Inntektsmottaker

A-melding sendes månedlig til Skatteetaten/Altinn via Tripletex (Smartout er integrasjonspartner — ikke direkte A-melding-avsender per ADR-0250 §Open Questions #2).

### 2.1 Obligatoriske felt per inntektslinje

| Felt | Innhold | Merk |
|---|---|---|
| `virksomhetsnummer` | Underenhet-orgnr | 9 siffer |
| `opplysningspliktigId` | Arbeidsgiver-orgnr | |
| `inntektsmottakerFødselsnummer` | Ansattes fnr/dnr | Kryptert transport |
| `arbeidsforholdId` | Stabil intern referanse til ansettelsesforhold | |
| `startdato` / `sluttdato` | Ansettelsesperiode i rapporteringsperioden | |
| `inntektstype` | Se kodetabell §2.2 | |
| `beloep` | Brutto utbetalt | NOK, to desimaler |
| `opptjeningsperiode.startdato` + `sluttdato` | Opptjeningsperiode | For OT, tillegg |
| `antall` | Timer/dager ved timebasert | |
| `fordel` | "Kontant" / "Annet" | |
| `skattetrekkBeloep` | Faktisk trukket skatt | |
| `arbeidsgiveravgiftBeloep` | AGA for linjen | |
| `tilleggsinformasjon.overtid` | OT-flagg + timer | Kun ved OT |

### 2.2 Mest brukte inntektskoder for restaurant/hospitality

| Kode | Navn | Når |
|---|---|---|
| `fastloenn` | Fast månedslønn | Faste ansatte |
| `timeloenn` | Timebasert lønn | Timeansatte, ekstravakter |
| `overtidsgodtgjoerelse` | Overtidsbetaling | OT-timer m/ 50%/100% tillegg |
| `uregelmessigeKjoereleg` | Uregelmessige tillegg | Kveld-, helg-, natt-, helligdagstillegg |
| `ferie` | Feriepenger ved uttak | |
| `beregnetFeriepengerMnd` | Opptjente feriepenger i måneden | Løpende |
| `trekkILoenn` | Lønnstrekk | Skatt, bidrag |
| `losji` | Fri bolig (naturalytelse) | |
| `kost` | Fri kost | Matpenger over skattefri sats |
| `diettUtenOvernattingUlegitimert` | Diett u/overnatting uten kvittering | Kurs, dagpakke |
| `tips` (kode 111-A) | Drikkepenger | Pool-organisert (se §7.2 åpne spørsmål) |
| `bilgodtgjoerelse` | Kjøregodtgjørelse | Privat bil |
| `annenArbeidsinntekt` | Øvrig | Bonuser, engangs |

[**MEDIUM** på tips-koding — bransjetolkning, ADR-0250 sier Tripletex håndterer A-melding men korrekt koding må verifiseres mot Skatteetaten]

---

## 3. Riksavtalen — Mest siterte paragrafer for payroll

Riksavtalen mellom NHO Reiseliv og Fellesforbundet (2024–2026, versjonert per ADR-0252).

| Paragraf | Innhold | Sats/regel | Merk |
|---|---|---|---|
| §4 Minstelønn | Ufaglært: **198,50 kr/t**. Faglært: **210,00 kr/t** | Seeded `tariff_rate_table` | [**HØY**] |
| §4 Lærling | Ca. 70-90% av minstelønn | [**MEDIUM** — ADR-0252 åpent] | Opplæringsloven kap. 4-blocker aktiv |
| §5 Garantilønn | Månedslønnede; lønn under garanti kompenseres opp | Workspace-spesifikt | |
| §6 Kveldstillegg | **15,65 kr/t** kl. 18–24 (man–fre) | Seeded `kveldstillegg 15.65` | [**HØY**] |
| §6 Helgetillegg | **29,74 kr/t** lør 06–søn 24 | Seeded `helgetillegg 29.74` | Kombinerbart med kvelds |
| §6 Helligdagstillegg | 100% av timelønn ekstra på røde dager | Sjekk `payroll_holiday_calendar` | |
| §6 Nattillegg | Tillegg kl. 24–06 | Sats avhenger av revisjonsår | [**MEDIUM** — ikke seeded, åpent] |
| §6 Delt vakt | Tillegg ved vaktdeling > 2 timers opphold | Flat sats per delt vakt | [**MEDIUM** — ikke seeded, åpent] |
| §7 Overtid | **50%** første 3 OT-timer/dag, **100%** deretter | Seeded OT 50/100 | Aml. §10-6 for tak |
| §7 Matpause ved OT | > 2t OT: matpause betales som arbeidstid | +30 min betalt pause | |
| §8 Forskyvning | Endring av oppsatt vakt < 24t varsel: 50% tillegg på berørte timer | Krever varslings-tidspunkt i `schedule_shift` | |
| §9 Turnusordning | Normert arbeidstid beregnes over 4 uker | Gjennomsnittsberegning per `payroll_working_time_rule` | |
| Diett | Statens dagsats (skattefri del); over: skattepliktig | Sjekk Skatteetatens gjeldende satser | |

---

## 4. Lønnstrekk — Når kan manager/admin trekke?

Aml. §14-15. Tre kategorier:

### 4.1 Lovbestemt (alltid tillatt — engine implementerer direkte)
- Skattetrekk (Skattebetalingsloven §5-1)
- Barnebidrag (NAV/Bidragsinnkrevingssentralen-pålegg)
- Namsmannstrekk (tvangsfullbyrdelsesloven)

### 4.2 Skriftlig forhåndsavtale (tillatt med dokumentasjon)
Aml. §14-15 første ledd bokstav b:
- Fagforeningskontingent
- Kantine/måltidssubsidier ansatt har bedt om
- Trekk i feriepenger for for mye utbetalt lønn (skriftlig avtalt)
- OTP egeninnskudd

**Ikke avtalbart bort:** trekk for "slitasje", "tapte gjester", "manko i kassen" uten klart erstatningsgrunnlag.

### 4.3 Erstatningskrav — strenge vilkår (§14-15 tredje ledd)
1. Forsettlig eller grovt uaktsomt
2. Skriftlig forhåndsvarsel (min 14 dager)
3. Trekket overstiger ikke det arbeidsretten ville tilkjenne

**Engine W14:** Ingen kategori 4.3-trekk uten godkjent `change_proposal` av type `wage_deduction_claim` med dokumentasjon.

### 4.4 Absolutt forbud — engine BLOCK (W15)
- Knust glass, sølt mat, kassemanko uten bevis for grov uaktsomhet
- Arbeidsgivers driftsrisiko (gjest-reklamasjon, "klisjeerstatning")
- Uniformserstatning der arbeidsgiver eier uniformen
- Trekk etter lønn er opptjent og forfalt

[**HØY confidence** på forbudene]

*Disclaimer: Trekksaker med tvist bør avklares med arbeidsrettsadvokat.*

---

## 5. Constructive Dismissal Risk ved lønn-/kontraktsendringer

ADR-0236/ADR-0244-mønster.

| Endring | Amendment-klasse | Risk | Confidence |
|---|---|---|---|
| Reduksjon i månedslønn ≥20% | MATERIAL | **HØY** — likestilles med endringsoppsigelse. Krever saklig grunn (§15-7 analogt) + ny signering | HØY |
| Reduksjon 5–19% | MATERIAL | MEDIUM — gråsone, anbefal advokat | MEDIUM |
| Reduksjon < 5% | ADMIN | LAV — normalt ikke vesentlig. Dokumentér | MEDIUM |
| Månedslønn → timelønn (samme totalsats) | MATERIAL | MEDIUM — endrer forutsigbarhet, krever signering | MEDIUM |
| Månedslønn → timelønn med lavere total | MATERIAL | **HØY** — dobbel effekt | HØY |
| Fjerning av etablert tillegg som er del av normal turnus | MATERIAL | **HØY** | MEDIUM/HØY |
| Reduksjon av ferielengde under §5-min | BLOCKED | Ulovlig — Ferieloven ufravikelig | HØY |
| Tariff-indeksregulering (Riksavtalen oppjustering) | ADMIN | Ingen — forbedring | HØY |

**Engine (ADR-0244):** `is_constructive_dismissal_risk = true` settes auto ved MATERIAL-endring som reduserer effektiv lønn. Karantene i amendment inbox; admin må `acknowledged_constructive_dismissal_risk` eksplisitt.

**Grensen for "vesentlig endring" er skjønnsbasert** — LAV confidence på saker mellom 5–25% reduksjon. Anbefalt: advokatvurdering.

---

## 6. Critical Compliance Gates Engine MÅ Block

| # | Gate | Trigger | Paragraf | Engine | Code |
|---|---|---|---|---|---|
| W01 | Hviletid < 11t | Ny vakt < 11t etter forrige vaktslutt | Aml. §10-8 første ledd | BLOCK shift-create. Krever admin-override med dokumentasjon | W01 |
| W02 | OT overskrider lovtak | `overtime_hours_in_period >= cap_at` | Aml. §10-6 | BLOCK shift-create. Emit `contract.overtime_cap_hit` | W02 |
| W03 | Lønn under Riksavtalen-min | `hourly_rate < tariff_rate_table.min_rate` | Riksavtalen §4 | BLOCK payroll-utbetaling. BLOCKED amendment + admin-override | W03 |
| W04 | Feriepenger < 10,2% | `holiday_allowance_pct < 10.20` | Ferieloven §10 | BLOCK kontrakt-send (Aml. §14-6 g) | W04 |
| W05 | Skattetrekk mangler/utdatert | `tax_card_type IS NULL` eller `tax_card_year != CURRENT_YEAR` | Skattebetalingsloven §5-1 | BLOCK lønn for profilen. Emit `skatteetaten.fetch_failed` | W05 |
| W06 | OTP < 2% | `otp_pct < 2.0` uten dokumentert unntak | OTP-loven §4 | BLOCK lønnskjøring. Krever admin-override + unntak-doc | W06 |
| W07 | Ulovlig lønnstrekk | Trekk uten dokumentert kategori | Aml. §14-15 | BLOCK trekk. Emit `payroll.deduction_blocked` | W07 |
| W08 | Prøvetid > 6 mnd | `probation_end_date > start_date + 6 mnd` | Aml. §15-6 fjerde ledd | BLOCK kontrakt-send (§14-6 f) | W08 |
| W09 | Pause < 30 min ved > 5,5t vakt | `break_minutes_per_day < 30` | Aml. §10-9 første ledd | WARN (ikke BLOCK) — tariff kan gi betalt pause | W09 |
| W10 | OT-kompensasjon mangler | OT-timer uten 50/100-tillegg | Riksavtalen §7 | BLOCK payroll-eksport for vakten | W10 |
| W11 | Sletting i retensjonsvindu | DELETE på `shift_pay_calculation_event` der `shift_period_end_date > TODAY - 5 år` | Bokføringsloven §13 | BLOCK på DB-nivå (RLS) | W11 |
| W12 | Endringsoppsigelse-risk uten kvittering | MATERIAL ≥20% reduksjon uten ack | Aml. §15-7 (analogt) | Karantene; BLOCK apply | W12 |

---

## 7. Open Legal Questions for Pontus

Disse må avklares **før Phase 1 produksjon**:

### 7.1 Indekstillegg og Aml. §14-6 — krever ny signatur?
**Situasjon:** ADR-0252 §D gir `indekstillegg` (`authority = autonomous`): engine auto-godkjenner, varsler ansatt — ingen ny signatur.
**Gråsone:** Aml. §14-6 krever skriftlig kontrakt. Er auto-akseptert `contract_amendment` med varsling tilstrekkelig dokumentasjon?
**Anbefalt:** Arbeidsrettsadvokat eller NHO Reiseliv juridisk. MEDIUM confidence at varsling er nok.

### 7.2 Tips (drikkepenger) — rapporteringsplikt og inntektstype
**Situasjon:** A-melding kode 111-A. Pool-organiserte tips er klart arbeidsinntekt; fritt mottatte er mer komplekst.
**Anbefalt:** Skatteetaten (bindende forhåndsuttalelse) eller regnskapsfører.

### 7.3 Delt vakt — triggergrense for tillegg
**Situasjon:** Riksavtalen §6 gir tillegg ved "delt vakt > X timers opphold". Sats og terskel ikke seeded.
**Anbefalt:** Pontus bestemmer (workspace-config); standard-seed verifiseres mot NHO Reiseliv.

### 7.4 Lærlinglønn og OTP
**Situasjon:** Lærlingerkontrakter blokkert (ADR-0241 Opplæringsloven). Ved åpning: hvilken OTP-plikt + minstelønn?
**Anbefalt:** Ny ADR (ADR-0253-kandidat) + NHO Reiseliv.

### 7.5 Frikort/AGA-fritak
**Situasjon:** Frikort < 70 000 kr/år; AGA-fritak < 850 kr/mnd. Mange ekstravakter treffer disse.
**Anbefalt:** Skatteetaten — grenser oppdateres 1. januar; engine trenger årlig re-seed.

### 7.6 Nattillegg — er Riksavtalen-sats seeded?
**Situasjon:** `tariff_rate_table` viser ikke eksplisitt seeded nattillegg-sats.
**Anbefalt:** Pontus verifiserer mot gjeldende Riksavtalen + seed via ADR-0252-prosessen.

### 7.7 Reise/diett skattefri grense
**Situasjon:** Diett/reisegodtgjørelse over statens satser er skattepliktig. Endres årlig.
**Anbefalt:** Skatteetaten; mekanisme for årlig oppdatering uten ny ADR.

### 7.8 Multi-arbeidsgiver og A-melding
**Situasjon:** Ansatt med to aktive kontrakter i to workspaces — Skatteetaten vurderer samlet inntekt, A-melding sendes per arbeidsgiver. Ingen Smartout-koordinering.
**Anbefalt:** ADR (ADR-0250 Open Question #1 åpent). Foreløpig: dokumentér at Smartout rapporterer kun sin del.

### 7.9 Forskuddstrekk-forskyvning fra januar 2026
**Situasjon:** Fra januar 2026 må forskuddstrekk betales til Skatteetaten første arbeidsdag etter utbetaling (ikke månedlig).
**Anbefalt:** Engine + Tripletex-sync må håndtere dette tidsvinduet. Verifisér med Tripletex om de allerede har implementert.

### 7.10 Konstruktiv oppsigelse-grense (5–19% reduksjon)
**Situasjon:** Gråsone i §5 over. Skjønnsbasert vurdering.
**Anbefalt:** Standard policy = ALL reduksjon krever ny signering, uavhengig av prosent. Konservativt valg.

---

## 8. Disclaimers

### 8.1 Standard payroll-engine disclaimer (norsk, vis til bruker)

> **Veiledning, ikke juridisk rådgivning**
>
> Lønnsberegninger og arbeidsrettslig veiledning fra Smartout er basert på gjeldende norsk lovgivning og tariffavtale slik de er innlastet i systemet. Beregningene er ment som operativ støtte — ikke som erstatning for profesjonell juridisk eller regnskapsmessig rådgivning.
>
> Tvister om lønn, oppsigelse eller tariffrettigheter bør avklares med arbeidsrettsadvokat, NHO Reiseliv juridisk, eller Arbeidstilsynet.
>
> Lovbestemmelser og tariffer endres. Smartout oppdaterer ved kjente revisjoner, men arbeidsgiver er ansvarlig for å etterse at konfigurasjonen til enhver tid gjenspeiler gjeldende regler.

### 8.2 Når disclaimer MÅ vises

1. Lønn-avvik > 10% fra forrige periode (uventet endring)
2. `is_constructive_dismissal_risk = true` i amendment inbox
3. Enhver `BLOCKED`-gate der admin gjennomfører manuell override
4. Skattetrekk-beregning der `tax_card_year` er utdatert
5. Eksport til A-melding / Tripletex (juridisk konsekvens: feil = straff etter Skattebetalingsloven)

---

*Confidence-merking per seksjon: §1 HØY på seeded satser/paragraf-sitat, MEDIUM på bransjetolkninger; §3 MEDIUM på useedede satser; §5 MEDIUM/LAV på gråsone-endringer (alle LAV anbefaler advokatvurdering).*

*Anbefalt før Phase 1 prod: seed manglende Riksavtalen-satser (nattillegg, delt vakt) via ADR-0252; avklar §7.1 og §7.2 med advokat eller NHO Reiseliv.*

---

## 9. Amendment-Classifier — Aml. §14-6 rule matrix (Lovsen-owned)

Single source of truth for classification av kontrakt-/tariff-endringer. Pure function — zero I/O. Bor i `packages/ai/src/capabilities/legal/amendment-classifier.ts` og brukes av alle payroll-/contract-tools som muterer §14-6 felter. ADR-0173 frozen-4: legal eier matrisen, andre capabilities kaller den (eksempel: `payroll.change_workspace_tariff`).

### 9.1 Output-kontrakt

```ts
type AmendmentClassification = {
  classifier: 'UP' | 'MATERIAL' | 'ENDRINGSOPPSIGELSE';
  reason: string;              // norsk, paragraf-sitert
  aml_refs: string[];          // Aml./Riksavtalen §-referanser
  requires_resigning: boolean; // true for ENDRINGSOPPSIGELSE
  notice_period_days: number | null; // §15-3 default 30, null ellers
};
```

### 9.2 Rule matrix

Reglene evalueres i prioritert rekkefølge — første treff vinner.

| # | Trigger | Klassifisering | Aml. §-ref | requires_resigning |
|---|---|---|---|---|
| 1 | No-op (samme union, samme law_version, ingen endring i lønn/stilling/arbeidstid) | UP | §14-6 | false |
| 2 | Endring av stilling (bokstav c) | ENDRINGSOPPSIGELSE | §14-6 c + §15-7 + §15-3 | true |
| 2 | Endring av avtalt arbeidstid (bokstav d) | ENDRINGSOPPSIGELSE | §14-6 d + §15-7 + §15-3 | true |
| 3 | Lønn-reduksjon ≥15% | ENDRINGSOPPSIGELSE | §14-6 b + §15-7 + §15-3 | true |
| 4 | Tariff-bundet → ikke-tariff-bundet (tap av floor) | ENDRINGSOPPSIGELSE | §14-6 m + §15-7 + §15-3 | true |
| 4b | Ikke-tariff-bundet → tariff-bundet (forbedring) | MATERIAL | §14-6 m | false |
| 5 | Union-bytte med >5% rate-floor-fall | ENDRINGSOPPSIGELSE | §14-6 b + m + §15-7 + §15-3 | true |
| 6 | Union-bytte uten signifikant reduksjon | MATERIAL | §14-6 m | false |
| 7 | Samme union, ny law_version (Riksavtalen-revisjon) | UP | §14-6 + **Riksavtalen §4 carve-out** | false |
| 8 | Mindre lønn-justering <15% | MATERIAL | §14-6 b | false |
| 9 | Fallback (ingen observerbar §14-6 endring) | UP | §14-6 | false |

### 9.3 Riksavtalen §4 carve-out

Regel 7 koder den eksplisitte unntaket: indeksregulering / mellomoppgjør på SAMME union-binding (eks. `taro-79` `2024-2026` → `2025-mellomoppgjor`) er **UP**, ikke MATERIAL. Ansatt har implisitt avtalt tariff-revisjoner via tariffmedlemskap; §14-6 krever ikke ny signering for slike justeringer. Bryter ikke §14-6 b (lønn) fordi tariff-revisjon historisk er forbedring eller justering.

### 9.4 ENDRINGSOPPSIGELSE → cascade BLOCK

Når klassifikatoren returnerer MATERIAL eller ENDRINGSOPPSIGELSE, blokker cascade-laget (`cascade.bind_workspace_union`) skrivingen med `AMENDMENT_BLOCKED` og `aml_ref: §14-6(m)`. Phase 7f amendment-handler-kapabiliteten eier signerings-flyten med §15-3 oppsigelsesfrist (default 30 dager hvis ikke annet er avtalt). Klassifikatorens `reason` + `aml_refs` returneres til kaller for visning i UI.

### 9.5 15%-terskel — bevisst konservativt valg

§5 over angir gråsone 5–19% som MEDIUM. Klassifikatoren legger ENDRINGSOPPSIGELSE-grensen på **15%** — midten av gråsonen — for å fange Pontus' §7.10 standardpolicy ("ALL reduksjon krever ny signering" som konservativt forslag) uten å overhåndheve på små justeringer. Reduksjon 5–14% returnerer MATERIAL med eksplisitt prosent i `reason` slik at admin kan vurdere advokatkonsultasjon før commit.

### 9.6 Test-coverage

`packages/ai/src/capabilities/legal/__tests__/amendment-classifier.test.ts` har 10 unit-tester, alle paragraf-siterte i testnavn + `reason`-assertion:

1. No-op (Rule 1) → UP
2. Riksavtalen-revisjon (Rule 7) → UP
3. Union-bytte uten reduksjon (Rule 6) → MATERIAL
4. Union-bytte med >5% reduksjon (Rule 5) → ENDRINGSOPPSIGELSE
5. Tariff → non-bound (Rule 4) → ENDRINGSOPPSIGELSE
6. Non-bound → tariff (Rule 4b) → MATERIAL
7. Lønn-reduksjon 20% (Rule 3) → ENDRINGSOPPSIGELSE
8a. Stilling-endring (Rule 2) → ENDRINGSOPPSIGELSE
8b. Arbeidstid-endring (Rule 2) → ENDRINGSOPPSIGELSE
9. Lønn-reduksjon 10% (Rule 8) → MATERIAL

### 9.7 Konsumenter

Forbudt å duplisere klassifiseringen — kall `classifyAmendmentLogic` fra `@smartout/ai/capabilities/legal`.

| Konsument | Hvor | Notat |
|---|---|---|
| `payroll.change_workspace_tariff` | `packages/ai/src/capabilities/payroll/tariff-tools.ts` | Erstattet inline TARIFF_REVISION/UNION_CHANGE-heuristikk (Phase 7d Track 5) |
| Phase 7f amendment-handler | (pending) | Eier signerings-flyt for MATERIAL + ENDRINGSOPPSIGELSE |
| `contract` amendment-tools | (pending) | Skal kalle klassifikatoren før endringer på `employment_contract` |

[**HØY confidence** på Rule 7 Riksavtalen-carve-out; **MEDIUM** på 15%-terskel; **HØY** på Rule 2 stilling/arbeidstid (Aml. §14-6 c/d er load-bearing)]
