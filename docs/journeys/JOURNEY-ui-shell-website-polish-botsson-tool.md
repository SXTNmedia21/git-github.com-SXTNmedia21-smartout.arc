---
title: "Journey — Botsson invokes a website tool on /dashboard/website"
status: verified
feature: website-polish
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, website, page-polish, harness, botsson, campaign-ui-shell]
---

# Journey — Botsson invokes a website tool

> Sub-sortie: `ui-shell-website-polish`. Verifies Phase 7 (useRegisterTools) + Phase 8 (site-map.json) end-to-end via HarnessAdapter chat path.

## Journey: Admin asks Botsson about website state

**Precondition:** Admin signed-in, Botsson chat open, current route = `/dashboard/website` OR `/dashboard/website/pages/[pageId]`, `HARNESS_ADAPTER_VOICE` flag does NOT need to be on (chat path tested).

1. Admin types "Hvilke sider er publisert?" in Botsson chat → Chat sends `{ message, client_route: "/dashboard/website", client_tools: [...website kit] }` to `/api/botsson/chat` → BFF forwards to stage-engine `/agent/chat`
2. Stage-engine HarnessAdapter resolves bundle for `channel:"chat"` + `pageRoute:"/dashboard/website"` → combines server-side capabilities + page-scope tools from `client_tools` + site-map.json metadata → injects into LLM call
3. LLM picks `getWebsitePublishState` (read tool from website kit) → Tool fires via dataRef → returns `{ pages: [{id, title, state: "published" | "draft"}], lastPublishedAt }` (no PII) → LLM composes natural-language answer → Admin sees "3 sider publisert: Hjem, Meny, Kontakt. Siste publisering: 2 dager siden."

**Postcondition:** Tool invoked via adapter, not via `query_smartout` fallback. Latency <2s end-to-end.

**Error paths:**
- Tool not in site-map → drift validator catches before merge (`pnpm site-map:validate`)
- Tool name collision with capability → adapter logs `clientToolCollisions` field
- Mutation tool attempted (e.g. `publishPage`) → not registered (ADR-0244 risk tier); LLM falls back to "trykk Publiser-knappen"
- HarnessAdapter feature flag off → falls back to capability-only tools, website-specific tools dormant (acceptable degradation)

## Verification

- `apps/web/.botsson/site-map.json` has `/dashboard/website` + `/dashboard/website/pages/[pageId]` entries
- Tools array in site-map matches `useRegisterTools` kits verbatim
- `pnpm --filter web site-map:validate` exits 0
- Chat-harness-pipeline test passes (`services/stage-engine/src/routes/agent/__tests__/chat-harness-pipeline.test.ts`)
- Manual: open Botsson on `/dashboard/website`, ask intent → tool fires, response specific

## E2E (recommended)

Voice path NOT covered (flag-gated, separate sortie). Chat-path manual verification sufficient for this journey.
