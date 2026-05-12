---
title: "Lovsen — Kontrakt-oppsett & kontroll-skill"
status: draft
updated: 2026-04-30
created: 2026-04-30
module: legal
tags: [lovsen, contract-setup, compliance, hospitality, k1a]
---

# Lovsen Skill — Kontrakt-oppsett & kontroll for bedriften

> Hel-bundlet kompetanse for å sette opp kontrakter og kontrollere kontraktsfesting i hospitality-bedrifter, fra workspace-init til månedlig compliance-audit.

## Hvem dette gjelder

Hospitality-arbeidsgivere (restaurant, bar, hotell, catering) i Norge som trenger:
- Lovlig kontrakt-mal-oppsett iht. Aml. §14-6 (16 bokstaver, post juli 2024-revisjon)
- Pålitelig amendment-håndtering uten å havne i constructive dismissal-feller
- Tariff-binding mot Riksavtalen + automatisk lønn-validering
- A-melding-readiness før innsending
- Sykefravær-frister + tidslinjer

## De 10 kjerne-journeyene

| # | Journey | Trigger | Mode |
|---|---------|---------|------|
| 01 | [§14-6 kontrakt-validering](./01-§14-6-kontrakt-validering/) | Send kontrakt | Strict gate |
| 02 | [Prøvetid-oppsigelse](./02-prøvetid-oppsigelse/) | Admin vurderer oppsigelse | Advisory |
| 03 | [Amendment-klassifisering](./03-amendment-klassifisering/) | Felt-endring på kontrakt | Pre-commit gate |
| 04 | [Feriepenger-kalkulator](./04-feriepenger-kalkulator/) | Payroll / sluttoppgjør | Advisory + commit |
| 05 | [Riksavtalen tariff-oppslag](./05-riksavtalen-tariff-oppslag/) | Lønnsoppgjør / compliance | Read-only |
| 06 | [Overtid-evaluering](./06-overtid-evaluering/) | Shift-cost / schedule | Read-only |
| 07 | [Tipsregel-fordeling](./07-tipsregel-fordeling/) | Workspace-setup / månedlig | Setup + commit |
| 08 | [A-melding validator](./08-a-melding-validator/) | Månedlig rapport | Pre-submit gate |
| 09 | [Sykefravær-håndtering](./09-sykefravær-håndtering/) | Ansatt registrer fravær | Workflow guidance |
| 10 | [Constructive dismissal-risk](./10-constructive-dismissal-risk/) | Vesentlig endring i vilkår | Pre-commit warning |

## Skill-struktur per journey

Hver journey har 3 filer:
- `mission.md` — hva, hvorfor, trigger, output, postcondition
- `checklist.md` — per-felt validation-regler med lov-referanser
- `description.md` — use cases, why-bra, edge cases, Phase 0c+ kobling

## Bruks-mønster — workspace-onboarding

Når en ny restaurant onboard'er Smartout, kjører Lovsen denne sekvensen:

```
1. Workspace setup
   ├── Bind til Riksavtalen via workspace_framework_binding
   ├── Setup contract_template per stilling (servitør, kokk, bartender, etc.)
   ├── Konfigurer contract_tip_rule (fordelings-metode) → Journey 07
   └── Verifiser tariff-binding mot K1a → Journey 05

2. Per ansatt onboard
   ├── Fyll Ansettelse-skjema med §14-6-felt → Journey 01 sjekker
   ├── Konfigurer payroll-profil (skatt, OTP, feriepenger %) 
   ├── Send kontrakt → Journey 01 strict gate
   └── Walt-mottakerrom rendrer for ansatt-signering

3. Månedlig drift
   ├── Payroll → Journey 04 feriepenger-påløp + Journey 07 tips-fordeling
   ├── Overtid auto-eval → Journey 06
   ├── A-melding → Journey 08 pre-submit
   └── Sykefravær → Journey 09 frister + tidslinjer

4. Endringer
   ├── Lønn / stilling / arbeidstid → Journey 03 klassifisering
   ├── HIGH-risk → Journey 10 constructive dismissal-warning
   └── Prøvetid-utløp / oppsigelse → Journey 02
```

## Bindinger til Smartout-kode

| Komponent | Lokasjon | Status |
|-----------|----------|--------|
| Capability runtime | `packages/ai/src/capabilities/legal/` | 🟡 Phase 0c stub |
| Send-route gate | `apps/web/src/app/api/contracts/send/route.ts:~197` | 🟢 wired |
| Sub-agent | `.claude/agents/lovsen.md` | 🟢 registrert |
| Telemetry events | `packages/telemetry/src/registry.ts` | 🟢 3 events |
| Contracts capability | `packages/ai/src/capabilities/contract/` | 🟢 (sibling per ADR-0234) |
| Payroll capability | `packages/ai/src/capabilities/payroll/` | 🟢 (sibling) |

## Lov-domener Lovsen dekker

1. **Arbeidsmiljøloven** — §10 arbeidstid, §14-6 kontrakt, §15 oppsigelse
2. **Ferieloven** — §10 sats, §11 sluttoppgjør
3. **Folketrygdloven** — kap. 8 sykepenger
4. **A-meldingforskriften** — koder + frister
5. **Skattetrekkforskriften** — tabell vs prosent
6. **OTP-loven** — pensjon-minimum
7. **Bokføringsloven §13** — oppbevaring lønns-doc
8. **Riksavtalen** (LO–NHO Reiseliv) — hospitality-tariff
9. **Hovedavtalen** (LO–NHO) — fagforening
10. **Mattilsynet-regulering** — alkohol, allergener, hygiene
11. **Arbeidstilsynet-veiledning** — HMS

## Confidence-policy

Hver påstand merkes:
- **HØY** — direkte sitat fra lov/forskrift/Riksavtalen, hentet via MCP
- **MEDIUM** — tolkning av lov-tekst eller bransje-praksis
- **LAV** — gråsone som krever advokat-vurdering

LAV + juridisk konsekvens (oppsigelse/lønnstrekk/prøvetid) = automatisk eskalering til ekte advokat.

## Channel-restriksjoner (ADR-0078 Layer 3)

| Tool | Chat | Voice | System |
|------|------|-------|--------|
| `validateAml146` | ✅ | ❌ (PII) | ✅ |
| `citeLaw` | ✅ | ✅ | ✅ |
| `classifyAmendment` | ❌ (admin-only) | ✅ | ✅ |

## Phase 0c+ TODO (canonical kilde for follow-ups)

Per ADR-0249:
1. Authority seed migration — `engine_authority_config` rad for `legal` capability
2. K1a seed — `regulatory_framework` + `framework_rule` + `tariff_rate_table` rader for Aml. §14-6 + 8 norske lover
3. Real `validateAml146` validator-body via Lovdata MCP
4. Real `classifyAmendment` body — `field_classification_metadata` lookup + constructive-dismissal-risk per ADR-0236
5. 15-cases test corpus i `packages/ai/src/capabilities/legal/__tests__/test-corpus/`
6. MCP-server-implementasjon for `lovdata`, `mattilsynet`, `arbeidstilsynet`, `nho-reiseliv`
7. Phase 0c.1 dataseed — Aml. §14-6 lov-tekst + Riksavtalen 2026-04 snapshot

## Relaterte ADRer

- **ADR-0078** — channel-restriksjoner (PII voice-forbud)
- **ADR-0173** — frozen-4 capability-navn (`journey.*`-namespace)
- **ADR-0220** — Botsson som conversational front door
- **ADR-0234** — capability split (contract / payroll / legal)
- **ADR-0235** — obligation lifecycle, MATERIAL/ADMIN/DERIVED/SYSTEM/BLOCKED
- **ADR-0236** — amendment flow, constructive-dismissal-risk
- **ADR-0244** — framework_snapshot freeze ved send
- **ADR-0249** — `legal` som femte sibling capability

## Versjon

**lovsen-skill-v0.1.0** — 10 journeys spec'et 2026-04-30. Capability runtime er Phase 0c stub. Ekte validator-bodies er Phase 0c+ work.
