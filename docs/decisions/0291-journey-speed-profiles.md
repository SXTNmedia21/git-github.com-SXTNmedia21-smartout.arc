---
title: "Journey speed profiles: full / normal / ai_companion"
id: ADR-0291
status: accepted
layer: decision
created: 2026-05-06
updated: 2026-05-06
---

# ADR-0291: Journey speed profiles: full / normal / ai_companion

> Renumbered from ADR-0290 → ADR-0291 on 2026-05-06 due to collision with `0290-engine-world-platform-rpc-bypass.md` (engine-world, 26 refs vs 4 here). See DRIFT-PREVENTION-PLAN.md §6 (Class A drift).

## Context and Problem Statement

The Journey Control Center runner executes compiled JourneyIR protocols against a live Playwright browser. In CI the runner uses tight timing defaults tuned for speed. Two other execution contexts require deliberate slowdown: (1) **operator review** — an operator watching a run live needs enough settle time to follow the action; (2) **Botsson live-narrate (ai_companion)** — the AI narrates each step via SSE, and the runner must wait long enough for both the narration to stream and the operator to absorb it before proceeding. A single implicit "speed" is not sufficient for these three contexts.

## Decision Drivers

- Runner gates (db_record, ui_state, etc.) already carry their own retry intervals and timeouts; the speed system must compose with them rather than replacing them.
- The profiles must be named — shareable vocabulary across runner, UI, and ADRs — not raw numeric multipliers chosen per-run.
- CI behavior must not regress; the default profile must be identical to current behavior (multiplier = 1 everywhere).
- Both IR-level pinning (authored in the compiled JSON) and runtime override (env var for tooling scripts) must be supported.

## Considered Options

1. **Three named profiles** — `full`, `normal`, `ai_companion` — each providing three multipliers (settle, retry, timeout). IR field optional. Runtime env-var override takes precedence.
2. **Free-form numeric multiplier** — caller passes a raw number per-invocation. More flexible, no shared vocabulary.
3. **Per-gate timeout overrides** — caller configures each gate's timeout independently. Maximum control, but requires callers to understand every gate type.

## Decision Outcome

Chosen option: **Option 1 — three named profiles**, because named profiles give shared vocabulary across runner, UI labels, and documentation without requiring callers to understand gate internals. Options 2 and 3 offer no semantic meaning — two runners configured identically by number could have completely different intended use cases.

## Multipliers

Exact values from `packages/journey-ir/src/speed-profile.ts`:

| Profile | settle | retry | timeout |
|---|---|---|---|
| `full` | ×1 | ×1 | ×1 |
| `normal` | ×3 | ×3 | ×2 |
| `ai_companion` | ×8 | ×6 | ×3 |

- **settle** — multiplier applied to `RUNNER_CONFIG.settleDelay` between actions.
- **retry** — multiplier applied to gate retry intervals (`db_record`, `ui_state`, etc.).
- **timeout** — multiplier applied to gate timeouts (prevents false-fail on slow runs).

## Rules & Consequences

- **Good, because** `full` = multiplier 1 everywhere — CI behavior is identical to pre-ADR baseline. No regression risk.
- **Good, because** `ai_companion` ×8/×6/×3 gives Botsson narration time to stream and the operator time to read before the next step fires.
- **Bad, because** `ai_companion` runs on long protocols can take many minutes — callers should communicate expected run duration when using this profile.
- **Bad, because** gate timeout scaling (`timeout: ×3`) can mask infrastructure slowness that would surface at `full` speed; operators should run `full` for final validation.
- **Precedence rule:** runtime env var `JOURNEY_SPEED_PROFILE` > IR `speed_profile` field > default (`full`).
- **Agent impact:** any new runner consumer that schedules runs must expose a `speed_profile` parameter (or accept the default). UI components that show run status should label the active profile.

## Implementation References

- `packages/journey-ir/src/speed-profile.ts` — `SpeedProfile` type, `SPEED_PROFILES` record, `resolveSpeedMultiplier()` pure helper
- `apps/e2e/runners/speed-profile-env.ts` — env-var resolver (`JOURNEY_SPEED_PROFILE`)
- `apps/e2e/runners/protocol-runner.ts` — applies `resolveSpeedMultiplier()` to settle delays
- `apps/e2e/runners/gate-checker.ts` — applies multipliers to retry intervals and timeouts

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
