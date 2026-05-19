---
title: "Journey — admin edits a website page in /dashboard/website/pages/[pageId]"
status: verified
feature: website-polish
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, website, page-polish, ui-shell, campaign-ui-shell, telemetry]
---

# Journey — admin edits a website page

> Sub-sortie: `ui-shell-website-polish`. Verifies Phase 5 (telemetry on every mutation) + Phase 6 instructions.

## Journey: Admin edits page in editor

**Precondition:** Admin signed-in, workspace has ≥1 website page, page `pageId` exists.

1. Admin clicks page row in overview → System routes to `/dashboard/website/pages/[pageId]` → Browser shows editor surface with page title, content, publish state
2. Admin edits content + clicks "Lagre" → System fires mutation → Optimistic state update → `emit('website.page.saved', { workspace_id, actor_id, entity: { type: 'website_page', id: pageId }})` → activity_trail row written, engine_event routed if applicable, PostHog event recorded, toast "Lagret"
3. Admin clicks "Publiser" → Confirm dialog (human-driven button, ADR-0244 — no agent mutation) → System fires publish mutation → `emit('website.page.published', ...)` → state-badge updates from "Utkast" → "Publisert"

**Postcondition:** Every save + publish writes activity_trail row. PostHog dashboard shows website.page.* events. Page editor remains responsive (<100ms input latency).

**Error paths:**
- Save fails (network/validation) → toast.error with retry copy, no telemetry emit (mutation didn't succeed)
- Publish fails on validation → inline error with specific field, no state change
- Concurrent edit conflict → optimistic update rolls back, toast "Endret av annen — last på nytt"

## Verification

- Every mutation has matching event in `packages/telemetry/src/registry.ts`
- `pnpm --filter @smartout/telemetry test` green after polish
- `activity_trail` row written per save+publish (manual SQL check or test)
- No empty-string fallback in `workspace_id` / `actor_id` (ADR-0134)
- Publish button is NOT a Botsson tool (ADR-0244 risk tier) — read-tool `getPublishState` allowed

## E2E (recommended)

`apps/web/e2e/website-polish/page-editor.spec.ts` — edit content, assert save toast, query activity_trail for emitted event.
