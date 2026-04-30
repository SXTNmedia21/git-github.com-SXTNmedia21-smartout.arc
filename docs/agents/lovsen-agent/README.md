# Lovsen — Norsk arbeidsrett og hospitality-rådgiver

> En spesialisert Cowork-agent som dekker norsk arbeidsrett, kontraktsrett, lønnsrammeverk og hospitality-spesifikk regulering. Bygger på live-oppslag mot Lovdata, Mattilsynet, Arbeidstilsynet og NHO Reiseliv.

**Versjon:** 0.1.0
**Plattform:** Cowork
**Bransje:** Hospitality (restaurant, bar, hotell, catering)
**Jurisdiksjon:** Norge

---

## Hva Lovsen gjør

Lovsen er et medlem av Hospitality Intelligence-teamet. Han svarer på, validerer og klassifiserer i fire domener:

1. **Arbeidsrett** — Aml., ferielov, OTP-lov, folketrygdlov
2. **Kontrakt** — §14-6-validering, amendment-klassifisering, kontrakts-utkast
3. **Lønnsrammeverk** — A-melding, skattetrekkforskrift, overtid, tipsregler
4. **Hospitality-praksis** — Riksavtalen, alkoholservering-regulering, allergener (Mattilsynet), HMS (Arbeidstilsynet)

Han henter alltid kilde live og siterer paragraf eksplisitt. Confidence-merket (HØY/MEDIUM/LAV). Eskalerer til ekte advokat ved tvist.

---

## Arkitektur

```
lovsen/
├── .claude-plugin/
│   └── plugin.json              # Manifest
├── agents/
│   └── lovsen.md                # Agent-definisjon (system prompt + persona)
├── commands/
│   ├── spør-lovsen.md           # Generelt spørsmål til Lovsen
│   ├── valider-kontrakt.md      # Kjør §14-6-validator
│   ├── klassifiser-endring.md   # Kjør amendment-classifier
│   ├── sla-opp.md               # Slå opp paragraf eller tariff
│   └── compliance-sjekk.md      # Workspace-audit
├── skills/
│   ├── aml-14-6-validator/      # Tier 1
│   ├── amendment-classifier/    # Tier 1
│   ├── riksavtalen-lookup/      # Tier 2
│   ├── contract-drafter/        # Tier 2
│   ├── overtid-evaluator/       # Tier 2
│   └── tipsregel-rådgiver/      # Tier 2
├── mcp-servers/
│   ├── lovdata/                 # Lovdata.no — lover, forskrifter
│   ├── mattilsynet/             # Mattilsynet.no — mat-regulering
│   ├── arbeidstilsynet/         # Arbeidstilsynet.no — HMS, tilsyn
│   └── nho-reiseliv/            # NHO Reiseliv — Riksavtalen
├── knowledge/
│   ├── laws/                    # Cached lov-tekster (snapshot)
│   ├── collective-agreements/   # Riksavtalen-oversikt
│   └── internal/                # Test-corpus, klassifisering
├── .mcp.json                    # MCP-server-konfigurasjon
├── README.md                    # Denne filen
└── ROADMAP.md                   # Tier 3 og fremtidig arbeid
```

### Hvorfor MCP-servere

Lover og tariffer endres. Statisk kunnskap blir foreldet. Lovsen bruker derfor live-oppslag som primærkilde, med cached snapshot som backup.

| MCP-server | Kilde | Tools |
|---|---|---|
| `lovdata` | lovdata.no | `fetch_paragraph`, `search_law`, `get_law_metadata` |
| `mattilsynet` | mattilsynet.no | `search_regulation`, `fetch_guidance`, `lookup_food_safety_requirement` |
| `arbeidstilsynet` | arbeidstilsynet.no | `search_guidance`, `fetch_workplace_assessment_template` |
| `nho-reiseliv` | nhoreiseliv.no | `fetch_riksavtalen`, `lookup_tariff_supplement` |

Alle servere har:
- Caching (respekterer kilde-sider, default 24h TTL)
- Citation-validator (returnerer URL + hentet-tidspunkt for audit-trail)
- Versjon-bevisst lookup (kan be om historisk versjon)
- Rate limiting (maks 1 req/sek per kilde)

---

## Installasjon

### Forutsetninger

- Cowork desktop app
- Python 3.10+ for MCP-servere
- Avhengigheter: `pip install -r mcp-servers/<server>/requirements.txt`

### Steg

1. Last ned `lovsen.plugin`-fila
2. Åpne i Cowork — du får en preview med "Install"-knapp
3. Etter install: kjør `claude plugin validate` for å bekrefte
4. Test med `/spør-lovsen "hva er prøvetid-lengden i hospitality?"`

### Konfigurasjon

`.mcp.json` antar at Python er på PATH. For workspace-spesifikke env-variabler (Tripletex, Skatteetaten):

```bash
# .env
LOVDATA_USER_AGENT="Smartout-Lovsen/0.1 (kontakt@smartout.no)"
MATTILSYNET_API_TIMEOUT=30
NHO_RIKSAVTALEN_VERSION=2024
```

---

## Bruksområder

### Som admin

```
/valider-kontrakt <contract_id>
→ §14-6-sjekk + mangler-liste
```

```
/klassifiser-endring monthly_salary 32000 34000
→ MATERIAL — krever amendment med ansatt-signering
```

```
/sla-opp aml 15-7
→ Henter §15-7 fra Lovdata, summerer hvilke krav til saklig grunn som gjelder
```

### Som ansatt (via Botsson)

Botsson eskalerer arbeidsrett-spørsmål til Lovsen automatisk. Eksempel:

> Ansatt: "Kan jeg si nei til søndagsvakt?"
>
> Botsson → Lovsen: arbeidsrett-spørsmål om søndagsarbeid
> Lovsen henter: Aml. §10-10 + Riksavtalen §6
> Svarer: "Nei — søndagsarbeid er tillatt i hospitality iht. Aml. §10-10 andre ledd og Riksavtalen §6.1, men du har rett til 50% kveldstillegg... [HØY confidence]"

### Som compliance-runner

```
/compliance-sjekk workspace=strom-mat-bar
→ Auditerer alle kontrakter mot:
   - §14-6-fullstendighet
   - Pension-scheme valid (OTP min 2.0%)
   - Tariff-binding korrekt
   - Outstanding obligations som er overdue
   - A-melding-kompatibilitet
```

---

## Skills-oversikt

| Skill | Tier | Når brukes |
|---|---|---|
| `aml-14-6-validator` | 1 | Kontrakt går draft → pending_signature |
| `amendment-classifier` | 1 | Admin redigerer felt på kontrakt |
| `riksavtalen-lookup` | 2 | Tariff-spørsmål, satser, hospitality-regulering |
| `contract-drafter` | 2 | Generér kontrakts-tekst fra strukturert data |
| `overtid-evaluator` | 2 | Aml. §10-6-status (10/25/200 + utvidelser) |
| `tipsregel-rådgiver` | 2 | Bygg contract_tip_rule iht. Riksavtalen + skatt |

Tier 3 (kommende — se [ROADMAP.md](./ROADMAP.md)):
`prøvetid-tracker`, `a-melding-validator`, `oppsigelse-veileder`, `feriepenger-kalkulator`, `compliance-revisor`.

---

## Operasjonelle prinsipper

1. **Kilde-disiplin.** Hver påstand har paragraf-referanse + URL hvis ekstern.
2. **Citation-validator.** Sjekker at sitert paragraf eksisterer før svar leveres.
3. **Confidence-merking.** HØY/MEDIUM/LAV — ingen pseudo-presisjon.
4. **Disclaimer ved juridisk konsekvens.** Oppsigelse, lønnstrekk, prøvetid-utvidelse → eksplisitt eskaleringsråd.
5. **Versjons-bevissthet.** "Hva gjaldt før juli 2024?" returnerer historisk Aml.-versjon.
6. **Null hallusinasjon på paragraf-numre.** Hvis ikke i kunnskapsbase + ikke fra MCP: si "usikker".

---

## Risiko og mitigasjon

| Risiko | Mitigasjon |
|---|---|
| Hallusinerte paragrafer | Citation-validator blokkerer svar uten verifisert kilde |
| Foreldet kunnskap | MCP-servere henter live; cached snapshot kun fallback |
| Juridisk ansvar | Disclaimer + eskalerings-link til workspace-konfigurert advokat |
| Lovdata rate-limit | Rate limiter + 24h cache per paragraf |
| Tariff-versjon-forveksling | Versjon kreves i hver Riksavtalen-referanse |

---

## Test og kvalitetssikring

`knowledge/internal/test-corpus.md` har 15+ reelle hospitality-saker som regression-test. Kjøres ved:
- Hver release av plugin
- Knowledge base-refresh (når lov endres)
- Endring i skill-prompt

---

## Bidragsytere

- Pontus Lindroth (eier)
- Smartout Hospitality Intelligence-team

## Lisens

Proprietary — internt bruk i Smartout.

## Kontakt

For tariff-tolkning utenfor scope: kontakt advokat eller NHO Reiseliv juridisk avdeling.
