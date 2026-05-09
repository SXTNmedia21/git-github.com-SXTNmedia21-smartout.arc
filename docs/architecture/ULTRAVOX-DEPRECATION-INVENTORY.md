---
title: Ultravox Deprecation Inventory — Pre-E6 Classification
status: in_progress
created: 2026-05-09
updated: 2026-05-09
module: governance
tags: [ultravox, deprecation, inventory, voice-plane, ADR-0282]
adr: [ADR-0282, ADR-0276]
---

# Ultravox Deprecation Inventory

> Generated 2026-05-09. Pre-E6 (Ultravox code deletion) snapshot. Classify files before stripping references.
> Reuses cascade-legacy-usage-inventory.md schema (ADR-0128/0144 deprecation-lifecycle precedent).
> Per council 2026-05-08 Hard Rules: ADRs / learnings / audits are PRESERVE-unconditional.

**Stats:** 745 lines across ~140 files (excludes `docs/archive/`, `docs/research/`).

## Bucket Legend

| Bucket | Action | Timing |
|---|---|---|
| **A — prose-glossary** | Strip + history-section after E6 | Post-E6 Phase 4 |
| **B — capability/table rows** | Update tables to reflect post-E6 state | Post-E6 Phase 5 |
| **C — dead-code doc-refs** | Remove refs to already-deleted files | Post-E6 Phase 4 |
| **D — code-comments quoted** | Replace with LiveKit equivalents | Post-E6 Phase 4 |
| **E — single-line cutover-anchors** | Banner-only / audit-anchor treatment | No change needed |
| **PRESERVE** | Keep unchanged — audit trail / ADR / learning | Never touch |

## PRESERVE Rules (unconditional)

Per council Hard Rule 1 + ADR-0282 provenance:

- All ADR files (incl. ADR-0135 original Ultravox decision) — audit trail
- All learnings referencing Ultravox — historic lessons
- All audits in `docs/audits/` — frozen evidence
- `docs/audits/2026-05-08-botsson-harness-audit.md` — canonical pre-deletion state
- `docs/decisions/0282-voice-plane-consolidation-livekit-only.md` — the cutover ADR
- Plans in `docs/superpowers/plans/completed/` — completed work, immutable
- Plans still in `docs/superpowers/plans/` containing voice-plane design rationale

## Classification Table

| file_path | bucket | approx_lines | current_status | target_status | cutover_phase |
|---|---|---|---|---|---|
| `docs/architecture/BOTSSON-SYSTEM-MAP.md` | A | ~10 | active | strip-after-E6 | Phase 4 |
| `docs/architecture/HARNESS-ARCHITECTURE.md` | A | ~30 | active | strip-after-E6 | Phase 4 |
| `docs/architecture/STAGE-ENGINE.md` | A | ~5 | active | strip-after-E6 | Phase 4 |
| `docs/architecture/modules/MODULE_BOTSSON.md` | A | ~15 | active | strip-after-E6 | Phase 4 |
| `docs/architecture/modules/SMARTOUT_MODULE_12_AI.md` | A | ~5 | active | strip-after-E6 | Phase 4 |
| `docs/architecture/modules/SMARTOUT_MODULE_18_WEBRTC.md` | A | ~20 | active | strip-after-E6 | Phase 4 |
| `docs/architecture/modules/SMARTOUT_MODULE_9_COMMUNICATION.md` | A | ~5 | active | strip-after-E6 | Phase 4 |
| `docs/architecture/progressive-intelligence-protocol.md` | A | ~5 | active | strip-after-E6 | Phase 4 |
| `docs/STATE-SUMMARY.md` | A | ~10 | active | strip-after-E6 | Phase 5 |
| `docs/plans/CAMPAIGN-botsson-arena.md` | A | ~20 | active | strip-after-E6 | Phase 5 |
| `docs/plans/ROADMAP-ai-harness.md` | B | ~10 | active | mark-removed | Phase 5 |
| `docs/INDEX.md` | B | ~5 | active | update-tables | Phase 3 |
| `docs/architecture/modules/MODULE_0_ROADMAP.md` | B | ~5 | active | update-tables | Phase 4 |
| `docs/reference/PACKAGES.md` | B | ~5 | active | update-tables | Phase 4 |
| `docs/reference/SERVICES_ARCHITECTURE.md` | B | ~5 | active | update-tables | Phase 4 |
| `docs/reference/API_ENDPOINT_REFERENCE.md` | C | ~5 | stale-ref | remove-ref | Phase 4 |
| `docs/reference/API_INVENTORY_AND_COVERAGE.md` | C | ~5 | stale-ref | remove-ref | Phase 4 |
| `docs/reference/API_ROUTES_REFERENCE.md` | C | ~5 | stale-ref | remove-ref | Phase 4 |
| `docs/architecture/SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md` | C | ~5 | stale-ref | remove-ref | Phase 4 |
| `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md` | C | ~3 | stale-ref | remove-ref | Phase 4 |
| `docs/architecture/contract-service/CONTRACT-PIPELINE-MAP.md` | C | ~3 | stale-ref | remove-ref | Phase 4 |
| `docs/agents/framework/AGENT_DRIVEN_UI_ARCHITECTURE.md` | C | ~5 | stale-ref | remove-ref | Phase 4 |
| `docs/agents/frontend-design/ONBOARDING_SYSTEM_DESIGN.md` | C | ~5 | stale-ref | remove-ref | Phase 4 |
| `docs/plans/PLAN-mobile-voice-wiring.md` | D | ~20 | design-doc | replace-code-refs | Phase 4 |
| `docs/plans/PLAN-voice-plane-consolidation.md` | D | ~30 | design-doc | replace-code-refs | Phase 4 |
| `docs/superpowers/specs/2026-05-04-voice-plane-consolidation.md` | D | ~50 | spec | replace-code-refs | Phase 4 |
| `docs/superpowers/specs/2026-04-09-agent-harness-foundation-design.md` | D | ~10 | spec | replace-code-refs | Phase 4 |
| `docs/BUILD_ORDER.md` | E | ~3 | anchor | banner-only | Phase 4 |
| `docs/SITEMAP.md` | E | ~2 | anchor | banner-only | Phase 4 |
| `docs/reference/infra-runtime.md` | E | ~3 | anchor | banner-only | Phase 4 |
| `docs/journeys/JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md` | PRESERVE | all | journey | keep-unchanged | never |
| `docs/journeys/JOURNEY-voice-plane-consolidation-lise-interview-livekit.md` | PRESERVE | all | journey | keep-unchanged | never |
| `docs/journeys/JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit.md` | PRESERVE | all | journey | keep-unchanged | never |
| `docs/journeys/JOURNEY-voice-agent-fix.md` | PRESERVE | all | journey | keep-unchanged | never |
| `docs/decisions/0282-voice-plane-consolidation-livekit-only.md` | PRESERVE | all | ADR | keep-unchanged | never |
| `docs/decisions/0276-adr-0107-amendment-provider-independence.md` | PRESERVE | all | ADR | keep-unchanged | never |
| `docs/decisions/0135-mobile-voice-via-livekit-not-ultravox.md` | PRESERVE | all | ADR | keep-unchanged | never |
| `docs/decisions/0220-botsson-conversational-front-door-not-orchestrator.md` | PRESERVE | all | ADR | keep-unchanged | never |
| `docs/decisions/0000-decision-log.md` | PRESERVE | all | decision-log | keep-unchanged | never |
| `docs/learnings/0013-ultravox-http-tool-parameters.md` | PRESERVE | all | learning | keep-unchanged | never |
| `docs/audits/2026-05-08-botsson-harness-audit.md` | PRESERVE | all | audit | keep-unchanged | never |
| `docs/audits/2026-05-02-adr-contract-validation/` | PRESERVE | all | audit | keep-unchanged | never |
| `docs/audits/2026-05-06-adr-contract-validation/` | PRESERVE | all | audit | keep-unchanged | never |
| `docs/HANDOFF-c1-mobile-voice-wiring.md` | PRESERVE | all | handoff | keep-unchanged | never |
| `docs/HANDOFF-c1b-botsson-voice-session.md` | PRESERVE | all | handoff | keep-unchanged | never |
| `docs/HANDOFF-vad-bench.md` | PRESERVE | all | handoff | keep-unchanged | never |
| `docs/superpowers/plans/completed/2026-03-22-livekit-phase2.md` | PRESERVE | all | completed-plan | keep-unchanged | never |
| `docs/superpowers/plans/2026-05-08-phase-e-cutover-tracks-2-3-4-6.md` | PRESERVE | all | active-plan | keep-unchanged | never |
| `docs/council/COUNCIL-LOG.md` | PRESERVE | all | council-log | keep-unchanged | never |
| `docs/reports/` (all) | PRESERVE | all | reports | keep-unchanged | never |
| `docs/worklogs/` (all) | PRESERVE | all | worklogs | keep-unchanged | never |
| Remaining files not listed above | E | varies | misc | assess-at-E6 | Phase 4 |

## Notes

1. **Active-content threshold** (council Hard Rule 4): Target = 0 Ultravox-refs in `docs/architecture/`, `docs/modules/`, `docs/decisions/` _active content_. `docs/archive/`, `docs/research/`, `docs/plans/completed/` unbounded.
2. **Strip timing:** ALL A/B/C/D bucket actions gated on Phase E E6 (Ultravox code deletion). Stripping before E6 creates doc-reality mismatch.
3. **U3 snapshot:** Per council Hard Rule 3, `docs/audits/2026-05-08-pre-ultravox-deletion-snapshot.md` must capture line-refs BEFORE E6. That file is Phase 4 scope.
4. **Line counts** above are approximate; run `grep -c` per file before editing.
