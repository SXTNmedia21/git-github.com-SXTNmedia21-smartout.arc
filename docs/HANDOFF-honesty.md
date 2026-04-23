---
title: "HANDOFF — journey-engine-honesty (Phase 0 remediation)"
feature: honesty
branch: feat/journey-engine-honesty
status: ready_for_merge
created: 2026-04-23
updated: 2026-04-23
module: journey-engine
tags: [handoff, remediation, phase-0, phantom, authority, fjernkontroll]
---

# HANDOFF — Phase 0 Honesty Sub-Sortie

**Campaign:** `journey-engine` · **Worktree:** `~/dev/smartout.ai-journey-engine-wt-1` · **Base:** `campaign/journey-engine @ 74f7839c`

Merges to `campaign/journey-engine` via `/close-feature`. First of four remediation phases from the 2026-04-23 council verdict (APPROVE WITH CHANGES → REMEDIATION).

## Summary

Three independent tracks landed on `feat/journey-engine-honesty` in parallel. Purpose: stop the Journey Engine campaign shipping code that lies. Zero new features; zero new capabilities; only remediation of defects surfaced by the post-implementation audit.

- **Track A** — `publish_mission` + `publish_guide` capability tools were phantom skeletons. Neutered: no more `journey.run_started` emit on no-op bodies.
- **Track B** — CVE-class base-key fold in `services/stage-engine/src/core/authority.ts` made per-capability C4 authority non-deterministic. Fixed via dotted-key preservation + per-tool selector lookup.
- **Track C** — Fjernkontroll state machine had no exit edges from `stuck` or `failed`, dead-ending users. Added retry/abandon/reset transitions + UI buttons.

Commit graph on `feat/journey-engine-honesty`:

```
015182fb  Track C — Fjernkontroll state-machine exit edges
7ecbda9c  Track B — authority loader dotted-key preservation
f291c88d  Track A — neuter publish_mission + publish_guide phantoms
073edc85  Plan + journey docs
```

## Decisions (all from Council 2026-04-23, committed in campaign parent)

- **ADR-0194** (proposed) — JourneyIR v2.1 → engine_missions hybrid mapping. Unblocks publish_mission body in Phase 3.
- **ADR-0195** (proposed) — Authority loader full dotted-key preservation. The CVE-class fix Track B implements.
- **ADR-0196** (proposed) — Journey Engine Invariants 11/12/13 (no phantom capabilities, falsifiable status claims, gate_action on every mutation). Added to `CLAUDE.md`.
- **ADR-0197** (proposed) — Phantom contracts class rule (promotes L-0094 after 5th occurrence; three failure modes: phantom emit / phantom body / phantom status claim).

All four ADRs remain `proposed`. Phase 1 will bump them `proposed → accepted`.

## Learnings captured

- **L-0124** — Phantom body vs phantom emit (two shapes of the same anti-pattern).
- **L-0125** — Test spirit vs letter (`ok:true` is not asserting the artefact; L-0118 reinforcement).
- **L-0126** — Ontology gap is an ADR, not effort.
- **L-0127** — Loader-level bugs evade grep-audits; Code-Tracer Mandate covers transformation layers.

## Verification output

| Gate | Result |
|---|---|
| Typecheck `pnpm turbo typecheck` | 35/35 tasks ✅ |
| Tests `@smartout/ai` | 245/245 ✅ |
| Tests `@smartout/stage-engine` | 100/100 ✅ (incl. 10-run determinism loop) |
| Tests `web` (Fjernkontroll) | 18/18 ✅ |
| Supervisor review | APPROVE WITH CHANGES (both non-blocking, handled) |
| Journey Guardian self-test (G-JE-1..6) | 6/6 ✅ |
| Trust Gate | PASS |

## Files changed per track

**Track A (2 files):**
- `packages/ai/src/capabilities/journey/tools.ts` — `publishMissionTool` + `publishGuideTool` execute bodies neutered.
- `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts` — assertions flipped to `ok:false` + `error: not_implemented` + `emit` mock NOT called.

**Track B (4 files, 1 new):**
- `packages/ai/src/capabilities/types.ts` — `CapabilityName` union gains 4 dotted members; legacy `"journey"` marked `@deprecated`.
- `services/stage-engine/src/core/authority.ts` — pure reducer `buildAuthorityConfig(rows)` extracted; skips base-key fold for `journey.*`; legacy families still fold.
- `packages/ai/src/router/tool-selector.ts` — `selectToolsForCapability` + `toolTier` + `tierUnlocked`; per-tool lookup: dotted → short fallback → `read_only`.
- `services/stage-engine/src/core/__tests__/authority.test.ts` (NEW) — 9 tests, 10-run shuffled-order determinism loop.

**Track C (4 files, 1 new):**
- `apps/web/src/components/journey/useFjernkontrollMachine.ts` — `abandon` + `reset` event types; new transitions; reducer exported pure.
- `apps/web/src/components/journey/FjernkontrollActions.tsx` — stuck renders "Prøv igjen" + "Avslutt"; failed renders "Start på nytt"; min-w-11 touch targets; Nordic Split tokens.
- `apps/web/src/components/journey/Fjernkontroll.tsx` — `recoveryAnnouncement` transient 2-s live-region override.
- `apps/web/src/components/journey/__tests__/useFjernkontrollMachine.test.ts` (NEW) — 18 tests.

## Known debt / follow-ups

Non-blocking for Phase 0 close; deferred to later sub-sorties:

1. **Dead code cleanup** — `apps/web/src/app/platform-admin/journeys/versions/actions/publish-mission.ts:154` + `publish-guide.ts:133` have a `noteStr.toLowerCase().includes("skeleton")` guard that is now unreachable (tools short-circuit earlier). Remove in a later commit.
2. **`completed → idle (dismiss)` transition** — Fjernkontroll's `completed` state still triggers `start` on button click. ADR-0177 implies a dismiss path. Out of Phase 0 scope.
3. **`handleAbandon` telemetry wiring** — Track C hook is pure. M5 runtime follow-up should wrap `handleAbandon` in `Fjernkontroll.tsx` with `journey.run_failed` emit (`error_code: "abandoned_by_user"`) once the capability path is wired. Documented in the hook header.

## Next steps (remediation roadmap)

Per `docs/plans/CAMPAIGN-journey-engine.md §REMEDIATION AMENDMENT`:

- **Phase 1 — Contracts (3–5 days).** Sub-sortie `feat/journey-engine-ir-v2`. Bump ADR-0194/0195/0196/0197 `proposed → accepted`. Document L-0125 spirit-compliant test pattern in `journey-runner-suite` scaffold.
- **Phase 2 — Foundations (1 week).** Sub-sortie `feat/journey-engine-foundations`. Add `callGateAction` to all 4 capabilities (ADR-0099 / Invariant 13). Seed-compile migration for 2+ additional journeys. L-0118-spirit artefact-asserting E2E tests.
- **Phase 3 — Bodies (3–4 weeks).** Sub-sorties per capability: `publish_mission` body → mission resolution → N-C worker (NOT this worktree — separate campaign) → stuck detector B-flip → `publish_guide` body.
- **Phase 4 — Mobile + Ops (2–3 weeks).** Mobile RN Fjernkontroll UI (Reanimated port), seed-missions, rollback, kill-switch, monitoring, preview→prod rollout.

## References

- `docs/plans/CAMPAIGN-journey-engine.md §REMEDIATION AMENDMENT`
- `docs/plans/PLAN-journey-engine-honesty.md`
- `docs/journeys/JOURNEY-journey-engine-honesty.md`
- `docs/council/COUNCIL-LOG.md` 2026-04-23
- ADR-0194 / 0195 / 0196 / 0197
- L-0124 / 0120 / 0121 / 0122
