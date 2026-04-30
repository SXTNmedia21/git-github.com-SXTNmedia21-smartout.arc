# Aml. §14-6 — Detaljert validerings-sjekkliste

Per-punkt validerings-logikk. Refereres av SKILL.md.

## Bokstav a — Partenes identitet

**Lov-tekst:** "Partenes identitet"

**Felter sjekkes:**

- `workspace.name` ikke null/empty
- `workspace.org_number` ikke null/empty (9-sifret)
- `profile.display_name` ikke null/empty
- `profile.personal_number` ikke null (11 siffer for fødselsnr eller D-nummer)

**Error hvis:** noen mangler.

## Bokstav b — Arbeidsplassen

**Lov-tekst:** "Arbeidsplassen. Dersom det ikke finnes noen fast arbeidsplass eller hovedarbeidsplass, skal arbeidsavtalen gi opplysning om at arbeidstakeren arbeider på forskjellige steder, og oppgi forretningsadressen eller eventuelt hjemstedet til arbeidsgiver."

**Felter sjekkes:**

- `workspace.location` satt, ELLER
- Hvis varierende: `contract.variable_workplace_arrangement` beskriver

**Warning hvis:** lokasjon mangler men workspace har default.
**Error hvis:** verken lokasjon eller varierende-beskrivelse.

## Bokstav c — Arbeidet eller tittel

**Lov-tekst:** "En beskrivelse av arbeidet eller arbeidstakerens tittel, stilling eller arbeidskategori."

**Felter sjekkes:**

- `contract.job_title` ikke null/empty
- Ikke generisk (`ansatt`, `medarbeider`, `personell` alene)

**Warning hvis:** generisk tittel — Mattilsynet/Skatteetaten kan kreve spesifikk stilling.

## Bokstav d — Tidspunkt for begynnelse

**Lov-tekst:** "Tidspunktet for arbeidsforholdets begynnelse."

**Felter sjekkes:**

- `contract.start_date` ikke null
- Ikke i fortid > 30 dager før `created_at` (toleranse for sen registrering)

**Error hvis:** null eller > 30 dager retroaktivt uten audit-note.

## Bokstav e — Forventet varighet

**Lov-tekst:** "Forventet varighet dersom arbeidsforholdet er midlertidig, og grunnlaget for ansettelsen, jf. §14-9."

**Felter sjekkes:**

- Hvis `employment_form = 'temporary'`:
  - `end_date` ikke null
  - `temporary_employment_basis` (Aml. §14-9 grunn) satt
  - `end_date > start_date`

**Error hvis:** temporary uten end_date eller §14-9-grunn.

## Bokstav f — Prøvetidsbestemmelser

**Lov-tekst:** "Eventuelle prøvetidsbestemmelser, jf. §15-6."

**Felter sjekkes:**

- Hvis `trial_period_months > 0`:
  - `trial_period_months <= 6` (Aml. §15-6 første ledd absolutte maks)
  - Avtalt skriftlig før tiltredelse (`trial_period_agreed_at <= start_date`)
  - Oppsigelsesfrist i prøvetid spesifisert (default 14 dager fra Aml. §15-3 syvende ledd)

**Error hvis:** > 6 mnd, eller ikke skriftlig før tiltredelse.

## Bokstav g — Ferie og feriepenger

**Lov-tekst:** "Arbeidstakerens rett til ferie og feriepenger og reglene for fastsettelse av ferietidspunktet."

**Felter sjekkes:**

- `payroll_profile.holiday_allowance_pct` mellom 10.20 og 20.00 (10.2% er minimum etter ferielov §10)
- 12.00% standard, 14.30% for 60+ med ekstra ferieuke
- Henvisning til ferielov må stå i kontrakts-tekst (sjekk template)

**Warning hvis:** holiday_allowance_pct = 10.20 (under bransje-norm).

## Bokstav h — Oppsigelsesfrister

**Lov-tekst:** "Arbeidstakerens og arbeidsgiverens oppsigelsesfrister."

**Felter sjekkes:**

- `notice_period_months` minimum etter §15-3:
  - 1 mnd første 5 år
  - 2 mnd 5+ år
  - 3 mnd 10+ år (50+ år gammel)
  - 4 mnd 55+ år
  - 5 mnd 60+ år
  - 6 mnd 65+ år
- Hvis ulik for arbeidsgiver vs arbeidstaker: må begrunnes (Aml. §15-3 åttende ledd, kun strengere mot arbeidsgiver)

**Error hvis:** under §15-3-minimum.

## Bokstav i — Lønn og tillegg

**Lov-tekst:** "Den gjeldende eller avtalte lønnen ved arbeidsforholdets begynnelse, eventuelle tillegg og andre godtgjørelser som ikke inngår i lønnen, for eksempel pensjonsinnbetalinger og kost- eller nattgodtgjørelse, utbetalingsmåte og tidspunkt for lønnsutbetaling."

**Felter sjekkes:**

- `monthly_salary` eller `hourly_rate` satt iht. `remuneration_type`
- Minst én base-rule i `contract_pay_rule` med `rule_type = 'base'`
- Tillegg listet (overtid, kveld, helg) i contract_pay_rule eller henvist til Riksavtalen
- `payday_regular` satt (1–31)
- Pensjon-info via `pension_scheme_id`

**Error hvis:** lønn null, payday null, eller ingen base-rule.

## Bokstav j — Daglig og ukentlig arbeidstid

**Lov-tekst:** "Lengde og plassering av den daglige og ukentlige arbeidstid. Dersom arbeidet skal utføres periodisk, skal arbeidsavtalen fastsette eller gi grunnlag for å beregne når arbeidet skal utføres."

**Felter sjekkes:**

- `agreed_weekly_hours` ikke null (eller variable_hours_arrangement satt)
- `working_hours_scheme` satt
- Hvis skiftarbeid: turnusplan-referanse

**Error hvis:** weekly_hours null OG variable_hours_arrangement null.

## Bokstav k — Pauser

**Lov-tekst:** "Lengde av pauser, jf. §10-9."

**Felter sjekkes:**

- `break_minutes_per_day` satt
- Hvis `agreed_weekly_hours / 5 > 5.5`: minimum 30 min (Aml. §10-9 første ledd)
- Hvis ≥ 8 timer per dag: pause kreves

**Warning hvis:** ikke spesifisert (kan henvise til workspace-policy).
**Error hvis:** under §10-9-minimum.

## Bokstav l — Særlig arbeidstidsordning

**Lov-tekst:** "Avtale om særlig arbeidstidsordning, jf. §10-2 andre, tredje og fjerde ledd."

**Felter sjekkes:**

- Hvis `variable_hours_arrangement` ikke null: må beskrive omfanget
- Hvis `working_hours_scheme = 'rotation336'`: rotasjonsplan vedlagt

**Error hvis:** schema krever beskrivelse men mangler.

## Bokstav m — Tariffavtaler

**Lov-tekst:** "Opplysninger om eventuelle tariffavtaler som regulerer arbeidsforholdet. Dersom avtale er inngått av parter utenfor virksomheten, skal arbeidsavtalen inneholde opplysninger om hvem tariffpartene er."

**Felter sjekkes:**

- Hvis `tariff_id` satt:
  - Tariff navn lagret (f.eks. "Riksavtalen 2024")
  - Parter listet (NHO Reiseliv + Fellesforbundet typisk)
  - Versjon spesifisert

**Error hvis:** tariff_id satt men metadata mangler.

## Bokstav n — Innleier-info

**Kun relevant for innleid arbeidskraft.** N/A for direkte ansatte.

## Bokstav o — Kompetanseutvikling (post juli 2024)

**Lov-tekst:** "Rett til kompetanseutvikling som arbeidsgiver tilbyr, dersom slik rett finnes."

**Felter sjekkes:**

- `training_rights` ikke null/empty (kan være "ingen særskilt rett ut over lov" hvis tilfellet)

**Warning hvis:** tom — bør eksplisitt si "ingen særskilt rett" hvis ikke noe tilbys.

## Bokstav p — Sosial trygghet og pensjon (post juli 2024)

**Lov-tekst:** "Ytelser i regi av arbeidsgiver til sosial trygghet og navn på institusjoner som mottar innbetalinger fra arbeidsgiver i forbindelse med arbeidsforholdet."

**Felter sjekkes:**

- `pension_scheme_id` satt
- Hvis tillegg-forsikringer: listet
- Sykepenger-rettigheter: henvisning til folketrygdloven kap. 8

**Error hvis:** pension_scheme_id null (OTP er pliktig).

---

## Test-corpus

15+ kontrakts-eksempler i `knowledge/internal/test-corpus.md` skal kjøre gjennom denne sjekklisten. Hver case forventer kjent output (pass/fail med spesifikke issues).

## Referanser

- Aml. §14-6, §10-9, §15-3, §15-6, §14-9, §10-2 — Lovdata
- Ferielov §10
- OTP-loven
- EU-direktiv 2019/1152
