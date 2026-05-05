---
title: "Lovsen S4 Phase 0 — Tariff-grense verifiseringsrapport"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: cascade
tags: [audit, lovsen, riksavtalen, tariff, compliance, taro-79]
---

# Tariff-grense verifiseringsrapport — Riksavtalen TARO-79 §4-3

**Dato:** 2026-05-04
**Sortie:** `feat/schedule-harness-tariff-utc-fix`
**Utført av:** Lovsen v0.2.0 (Phase 0 — read-only)
**Fil analysert:** `apps/web/src/lib/cascade/resolve-tariff-rate.ts`

---

## 1. Sammendrag

`resolve-tariff-rate.ts` inneholder to kategorier feil:

**Kategori A — UTC-bug (bekreftet, Phase 2 fikser):** `getUTCHours()` / `getUTCDay()` brukes i stedet for workspace-lokal tid. Oslo sommertid (UTC+2) betyr at 21:00 Oslo = 19:00 UTC — kveldstillegg utløses ikke. Dette er uavhengig av om grensene er korrekte.

**Kategori B — Gale klokkegrenser (dette dokumentet):** Tre av fire grenser avviker fra §4-3. I tillegg mangler nattillegg som separat kategori fullstendig. Samlet fører dette til underbetaling selv etter UTC-fix.

**Viktig:** Underbetaling i begge kategorier er kumulativ. En fredag 22:30-vakt i Oslo sommertid taper kveldstillegg på grunn av UTC-bug OG ville ha feil grense (22:00 i koden vs 21:00 i §4-3) selv etter tz-fix.

---

## 2. Eksakte klokkegrenser per §4-3 (lovtekst)

Kilder som er verifisert:

- **Lovdata TARO-79 §4-3** (Riksavtalen Fellesforbundet–NHO Reiseliv 2024–2026): direkte sitat hentet fra Lovdata
- **Satser fra 1. april 2025** (Fellesforbundet PDF, publisert som offentlig dokument)
- **Mellomoppgjøret 2025** (Fellesforbundet, bekrefter 2,3 % regulering av kronesatser)

---

## 3. Grense-for-grense analyse

### 3.1 Kveldstillegg — mandag til fredag

**§4-3 punkt 3.2 (ordrett fra Lovdata):**
> "For arbeid på mandag – fredag i tidsrommet 21.00-24.00 utbetales et tillegg på kr 15,65 pr. time."
> *(Ajourført 1. april 2024. Regulert til kr 16,01/t fra 1. april 2025.)*

| | Koden | §4-3 | Delta |
|---|---|---|---|
| Fra | 21:00 (UTC) | 21:00 (lokal tid) | **Tz-feil, ikke grense-feil** |
| Til | 06:00 (UTC, neste dag) | 24:00 (lokal tid) | **FEIL — se under** |
| Sats | (ikke hardkodet, hentes fra DB) | kr 16,01/t (fra 01.04.2025) | Avhenger av seed |

**Funn — til-grense:** Koden setter `isEveningTime = hour >= 21 || hour < 6`. Det betyr at perioden 00:00–06:00 regnes som kveldstillegg. Dette er feil: §4-3 definerer kveldstillegg som **21:00–24:00**. Perioden 00:00–06:00 er **nattillegg** (separat sats, se punkt 3.4). Koden slår dem sammen til ett tillegg.

**Konsekvens:** Ansatte som jobber nattevakt (00:00–06:00) får kveldstillegg (16,01 kr/t) i stedet for nattillegg (56,02 kr/t for øvrige arbeidstakere). Det er **40 kr/t for lite** per time nattevakt.

**Confidence: HØY** — direkte sitat fra Lovdata TARO-79 §4-3 punkt 3.2, bekreftet mot satsark 1. april 2024 og 2025.

---

### 3.2 Lørdagstillegg

**§4-3 punkt 3.1 (ordrett fra Lovdata):**
> "For arbeid på lørdager i tidsrommet 14.00 – 24.00 og på søndager i tidsrommet 06.00 – 24.00 utbetales et tillegg på kr 29,74 pr. arbeidede time."
> *(Regulert til kr 30,42/t fra 1. april 2025.)*

| | Koden | §4-3 | Delta |
|---|---|---|---|
| Starttime lørdag | 15:00 (UTC) | 14:00 (lokal tid) | **DOBBELT FEIL: feil grense OG UTC** |
| Sluttid lørdag | (implisitt dag-slutt) | 24:00 | Korrekt konsept |
| Sats | (ikke hardkodet) | kr 30,42/t (fra 01.04.2025) | Avhenger av seed |

**Funn:** Koden har `day === 6 && hour >= 15`. §4-3 sier 14:00. Det betyr at alle ansatte som jobber lørdag 14:00–15:00 systematisk underbetales med helgetillegg. I tillegg er dette i UTC — Oslo-tid UTC+1 (vinter) = lørdag 14:00 Oslo = 13:00 UTC, som heller ikke trigges av `hour >= 15`.

**Praktisk eksempel:** En bartender som starter lørdag 14:00 Oslo-tid vinter: UTC 13:00. Koden evaluerer `13 >= 15` = false → ingen helgetillegg. §4-3: tillegg fra 14:00 → tillegg burde gis.

**Confidence: HØY** — ordrett sitat fra Lovdata TARO-79 §4-3 punkt 3.1. Bekreftet av to uavhengige WebFetch-kall mot Lovdata.

---

### 3.3 Søndagstillegg

**§4-3 punkt 3.1 (samme paragraf som lørdag, ordrett):**
> "...på søndager i tidsrommet 06.00 – 24.00 utbetales et tillegg på kr 29,74 pr. arbeidede time."

| | Koden | §4-3 | Delta |
|---|---|---|---|
| Fra søndag | 00:00 (alle søndag, UTC) | 06:00 (lokal tid) | **FEIL grense + UTC-feil** |
| Til | (dag-slutt) | 24:00 | Korrekt konsept |

**Funn:** Koden har `day === 0` (alle søndag = helgetillegg). §4-3 sier **06:00–24:00**, ikke hele døgnet. Perioden 00:00–06:00 søndag gir **nattillegg**, ikke søndagstillegg (se punkt 3.4).

**Praktisk konsekvens:** En ansatt som jobber nattevakt 00:00–06:00 natt til søndag vil i gjeldende kode få søndagstillegg (30,42 kr/t). Korrekt er nattillegg (56,02 kr/t for øvrige). Koden gir 25,60 kr/t for lite per time i dette vinduet.

**Merk også:** Søndag 00:00–06:00 er strengt tatt "lørdag-til-søndag natt" i UX-forstand (ansatte er på jobb fra lørdag kveld). Denne perioden faller mellom to stolar i gjeldende kode: den regnes som søndag (UTC dag 0), men §4-3 gir kun søndagstillegg fra 06:00.

**Confidence: HØY** — ordrett sitat fra Lovdata TARO-79 §4-3, bekreftet av to separate Lovdata-oppslag.

---

### 3.4 Nattillegg — mangler i koden

**§4-3 punkt 3.3 (ordrett fra Lovdata):**
> "For arbeid i tidsrommet 24.00 – 06.00 utbetales et tillegg på kr 41,46 pr. time" (for nattvakter og sikkerhetspersonell), og "kr 54,76 pr. time" (for øvrige arbeidstakere)."
> *(Regulert fra 1. april 2025: kr 42,41/t (nattvakter) og kr 56,02/t (øvrige).)*

| | Koden | §4-3 | Delta |
|---|---|---|---|
| Nattillegg finnes | Nei — mangler helt | Ja, 00:00–06:00 | **MANGLER** |
| To kategorier | Nei | Ja (nattvakter vs øvrige) | Ikke implementert |
| Sats (øvrige) | — | kr 56,02/t (2025) | Mangler i seed |
| Sats (nattvakter) | — | kr 42,41/t (2025) | Mangler i seed |

**Funn:** Nattillegg er et selvstendig tillegg i §4-3, separert fra kveldstillegg og helgetillegg. Det gjelder alle ukedager 00:00–06:00. Koden har ingen `isNightTime`-funksjon og ingen `nattillegg`-søk mot `tariff_rate_table`. I stedet fanges 00:00–06:00 opp av `isEveningTime` (som inkluderer `hour < 6`).

**Sats-split:** §4-3 skiller mellom "nattvakter og sikkerhetspersonell" (lavere sats) og "øvrige arbeidstakere" (høyere sats). Hvilken kategori en enkelt ansatt tilhører avhenger av `tariff_category` på lønnsprofilnivå. Implementasjonen må hente riktig rad fra `tariff_rate_table` basert på kategori.

**Confidence: HØY** — ordrett sitat fra Lovdata TARO-79 §4-3 punkt 3.3. Dette er ikke tolkning — det er to separate satsrader som mangler i koden.

---

### 3.5 Helligdagstillegg

**§4-2 (Riksavtalen, fra Lovdata-oppslag):**
> Helligdager (1. mai, 17. mai, jul, påske osv.) gir **100 % tillegg av individuell timelønn** (månedslønnen dividert med 154 timer, multiplisert med arbeidede timer). Dette er et eget tillegg som aktiveres av `context.isPublicHoliday` i koden.

| | Koden | §4-2 | Status |
|---|---|---|---|
| Aktivering | `context.isPublicHoliday` boolean | Dato-oppslag mot helligdagskalender | Korrekt prinsipp |
| Beregning | Fast `amount` fra `tariff_rate_table` | 100 % av individuell timelønn | **Potensielt galt** |
| Seed-kilde | `public_holiday`-tabell via `context.isPublicHoliday` | K1a-rader for norske helligdager | Se under |

**Funn — to problemer:**

**Problem 1 (beregning):** §4-2 sier 100 % av individuell timelønn, ikke en fast krone-sats fra `tariff_rate_table`. Koden kaller `findRate(primaryRates, "helligdagstillegg", dateStr)` og forventer en fast `amount`. Hvis seeden legger inn en fast sats (f.eks. kr 250/t), vil dette avvike fra den ansattes faktiske timelønn × 100 %. En ansatt med timelønn kr 180/t skal ha kr 180 i tillegg, ikke kr 250 og heller ikke kr 180 hvis seeden er gammel. Korrekt implementasjon er å beregne `baseRate * 1.0` (dvs. dobling av base), ikke slå opp en tariff-rad.

**Problem 2 (seed mangler):** Det finnes ingen `helligdagstillegg`-rad i restaurant-template-seedet (bekreftet via grep — null treff). `context.isPublicHoliday` settes via `public_holiday`-tabellen (K1a), men `tariff_rate_table` mangler raden. Koden vil finne `rate = null` og hoppe over tillegget stille, uten feilmelding.

**Confidence (klokkegrenser):** HØY — §4-2 er klar på at det er et separat tillegg for helligdager.
**Confidence (beregningsmetode):** MEDIUM — §4-2 beskriver 100 % av timelønn, men det er tolkningsplass for om dette er "tillegg på toppen av" (200 % totalt) eller "erstatning for" (100 % totalt). Bransje-praksis er at det er tillegg i tillegg til ordinær lønn = 200 % totalt.
**Confidence (seed-problemet):** HØY — grep mot supabase/templates/restaurant/* bekrefter null `helligdagstillegg`-rader.

**Eskalering:** Beregningsmetode for helligdagstillegg → kontakt NHO Reiseliv juridisk avdeling (se eskaleringsanbefaling).

---

## 4. Satser — sammenligning kode vs gjeldende

| Tillegg | Kode (henter fra DB) | §4-3 sats 01.04.2024 | Gjeldende sats 01.04.2025 | Status |
|---|---|---|---|---|
| Kveldstillegg (21:00–24:00 man-fre) | `amount` fra `tariff_rate_table` | kr 15,65/t | kr 16,01/t | Avhenger av seed |
| Lørdagstillegg (14:00–24:00) | `amount` fra `tariff_rate_table` | kr 29,74/t | kr 30,42/t | Avhenger av seed |
| Søndagstillegg (06:00–24:00) | `amount` fra `tariff_rate_table` | kr 29,74/t | kr 30,42/t | Avhenger av seed |
| Nattillegg øvrige (00:00–06:00) | **MANGLER** | kr 54,76/t | kr 56,02/t | Ikke implementert |
| Nattillegg nattvakter (00:00–06:00) | **MANGLER** | kr 41,46/t | kr 42,41/t | Ikke implementert |
| Helligdagstillegg | `amount` fra `tariff_rate_table` | 100 % av timelønn | 100 % av timelønn | Seed mangler + feil beregningsmetode |

**Merk:** Restaurant-template-seeden (`supabase/templates/restaurant/`) inneholder ingen `tariff_rate_table`-INSERT for noen av disse satsene. Det betyr at koden faller tilbake til `platformTariffRates` (K1a), som heller ikke er seeded i restaurant-templaten. Koden vil stille returnere tomme supplements for alle tenants basert på denne templaten.

---

## 5. Kodetabell — kode vs §4-3 (full sammenligning)

| Grense | Kode | §4-3 korrekt | Feil-type | Confidence |
|---|---|---|---|---|
| Kveld fra | `hour >= 21` (UTC) | 21:00 lokal | UTC-feil, ikke grense-feil | HØY |
| Kveld til | `hour < 6` (dvs. 00:00–06:00 inkludert) | 24:00 (kveld stopper ved midnatt) | **Grense-feil + natt-overlap** | HØY |
| Lørdag fra | `hour >= 15` (UTC) | 14:00 lokal | **Grense-feil (1 time galt) + UTC** | HØY |
| Lørdag til | (implisitt dag-slutt) | 24:00 | Korrekt | HØY |
| Søndag fra | `day === 0` (alle søndag, UTC) | 06:00 lokal | **Grense-feil (6 timer galt) + UTC** | HØY |
| Søndag til | (implisitt dag-slutt) | 24:00 | Korrekt | HØY |
| Natt 00:00–06:00 | Fanges av kveld-logikk | Eget nattillegg | **Mangler separat tillegg** | HØY |
| Helligdag | `context.isPublicHoliday` flag | §4-2 100 % av timelønn | Seed mangler, beregning gal | MEDIUM |

---

## 6. `deriveDayCategory` i `add-shift-action.ts` — mismatch

Funksjonen (linje 99–107) bruker allerede `toWorkspaceDateTimeParts` (korrekt, tz-bevisst). Men grensene er ikke alignet med §4-3:

```typescript
function deriveDayCategory(startAtISO: string, timezone: string): DayCategory {
  const { weekday, hour } = toWorkspaceDateTimeParts(startAtISO, timezone);
  if (weekday === 0 || weekday === 6) return "weekend";   // All lørdag + søndag = weekend
  if (hour >= 22 || hour < 5) return "night";             // 22:00–05:00 = night (avviker fra §4-3)
  if (hour >= 16) return "evening";                       // 16:00–22:00 = evening (avviker)
  if (hour >= 14) return "afternoon";
  if (hour >= 11) return "midday";
  return "morning";
}
```

**Avvik mot §4-3:**

| `deriveDayCategory` | §4-3 tillegg | Mismatch |
|---|---|---|
| `night` fra 22:00 | §4-3 kveld starter 21:00 | 21:00–22:00 klassifiseres som `evening` i koden, men utløser kveldstillegg §4-3 |
| `night` fra 00:00–05:00 | §4-3 natt er 00:00–06:00 | 05:00–06:00 gap: koden kaller det `morning`, §4-3 gir nattillegg |
| `weekend` all lørdag | §4-3 lørdagstillegg fra 14:00 | Lørdag 00:00–13:59 = ingen tillegg §4-3, men koden sier `weekend` |
| `weekend` all søndag | §4-3 søndagstillegg fra 06:00 | Søndag 00:00–05:59 = nattillegg §4-3, men koden sier `weekend` |
| `evening` fra 16:00 | §4-3 kveld starter 21:00 | 16:00–20:59: koden kaller det kveld, §4-3 gir ingen tillegg (hverdag) |

**Merk:** `deriveDayCategory` og `resolve-tariff-rate.ts` er to separate systemer som begge klassifiserer tid, men med ulike grenser og ulik tz-bevissthet. `deriveDayCategory` er tz-korrekt men bruker grove UX-kategorier (ikke direkte tariff-grenser). `resolve-tariff-rate.ts` har eksakte tariff-grenser men er UTC-feil. De bør ikke forveksles, men de bør alignes slik at `day_category`-kolonnen på `schedule_shift` ikke gir falsk trygghet.

**Confidence: HØY** på avvikene over — de er direkte lesbare fra kildekode vs lovtekst.

---

## 7. K1a seed-status for restaurant-template

Grep mot `supabase/templates/restaurant/` og alle `.sql`-filer bekrefter:

- **Ingen** `INSERT INTO tariff_rate_table`-setninger i restaurant-templaten
- `contracts.sql` refererer "Riksavtalen tariff rates effective 1 April 2024" i en kommentar, men setter ingen rader
- Tilleggssatser finnes ikke i noen template-seed

**Konsekvens:** Alle hospitality-tenants som provisjoneres via restaurant-templaten starter uten tariff-supplement-rader. `resolveTariffRate()` vil alltid returnere `supplements: []` for disse tenantene. Ansatte underbetales med full supplement-sum fra dag én.

**Dette er en separat feil fra UTC-bugen** og bør adresseres i Phase 2 som en K1a-seed-sortie (eventuelt som del av denne).

**Confidence: HØY** — direkte verifisert via grep i filsystemet.

---

## 8. Sammendrag av feil (prioritert)

| Prioritet | Feil | Konsekvens | Confidence |
|---|---|---|---|
| P0 | UTC-bug i `isEveningTime` + `isWeekendTime` | Underbetaling alle DST-berørte vakter | HØY |
| P0 | Nattillegg mangler fullstendig | Underbetaling 40 kr/t alle nattevakter 00:00–06:00 | HØY |
| P1 | Lørdagsgrense: 15:00 → skal være 14:00 | 1 time underbetaling per lørdagsvakt | HØY |
| P1 | Søndagsgrense: 00:00 → skal være 06:00 | Feil tillegg (søndagstillegg i stedet for nattillegg, 25,60 kr/t gal sats) | HØY |
| P1 | Kveldstillegg: til-grense er 06:00 → skal være 24:00 | Natt feilklassifisert som kveld, 40 kr/t for lite | HØY |
| P2 | K1a seed mangler alle supplement-rader | Alle supplements returnerer tom liste for nye tenants | HØY |
| P2 | Helligdagstillegg: beregning feil (fast sats vs 100 % timelønn) | Variabel feil avhengig av ansattes timelønn | MEDIUM |
| P3 | `deriveDayCategory` UX-grenser avviker fra §4-3 | Potensielt feil `day_category` på `schedule_shift` | MEDIUM |

---

## 9. Eskaleringsanbefalinger

### Nattillegg — to kategorier (LAV på kategori-avgrensning)

**HØY** på at nattillegg eksisterer og er 00:00–06:00. **LAV** på hva som skiller "nattvakter og sikkerhetspersonell" fra "øvrige arbeidstakere" i Riksavtalen — §4-3 definerer ikke kriteriene. Ulike restaurant-tenants kan tolke dette ulikt.

**Anbefaling:** Kontakt NHO Reiseliv juridisk avdeling for avklaring av hvem som faller under "nattvakter"-kategorien vs "øvrige" i en typisk restaurant-kontekst. Implementer inntil videre kun "øvrige"-raten (56,02 kr/t) som default, med `tariff_category`-override for nattvakter.

### Helligdagstillegg — beregningsmetode (MEDIUM confidence)

§4-2 sier 100 % av individuell timelønn. Beregningsmetode er klar, men spørsmålet er om `baseRate` i `TariffContext` alltid er korrekt individuell timelønn (inkludert senioritetstillegg og lokale avtaler) eller bare tariff-minimum. Hvis `baseRate` er undergrense, vil helligdagstillegget bli for lavt for ansatte over minstelønn.

**Anbefaling:** Verifiser at `baseRate` i `TariffContext` reflekterer faktisk avtalt timelønn (fra `employee_payroll_profile`), ikke tariff-minimum. Endre beregning fra `findRate(..., "helligdagstillegg")` til `supplements.push({ amount: baseRate, unit: "kr/t" })` — ingen tariff-rad nødvendig.

### Satser fra 1. april 2025 — verifisering (MEDIUM confidence)

Satsene kr 16,01/t (kveld), kr 30,42/t (lørdag/søndag), kr 56,02/t (natt øvrige) og kr 42,41/t (natt nattvakter) er hentet fra websøk-aggregering (Fellesforbundet PDF-tittel + NHO Reiseliv minstesatser-side). PDF-innholdet var ikke direkte lesbart. Satsene samsvarer med en konsistent 2,3 %-regulering fra 2024-satsene.

**Anbefaling:** Pontus verifiserer mot nedlastet PDF fra Fellesforbundet. Dette er en rimelig antagelse men bør konfirmeres før disse satsene legges inn i produksjons-seed.

---

## 10. Korrekte verdier for Phase 2 implementasjon

Basert på verifisert §4-3 (HØY confidence der angitt):

```typescript
// resolve-tariff-rate.ts — korrekte grenser (i LOKAL TID, ikke UTC)

/** Kveldstillegg: mandag–fredag 21:00–24:00 */
function isEveningTime(localHour: number, localWeekday: number): boolean {
  const isWeekday = localWeekday >= 1 && localWeekday <= 5; // Mon=1, Fri=5
  return isWeekday && localHour >= 21; // 21:00–23:59, IKKE 00:00–06:00
}

/** Nattillegg: alle ukedager 00:00–06:00 */
function isNightTime(localHour: number): boolean {
  return localHour < 6; // 00:00–05:59 — SEPARAT fra kveldstillegg
}

/** Lørdagstillegg: lørdag 14:00–24:00 */
function isSaturdayTime(localWeekday: number, localHour: number): boolean {
  return localWeekday === 6 && localHour >= 14; // Lørdag, ikke 15:00
}

/** Søndagstillegg: søndag 06:00–24:00 */
function isSundayTime(localWeekday: number, localHour: number): boolean {
  return localWeekday === 0 && localHour >= 6; // Fra 06:00, ikke 00:00
}
```

**K1a seed-rader som mangler (basert på satser 1. april 2025):**

```sql
-- Kveldstillegg (man-fre 21:00-24:00)
INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit)
VALUES (NULL, 'kveldstillegg', 'riksavtalen', '2025-04-01', 16.01, 'kr/t');

-- Lørdag/søndagstillegg
INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit)
VALUES (NULL, 'helgetillegg', 'riksavtalen', '2025-04-01', 30.42, 'kr/t');

-- Nattillegg — øvrige (restaurantpersonell)
INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit)
VALUES (NULL, 'nattillegg', 'riksavtalen', '2025-04-01', 56.02, 'kr/t');

-- Nattillegg — nattvakter/sikkerhetspersonell (bruk tariff_category for filter)
INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit)
VALUES (NULL, 'nattillegg_nattvakt', 'riksavtalen', '2025-04-01', 42.41, 'kr/t');
```

*Merk: 2025-satsene bør verifiseres mot Fellesforbundet-PDF før produksjons-seed. 2024-satsene (15,65 / 29,74 / 54,76 / 41,46) er HØY confidence fra Lovdata-tekst.*

---

## 11. Disclaimer

Dette er juridisk veiledning, ikke juridisk rådgivning. Lovsen er en compliance-støtteverktøy — ikke advokat. For bindende svar om tariff-tolkninger, kontakt NHO Reiseliv juridisk avdeling.

Rapporten er basert på:
- Riksavtalen TARO-79 §4-3 (Fellesforbundet–NHO Reiseliv 2024–2026) via Lovdata
- Websøk-aggregering av satser fra 1. april 2025 (Fellesforbundet + NHO Reiseliv)
- Direktelesing av kildekode i worktree

---

**Kilder:**
- [Riksavtalen TARO-79 §4-3 — Lovdata](https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_2-1)
- [Riksavtalen TARO-79 full tekst — Lovdata](https://lovdata.no/dokument/TARO/tariff/taro-79)
- [Riksavtalens satser fra 1. april 2025 — Fellesforbundet PDF](https://www.fellesforbundet.no/globalassets/lonn-og-tariffsaker/tariffavtaler/overenskomster-2024-2026/riksavtalens-satser-fra-1.-april-2025---nett.pdf)
- [Riksavtalen | Fellesforbundet](https://www.fellesforbundet.no/lonn-og-tariff/tariffavtaler/riksavtalen/)
- [Minstelønnssatser fra 1. april 2025 — NHO Reiseliv](https://www.nhoreiseliv.no/jushjelp-tariff-hms/lonn-og-tariff/nyhet/2025/minstelonnssatser-fra-1.-april-2025)
- [Lønnsoppgjøret 2025 Riksavtalen nr 79 — NHO MD](https://www.nhomd.no/arbeidsforhold-og-tariff/tariff/overenskomster/Riksavtalen/)
