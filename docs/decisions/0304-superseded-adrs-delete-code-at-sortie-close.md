---
title: "Superseded ADRs MUST delete code by close of sortie"
id: ADR_0304
status: proposed
layer: decision
created: 2026-05-13
updated: 2026-05-13
module: governance
tags: [adr, governance, supersession]
---

# ADR-0304: Superseded ADRs MUST delete code by close of sortie

## Context and Problem Statement

ADR-0041 carried `superseded` status from Phase E (~2026-05) but legacy onboarding
scroll-wizard code remained importable on disk for ~2 weeks until the 2026-05-13
audit caught it (F-OB-10-01 CRITICAL, F-OB-10-04 HIGH). The supersession header
read "Verified by audit slice 10 (2026-05-02)" yet 26 files in the predecessor
tree were still on the file system, three of them carrying live ADR-0123
violations that would reactivate on any revival. This is the same shape as
ADR-0299 sister-table gap (cleanup-by-sortie-close fixed in ADR-0303).

Pattern observed across audits (see synthesis "Cleanup never lands when runtime
moves"): F-OB-10-01 onboarding files; F-JR-02 `UltravoxVoice` type still present
after Ultravox runtime removal; F-OB-04 Emma BFF orphan after Botsson move.
Runtime cutover lands, dead code stays, supersession status becomes fictional.

## Decision Drivers

- ADRs marked `superseded` must reflect real codebase state — otherwise the
  document graph lies and audit-integrity is broken
- Latent re-activation risk: any future agent or developer who revives a
  superseded module reactivates whatever security/compliance violations the
  predecessor carried (here: three ADR-0123 EF calls from browser)
- Audit cost: each audit cycle rediscovers the same predecessor-not-deleted
  pattern in a new slice (onboarding 2026-05-13; voice/Ultravox 2026-04;
  Emma BFF orphan multi-cycle)

## Considered Options

1. **Mandate code deletion in same sortie that marks ADR `superseded`** —
   The supersession PR cannot merge while predecessor files exist on disk.
   Auditor verifies in next audit run.
2. **Leave as convention; rely on next audit** — Status quo. Audit catches
   it eventually; sortie work amortizes the cleanup over weeks.
3. **Tombstone-without-delete: mark files `@deprecated` JSDoc + lint warn** —
   Keeps files importable for a deprecation window. Lower blast radius but
   preserves the latent-revival risk that motivated this ADR.

## Decision Outcome

Chosen option: **"Mandate code deletion in same sortie that marks ADR `superseded`"**,
because the alternative is exactly what produced F-OB-10-01 + F-OB-10-04
two weeks after ADR-0041 supersession. Tombstone-without-delete (Option 3)
keeps the import path live, which is the precise condition that allows
violations to reactivate.

## Rules & Consequences

- **Good, because** ADR document graph reflects real codebase state at all
  times — supersession is no longer a partial promise
- **Good, because** eliminates "claimed superseded, actually live" drift class
  observed in F-OB-10-01 (ADR-0041), F-JR-02 (Ultravox), and F-OB-04 (Emma BFF)
- **Good, because** removes latent re-activation risk for security/compliance
  violations carried by predecessor code (here: three ADR-0123 browser EF calls)
- **Bad, because** slightly more work per supersession — sortie author must
  produce a deletion map (delete-safe / keep-live / needs-migration) alongside
  the ADR text and a paired test sweep
- **Bad, because** large supersessions (e.g. cross-package runtime cutovers)
  may need to split into "supersede + tombstone" then "cleanup sortie" if the
  predecessor surface is too large for one sortie — exception allowed only
  when the supersession ADR explicitly schedules the cleanup sortie

- **Agent Impact:**
  - `start-feature` skill MAY warn when a feature touches a `superseded`-ADR
    surface that hasn't been deleted yet (signals open cleanup debt)
  - `close-feature.sh` script SHOULD block merge when the closing PR text or
    feature plan promotes an ADR to `superseded` but does not include a
    deletion map for the predecessor surface
  - `adr-contract-audit` skill MAY include "scan superseded ADRs for live
    predecessor code" as a slice 09 (coverage-gaps) sub-check
  - When marking an ADR `superseded`, the same sortie MUST land the deletion
    commit. Cross-sortie deletion is allowed only when the supersession ADR
    explicitly names the follow-up cleanup sortie and assigns an owner

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update
> the ADR table in `CLAUDE.md`.
