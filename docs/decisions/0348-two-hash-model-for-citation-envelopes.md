---
title: "Two-hash model for regulatory citation envelopes — structureHash + rateHash supersedes single hash"
id: ADR_0348
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: MODULE_AGENT_SDK
tags: [lovsen, citation, hash, schema, payroll, golden-month, phase-7, adr-0341, adr-0342]
supersedes: none
superseded_by: none
amends: [ADR-0341, ADR-0342]
related_adrs: [ADR-0256, ADR-0341, ADR-0342, ADR-0347, ADR-0349]
---

# ADR-0348: Two-hash model for regulatory citation envelopes

## 2026-05-17 AMENDMENT — Dynamic-MCP-Fetch Pivot (Round 2)

**Two-hash model REFINED** — the two hashes now serve two distinct consumer classes per Phase 7d council (2026-05-17):

- **(a) Audit-provenance consumer:** `shift_pay_calculation_event.provenance` JSONB field (per Bokf. §13 / ADR-0251 audit pattern) stores `structureHash` + `rateHash` at calculation time. This is the legally defensible audit trail — a 2027 auditor can verify which rate was in force when the shift was calculated. Consumer: engine output, not fixture CI.
- **(b) CI/batch staleness consumer:** `pnpm test:golden-month` F6 gate (ADR-0342) uses the two hashes to discriminate `RATE_STALE` (legally material, must act) from `SCHEMA_DRIFT` (structural notation, informational). Consumer: fixture CI only.

**Original model unchanged.** `structureHash` + `rateHash` schema extension (18 fields per §"ExpectedCell-skjema-endring"), dual-lineage validator (Pattern L / Pattern N), and telemetry impact are unmodified.

**ADR-0354 implements (b) at production layer.** The heartbeat cron (ADR-0354) calls `verify_citation_freshness` using the same two hashes against the materialized snapshot — drift class surfaced as `RATE_STALE` or `SCHEMA_DRIFT` in Telegram alert payload.

> En enkelt hash over verbatim tekst er blind for hva som faktisk endret seg. Lovsen council 2026-05-17 identifiserte to separable drift-akser som enkelt-hash sammenblander — og sammenblandingen drukner lovlig-materielle varsler i strukturell støy.

**Tre ekstremt-viktige punkter for leseren i 2027:**

1. **Single `lovsenCitationHash` (ADR-0341 §H) kollapser to uavhengige drift-akser til én signal.** Riksavtalen-edisjoner renumrerer paragrafer (§6 → §4-3) uten å endre satser — dette gir false-positive staleness-alert. Lønnsoppgjør justerer satser mid-edisjon — dette er det juridisk materielle varselet. Uten separasjon druknes det materielle i støyen.
2. **To hash-er, to ansvarslinjer:** `structureHash = SHA256(normalisert paragraftekst med satser maskert)` skifter kun når juridisk notasjon endres (SCHEMA_DRIFT). `rateHash = SHA256(kanonisk satsekstraksjon)` skifter kun når lovlig bindende satser endres (RATE_STALE). Revisor spør alltid om satser — aldri om paragrafnumrering.
3. **Migrasjon er dual-lineage, ikke big-bang.** Eksisterende 358 NHO-stemplede celler beholder `lovsenCitationHash` (markert `legacy_single_hash: true`). Fase 7c re-source via Lovdata MCP populerer begge nye hash-felt. Skjemavalidatoren aksepterer begge mønstre i parallell inntil legacy-celler er re-sertifisert.

## Context and Problem Statement

ADR-0341 §H låste ExpectedCell-skjema til 16 felt, inkludert ett `lovsenCitationHash`-felt som er SHA-256 av verbatim paragraftekst (per ADR-0256). ADR-0342 `verify_citation_freshness`-verktøyet sammenligner denne cachen mot live-hentet hash for å detektere staleness.

Modellen er solid for ett spesifikt scenario: verbatim tekst endrer seg = alt endret. Men Riksavtalen opererer med to distinkte endringshendelser:

1. **Paragraf-renumrering mellom edisjoner** (f.eks. §6 kveldstillegg → §4-3 kveldstillegg i ny edisjon). Verbatim tekst endres — satsen er identisk. Single-hash: STALE-alert (false positive). Konsekvens: CI rød på noe som ikke er juridisk materielt.
2. **Lønnsoppgjør justerer sats mid-edisjon** (f.eks. kveldstillegg 42.41 kr/t → 44.50 kr/t). Verbatim tekst endres fordi satsen i brødteksten endres. Single-hash: detekterer dette IFF satsen er eksplisitt i verbatim tekst. Men garantien er svak — satsen kan ligge i vedlegg, tariffprotokoll eller cross-referanse utenfor verbatim-feltet som ble hash-et.

Lovsen council Phase 3 review (2026-05-17) surfaced this gap. Konkret trigger: ADR-0347 åpner Lovdata-sti for paragrafer som NHO Reiseliv selv ikke publiserer med stabile URL-er. Ved første Lovdata-fetch vil paragraph-numrering sannsynligvis avvike fra NHO Reiseliv-formuleringene — single-hash vil false-positive-alert på alle 358 celler simultaneously ved første re-source.

Uten to-hash-modellen er ADR-0347-migrasjonen ikke gjennomførbar uten å drukne operatøren i false-positive staleness-alarmer.

## Decision Drivers

- **Juridisk korrekthet:** varselet skal signalisere lovlig-materiell endring (satsendring), ikke notasjonsendring (paragrafnumrering). Revisor spør "er denne satsen gjeldende?" — aldri "er paragrafnummeringen uendret?"
- **Audit-forsvarbarhet:** Arbeidstilsynet og Skatteetaten er interessert i om lønnsgrunnlaget er basert på gjeldende satser — ikke om paragraf fikk nytt nummer i neste tariffperiode.
- **Kaskade-integritet:** K1a regulatory facts har multiple drift-akser; enkelt-hash reduserer signal-til-støy-ratio og gjør `lovsen.citation.stale` telemetri mindre handlingsrettet.
- **ADR-0347 fremover-kompatibilitet:** Lovdata-sti bringer annen paragraf-numrering enn NHO Reiseliv. Single-hash ville false-positive-alert globalt ved første re-source. To-hash eliminerer dette problemet — `rateHash` er stabil så lenge satsen er den samme.
- **Stale-alert-metthet:** Hvis CI ropes opp på strukturell støy, ignoreres det. Varselets verdi er direkte proporsjonal med dets presisjon.

## Considered Options

1. **A — Behold single hash, aksepter støy.** Hold ADR-0341 §H uendret. Operatøren re-verifiserer manuelt ved false-positiver. Rejected: drukner rate-change-signal; ADR-0347-migrering umulig i praksis (global false-positive ved Lovdata-debut).
2. **B — Per-celle drift-akse-teller** (`paragraf_drift_count`, `rate_drift_count`). Rejected: tellere er ikke deterministiske (avhenger av hvor mange ganger MCP har fetched siden baseline), vanskelig å verifisere i audit, gir ikke hash-basert idempotens.
3. **C (valgt) — To-hash-modell med eksplisitte drift-akse-felt.** `structureHash` for notasjon, `rateHash` for satser. Begge uavhengig versjonerte. Skjemavalidator aksepterer legacy og post-0348 i parallell.

## Decision Outcome

Valgt alternativ: **C — To-hash-modell**.

### ExpectedCell-skjema-endring (ADR-0341 §H amendment — skjema → 18 felt)

To nye felt legges til alle `expected/*.json`-celler:

```json
{
  "structureHash": "sha256:...",
  "rateHash": "sha256:..."
}
```

**`structureHash`** — SHA-256 av normalisert paragraftekst der alle rate-numeraler er maskert via regex:

- Regex erstatningsregel: NOK-beløp (f.eks. `42,41 kr/t`, `42.41 kr/time`, `NOK 42.41`) + prosent-tillegg (f.eks. `50 %`, `50%`) erstattes med token `<RATE>` FØR hashing.
- Eksempel: `"Kveldstillegg utgjør 42,41 kr pr. time"` → `"Kveldstillegg utgjør <RATE> pr. time"` → hash.
- Skifter IKKE ved satsendring (lønnsoppgjør) — skifter KUN ved omformulering, renumrering, eller ny paragraftittel.
- Drift-klasse ved stale: `SCHEMA_DRIFT` — strukturell notasjonsendring, ikke juridisk materielt.

**`rateHash`** — SHA-256 av kanonisk satsekstraksjon (nøkkel=verdi-par, én per supplement-type):

- Kanonisk form: `kveldstillegg=42.41 kr/t; helgetillegg=56.02 kr/t; nattillegg=28.91 kr/t` (sortert alfabetisk på nøkkel, desimalpunkt, kr/t-enhet normalisert).
- Skifter IKKE ved paragraf-renumrering — skifter KUN når lønnsoppgjøret justerer satsen.
- Drift-klasse ved stale: `RATE_STALE` — juridisk materielt, MÅ varsle.

**Behold eksisterende `lovsenCitationHash`-felt** for bakover-kompatibilitet. Markert deprecated. Fjernes i ADR-0341 v1.3 (separat vedlikehold-ADR, ikke denne).

### Skjema-validator (Zod) — dual-lineage-logikk

Valideringen aksepterer to gyldige mønstre for en celle. Et av disse MÅ være sant:

- **Mønster L (legacy):** `lovsenCitationHash` ikke-tom string + `structureHash` tom string (`""`) + `rateHash` tom string (`""`).
- **Mønster N (post-0348):** `structureHash` ikke-tom string + `rateHash` ikke-tom string + `lovsenCitationHash` tom string eller null.

En celle med INGEN av mønstrene er en `golden-month.cell_schema_violation`.

### Telemetri-impact

`lovsen.citation.stale`-event (registry.ts L7369) får to nye valgfrie felt i payload:

- `drift_axis: 'structure' | 'rate' | 'both'` — hvilken hash-akse som er stale.
- `legacy_single_hash: boolean` — `true` hvis cellen er på pre-0348 legacy-skjema (ukjent drift-akse).

Disse feltene er optional for bakover-kompatibilitet. Eksisterende consumers av `lovsen.citation.stale` brytes ikke.

Telemetry-registry oppdateres i neste event-registry sortie (ikke blokkerende for ADR-0348).

### `verify_citation_freshness` — per-akse returtype (ADR-0342 amendment)

`FreshnessResult` (ADR-0342) utvides med:

```typescript
type FreshnessResult = {
  // ... existing fields unchanged ...
  drift_axis?: 'structure' | 'rate' | 'both' | null;  // null = legacy single-hash
  legacy_single_hash?: boolean;
};
```

ADR-0342 MCP-kontrakt er ellers uendret. MCP-implementasjoner oppdateres i T3.

## Migrasjonsstrategi

### Fase 7b (denne ADR) — skjema-utvidelse

- T1: Definer rate-normaliserings-regex + test mot 6 Riksavtalen supplement-satsformer (kveldstillegg, helgetillegg, nattillegg, overtid 50 %, overtid 100 %, kortvarseltillegg).
- T2: Legg til `structureHash` + `rateHash` i `ExpectedCellSchema` (Zod) i `packages/payroll-calculate/__tests__/golden-month/expected-cell.schema.ts`. Test-runner beregner begge for nye celler.
- T3: Oppdater `verify_citation_freshness` MCP-verktøy til å returnere per-akse drift-info (`drift_axis`-felt) og emitte `lovsen.citation.stale` med `drift_axis` payload.
- T4: Migrer 358 NHO-celler i Fase 7c via lovdata-mcp re-fetch — populer `structureHash` + `rateHash` + sett `lovsenCitationHash` til tom string.

### Dual-lineage i overgangsperioden

Eksisterende 358 NHO-stemplede celler (`lovsenCitationHash` satt, `structureHash`/`rateHash` tomme) er gyldig **Mønster L** — CI passerer. Nye celler (Fase 7c Lovdata-sourced) populerer **Mønster N**. Ingen big-bang re-sertifisering kreves.

### Rollback

Hvis to-hash-modellen viser seg upraktisk (rate-regex vedlikehold for kostbart), er rollback: fjern Mønster N fra skjema-validator, re-populer `lovsenCitationHash` for alle celler, deprecer nye felt. ADR-0341 v1.0 semantikk gjenopprettes. Rollback er mulig fordi vi IKKE fjerner `lovsenCitationHash`-feltet nå.

## Implementasjonsporter (Fase 7b/c)

- **T1:** Definer rate-normaliserings-regex + test mot 6 supplement-satsformer. Per-supplement-type-tabell foretrekkes over generell parser (6 entries, deterministisk vedlikehold).
- **T2:** Legg til `structureHash` + `rateHash` til `ExpectedCellSchema` (Zod) + oppdater test-runner til å beregne begge for post-0348-celler.
- **T3:** Oppdater `verify_citation_freshness` MCP-verktøy til å returnere `drift_axis` + `legacy_single_hash` i `FreshnessResult`.
- **T4:** Migrer 358 NHO-celler i Fase 7c via lovdata-mcp re-fetch til Mønster N.

## Rules & Consequences

- **Good, because** staleness-varsler har juridisk mening — `RATE_STALE` signaliserer handlingsplikt, `SCHEMA_DRIFT` er informasjon. Operatøren vet hva som krever re-sertifisering.
- **Good, because** ADR-0347 Lovdata-migrering er gjennomførbar uten global false-positive storm — `rateHash` er stabil så lenge satsen er lik, uavhengig av paragraf-numrering.
- **Good, because** audit-sporet er mer presist — revisor kan skille "satsen er gjeldende" fra "paragrafnummeret er det samme." Kun det første er juridisk relevant.
- **Bad, because** skjema-migrasjon berører 358 celler i Fase 7c — re-source via Lovdata MCP er nødvendig for å populere begge hash-felt. Vedlikeholdskost er real.
- **Bad, because** rate-normaliserings-regex MÅ vedlikeholdes per supplement-type. Ny satsform uten regex-oppdatering → `rateHash` feiler å isolere satsen → falsk `SCHEMA_DRIFT`-klassifisering. Krav: regex-tabell for de 6 supplement-typene i golden-month v1.
- **Neutral:** kapabilitetslaget berøres IKKE. ZERO consumers av `verify_citation_freshness` utenfor CI test-runner + Lovsen MCP-er. Endringen er begrenset til test-oracle-domenet.
- **Agent Impact:** Capability-laget er uberørt. Lovsen MCP-eiere (NHO Reiseliv + Lovdata) implementerer `drift_axis`-retur per T3. Golden-month fixture-forfattere bruker det nye skjemaet fra Fase 7c. CI test-runner tolker `drift_axis` for differensiert feil-rapportering.

## Åpne spørsmål

1. **Rate-regex: per-supplement-type-tabell vs generell parser?** Anbefaling: per-supplement-type-tabell med 6 entries (kveldstillegg, helgetillegg, nattillegg, overtid-50, overtid-100, kortvarseltillegg). Generell parser er fristende men vanskelig å verifisere for edge cases i norsk lovtekst. Besluttes i T1.
2. **Telemetri `drift_axis`-felt:** Registreres i neste event-registry sortie. Ikke blokkerende for ADR-0348 accept eller T1–T4.
3. **`legacy_single_hash: true`-celler i `verify_citation_freshness`:** Returner `drift_axis: null` + `legacy_single_hash: true` for slike celler. MCP kan ikke bestemme aksen uten å re-parse originaltekst mot normaliserings-regex. Akseptert begrensning — slike celler flagges for re-source i neste Fase 7c-syklus.

## Referanser

- ADR-0341 v1.1 §H — ExpectedCell 16-felt skjema med `lovsenCitationHash` (amended by this ADR → 18 felt)
- ADR-0342 — Lovsen MCP freshness-verification tool (`FreshnessResult` type amended by this ADR)
- ADR-0256 — Lovsen citation contract (Citation type + `lovsen.citation.stale` event)
- ADR-0347 — Lovdata canonical source + NHO repurpose (the triggering migration this ADR enables)
- ADR-0349 — Paragraph-ref translation map (sibling ADR, Phase 7a)
- `packages/payroll-calculate/__tests__/golden-month/expected-cell.schema.ts` lines 25–74 (current 16-field schema, pre-0348)
- `packages/telemetry/src/registry.ts` L7369 — `lovsen.citation.stale` telemetry event (payload extended by this ADR)
- Council 2026-05-17 Lovsen Phase 3 review (the core driver — surfaced false-positive storm at Lovdata debut)

---

> Struktur er notasjon. Sats er loven. Aldri konflater de to.

> Registered in `docs/decisions/0000-decision-log.md`. Amends ADR-0341 §H + ADR-0342 `FreshnessResult`. Status `proposed` pending Pontus accept.
