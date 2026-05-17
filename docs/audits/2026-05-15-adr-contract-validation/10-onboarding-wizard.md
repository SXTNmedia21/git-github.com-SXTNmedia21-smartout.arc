---
title: "Slice 10 — Onboarding Wizard ADR/Contract Audit"
status: done
slice: 10
created: 2026-05-15
updated: 2026-05-15
adrs: [ADR_0041, ADR_0123, ADR_0179, ADR_0238]
surfaces:
  - apps/web/src/app/onboarding
  - apps/web/src/app/join
tags: [audit, onboarding, wizard, adr]
---

# Slice 10 — Onboarding Wizard

Read-only audit. ADRs: 0041 (onboarding architecture), 0123 (pre-workspace EF exceptions), 0179 (browser mutations via route handlers), 0238 (Botsson surface disambiguation). Development HEAD, 2026-05-15.

## Summary

F-OB-10-01 (CRITICAL — 27 legacy scroll-wizard files) is **CLOSED**. All 27 flagged files verified deleted via `feat/audit-fob10-onboarding-cleanup` (merged `2c3e4b1eb`). `/onboarding` directory now contains exactly 23 files — all belong to the AnimatedWizardShell tree, zero legacy patterns detected.

Two findings carry forward from the 2026-05-13 baseline. One new finding added: wizard-definition.ts invokes `finalize-workspace` / `activate-workspace` Edge Functions directly from browser (`"use client"` context), which is an ADR-0179 violation. ADR-0238 (`DomainChatOwnership` component) remains unimplemented.

**Counts: 0 CRITICAL / 1 HIGH (new) / 1 HIGH (carry-forward) / 1 LOW (carry-forward)**

---

## Findings Table

| ID | Severity | File:Line | ADR | Description | Status |
|---|---|---|---|---|---|
| F-OB-10-06 | HIGH | `wizard-definition.ts:14,292` | ADR-0179 | Browser (`"use client"`) invokes `invokeEdgeFunction` → `supabase.functions.invoke()` for `finalize-workspace` / `activate-workspace`. Both EFs are JWT-authenticated — no pre-workspace exception applies (ADR-0123 allowlist is `accept-invitation` only). | NEW |
| F-OB-10-02 | HIGH | `apps/web/src/app/api/emma/session/route.ts` | ADR-0179 | BFF route exists with full implementation + passing tests but zero callers. `packages/ai/src/missions/registry.ts:57,152` still instructs agent to call `getOnboardingState` (dead client tool). `packages/agent-sdk/src/tools/onboarding.ts` still exports `createOnboardingTools`. Blueprints still document the tool as canonical. | CARRY-FORWARD |
| F-OB-10-07 | LOW | `platform-admin/journeys/wizard/[sessionId]/page.tsx` | ADR-0238 | `platform-admin/layout.tsx` mounts `<BotssonShell />` globally. `/journeys/wizard/[sessionId]` renders `<WizardChat>` (in-page chat surface). No `<DomainChatOwnership>` declared. Dual-surface on live route. Scope note: this is platform-admin, not `/onboarding` or `/join`, but ADR-0238 explicitly named this page as Phase 1 target. | NEW (partially carry-forward) |
| F-OB-10-05 | LOW | `packages/Botsson/blueprints/environment-ui-control.md:32,49,100` | ADR-0238 | `<DomainChatOwnership>` component does not exist anywhere in the codebase (zero export hits). Referenced in 20+ comment annotations across dashboard pages but never implemented. ADR-0238 status remains `proposed`. | CARRY-FORWARD |

---

## Per-ADR Rollup

### ADR-0041 — Onboarding Wizard Step Architecture (superseded)

**Status: COMPLIANT — closure confirmed.**

The F-OB-10-01 CRITICAL finding from 2026-05-13 is fully resolved. Verified:

- `WizardContext.tsx` — DELETED
- `hooks/useOnboardingState.ts`, `useBotsson.ts`, `useScrollProgress.ts` — DELETED
- `hooks/__tests__/useBotsson.test.ts` — DELETED
- `sections/*.tsx` (9 files: Hero, Welcome, Business, Season, Departments, Locations, Procedures, Done, CustomerDocumentView) — DELETED
- `components/*.tsx` (11 files: AgentControlPanel, AmbientBackground, BigBoard, BotssonAvatar, BusinessCardGrid, DataMaterializer, FinaleOverlay, KeyFactsPanel, SectionReveal, TypewriterText, VoiceSessionOverlay) — DELETED
- `lib/tool-schemas.ts` — DELETED
- `steps/ConfirmProfessions.tsx` — DELETED (bonus: not in original 27 count)

Zero legacy patterns survive. `grep` for `useOnboardingState`, `STEP_COMPONENTS`, `OnboardingWizardProvider` returns no hits. ADR-0041's supersession note is now accurate.

### ADR-0123 — Pre-Workspace EF Exceptions

**Status: COMPLIANT on `/join`. NEW VIOLATION on `/onboarding`.**

`/join` wizard: all AI-draft calls route through Next.js route handlers (`/api/workspace-intelligence`, `/api/scrape/brreg`, `/api/scrape/public`). No `supabase.functions.invoke()` calls in `/join`. JoinScrapingProvider + useWorkspaceIntelligence + useScrapedData all use `fetch("/api/...")`. Clean.

`/onboarding` wizard (F-OB-10-06): `wizard-definition.ts:14` imports `invokeEdgeFunction`; `wizard-definition.ts:292` calls it directly from the browser `onComplete` handler to invoke either `finalize-workspace` or `activate-workspace`. Both EFs require JWT auth (`supabaseClient.auth.getUser()` at their entry point — confirmed). This is NOT a pre-workspace flow; the user is authenticated with an active profile. ADR-0123 pre-workspace exception does not apply. ADR-0179 is the governing rule: browser-originated mutations must route through Next.js route handlers.

Note: this is the finalization step only — not an ongoing data-fetch pattern. A route handler at `/api/onboarding/finalize` wrapping the EF server-to-server would close this finding.

### ADR-0179 — Browser Mutations via Next.js Route Handlers

**Status: VIOLATION at wizard-definition.ts:292 (F-OB-10-06).**

The `onComplete` function in `apps/web/src/app/onboarding/wizard-definition.ts` (line 1 = `"use client"`) calls `invokeEdgeFunction(supabase, finalizationRequest.functionName, ...)` which resolves to `supabase.functions.invoke()`. This is the exact anti-pattern ADR-0179 prohibits.

The `buildWorkspaceFinalizationRequest()` helper in `lib/finalization.ts` correctly encapsulates the EF name selection — it could be reused by a route handler with minimal refactor. Fix shape: new `POST /api/onboarding/finalize` route handler that accepts the same payload, calls the EF server-to-server with service role, and returns the result.

The `invokeEdgeFunction` wrapper (`src/lib/supabase-edge-invoke.ts`) is a developer-DX utility (503 detection), not a CORS workaround — it still calls `supabase.functions.invoke()` at line 31 and therefore produces cross-origin requests from `*.smartout.ai` to `<project>.supabase.co`.

### ADR-0238 — Botsson Surface Disambiguation

**Status: PROPOSED, NOT IMPLEMENTED. Dual-surface violation on platform-admin journeys wizard.**

`<DomainChatOwnership>` component: confirmed absent. No file exports it. Zero import hits. 20+ comment annotations across dashboard files reference it as "not needed here" — which is correct for those pages — but the implementation prerequisite (the component itself) was never built.

The ADR-0238 Phase 1 target page (`platform-admin/journeys/wizard/[sessionId]`) has:
- `platform-admin/layout.tsx:21` renders `<BotssonShell />` (global Orb)
- `wizard/[sessionId]/_components/wizard-chat.tsx` renders an in-page chat surface for journey authoring

This is the exact dual-surface scenario ADR-0238 was written to prevent. The ADR is `proposed` so this is an implementation gap, not a regression. However, since `BotssonShell` and the wizard chat are both live and reachable, the silent-failure UX described in the ADR is active today for any godmode user who reaches that page.

`/onboarding` and `/join` remain clean: `onboarding/layout.tsx` mounts `BotssonProvider` (context-only, no shell/Orb rendered). `/join` has no BotssonProvider at all.

---

## Verified Intentional

| Item | Rationale |
|---|---|
| `accept-invitation` EF direct invoke | ADR-0123 explicit allowlist — token-as-auth, no workspace context, mobile dependency at `apps/mobile/app/(auth)/verify.tsx:289` |
| `/api/workspace-intelligence` → scrape.smartout.ai | Canonical `/join` pattern; server-side Next.js route handler proxying Python droplet. Not an EF call. Confirmed by memory note from 2026-05-13. |
| `invokeEdgeFunction` wrapper itself | DX utility, not a bypass. Lives in `src/lib/` (server-importable). The problem is the caller context (`"use client"` wizard-definition.ts), not the wrapper. |

---

## In-Progress

| Item | Notes |
|---|---|
| `createOnboardingTools` in `@smartout/agent-sdk` | F-OB-10-02 from 2026-05-13: `packages/agent-sdk/src/tools/onboarding.ts` + `src/index.ts:32` still export it. `packages/ai/src/missions/registry.ts:57,152` still references `getOnboardingState`. Cleanup recommended independently of `/api/emma/session` decision. |
| ADR-0238 `<DomainChatOwnership>` component | Not implemented. Required before any future BotssonShell mounting on a page with in-page chat. Platform-admin journeys wizard is already in violation scope. |

---

## Delta vs 2026-05-13

| Finding | 2026-05-13 Status | 2026-05-15 Status | Change |
|---|---|---|---|
| F-OB-10-01 — 27 legacy scroll-wizard files | CRITICAL — OPEN | CLOSED — all 27 files deleted | RESOLVED |
| F-OB-10-04 — `useOnboardingState` EF calls (dead code) | MEDIUM — latent | N/A — file deleted | RESOLVED (by F-OB-10-01 closure) |
| F-OB-10-03 — `getOnboardingState` dead tool / registry drift | HIGH — OPEN | HIGH — still open (agent-sdk + registry.ts not cleaned up) | CARRY-FORWARD as part of F-OB-10-02 |
| F-OB-10-02 — `/api/emma/session` zero callers | HIGH — OPEN | HIGH — OPEN | CARRY-FORWARD |
| F-OB-10-05 — ADR-0238 not implemented | LOW — OPEN | LOW — OPEN | CARRY-FORWARD |
| F-OB-10-06 — wizard-definition.ts browser→EF invocation | not previously flagged | HIGH — NEW | NEW FINDING |
| F-OB-10-07 — journeys/wizard/[sessionId] dual-surface | not previously flagged | LOW — NEW | NEW FINDING |

**Net delta: -2 findings (CRITICAL + MEDIUM closed), +2 findings (1 HIGH + 1 LOW added). Severity profile improved.**

---

## Severity Summary

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 2 | F-OB-10-06 (new), F-OB-10-02 (carry-forward) |
| MEDIUM | 0 | — |
| LOW | 2 | F-OB-10-07 (new), F-OB-10-05 (carry-forward) |
