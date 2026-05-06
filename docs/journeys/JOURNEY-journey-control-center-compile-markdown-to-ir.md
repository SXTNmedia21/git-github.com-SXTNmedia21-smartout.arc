---
title: "Journey — Pontus compiles markdown draft to JourneyIR"
feature: journey-control-center
journey: compile-markdown-to-ir
status: verified
verified_at: 2026-05-06
e2e_test: apps/journey-control/src/lib/__tests__/journey-compiler.test.ts
created: 2026-05-06
updated: 2026-05-06
module: journey-engine
tags: [journey]
---

## Verification (2026-05-06)

Live-verified:
- `POST /api/journeys/compile` without `OPENROUTER_API_KEY` set returns `{ok:false, error:"OPENROUTER_API_KEY not set in environment"}` (status 500). Graceful error path.
- Test suite green: `journey-compiler.test.ts` (mocked OpenAI SDK, validates JourneyIR schema parse on mock response), `ir-ts-emitter.test.ts` (TS module emission with non-alphanumeric-stripped const name), `journey-discovery.test.ts` (regex extraction of slug+title+module from compiled `.ts` files).

Code-trace verified (Council 2026-05-06 Round 3 + Round 5 code-tracer):
- LLM compile chain: dialog POST → `compile/route.ts:31-37` Zod parse (regex relaxed `[A-Za-z0-9-]+` + `.transform(toUpperCase)` server-side per commit `fef26fa62`) → markdown read at `route.ts:60-69` → `compileMarkdownToIR()` at `journey-compiler.ts:75-141` with OpenRouter via OpenAI SDK, system as `messages[0]` per L-0202, `response_format: {type: "json_object"}` → `JourneyIRSchema.safeParse` validation → `emitIRToTypescript` writes `apps/e2e/protocols/<slug>-<draft>.ts` → idempotent regex-rewrite of `protocols/index.ts` (both `if (!next.includes(...))` guards present at `route.ts:96-102`).
- Idempotency colon-terminator-safe: `"P-002":` substring check does NOT false-match `"P-002X":` (verified in Round 5 trace).
- Auto-suggest next P-NNN slug: `compile-dialog.tsx` mounts → fetches `/api/journeys` → computes `Math.max(...P-NNN) + 1` → pre-fills input.

Spec-drift accepted as ADR-0290-canonical:
- Port `localhost:3334` in spec → actual `3065`.
- Body shape `{ markdown_path }` in spec → actual `{ draft_slug, desired_slug? }` (slug-based lookup, not path-based; cleaner contract).
- Response `{ ok, slug, file_path }` in spec → actual `{ ok, slug, title, filePath, note }` (richer metadata).
- Markdown preview in dialog spec → actual slug-input-only (deferred to sortie B; council C-list).
- Auto-jump draft → compiled in spec → actual alert + manual refresh (deferred to sortie B).
- Slug-collision 409 prompt in spec → actual silent overwrite (deferred to sortie B; idempotent registry-rewrite ensures no duplicate entries).
- Error 503 for missing key in spec → actual 500 (catalog drift; functionally equivalent).

Deferred to sortie B + manual Pontus check post-merge:
- Live OpenRouter compile (requires `op run --env-file=.env.template -- pnpm dev` shell with 1Password unlock).
- Round-trip: compiled IR → run via Journey 1 (chained on live compile).
- E2E test with mocked Claude response on a fixture markdown (council C9 — currently only unit-level mock test).
- UI dialog flow (Compile button → modal open → slug input → submit → success alert).

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
