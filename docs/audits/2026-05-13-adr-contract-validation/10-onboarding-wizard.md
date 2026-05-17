---
title: "Slice 10 — Onboarding Wizard ADR/Contract Audit"
status: done
slice: 10
created: 2026-05-13
updated: 2026-05-13
adrs: [ADR_0041, ADR_0123, ADR_0238]
surfaces:
  - apps/web/src/app/onboarding
  - apps/web/src/app/join
  - apps/web/src/app/api/workspace-intelligence
---

# Slice 10 — Onboarding Wizard

Read-only audit. ADR-0041 (onboarding flow), ADR-0123 (pre-workspace EF exception), ADR-0238 (domain chat ownership). Two surfaces: `/join` (live, Route-Handler → scrape.smartout.ai droplet) and `/onboarding` (confirmation wizard against EFs).

## Findings

### F-OB-10-01 CRITICAL — `/onboarding` is half-migrated; ~17 files of legacy scroll-wizard remain mounted as dead code

`apps/web/src/app/onboarding/page.tsx` now mounts only `AnimatedWizardShell + wizard-definition.ts` (the 5-step `Confirm*` flow). `OnboardingProvider` from `WizardContext.tsx` is **never** mounted. ADR-0041's superseded note matches reality at the entry point.

But the deletion was abandoned mid-way:

- `apps/web/src/app/onboarding/WizardContext.tsx` (364 lines)
- `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` + `useBotsson.ts` + `useScrollProgress.ts`
- `apps/web/src/app/onboarding/sections/*.tsx` (9 files: Hero, Welcome, Business, Season, Departments, Locations, Procedures, Done, CustomerDocumentView)
- `apps/web/src/app/onboarding/components/*.tsx` (11 files incl. BigBoard, KeyFactsPanel, AgentControlPanel, AmbientBackground, VoiceSessionOverlay, FinaleOverlay)

…all still on disk, all importing `useOnboarding()` from the orphaned `WizardContext`. Every one of these files would throw `"useOnboarding must be used within OnboardingProvider"` if rendered. They are not rendered — `grep` confirms zero external mounts — so the runtime is safe. The cost is: dead code ships in the build (until tree-shaken), `useOnboardingState` still contains direct EF calls (`gather-workspace-intelligence`, `search-brreg`, `scrape-website`) that would otherwise be ADR-0123 violations, the SUPERSEDED ADR claim is misleading (the runtime moved, the codebase didn't), and a future reader has no way to tell legacy from live without diffing `page.tsx`.

This is the same shape as L-0177 (silent-fallback class) — the old surface still compiles; the new surface routes around it.

### F-OB-10-02 HIGH — F-OB-04 confirmed: `/api/emma/session` BFF route has ZERO consumers

`apps/web/src/app/api/emma/session/route.ts` exists with full implementation, JWT auth, tests passing (3/3). No source file fetches it. Only references are the route's own file, its test file, the Next.js routes typegen, and a build log. Voice agent / capability surface / mobile / Botsson tools — none of them call it. Per ADR-0282 Phase E this was meant to replace the client-side `getOnboardingState` Ultravox temporaryTool; that replacement never landed on the caller side. Baseline status from 2026-05-10 unchanged.

### F-OB-10-03 HIGH — F-OB-09 confirmed: `getOnboardingState` client path still wired, BFF tool that should call session route does not exist

`WizardContext.tsx:37` defines `getOnboardingState` reading from React state. It is exposed via `packages/agent-sdk/src/tools/onboarding.ts:39` `createOnboardingTools` → registered in `@smartout/agent-sdk` exports. `packages/ai/src/missions/registry.ts:57` and `:152` still instruct the agent: *"Bruk getOnboardingState for å sjekke hva som er fylt inn."* The voice-SDK blueprint at `packages/Botsson/blueprints/voice-sdk-architecture.md:309` still documents it as the canonical environment-read tool. 

Two problems compounding: (a) the tool runs against a `WizardContext` that is never mounted on `/onboarding` (so any agent that calls it gets a state-snapshot of nothing); (b) the BFF replacement tool — the one the agent should call instead, hitting `/api/emma/session` server-side — was not built. So the agent has the prompt instruction, has a tool with the right name, has a server route waiting for the call, and none of the three connect.

### F-OB-10-04 MEDIUM — `useOnboardingState` performs direct EF calls outside ADR-0123 allowed set

`apps/web/src/app/onboarding/hooks/useOnboardingState.ts` invokes three Edge Functions directly via `invokeEdgeFunction`: `gather-workspace-intelligence` (L426), `search-brreg` (L583), `scrape-website` (L655). Per ADR-0123 v2 (amended 2026-04-22), the pre-workspace EF allowlist is **`accept-invitation` only**; `create-invitation` was migrated to a Next.js route handler, and the canonical answer for any new pre-workspace flow is "prefer Next.js route handler unless token-as-auth without session is required." These three EFs are pre-workspace but JWT-authenticated (workspace context resolvable) and serve content generation, not auth — they belong in route handlers (the pattern `/join` already implements via `/api/workspace-intelligence`).

Severity is MEDIUM only because `useOnboardingState` is currently dead code (F-OB-10-01). Live status would push this to HIGH and trigger the ADR-0123 tripwire clause ("when a 2nd pre-workspace Edge Function is proposed, open a new ADR before adding it"). The drift is latent: any revival of the scroll-wizard reactivates three ADR-0123 violations simultaneously.

### F-OB-10-05 LOW — ADR-0238 dual-surface UX not currently triggered on `/onboarding` or `/join`

Verified clean: `apps/web/src/app/onboarding/layout.tsx` wraps children in `BotssonProvider` (context-only) but does NOT mount `BotssonShell` or `EmmaOverlay`. `BotssonShell` is rendered only by `apps/web/src/app/platform-admin/layout.tsx:19` and standalone Playground/Arena pages. `/onboarding/page.tsx` does not pass `onContextChange` to `AnimatedWizardShell`, so wizard context is not pushed to BotssonProvider on this surface. `/join/page.tsx` mounts `JoinScrapingProvider` + `AnimatedWizardShell`, no BotssonProvider. Both wizards are single-surface today — but the wizard surface is itself conversational (multi-step chat-like AnimatedWizardShell with thread + Botsson Avatar in steps), so the risk window is open the moment someone adds `BotssonShell` under `/onboarding/layout.tsx` or wires the missing `onContextChange`. No `<DomainChatOwnership>` declaration anywhere in the repo (zero hits). `LonnsprofilSection.tsx:26` has a TODO comment for the pattern; the pattern itself doesn't exist yet.

## Recommendations

| Severity | Finding | Action |
|---|---|---|
| CRITICAL | F-OB-10-01 | Sortie `feat/onboarding-legacy-cleanup` — delete `WizardContext.tsx`, `hooks/{useOnboardingState,useBotsson,useScrollProgress}.ts`, all `sections/*.tsx`, all `components/*.tsx`, plus `lib/tool-schemas.ts`. Remove `createOnboardingTools` from `@smartout/agent-sdk` exports. Update `voice-sdk-architecture.md` + `environment-ui-control.md` + `journey-content-map.md` to remove `getOnboardingState` from documented toolset. Promote ADR-0041 status from `superseded` to `superseded + cleanup-done`. |
| HIGH | F-OB-10-02 + F-OB-10-03 | Either delete `/api/emma/session/route.ts` (if the BFF tool plan is dropped) OR build the BFF tool that calls it from the agent harness side and update `packages/ai/src/missions/registry.ts` instruction text. Current state is the worst of both — route exists, tests pass, no caller, instruction still points at the dead client path. |
| MEDIUM | F-OB-10-04 | Resolved automatically by F-OB-10-01 deletion. If `useOnboardingState` is preserved (e.g. ported to the new shell), the three EF calls must be migrated to route handlers per ADR-0123 amendment + tripwire ADR opened. |
| LOW | F-OB-10-05 | Implement `<DomainChatOwnership>` in `@smartout/ui` per ADR-0238 implementation pattern before mounting `BotssonShell` on any wizard surface. Add to `smartout-page-polish` skill checklist. |

## ADR Compliance

| ADR | Surface | Status | Notes |
|---|---|---|---|
| 0041 | `/onboarding` | superseded — runtime moved, dead code stayed | Runtime correctly uses `AnimatedWizardShell + wizard-definition.ts`. Legacy 17-file scroll-wizard remains on disk; F-OB-10-01 CRITICAL. |
| 0123 | `useOnboardingState` (dead) | latent drift | Three pre-workspace EF calls outside allowlist. Dead code today; revival = instant 3× ADR-0123 violation. |
| 0123 | `/join` | compliant | Uses `/api/workspace-intelligence` Route Handler → scrape.smartout.ai droplet. No EFs invoked from `/join`. |
| 0238 | `/onboarding`, `/join` | compliant by absence | No `BotssonShell` on either surface; no dual-surface today. Pattern not implemented anywhere — first page that needs it must build the primitive. |

## Counts

- 1 CRITICAL
- 2 HIGH (both baseline-confirmed)
- 1 MEDIUM (latent / dead code)
- 1 LOW
- 0 false positives carried; 0 active-campaign exclusions

## Top 3

1. `/onboarding` runtime moved to `AnimatedWizardShell` but ~17 legacy scroll-wizard files remain mounted as dead imports — delete before ADR-0041 can honestly read "superseded."
2. F-OB-04 baseline holds: `/api/emma/session` has zero source consumers; the BFF replacement for `getOnboardingState` was built half-way and abandoned.
3. F-OB-09 baseline holds and is worse than it reads: agent prompt + tool registration + voice blueprint all still point at the dead client path; deleting the path requires also pruning the agent-sdk export and the mission-registry instruction text.
