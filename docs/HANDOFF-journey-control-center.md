---
title: "Handoff — Journey Control Center"
status: in_progress
updated: 2026-05-06
created: 2026-05-06
module: journey-control-center
---

# Handoff — Journey Control Center

## Summary

A standalone Next.js developer dashboard at port 3065 (`apps/journey-control/`) that gives operators a UI surface for running, compiling, aborting, and discovering Playwright-backed JourneyIR protocols.

What was built across 28 commits on `feat/journey-control-center`:

- **IR primitives** — `packages/journey-ir/src/speed-profile.ts`: `SpeedProfile` type (`full` / `normal` / `ai_companion`) and `SPEED_PROFILES` multiplier table. Zod-validated `JourneyIR` schema with `z.array().min(1)` step constraint.
- **E2E runner integration** — `apps/e2e/runners/speed-profile-env.ts` resolves `JOURNEY_SPEED_PROFILE` env var; `protocol-runner.ts` and `gate-checker.ts` apply multipliers to settle delays, retry intervals, and gate timeouts.
- **Discovery + run BFF** — `apps/journey-control/` Next.js app with API routes: `GET /api/journeys` (list compiled protocols), `POST /api/journeys/[slug]/run` (spawn Playwright child), `GET /api/journeys/[slug]/stream/[runId]` (SSE log), `POST /api/journeys/[slug]/abort/[runId]` (SIGTERM), `POST /api/journeys/compile` (LLM compile draft → IR).
- **LLM compile** — OpenRouter via OpenAI-compat SDK (Claude Sonnet 4.6). System prompt passed as `messages[0]` `role:system`; `response_format: { type: "json_object" }` enforced. Auto-registers compiled slug in `apps/e2e/protocols/index.ts` via regex rewrite.
- **Dashboard UI** — Protocol cards (compiled + draft), RunViewer with SSE log panel, speed selector, abort button, draft search (client-side, case-insensitive, render cap 50).
- **Abort + search** — Abort sends SIGTERM via `POST /api/journeys/run/abort`; search filters slug+title in real time, no round-trip.

## Architecture

```
packages/journey-ir/src/
  speed-profile.ts        — SpeedProfile type + SPEED_PROFILES multiplier table (pure)
  schema.ts               — JourneyIR Zod schema (steps min(1))

apps/e2e/runners/
  speed-profile-env.ts    — resolves JOURNEY_SPEED_PROFILE env var to SpeedProfile
  protocol-runner.ts      — consumes resolveSpeedMultiplier() for settle delays
  gate-checker.ts         — consumes multipliers for retry/timeout scaling
  progress-writer.ts      — SSE emit helper

apps/journey-control/src/
  app/
    api/journeys/
      route.ts            — GET: list compiled protocols from PROTOCOL_REGISTRY
    api/journeys/[slug]/run/
      route.ts            — POST: spawn Playwright child; activeRuns Map per-process
    api/journeys/[slug]/abort/[runId]/
      route.ts            — POST: SIGTERM child
    api/journeys/[slug]/stream/[runId]/
      route.ts            — GET: SSE stream from child stdout
    api/journeys/compile/
      route.ts            — POST: read draft → OpenRouter → Zod validate → write IR + rewrite registry
    page.tsx              — dashboard shell
  components/
    journey-list.tsx      — compiled + draft protocol cards
    run-viewer.tsx        — SSE log panel + speed selector + abort button
    compile-dialog.tsx    — slug input + confirm compile

apps/e2e/protocols/
  index.ts                — PROTOCOL_REGISTRY barrel (auto-rewritten by compile API)
```

Data flow (run): Operator clicks Run → `POST /api/journeys/[slug]/run` → server spawns `npx playwright test tests/protocol.spec.ts --project=web --reporter=list` as child process with env vars `JOURNEY_PROTOCOL_SLUG=<slug>`, `JOURNEY_SPEED_PROFILE=<profile>`, `SKIP_WEB_SERVER=1`, `CI=""` → `apps/e2e/tests/protocol.spec.ts` reads env vars to dispatch from `PROTOCOL_REGISTRY` → child writes progress to stdout → `GET /api/journeys/[slug]/stream/[runId]` SSE route pipes child stdout → browser EventSource renders log lines.

Data flow (compile): Operator clicks Compile → `POST /api/journeys/compile` → server reads draft markdown → OpenRouter call with JSON-mode → Zod validates response → writes `protocols/<slug>.json` → regex-rewrites `protocols/index.ts` → 201 response → dashboard re-fetches protocol list.

## Decisions

- **ADR-0291** — Journey speed profiles (`full` / `normal` / `ai_companion`). Three named profiles with explicit multipliers. `full` = CI baseline (×1). `normal` = operator review (settle×3, retry×3, timeout×2). `ai_companion` = Botsson live-narrate (settle×8, retry×6, timeout×3). Runtime env var `JOURNEY_SPEED_PROFILE` overrides IR `speed_profile` field. Rejects free-form numeric multiplier (no shared vocabulary).

  Note: plan file (`docs/superpowers/plans/2026-05-06-journey-control-center.md`) referred to this as ADR-0284. ADR-0284 was already taken by `phantom-reuse-detection-in-capability-plans.md` (2026-04-29). Next free slot at sortie start was 0290. All plan references to "0284" map to 0290 in the delivered artefact.

## Learnings

1. **Plan-spec ADR numbers collide at merge time.** Plan files are written against the ADR counter at authoring time, but other sorties or campaign merges land between plan-write and plan-execution. Always verify the next free slot by listing `docs/decisions/` before writing the ADR file — do not trust the plan's number verbatim. (Seen this sortie: plan said 0284, 0284 was taken, correct number is 0290.)

2. **OpenRouter via OpenAI-compat SDK silently drops a top-level `system` field.** The `system` field in the Anthropic format has no equivalent at the top level of the OpenAI-compat `/v1/chat/completions` endpoint; it is silently discarded. Pass the system prompt as `messages[0]` with `role: "system"`. Add `response_format: { type: "json_object" }` to force JSON output. Without this, the LLM returns prose and the Zod parse fails. (See `learning_llm_openai_compat_system_field_trap.md` in agent memory.)

3. **Stop-hook scoped typecheck fires on every intermediate file write.** The pre-push typecheck hook triggers on file writes, not only on commits. Agents must hold all writes until the full file set is consistent and passes typecheck — committing after each individual Write call produces false typecheck failures mid-build.

4. **Parallel agent dispatch can interleave file writes across tracks.** Track D (discovery+run) and Track F (compile) wrote files in the same window during parallel dispatch. Track D's commit `509ddd7dd` bundled `journey-compiler.ts` (a Track F deliverable) because both agents were writing files simultaneously. The output is functionally correct but commits do not cleanly map to their originating track. When parallelising across tracks that share a directory, either serialise the final commit step or pre-allocate file ownership per track.

5. **Plan code using `steps: []` violates `z.array().min(1)` schema constraint.** The JourneyIR Zod schema requires at least one step per stage (`z.array(StepSchema).min(1)`). Plan fixture code that used empty arrays (`stages: [{ steps: [] }]`) failed at runtime during TDD. Always cross-check plan fixture shapes against the live Zod schema before writing tests.

## Known Issues

1. **Registry rewrite regex is fragile.** The compile API rewrites `apps/e2e/protocols/index.ts` using `(import [\s\S]+?;\n)(?!import)` to locate the insertion point. This works for the current barrel shape (grouped imports followed by an export map). If the import structure changes (blank lines between imports, comments, re-exports), the regex will fail to match and the compile API returns 500. A proper AST-based rewrite (ts-morph) is the correct long-term fix.

2. **Live LLM compile requires `OPENROUTER_API_KEY` in the shell environment.** The variable is not auto-loaded by `next dev` from `.env.template`. The operator must run `op run --env-file=.env.template -- pnpm --filter @smartout/journey-control dev` or export the key manually in the shell before starting the dev server.

3. **Single-run lock is per-process; restarting the dev server leaks zombie children.** The `activeRuns` Map lives in the Next.js API route module's module scope. Restarting the dev server clears the Map. Any Playwright child running at restart time becomes orphaned — it will continue running until its own timeout or until the operator kills it manually via `pkill -f protocol-runner`.

4. **`CompileDialog` does not receive `draftTitle` prop (simplified from plan).** Plan T22 intended to pre-populate the dialog with the draft card's title. To avoid threading `selectedTitle` state through `JourneyList`, the `CompileDialog` derives a display name from the draft filename instead. Minor UX delta: the dialog header shows the filename, not the markdown `# Title` heading.

## Next Steps (Sortie B)

- Port the `/join` new-workspace wizard to JourneyIR (write P-002).
- Refresh P-001 against current `/onboarding` wizard (state has drifted from the version used to generate P-001).
- Add a Fjernkontroll-style step indicator to RunViewer: shows total steps, current step index, and estimated time remaining at the chosen speed profile.
- Add LLM-mediated worker for run-time speed change: operator can switch from `normal` to `ai_companion` mid-run without aborting (requires pause/resume protocol in the child process).
- Fix registry rewrite to use ts-morph AST manipulation instead of regex.
- Add `OPENROUTER_API_KEY` to `.env.template` as an `op://` reference so `op run` auto-injects it.
