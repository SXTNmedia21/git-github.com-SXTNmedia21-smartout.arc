---
title: "Lovdata as K1a canonical source for Riksavtalen + NHO Reiseliv MCP repurpose"
id: ADR_0347
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: MODULE_AGENT_SDK
tags: [lovsen, mcp, lovdata, nho-reiseliv, riksavtalen, payroll, ontology, k1a, phase-7]
supersedes: none
superseded_by: none
amends: [ADR-0258, ADR-0342]
related_adrs: [ADR-0256, ADR-0258, ADR-0341, ADR-0342, ADR-0348, ADR-0349]
---

# ADR-0347: Lovdata as K1a canonical source for Riksavtalen + NHO Reiseliv MCP repurpose

**Tre ekstremt-viktige punkter for leseren i 2027:**

1. **Lovdata.no er kanonisk kilde for Riksavtalen-tekst.** Lovdata hoster Riksavtalen på TARO-namespace (`/dokument/TARO/tariff/taro-79/` — Fellesforbundet). `nhoreiseliv.no/overenskomster/riksavtalen/*` er ikke en fungerende kilde — URL-en har returnert HTTP 404 siden ADR-0258 ble skrevet 2026-04-29.
2. **NHO Reiseliv MCP er re-purposet som employer-interpretive K1a auxiliary.** NHO Reiseliv MCP-en beholder `fetch_riksavtalen`, `lookup_tariff_supplement`, og `verify_citation_freshness` — men autoriteten er redefinert: disse er nå employer-side kontekst (lønnsoppgjør sirkulær, member-org-tolkninger), ikke kanonisk lovtekst. Canonical = Lovdata. Auxiliary = NHO Reiseliv.
3. **K1a-invarianten: én kanonisk kilde per regulatorisk faktum.** Phase 7 er FØRSTE gang vi kobler en ekte nettverkskilde til Riksavtalen i Lovsen-MCP-laget — vi bytter ikke; vi initialiserer. ADR-0258 deklarerte grensen; ADR-0347 fyller den med en kilde som faktisk eksisterer.

## Context and Problem Statement

ADR-0258 (2026-04-29) etablerte 4 stdio MCPs som boundary-lag for Lovsen. NHO Reiseliv MCP ble tilordnet Riksavtalen som primary source, basert på at `nhoreiseliv.no/overenskomster/riksavtalen/` forventet å hoste avtaleteksten.

Pre-flight HTTP-sondringer 2026-05-17 avdekker: **alle testede URL-er under `nhoreiseliv.no/overenskomster/riksavtalen/*` returnerer HTTP 404** (~62KB branded 404-side). `services/lovsen-nho-reiseliv-mcp/nho_reiseliv_client.py:163` `_BASE_URL`-feltet har vært spekulativt siden skip. Ingen faktisk nettverkstest ble gjennomført før ADR-0258 ble godkjent.

Parallelt verifiserte vi Lovdata: `lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_*` returnerer HTTP 200, parseable HTML, paragraf-addressable URL-er, og ingen paywall for tariffavtaler på TARO-namespace.

ADR-0342 (2026-05-16) skipsatte `verify_citation_freshness` som MCP-metode på begge servere, og 358 fixture-celler ble sertifisert mot NHO Reiseliv MCP. Disse sertifiseringene refererer til en kilde som ikke eksisterer på nettet — de er strukturelt korrekte men source-sporet er feil. Phase 7c må re-sertifisere mot Lovdata.

ADR-0258 deklarerte K1a én-kilde-per-faktum som invariant. ADR-0258 routing-tabell assigner nhoreiseliv.no til Riksavtalen — men kilden eksisterer ikke. Invarianten er ikke brutt i kode; den er brutt i realitet. ADR-0347 justerer routing-tabellen til å matche virkeligheten.

## Decision Drivers

- **Juridisk kanonisk autoritet:** Lovdata er Norges offisielle juridiske database. Domstoler, Arbeidstilsynet, og Riksrevisjonen siterer Lovdata. Siteringer fra Lovdata bærer legal autoritet som nhoreiseliv.no ikke kan matche.
- **Live kilde verifisert:** HTTP 200 + strukturerte paragraf-URL-er bekreftet 2026-05-17 (`/dokument/TARO/tariff/taro-79/`).
- **K1a-ontologi-integritet:** Cascade-invarianten krever én kanonisk kilde per regulatorisk faktum. To "canonical" sources = ingen canonical source.
- **Bakover-kompatibilitet:** 358 celler allerede sertifisert mot nho-reiseliv MCP — dual-lineage nødvendig under overgangen; Phase 7c re-sertifiserer.
- **Kode-spor:** ZERO capability-consumers av `paragrafRef` i produksjon per code-trace (AI Architect council Phase 3, 2026-05-17). Schema-endring er ikke nødvendig; routing skjer på `FreshnessResult.source`-nivå.
- **Variant-scope-grense:** taro-79 (Fellesforbundet) vs taro-226 (Parat) er en D3 binding-beslutning per workspace. Deferred til separat ADR.

## Considered Options

1. **Option A — Behold NHO Reiseliv MCP som Riksavtalen primary (status quo).** NHO Reiseliv-URL fungerer antakelig men er midlertidig nede; eller vi bruker cached/fixture-data og ignorerer at live-fetching ikke fungerer. **Rejected:** Pre-flight probe er entydig — 62KB 404-side er ikke en transient nettverksfeil. Fixture-mode skjuler feilen i CI; production-mode vil feile. Phase 7 kan ikke lykkes med en kilde som ikke eksisterer.

2. **Option B — Lovdata MCP blir primary; NHO Reiseliv MCP depreceres umiddelbart.** Enklest routing-tabell. **Rejected:** NHO Reiseliv produserer innhold som ikke finnes på Lovdata — spesifikt lønnsoppgjør-sirkulær (årslig rate-justering pr. 2026-protokoll) og member-org fortolkninger. Uten dette innholdet kan vi ikke verifisere 42.41 kr/t kveldstillegg mot 2026-protokollen. Employer-interpretive kontekst er en reell K1a auxiliary — den skal ikke kastes bort, bare re-klassifisert.

3. **Option C (chosen) — Lovdata MCP blir Riksavtalen canonical via nytt `fetch_riksavtalen_paragraph` verktøy; NHO Reiseliv MCP re-purposes som employer-interpretive K1a auxiliary.** Routing-tabell amenderes. NHO Reiseliv MCP beholder sine verktøy men authority re-klassifiseres fra "canonical" til "interpretive auxiliary". Deprecated lineage i `FreshnessResult.source` håndteres transparent.

## Decision Outcome

Chosen option: **Option C — Lovdata MCP canonical for Riksavtalen, NHO Reiseliv MCP som employer-interpretive auxiliary.**

### MCP routing table (amends ADR-0258 Decision Outcome)

| Kilde / scope | MCP | Authority |
|---|---|---|
| Aml., ferielov, OTP, øvrig norsk lov | `lovsen-lovdata-mcp` | Canonical legal |
| **Riksavtalen tekst (NEW per ADR-0347)** | **`lovsen-lovdata-mcp`** | **Canonical legal** |
| Mattilsynet | `lovsen-mattilsynet-mcp` | Canonical legal |
| Arbeidstilsynet | `lovsen-arbeidstilsynet-mcp` | Canonical legal |
| NHO Reiseliv lønnsoppgjør sirkulær + member guidance | `lovsen-nho-reiseliv-mcp` | Employer-interpretive K1a auxiliary |

**TARO namespace for Lovdata Riksavtalen-oppslag:**

| Avtale | TARO ID | Part (LO-siden) |
|---|---|---|
| Riksavtalen (Fellesforbundet) | taro-79 | Fellesforbundet |
| Riksavtalen (Parat) | taro-226 | Parat |

Default workspace-binding er taro-79 (Fellesforbundet) inntil ADR om D3 variant-scope.

### Nytt verktøy: `fetch_riksavtalen_paragraph`

```typescript
// services/lovsen-lovdata-mcp/ — Phase 7b
async function fetch_riksavtalen_paragraph(
  taro_id: string,        // e.g. "taro-79"
  paragraph: string,      // e.g. "§4-3" or "KAPITTEL_4"
  version?: string,       // ISO date — if omitted, current version
  ledd?: number           // optional sub-paragraph number
): Promise<ParagraphResult>
```

URL-mønster: `https://lovdata.no/dokument/TARO/tariff/{taro_id}/{paragraph}`

### NHO Reiseliv MCP — deprecation timeline

- **Nå (ADR-0347 proposed):** Authority re-klassifisert. Verktøy beholdes uendret.
- **Phase 7b:** `verify_citation_freshness` på lovdata-mcp implementeres med `source: 'lovdata'` discriminator.
- **Phase 7c:** 358 nho-stemplede celler re-sertifiseres via lovdata-mcp. Dashboard rapporterer dual-lineage til 100% lovdata.
- **Post-Phase 7c:** NHO Reiseliv MCP beholdes som employer-interpretive auxiliary for lønnsoppgjør-kontekst. Ingen deprecation av selve MCP-en — kun av dens canonical-status.

## Rules & Consequences

- **Good, because** ontologi-fiksjonen elimineres — Lovdata er en ekte source med ekte HTTP 200-svar; phase 7 kan lykkes.
- **Good, because** legal autoritet er i tråd med domstolspraksis — siteringer fra Lovdata TARO er forsvarbare i revisjon og rettslige prosesser.
- **Good, because** employer-interpretive kontekst bevares — lønnsoppgjør-sirkulær og member-guidance fra NHO Reiseliv forblir tilgjengelig som K1a auxiliary; 42.41 kr/t verifisering er mulig via NHO-råkilden.
- **Bad, because** dual-lineage under overgangen — 358 celler med `source: 'nho-reiseliv'` må re-sertifiseres i Phase 7c; inntil da rapporterer dashboardet mixed provenance.
- **Bad, because** nytt TARO-path-kart nødvendig — `fetch_riksavtalen_paragraph` må knytte kapittel/paragraf-shortcodes til TARO URL-struktur (Phase 7b implementerings-detalj).
- **Agent Impact:** Capability-laget er uberørt — ZERO consumers av `paragrafRef` i produksjon per code-trace. Routing skjer i CI test runner (`pnpm test:golden-month` via ADR-0342 `source`-felt routing). Lovsen MCP-eierne implementerer `fetch_riksavtalen_paragraph` i Phase 7b. ADR-0342 `verify_citation_freshness` på lovdata-mcp implementeres med `source: 'lovdata'` discriminator i Phase 7b.

## Implementation gates

- **T1 — Live curl-proof:** `curl -sI https://lovdata.no/dokument/TARO/tariff/taro-79/§4-3` returnerer HTTP 200 + parseable HTML + paragraf-innhold. Output vedlagt ADR som kommentar ved Phase 7b accept.
- **T2 — Rate-verifisering (BLOCKER):** Lovsen verifiserer 42.41 kr/t kveldstillegg mot NHO Reiseliv lønnsoppgjør 2026-protokoll. Kan ikke re-sertifisere fixture-celler uten at denne raten er bekreftet av employer-interpretive auxiliary. Trust-gate blocker for Phase 7c.
- **T3 — Lovdata-mcp envvar-kanonisering replay:** `LOVSEN_FIXTURE_MODE` + `LOVSEN_MCP_FIXTURE` backwards-compat per ADR-0258. Samme mønster som ADR-0342 T2 (allerede løst for NHO MCP); replayer for Riksavtalen-path i lovdata-mcp.
- **T4 — Nytt `fetch_riksavtalen_paragraph` verktøy (Phase 7b):** TARO path-tabell implementert. Input-validering: `taro_id` whitelist (`taro-79`, `taro-226`), `paragraph` format-validering (`§N-N` eller `KAPITTEL_N`). Fixture-mode returnerer deterministic paragraph-tekst.
- **T5 — `verify_citation_freshness` på lovdata-mcp (Phase 7b):** Mirror av ADR-0342 implementasjon, med `source: 'lovdata'` discriminator i `FreshnessResult`. 4-path pytest: (a) all-fresh, (b) mixed-stale, (c) fixture-mode, (d) unknown-hash → stale.
- **T6 — Re-sertifiser 358 nho-stemplede celler via lovdata-mcp (Phase 7c):** Dashboard rapporterer dual-lineage-fremgang. Phase 7c betraktes ferdig når 100% celler har `source: 'lovdata'` i `lovsenCitationHash`-envelopen. Avhenger av T2 (rate-verifisering løst).

## Open questions / PENDING

- **Rate-verifiserings-blocker (kritisk):** 42.41 kr/t kveldstillegg er ikke verifisert mot 2026 lønnsoppgjør-protokoll. Må løses via NHO Reiseliv auxiliary-MCP (lønnsoppgjør-sirkulær) FØR Phase 7c kan populere citation-envelopen med korrekte satser. Eskalert: separat task #63.
- **D3 variant-ADR (deferred):** Workspace-binding taro-79 (Fellesforbundet) vs taro-226 (Parat) er en D3 tariffbinding-beslutning. Separate workspace-typer (restaurant vs hotell vs bar) kan ha ulike variant-bindinger. Deferred til separat ADR.
- **ADR-0258 routing-tabell formal amendment:** ADR-0347 amends ADR-0258 §Decision Outcome routing-tabell. ADR-0258 filen selv skal oppdateres med amendment-note ved Phase 7b accept (ikke blokkerende for ADR-0347 proposed status).

## References

- **ADR-0256** — Lovsen Citation Contract (`Citation` type, `lovsen.citation.stale` event)
- **ADR-0258** — Lovsen MCP Boundary (4 stdio MCPs, `LOVSEN_FIXTURE_MODE`) — amends routing table
- **ADR-0341** — Calc-engine Test Oracle Provenance Contract (K1a context, oracle provenance)
- **ADR-0342** — Lovsen MCP freshness-verification tool (`verify_citation_freshness`) — amends: new `source: 'lovdata'` path on lovdata-mcp
- **ADR-0348** — Two-hash model (companion: supersedes ADR-0341 §H citation-hash model)
- **ADR-0349** — Paragraph-ref translation map (companion: TARO namespace mapping)
- **Council session 2026-05-17** — AI Architect + Lovsen + Payroll-engine council; Phase 7 Lovdata reframe. Synthesis: `docs/audits/2026-05-17-phase-7-lovdata-reframe-council.md`
- **Pre-flight HTTP probe 2026-05-17** — `nhoreiseliv.no/overenskomster/riksavtalen/*` → HTTP 404 (62KB); `lovdata.no/dokument/TARO/tariff/taro-79/` → HTTP 200

---

> Registered in `docs/decisions/0000-decision-log.md`. Amends ADR-0258 routing table + ADR-0342 source discriminator. Phase 7b/7c implementation gates.
