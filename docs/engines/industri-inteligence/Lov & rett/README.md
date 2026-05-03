---
title: "Lov & rett — Norsk arbeidsrett-engine for I1 industri-intelligence"
status: draft
updated: 2026-04-30
created: 2026-04-30
module: industri-intelligence
tags: [i1, lovsen, arbeidsrett, hospitality, legal]
---

# Lov & rett — Norsk arbeidsrett-engine

Sub-engine under **I1 Industry Intelligence Bootstrap** som leverer arbeidsrett-kunnskap til Smartout-platformen. Dekker norsk arbeidsrett, kontraktsrett, lønnsrammeverk og hospitality-spesifikk regulering.

## Struktur

```
Lov & rett/
├── README.md                 ← this file
├── agents/
│   ├── lovsen-agent/         ← Lovsen agent-spec (canonical)
│   │   ├── lovsen.md         ← agent-definisjon (system prompt + persona)
│   │   ├── SKILL.AML.md      ← aml-14-6-validator spec
│   │   ├── SKILL.CLASSIFYER.md ← amendment-classifier spec
│   │   ├── checklist.md      ← Aml. §14-6 detaljert per bokstav (a–p)
│   │   ├── ROADMAP.md        ← Tier 1+2 → Tier 3 → v1.0.0
│   │   ├── README.md
│   │   └── plugin.json
│   ├── framework/            ← UI/agent-arkitektur (delt med andre engines)
│   ├── frontend-design/      ← (delt — bør flyttes til engine-agnostic plassering)
│   ├── mobile-design/        ← (delt — bør flyttes til engine-agnostic plassering)
│   ├── LISE_DASHBOARD_GUIDE.md
│   └── SHARED_DESIGN_PRINCIPLES.md
└── (future)
    ├── lovdata-snapshots/    ← Cached lov-tekster per versjon
    ├── riksavtalen/          ← Tariff-versjoner per gyldig fra-dato
    └── seeds/                ← K1a regulatory_framework + framework_rule + tariff_rate_table seed-data
```

## Hvor dette engine'et lever i kode-base

| Lag | Lokasjon | Status |
|---|---|---|
| Capability runtime | `packages/ai/src/capabilities/legal/` | 🟡 Phase 0c stub (validator-bodies returnerer `pass=true`) |
| Send-route hook | `apps/web/src/app/api/contracts/send/route.ts:~197` | 🟢 wired (calls `validateAml146.execute()`) |
| Sub-agent definisjon | `.claude/agents/lovsen.md` | 🟢 registrert (sonnet, indigo) |
| Telemetry events | `packages/telemetry/src/registry.ts` | 🟢 3 events: `legal.aml_14_6.validated`, `legal.law_cited`, `legal.amendment_classified` |
| Capability spec | `docs/architecture/contract-service/CAPABILITY-legal.md` | 🟢 |
| K1a seed | `regulatory_framework` + `framework_rule` rader | 🔴 Phase 0c+ |
| Lovdata MCP integrasjon | live paragraph-fetch | 🔴 Phase 0c+ |
| Test corpus | `packages/ai/src/capabilities/legal/__tests__/test-corpus/` | 🔴 Phase 0c+ |

## Domener Lovsen dekker

1. **Arbeidsmiljøloven** (Aml.) — §10 arbeidstid, §14-6 kontrakt-krav (16 bokstaver a–p), §15 oppsigelse
2. **Ferieloven** — feriepenger 10.20–14.30%, 6. ferieuke
3. **Folketrygdloven** — relevante deler (sykepenger, omsorgspenger)
4. **A-meldingforskriften** — rapport-krav, koder
5. **Skattetrekkforskriften** — tabell-trekk, prosent-trekk, frikort
6. **OTP-loven** — pensjon-minimum, opptjening
7. **Bokføringsloven §13** — oppbevaring av lønns-dokumentasjon
8. **Riksavtalen** (LO–NHO Reiseliv) — hospitality-tariff
9. **Hovedavtalen** (LO–NHO) — fagforeningsforhold
10. **Mattilsynet-regulering** — alkohol, allergener, hygiene
11. **Arbeidstilsynet-veiledning** — HMS, vakt-rutiner

## Confidence-policy

Hver påstand merkes:
- **HØY** — direkte sitat fra lov/forskrift/Riksavtalen, hentet fra MCP eller verifisert kilde
- **MEDIUM** — tolkning av lov-tekst eller bransje-praksis
- **LAV** — gråsone som krever advokat-vurdering

LAV + juridisk konsekvens (oppsigelse/lønnstrekk/prøvetid-utvidelse) = automatisk eskalering til ekte advokat.

## Kobling til Smartout cascade

Lovsen er **K1a Industry Knowledge Base** sibling — platform-eid, delt på tvers av workspaces innenfor hospitality-vertikalen. Workspace-spesifikke overrides (compliance_overrides på employment_contract) lever på K1b. Per ADR-0244 frosner kontrakter ved send via `framework_snapshot` — historisk validering bruker snapshot, nåtidig bruker live-versjon.

## Phase 0c+ TODO (canonical kilde for follow-ups)

Per ADR-0249:
1. Authority seed migration `<timestamp>_legal_capability_authority_seed.sql` — `engine_authority_config` rad for `legal` capability
2. K1a seed — `regulatory_framework` + `framework_rule` + `tariff_rate_table` rader for Aml. §14-6 + 8 andre norske lover
3. Real `validateAml146` validator-body via Lovdata MCP
4. Real `classifyAmendment` body — `field_classification_metadata` lookup + constructive-dismissal-risk per ADR-0236
5. 15-cases test corpus i `__tests__/test-corpus/`
6. MCP-server-implementasjon for `lovdata`, `mattilsynet`, `arbeidstilsynet`, `nho-reiseliv`

## Relaterte ADRer

- **ADR-0078** — channel-restriksjoner (PII voice-forbud)
- **ADR-0173** — frozen-4 capability-navn (`journey.*`-namespace, ikke global registry)
- **ADR-0220** — Botsson som conversational front door, Lovsen som output-branding
- **ADR-0234** — capability split (contract / payroll / legal)
- **ADR-0235** — obligation lifecycle, MATERIAL/ADMIN/DERIVED/SYSTEM/BLOCKED
- **ADR-0236** — amendment flow, constructive-dismissal-risk
- **ADR-0244** — framework_snapshot freeze ved send
- **ADR-0249** — `legal` som femte sibling capability

## Versjon

**lovsen-v0.2.0** — Smartout Phase 0c-stub levert 2026-04-30. Real validator-body er Phase 0c+ work.
