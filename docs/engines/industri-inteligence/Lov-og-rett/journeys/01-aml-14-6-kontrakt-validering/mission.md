---
journey: 01
title: "§14-6 kontrakt-validering"
trigger: "Kontrakt går fra draft → sent. Admin trykker Send i dispatch-drawer."
mode: strict (blokkerer) | advisory (advarer)
capability: legal.validateAml146
adr: 0249, 0244
---

# Mission — §14-6 kontrakt-validering

**Mål:** Garantere at hver utgående arbeidsavtale oppfyller alle 16 statutory krav i Aml. §14-6 (post juli 2024-revisjon, EU-direktiv 2019/1152) FØR DocuSeal-dispatch.

**Hvorfor det betyr noe:** §14-6-mangler er rettsmangel ved tvist. Arbeidsgiver bærer bevisbyrden. Mangler kan medføre tilbakebetaling av lønn, oppreisning, og at midlertidig kontrakt blir fast.

**Hvem trigger:** Admin/owner som trykker Send i ContractDispatchDrawer. Pre-flight kall fra `/api/contracts/send` linje ~197 før framework_snapshot freezes.

**Output:**
- `pass: true/false`
- `errors[]` med `{letter, paragraph, field, message, fix_url}` per fail
- `warnings[]` for soft-checks (workspace_default-aligned avvik)
- `confidence: HØY/MEDIUM/LAV`
- Telemetry: `legal.aml_14_6.validated` til posthog + activity_trail + engine_event

**Postcondition (pass):** kontrakt godkjent for dispatch, framework_snapshot bygges, status flippes til ready_to_send.

**Postcondition (fail):** 422 til drawer med per-felt feilmeldinger og deep-link til editing-side.
