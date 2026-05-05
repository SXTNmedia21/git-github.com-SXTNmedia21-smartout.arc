# Roadmap — Lovsen

## Smartout-integrasjon (Phase 0c, 2026-04-30)

`legal` capability shipped as stub i Smartout monorepo per ADR-0249:

- `packages/ai/src/capabilities/legal/` — capability registreret som 5. sibling (ADR-0173 amendment)
  - `tools.ts` — stub `validateAml146`, `citeLaw`, `classifyAmendment` (returnerer `pass=true` alltid)
  - `index.ts` — `legalCapability: CapabilityDefinition` med `defaultAuthority="read_only"`
- `apps/web/src/app/api/contracts/send/route.ts` — Lovsen-gate kalt før dispatch (Phase 0c stub-mode = passthrough)
- `packages/telemetry/src/registry.ts` — 3 events registrert: `legal.aml_14_6.validated`, `legal.law_cited`, `legal.amendment_classified`
- `docs/architecture/contract-service/JOURNEY-contract-module.md` — Journey 2 step 4 oppdatert med §14-6-gate
- `docs/decisions/0249-legal-capability-fifth-sibling.md` — ADR ratifying capability count amendment

**Stub-tilstand:** alle validator-bodies returnerer `pass=true`. Real Lovdata MCP-integrasjon er framtidig arbeid (se under).

---

## v0.1.0 (lovsen-plugin spec — nå)

Tier 1+2 levert som spec:

- Agent-definisjon
- 6 skills (aml-14-6-validator, amendment-classifier, riksavtalen-lookup, contract-drafter, overtid-evaluator, tipsregel-rådgiver)
- 5 commands
- 4 MCP-servere (Lovdata, Mattilsynet, Arbeidstilsynet, NHO Reiseliv)
- Knowledge base seed
- 15-cases test-corpus

## v0.2.0 — Tier 3 skills

| Skill | Hva den gjør |
|---|---|
| `prøvetid-tracker` | Aml. §15-6 inkl. pause ved sykefravær |
| `a-melding-validator` | Sjekk at koder og data er rapport-klare |
| `oppsigelse-veileder` | Aml. §15-7 saklig grunn-vurdering, prosessuell sjekkliste |
| `feriepenger-kalkulator` | Ferielov-beregning, sluttoppgjør, 12%/14.3% |
| `compliance-revisor` | Workspace-audit på alle kontrakter |

## v0.3.0 — Skatteetaten-integrasjon

Ny MCP-server for skattekort-pull. Krever sertifisering — eier-utpeking før utvikling starter.

- `skatteetaten` MCP-server
- `skattekort-pull` skill
- A-melding-rapportering (utkast)

## v0.4.0 — Lærling og spesielle ansettelsesformer

- Opplæringsloven kap. 4 i kunnskapsbase
- `lærling-validator` skill
- Frilans/oppdragsavtale (egen agent eller utvidet scope?)

## v1.0.0 — Stable

- Test-corpus 50+ cases
- Citation-validator full coverage
- Audit-log immutable storage
- 5 års retensjon implementert
- Versjonert lov-snapshot for historisk lookup
- Multi-workspace tariff-mapping

## Vedlikeholds-rytme

- **Hver gang Aml. revideres** — refresh kunnskapsbase + kjør test-corpus
- **Når Riksavtalen reforhandles** (typisk hvert 2. år) — ny tariff-versjon i NHO Reiseliv MCP
- **Årlig januar** — refresh skattetabeller hvis Skatteetaten-MCP er aktiv
- **Kvartalsvis** — review test-corpus, legg til nye cases fra reelle hendelser

## Åpne spørsmål for framtid

- Hvordan håndtere ansatte med tilknytning til flere workspaces (konsern)?
- Skal Lovsen kunne kommunisere direkte med ansatt, eller alltid via Botsson?
- Lov-versjons-bevisst lookup: hvordan lagres "Aml. slik den var i mars 2024" effektivt?
- Integration med advokat-tjeneste (Codex/Lexolve) for automatisk eskalering ved LAV confidence?
