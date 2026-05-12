---
id: L-0231
title: "Service Dockerfile drift from package.json deps when workspace dep added without Dockerfile update"
type: learning
status: accepted
created: 2026-05-10
updated: 2026-05-10
discovered_in: council 2026-05-10 voice-agent Dockerfile bug
discovered_by: supervisor + system-steward + system-agent-coordinator + botsson-harness-builder (4/4 unanimous)
tags: [dockerfile, monorepo, workspace-deps, ci-gap, phase-e, subpath-imports]
related: [L-0176, L-0190]
---

# L-0231: Service Dockerfile Drift from package.json Deps

## Pattern

When a sortie adds a `@smartout/*` workspace dep to a service's `package.json` + source imports, the service's `Dockerfile` must be updated in the same commit. Build-agent typecheck verification does NOT catch this:

- **TypeScript** resolves workspace imports via root `tsconfig` paths + pnpm symlinks at `node_modules/@smartout/*` → resolves to `packages/*/src/*` → `tsc --noEmit` passes locally.
- **Docker build** resolves via per-package `COPY` directives in the Dockerfile → if the Dockerfile doesn't COPY `packages/<dep>/`, the symlinked target doesn't exist in the build context → `tsc` inside the builder stage fails `TS2307: Cannot find module '@smartout/<dep>/<subpath>'`.

The two resolution mechanisms diverge silently. Phase E commit `75a66007e` (mission-aware dispatch) added `@smartout/ai/missions` import to `services/voice-agent/src/agent.ts`; commit `41be285d1` (runtime telemetry) added `@smartout/telemetry/server`. Neither commit touched the Dockerfile. Local typecheck passed. Docker rebuild failed TS2307 on subpath imports.

## Root cause

This is the **2nd occurrence** of the subpath-imports-need-built-dist class:

| # | Date | Service | Triggered by |
|---|---|---|---|
| 1 | 2026-05-06 | stage-engine local typecheck | Fresh worktree + `@smartout/ai/router/*` imports — see `learning_stage_engine_subpath_imports.md` (memory) |
| 2 | 2026-05-10 | voice-agent Docker build | Phase E added `@smartout/ai/missions` + `@smartout/telemetry/server` |

Both share the same root cause: subpath exports in `@smartout/*` packages point to `dist/<subpath>/index.js`. The dist must exist before the consumer compiles. Local dev `tsx watch` gets away with it because tsx resolves via tsconfig paths to `src/`, not via package.json exports map. Docker `tsc` honors the exports map → needs dist.

## Verification gap that allowed this to ship

`.github/workflows/ci.yml` docker-build matrix (lines 141-150) included stage-engine, shift-mcp, contract-service, scrapling — but **NOT voice-agent**. CI never built the voice-agent Docker image. Phase E sub-sortie verification claim was "Typecheck: 0 errors" — which was true and insufficient. The only gate that would have caught this (docker build) was not wired.

## Fix applied (commit `e524a966a`)

1. Cloned `services/stage-engine/Dockerfile` multi-stage pattern verbatim. Adapted for voice-agent's smaller dep set (types → utils → telemetry → journey-ir → ai → voice-agent).
2. Stage 2 sed-patch for telemetry exports (line 75 stage-engine pattern) — without it, runtime resolution of `@smartout/telemetry/server` fails even if build succeeds.
3. Updated Dockerfile header comment to declare actual workspace dep graph + cross-link ADR-0282 (was: stale "no @smartout/* workspace deps" claim).
4. Added voice-agent to `.github/workflows/ci.yml` docker-build matrix.

## Latent vulnerability remaining

`services/shift-mcp/Dockerfile` has the same structural pattern as pre-fix voice-agent: no `@smartout/*` workspace dep COPY, no transitive build sequence. Currently safe because shift-mcp source has no `@smartout/*` imports. First time anyone adds one, it breaks identically.

## Prevention

Council proposed but deferred to follow-up sortie:

- **ADR-DRAFT**: "Monorepo Service Dockerfile Pattern" — codify 8 rules (build context = monorepo root; `--filter <service>...` with transitive triple-dot; topological build order; Stage 2 dist COPY; export-rewrite sed-patches; header comment must match `package.json` deps; commit-time CI gate).
- **CI gate**: any commit adding `@smartout/*` to a service `package.json` must also update the Dockerfile + add the service to `docker-build` matrix, OR be CI-rejected.
- **Heartbeat job**: diff declared deps in Dockerfile header comment vs `package.json` dependencies — alert on drift.

## Cross-pattern signature

When a build-agent reports "typecheck passes" as verification for a change touching `services/*/src/`, that is **insufficient evidence** for any commit that adds workspace deps. Required additional gate: `docker compose build <service>` returns 0. Add to close-feature checklist for any sortie that touches `services/*/src/` with new package.json deps.

## Council decision references

- Steward verdict (Phase 3 + Phase 5 chair): option (a) Dockerfile fix mandatory; new ADR for monorepo Dockerfile pattern recommended; promotion-blocker for HOP A per ADR-0265.
- Supervisor (blast radius scan): identified missing voice-agent in CI matrix as bug #2.
- Agent-coord (boundary review): cascade ontology preserved — voice-agent → mission registry is sanctioned per ADR-0282 R6 E5; long-term decoupling (mission-id-only contract) deferred to Phase F1 ADR.
- Harness (Phase E owner): downgrade BOTSSON-SYSTEM-MAP `L3 — VOICE AGENT` from 🟢 to 🟡 until Dockerfile fix lands. Now 🟢 again post-`e524a966a`.
