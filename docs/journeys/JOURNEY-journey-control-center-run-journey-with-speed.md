---
title: "Journey — Pontus runs journey with speed profile"
feature: journey-control-center
journey: run-journey-with-speed
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: journey-engine
tags: [journey]
---

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
