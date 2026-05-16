---
title: "Lovsen MCP freshness-verification tool — verify_citation_freshness(hashes[]) contract"
id: ADR_0342
status: proposed
date: 2026-05-16
layer: decision
created: 2026-05-16
updated: 2026-05-16
module: MODULE_AGENT_SDK
tags: [lovsen, mcp, citation, freshness, golden-month, ci, payroll, p1]
supersedes: none
superseded_by: none
related_adrs: [ADR-0256, ADR-0258, ADR-0341]
---

# ADR-0342: Lovsen MCP freshness-verification tool

> ADR-0341 låste forventningen om at hver krone i `expected/` bærer sin egen `lovsenCitationHash`. Den forventningen er bare meningsfull hvis CI faktisk kan spørre Lovsen "er denne hashen fortsatt i kraft?" — uten den spørringen er stale-detection en bokstav på papiret, ikke en kontroll i pipelinen.

**Tre ekstremt-viktige punkter for leseren i 2027:**

1. **`verify_citation_freshness` er kontrakten ADR-0341 §"Stale handling" hviler på.** Uten dette verktøyet kan ikke `pnpm test:golden-month` skille mellom "Riksavtalen-paragrafen er uendret" og "paragrafen er rebound og fixturen din siterer død tekst." Stale-check uten verktøy = grønn CI på utdaterte sannheter.
2. **Implementeres i begge MCP-er (NHO Reiseliv + Lovdata).** Citation-routing skjer per `source`-felt lagret på siteringstidspunkt. Én MCP per kilde betyr CI batcher 100 hash-er av gangen mot riktig server uten å gjette.
3. **`LOVSEN_FIXTURE_MODE=true` MÅ returnere `stale: false` deterministisk.** ADR-0258 fixture-modus er ikke-forhandlbar for CI. Hash-spørringer som rammer fixture-modus skal aldri nettverk-fetche, aldri returnere stale, aldri tilfeldige resultater. Determinisme før korrekthet på offline-pathway.

## Context and Problem Statement

Golden-month fixtures (per ADR-0341) bærer per-celle `lovsenCitationHash` for å gi revisor-defensibel sporing fra hver krone tilbake til Riksavtalen-tekst som var i kraft da Pontus regnet. Når Riksavtalen revideres (paragraf-renumrering, satsjustering, 2026→2027-revisjon), endres den siterte teksten — men hashen i fixturen er den samme. Resultat: fixturen passerer CI mens den validerer mot tekst som ikke lenger eksisterer i forhandlet form.

ADR-0256 definerer `lovsen.citation.stale` telemetry-event (registered `packages/telemetry/src/registry.ts:7275, 12366`), men ingen MCP-metode finnes for å detektere staleness på et batch av hash-er. ADR-0341 §"Stale handling" og §"Implementation gates F6" antar denne metoden eksisterer. Den gjør ikke. Council 2026-05-16 (chair + lovsen + payroll-engine) flagget gapet under ADR-0341-vurderingen; Pontus valgte å fylle gapet i separat ADR.

Uten `verify_citation_freshness` er F6 stale-check i ADR-0341 ikke-operativ. Lovsen MCP per i dag eksponerer kun fetch-tools (`fetch_riksavtalen`, `lookup_tariff_supplement` for NHO Reiseliv; `fetch_paragraph`, `search_law`, `get_law_metadata` for Lovdata) — ingen tar et sett hash-er som input og returnerer fersk-status.

## Decision Drivers

- **ADR-0341 F6 må være operativ:** stale-check uten verktøy er en kontroll-i-prosa, ikke en kontroll-i-pipeline
- **Batch-evne kreves:** golden-month-fixture v1 har ~300 celler; per-hash roundtrip = 300 MCP-kall = uforsvarlig CI-latens
- **Fixture-modus determinisme (ADR-0258):** CI uten nettverk er et arkitekturkrav; staleness-spørringer må respektere `LOVSEN_FIXTURE_MODE`
- **Telemetry kontinuitet:** `lovsen.citation.stale` allerede registrert per ADR-0256; freshness-tool må fyre samme event så aktørkjede (ADR-0341 verifyBy) stemmer
- **Citation routing per `source`:** ADR-0258 etablerte 4 MCP-er per kilde; freshness må respektere samme grense — én hash spør én MCP

## Considered Options

1. **A — Skip freshness verification entirely; manual Riksavtalen monitoring + manual fixture refresh.** Manager-cron leser NHO Reiseliv-nyheter, opdaterer fixtures ved sats-endring. Rejected: defeats ADR-0341 audit-purpose; manuell monitorering ER den bug-klassen denne kontrakten skal eliminere.
2. **B — Embed freshness logic in fixture test runner (no MCP method); test runner re-fetches paragraph text per hash and compares.** Rejected: re-fetches bryter determinisme; krever nettverk i CI; konflikt med `LOVSEN_FIXTURE_MODE` (ADR-0258); duplikerer hash-logikk som hører hjemme i MCP per ADR-0258 boundary.
3. **C (chosen) — Add `verify_citation_freshness` MCP method; CI batches calls; behavior contract honors fixture mode.** Holder ADR-0258 boundary intakt, gjør F6 operativ, gir batch-evne, respekterer fixture-modus.

## Decision Outcome

Chosen option: **C — Add `verify_citation_freshness(hashes: string[]): Promise<FreshnessResult[]>` to Lovsen MCP servers.** Implementert i `services/lovsen-nho-reiseliv-mcp/` og `services/lovsen-lovdata-mcp/`. CI router per `source`-felt lagret på citation.

### Method contract

```typescript
type FreshnessResult = {
  hash: string;                       // 64-char lowercase hex SHA-256 (matches ADR-0256 Citation.hash)
  stale: boolean;                     // true if cited text differs from current
  current_hash?: string;              // present if stale=true; hash of current text
  current_verbatim_text?: string;     // present if stale=true; verbatim text now in force
  paragraph_ref: string;              // mirrors original citation's paragrafRef for audit
  checked_at: string;                 // ISO-8601 timestamp of freshness check
  source: 'nho-reiseliv' | 'lovdata'; // which MCP served the check
};
```

### Behavior contract

- **Idempotent within freshness-window.** N successive calls within ADR-0256 default 24h TTL → identical results. No request-level jitter, no clock-skew variance.
- **Batched.** Single call covers up to 100 hashes. Golden-month v1 (~300 celler) → 3 batched calls per MCP. Caller responsible for splitting larger sets.
- **Fixture-modus deterministisk.** `LOVSEN_FIXTURE_MODE=true` (per ADR-0258) → MCP MUST return all hashes as `stale: false` uten nettverk-I/O. No exceptions.
- **Telemetry per stale-treff.** Each `stale: true` result MUST emit `lovsen.citation.stale` (ADR-0256 registered event) with `hash` + `paragraph_ref` in payload. CI extracts payload to identify affected fixture cells.
- **Ukjente hash-er.** Hash ikke sett av MCP (aldri-fetched eller utgått fra cache) → returner `stale: true` uten `current_hash`, logg warning. CI behandler dette som stale.
- **Source-disambiguation.** Hver MCP svarer kun på hash-er fra egen kilde. Caller-side routing per `source`-felt; MCP returnerer `source` i resultat for audit-symmetri.

### MCP server placement

- **`services/lovsen-nho-reiseliv-mcp/`** — covers Riksavtalen-siteringer (NHO Reiseliv / LO kollektivavtale). MCP eksisterer i dag (P1.S1d, ADR-0258 row 4); tilføy `verify_citation_freshness` til verktøy-katalog.
- **`services/lovsen-lovdata-mcp/`** — covers Aml., ferielov, OTP, øvrig norsk lov. MCP eksisterer (P1.S1a, ADR-0258 row 1); tilføy `verify_citation_freshness`.
- **`services/lovsen-mattilsynet-mcp/` + `services/lovsen-arbeidstilsynet-mcp/`** — utenfor scope for ADR-0341 (golden-month fixtures siterer ikke disse kildene per v1). Tilføy `verify_citation_freshness` når første fixture siterer Mattilsynet/Arbeidstilsynet (egen ADR ved behov).

### Routing in MCP client

Caller (CI test runner) determines target MCP via `source`-felt lagret på citation. Routing-tabell:

| `source` value     | MCP target                            |
|--------------------|---------------------------------------|
| `nho-reiseliv`     | `services/lovsen-nho-reiseliv-mcp/`   |
| `lovdata`          | `services/lovsen-lovdata-mcp/`        |

Hash kommer kun fra én kilde; cross-source freshness-check er feil-bruk.

## CI integration (consumer perspective from ADR-0341)

`pnpm test:golden-month` (F6 i ADR-0341):

1. Loader alle `lovsenCitationHash` + `paragrafRef` fra `expected/{aggregated_periods,payroll_lines,deviations,timebank_entries}.json`
2. Grupperer per `source`-felt på citation
3. Batcher i kall ≤100 hash per MCP
4. Kaller `verify_citation_freshness(hashes[])` per MCP
5. Hvis noen result har `stale: true` → CI feiler med exit-kode `golden-month.citation_stale` + liste over affected `paragraph_ref` + fixture-fil (utledet fra `lovsen.citation.stale`-events emittert under run)
6. Operatør re-verifiserer fixture (oppdater `lovsenCitationHash` + `verifiedBy` + `verifiedAt`) eller rebinder paragraf hvis Riksavtalen-revisjon krever ny `paragrafRef`

## Rules & Consequences

- **Good, because** ADR-0341 stale-check blir operativ — CI fanger Riksavtalen-revisjoner automatisk i stedet for å vente på manuell oppdagelse
- **Good, because** mønsteret er gjenbrukbart — enhver fremtidig engine som låser Lovsen-siterte fixtures (Phase 7 Tripletex calc parity, Phase 8 recalc) bruker samme verktøy
- **Good, because** ADR-0258 boundary intakt — capability-laget kaller fortsatt kun MCP-tools, scraping bor i MCP
- **Bad, because** vedlikeholdsbyrde på MCP — paragraf-diff-logikk må holdes synkron med NHO Reiseliv + Lovdata tekst-endringer (P1.S1a-d eierskap)
- **Bad, because** batch-stale events ved Riksavtalen 2027-revisjon vil flomme `lovsen.citation.stale` telemetri — trenger throttling-vurdering (ikke blokkerende for v1; surface-når-vi-ser-det)
- **Bad, because** ukjente hash-er returneres som `stale: true` — første gang CI kjører mot en re-deployed MCP med tom cache vil alle hash-er vise stale før MCP varmes opp. Mitigering: cache warm-up som MCP-boot-steg (impl-detalj, ikke ADR-scope).
- **Agent Impact:** Lovsen MCP-eierne (NHO Reiseliv + Lovdata) implementerer `verify_citation_freshness` per spec over. ADR-0341 CI-wiring (F6) konsumerer metoden. Telemetry-registry har allerede `lovsen.citation.stale`; ingen nye events trengs. Capability-laget rører ikke metoden — kun CI test runner kaller den.

## Implementation gates

- **T1 — Spec `verify_citation_freshness` in MCP server.** Hono-route hvis MCP er HTTP-baseret; stdio-handler hvis stdio-MCP (NHO Reiseliv er stdio per README; Lovdata følger samme pattern). Input-validering: `hashes` er 1–100 64-tegn hex-strenger.
- **T2 — Wire `LOVSEN_FIXTURE_MODE=true` deterministic path.** Tidlig return i handler: alle input-hash-er → `stale: false`, `checked_at: <now>`, `paragraph_ref: "fixture-mode"`, `source: <mcp-source>`. README-drift på envvar-navn (`LOVSEN_MCP_FIXTURE=1` i NHO Reiseliv README vs `LOVSEN_FIXTURE_MODE=true` i ADR-0258) må løses — ADR-0258 er kanonisk, README oppdateres.
- **T3 — Telemetry registration verified.** `lovsen.citation.stale` payload-shape MUST include `hash` + `paragraph_ref` (allerede registrert lines 7275 + 12366). Hvis payload-felt mangler, oppdater registry-shape før T4.
- **T4 — Integration test.** 100-hash batch covers (a) all-fresh path, (b) mixed-stale detection, (c) fixture-mode determinism, (d) unknown-hash → stale path. Test bor i `services/lovsen-<source>-mcp/tests/test_verify_citation_freshness.py`.

## References

- ADR-0256 — Lovsen citation contract (`Citation` type, `lovsen.citation.stale` event)
- ADR-0258 — Lovsen MCP boundary (4 stdio MCPs, `LOVSEN_FIXTURE_MODE`)
- ADR-0341 — Calc-engine test oracle provenance contract (the consumer)
- `packages/telemetry/src/registry.ts` lines 7275, 12366 — `lovsen.citation.stale` registrert
- `services/lovsen-nho-reiseliv-mcp/README.md` — existing MCP pattern (note envvar-drift to fix in T2)
- `services/lovsen-lovdata-mcp/` — Lovdata MCP target
- Council session 2026-05-16 — 4-seat ADR-0341 review identified this gap

---

> **Bunnsolid før brennende.** Stale-check uten verktøy er prosa; med verktøy er det pipeline.

> Registered in `docs/decisions/0000-decision-log.md`. Consumed by ADR-0341 F6 gate.
