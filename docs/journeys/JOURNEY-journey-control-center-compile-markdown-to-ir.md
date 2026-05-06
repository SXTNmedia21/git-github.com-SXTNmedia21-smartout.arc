---
title: "Journey — Pontus compiles markdown draft to JourneyIR"
feature: journey-control-center
journey: compile-markdown-to-ir
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: journey-engine
tags: [journey]
---

# Journey: Pontus compiles markdown draft to JourneyIR

**Role:** developer (Pontus, local-only)

**Precondition:**
- `apps/journey-control/` running on `http://localhost:3334`
- `ANTHROPIC_API_KEY` injisert via `op run --env-file=.env.template`
- Minst én markdown-draft finnes i `docs/journeys/JOURNEY-*.md`
- Markdown har gjenkjennelig struktur (Happy Path + Verification headings)

## Happy Path

1. Pontus åpner `http://localhost:3334` → Dashboard viser to seksjoner: "Compiled" og "Drafts (235)"
2. Pontus scroller til "Drafts" → cards viser slug + filsti + "Compile"-knapp
3. Pontus klikker "Compile" på en draft → modal åpnes med markdown-preview + "Compile to IR"-bekreftelsesknapp
4. Pontus klikker bekreft → POST `/api/journeys/compile` med `{ markdown_path }` → server kaller Anthropic SDK med claude-sonnet-4-6 + Zod-typed structured output
5. Claude returnerer JSON som validerer mot `JourneyIRSchema` → server skriver `apps/e2e/protocols/<slug>.ts` + auto-registrerer i `PROTOCOL_REGISTRY` (regex-replace)
6. Server returnerer `{ ok: true, slug, file_path }` → UI viser toast "Compiled <slug>"
7. Draft hopper fra "Drafts" til "Compiled"-seksjonen → "Run"-knapp blir aktiv

**Postcondition:**
- Ny `.ts`-fil eksisterer på `apps/e2e/protocols/<slug>.ts`
- `PROTOCOL_REGISTRY` har ny entry
- Journey er nå kjørbar via journey 1 (run-journey-with-speed)

## Error Paths

- **Claude returnerer ugyldig JSON:** Zod-parse feiler → server returnerer 422 med diff → UI viser "Compile failed: <error>" + "Retry"-knapp
- **Markdown overskrider max_tokens:** API-call feiler → server returnerer 413 → UI peker på "Markdown too long, split"
- **PROTOCOL_REGISTRY regex-replace miss:** server logger advarsel, fil skrevet men registry uendret → UI viser warning toast
- **ANTHROPIC_API_KEY missing:** API-call feiler 401 → server returnerer 503 + "API key not configured"
- **Slug-collision (compiled finnes allerede):** server returnerer 409 → UI prompt "Overwrite?"

## Verification

- [ ] Implementation matcher stegene over
- [ ] E2E-test finnes og består — bruker fixture-markdown + mocked Claude-response (path i `e2e_test:` frontmatter)
- [ ] Manuelt testet med ekte Claude-call på minst én ekte draft
- [ ] Round-trip: kompilert IR kjører grønt via journey 1

**Sett `status: verified` i frontmatter når alle fire bokser er sjekket.**
