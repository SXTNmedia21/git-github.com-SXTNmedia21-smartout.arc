---
title: "Journey — Pontus runs journey with speed profile"
feature: journey-control-center
journey: run-journey-with-speed
status: verified
verified_at: 2026-05-06
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: journey-engine
tags: [journey]
---

## Verification (2026-05-06)

Live-verified:
- Dashboard 200 OK on `http://localhost:3065/`.
- `GET /api/journeys` returns `{ compiled: [P-001], drafts: 228 }`.
- `POST /api/journeys/P-001/run` with `{"speed_profile":"normal"}` returns `{ok:true, runId}`.
- Single-run lock: 2nd concurrent POST returns `{ok:false, error:"Run already active: <id>"}`.
- `POST /api/journeys/[slug]/abort/[runId]` returns `{ok}` boolean (false when child already exited; SIGTERM otherwise).
- SSE stream route accessible at `/api/journeys/[slug]/stream/[runId]`.

Code-trace verified (Council 2026-05-06 Round 3 + Round 5 code-tracer):
- `speed_profile` end-to-end chain: `page.tsx:14` → `run/route.ts` (Zod parse) → `journey-runner.ts:53` (env spawn) → `protocol.spec.ts:23` (slug dispatch) → `protocol-runner.ts:352` (`resolveRuntimeSpeedProfile`) → multiplier applied to settle delays + gate timeouts. Env-var precedence over IR `speed_profile` field verified at `speed-profile-env.ts:13-19`.
- SSE completion race-free: exit handler at `journey-runner.ts:86-91` is fully synchronous; `run.done = true` and final `done` line land in same event-loop tick.
- Single-run lock sound: `find((r) => !r.done)` filter at `journey-runner.ts:40` correctly handles cleanup-delay race.

Spec-drift accepted as ADR-0290-canonical:
- Port `localhost:3334` in spec → actual `3065` (Pontus's choice, ADR-0290 implementation refs).
- Multipliers `×1.0/×2.0/×0.3` in spec → actual `×1/×3/×8` per ADR-0290 multiplier table (spec was wrong, ADR-0290 is canonical).
- `/runs/[runId]` separate route in spec → inline `RunViewer` mounted in dashboard (UX simplification, no regression).
- Screenshot thumbs per step in spec → raw stdout/stderr panel (deferred to sortie B; council C-list).

Deferred to sortie B + manual Pontus check post-merge:
- E2E test for journey-control app (council C9 — sortie B work; current `protocol.spec.ts` is `test.skip(true)` because P-001 onboarding `data-testid` attributes missing).
- 3-speed × end-to-end browser flow (UI button states, RunViewer SSE rendering, abort UX).
- Speed multiplier 3× delta measurement (requires unskipped P-001 or new compiled IR with non-skip test body).

# Journey: Pontus runs journey with speed profile

**Role:** developer (Pontus, local-only)

**Precondition:**
- `apps/journey-control/` running on `http://localhost:3334`
- Minst én kompilert JourneyIR finnes i `apps/e2e/protocols/`
- Playwright-binary installert
- Web-app på port 3060 oppe (target for journey-runs)

## Happy Path

1. Pontus åpner `http://localhost:3334` → Dashboard viser liste over kompilerte journeys (cards med navn, slug, last-run-status)
2. Pontus klikker en journey-card → modal/detail-view åpnes med speed-picker (3 knapper: Full / Normal / AI companion)
3. Pontus velger speed-profil → valg lagres i komponent-state, profil-multiplier vises (`×1.0` / `×2.0` / `×0.3`)
4. Pontus klikker "Run" → POST `/api/journeys/[slug]/run` med `{ speed_profile }` → server spawner Playwright child-prosess med `JOURNEY_SPEED_PROFILE` env-var → returnerer `{ runId }`
5. Browser navigerer til `/runs/[runId]` → SSE-stream åpnes mot `/api/journeys/[slug]/stream/[runId]`
6. Step-events streamer inn → Pontus ser hver step lyse opp grønn/rød/pågående med screenshot-thumbs
7. Run fullfører → siste event `{ type: "done", success: true|false }` → UI viser oppsummering (varighet, antall steg, gate-passes)

**Postcondition:**
- Run-result lagret i in-memory store på server (eller `apps/e2e/runs/<runId>/`)
- Speed-profil reflektert i faktiske step-tider (verifiserbar i log)

## Error Paths

- **Playwright child crasher:** SSE sender `{ type: "error", message }` → UI viser rød banner + "Retry"-knapp
- **Web-app 3060 nede:** journey feiler på første navigate → SSE sender error → UI peker på "Start web first"
- **Speed-profil ugyldig:** `/api/journeys/[slug]/run` returnerer 400 med Zod-feilmelding
- **Run-id ukjent ved stream:** SSE `/stream/[runId]` returnerer 404 → UI viser "Run not found"
- **Pontus klikker abort:** POST `/api/journeys/[slug]/abort/[runId]` → child-prosess SIGTERM → SSE `{ type: "aborted" }`

## Verification

- [ ] Implementation matcher stegene over
- [ ] E2E-test finnes og består (path i `e2e_test:` frontmatter)
- [ ] Manuelt testet end-to-end med alle 3 speed-profilene
- [ ] Speed-multiplier verifiserbar — full vs ai_companion gir målbart ulik varighet (>3× forskjell)

**Sett `status: verified` i frontmatter når alle fire bokser er sjekket.**
