---
title: Four Parallel Permission Mechanisms Is An Ontology Drift Smell
id: LEARNING_0029
status: canonical
layer: learning
created: 2026-04-08
updated: 2026-04-08
tags: [cascade, ontology, permissions, engine, governance]
---

# Learning-0029: Four Parallel Permission Mechanisms Is An Ontology Drift Smell

## Context

Under brainstorm-sesjonen for compliance-drevet kontrakt-composition
(ADR-0076) foreslo en agent å legge til et `human_only: true` flag på
`engine_step` og `engine_state_step` for å garantere at enkelte steg (som
signering) ikke kunne fullføres av Botsson. Intensjonen var god — forhindre
at agent "mock-fullfører" signeringssteget.

Council session 2026-04-07 avviste forslaget etter Steward-review.

## Discovery

`human_only: true` som schema-flag ville vært det **fjerde** parallelle
permission-systemet på engine-nivå:

1. **C4 Authority** (`engine_authority_config`) — "hvem har lov til å utføre
   denne capability" (read_only / suggest / confirm / autonomous)
2. **`collect_signature` action_type** — "dette steget venter på DocuSeal
   webhook, kan ikke manuelt fullføres"
3. **(Foreslått) `engine_process.allowed_channels`** — "denne prosessen kan
   kun kjøre i bestemte session-kanaler" (voice vs chat osv.)
4. **(Avvist) `human_only: true` flag** — "dette steget kan ikke auto-
   fullføres av agent"

Fire parallelle mekanismer for permission-semantikk bryter Cascade invariant
#2 ("hver datum har én rolle"). Når to mekanismer overlapper, vet ikke
developer hvilken som er autoritativ, og edge cases faller mellom dem.

**Resolusjonen:** hver av de tre første mekanismene har et eget, ikke-
overlappende ansvar:

- **C4 Authority** = *hvem* har permission
- **`collect_signature` handler** = *hvordan* en spesifikk action fullføres
  (via ekstern webhook)
- **`allowed_channels`** = *hvor* (i hvilken modalitet) en prosess kan kjøre

"Må være menneske som fullfører" kan alltid uttrykkes via C4 authority —
ingen agent-capability har permission til å fullføre steget, så steget venter
på human input via `collect_signature`-mønsteret.

## Impact

**Regel:** Før en ny permission-flag/kolonne legges til engine-systemet,
enumerer alle eksisterende mekanismer i samme concern-område. Hvis den nye
flaggen kan uttrykkes via kombinasjoner av eksisterende mekanismer, skal den
**ikke** legges til.

**Eksempel på anvendelse:**
- "Må være admin for å starte" → C4 authority på capability
- "Må fullføres via ekstern system" → bruk eller opprett en action_type
  handler som venter på den eksterne eventen (som `collect_signature`)
- "Kan ikke kjøres i voice" → `engine_process.allowed_channels`
- "Må være human, ikke agent" → C4 authority (ingen agent-capability har
  permission)

**Pattern:** Når council foreslår en ny permission-flag, Steward skal alltid
spørre "hvilken eksisterende mekanisme uttrykker allerede dette?" før
godkjenning.

## References

- ADR-0076 (Contract Composition as Cascade Derivation) — composition-
  designet som utløste denne innsikten
- ADR-0078 (Engine Process Channel Restriction) — der `allowed_channels`
  ble akseptert som legitimt, separate concern
- Council session 2026-04-07 (Contract Composition Engine)
- Cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
  — invariant #2
