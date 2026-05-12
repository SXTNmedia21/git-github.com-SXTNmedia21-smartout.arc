# Beskrivelse — Constructive dismissal-risk

## Use case 1 — HIGH risk lønn-reduksjon

Pontus vil sette Annas timelønn fra 220 til 195 (kutt 11%). `classifyAmendment` returnerer MATERIAL + `constructive_dismissal_risk: true`.

Lovsen advarsel:
> **HØY RISIKO** — Lønn-reduksjon på 11% kan tolkes som vesentlig forringelse likestilt med oppsigelse.
>
> [HØY confidence — Aml. §14-6 i + Høyesterett-praksis]
>
> **Risk-faktorer:**
> - Lønn ned ≥10%
> - Ingen tariff-revisjon-grunn
> - Anna er ikke innenfor prøvetid
>
> **Anbefalt:**
> 1. Få Annas samtykke skriftlig før endring
> 2. Hvis Anna nekter: vurder formell oppsigelses-prosess med saklig grunn (§15-7) i stedet
> 3. Tilby alternativer: lik lønn med færre timer, eller bonus-justering
> 4. Konsulter advokat før commit
>
> *Hvis du går videre uten samtykke: Anna kan kreve endringen ugyldig + krever lik lønn videre, ELLER kreve sluttoppgjør pga ulovlig endring.*

## Use case 2 — MEDIUM risk departement-bytte

Pontus flytter Ole fra "Bistro" til "Café" (samme arbeidsgiver, samme lønn, samme stillingsprosent).

Lovsen:
> **MEDIUM RISIKO** — Departement-bytte uten samtykke.
>
> Ikke automatisk constructive dismissal hvis:
> - Lønn + stillingsprosent uendret ✅
> - Arbeidsoppgaver vesentlig like (begge servering)
> - Geografisk avstand rimelig (<30 min reise)
>
> **Anbefalt:**
> - Skriftlig varsel med 14-dagers betenkningstid
> - Dokumenter saklig grunn (omorganisering / kapasitet / etc.)
> - Forhandlings-rett iht. §17-3

## Use case 3 — LOW risk tariff-justering

Riksavtalen oppjusterer min-sats. Pontus følger automatisk + holder Annas lønn over ny min.

Lovsen:
> **LAV RISIKO** — Tariff-bundet justering hvor sats er holdt over min.
> - `field_is_workspace_default_aligned: true`
> - `tariff_revision_triggered: true`
>
> Standard amendment-flow med signering. Ingen særskilt eskalering.

## Hvorfor Lovsen er bra på dette

1. **Quantifiserer risiko** — ikke bare "vær forsiktig", men HIGH/MEDIUM/LOW med spesifikke faktorer
2. **Foreslår alternativer** — istedenfor "ikke gjør det", gir admin verktøy: samtykke / formell prosess / kompensasjon
3. **Konkludent atferd-detection** — flagger hvis ansatt har fortsatt etter endring (≥3 mnd) som potensiell aksept
4. **Skiller §15-7-prosess fra constructive dismissal** — hvis admin har saklig grunn, formell oppsigelses-prosess er trygg vei

## Phase 0c+ kobling

- Tier 3 skill `compliance-revisor` (ROADMAP) — månedlig audit av amendments for unhandled risks
- Integrasjon mot `change_proposal`-tabell for amendment-flow med ansatt-samtykke
- Test corpus: 10+ cases dekkende kombinasjoner av risk-faktorer
