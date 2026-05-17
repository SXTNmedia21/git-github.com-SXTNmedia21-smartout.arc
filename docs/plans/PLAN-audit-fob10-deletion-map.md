---
title: "Deletion map — audit-fob10 onboarding legacy cleanup"
feature: audit-fob10-onboarding-cleanup
status: ready
updated: 2026-05-13
created: 2026-05-13
module: onboarding
tags: [plan, deletion-map, f-ob-10-01, audit]
---

# Deletion map — F-OB-10-01 legacy onboarding files

> Branch: `feat/audit-fob10-onboarding-cleanup` | Worktree: `~/dev/smartout.ai-wt-9`
> Spec: [Slice 10 audit](../audits/2026-05-13-adr-contract-validation/10-onboarding-wizard.md), synthesis F-OB-10-01 (CRITICAL)
> Parent plan: [PLAN-audit-fob10-onboarding-cleanup.md](PLAN-audit-fob10-onboarding-cleanup.md)

## Scope of audit verification

Audit claimed "~17 files" in F-OB-10-01. T1 verification finds **26 legacy files** in `apps/web/src/app/onboarding/` (9 sections + 11 components + 3 hooks + 1 `WizardContext.tsx` + 1 `lib/tool-schemas.ts` + 1 orphan `steps/ConfirmProfessions.tsx`). Audit was directionally correct; counts were approximate.

Live (KEEP_LIVE) tree confirmed:
`page.tsx` → `wizard-definition.ts` + `layout.tsx` → `BotssonProvider`
`wizard-definition.ts` imports: `types.ts`, `types-v2.ts`, `lib/{data-merger,industry-defaults,finalization,redirect}.ts`, `steps/Confirm{Departments,Roles,Positions,Locations,Procedures,Summary}.tsx` (6 step files + 5 tools files).

## Council escalation triggers — NONE FIRED

- ANY legacy file with inbound import from `apps/web/src/app/dashboard/`, `apps/landing/`, `apps/mobile/`, `packages/ai/`, `services/` → **FALSE.** Grep confirmed zero hits across all 26 legacy files. Mentions of `WizardContext` outside legacy code resolve to `WizardContextPayload` (separate `@smartout/ui` type, not the legacy React context). Mentions of `useOnboarding*` outside legacy code resolve to `useOnboardingGuide` (dashboard's setup-completion hook in `apps/web/src/app/dashboard/_hooks/use-onboarding-guide.ts` — unrelated symbol).
- `useOnboardingState` consumer outside `apps/web/src/app/onboarding/` → **FALSE.** Only `WizardContext.tsx` (itself orphaned) consumes it.
- Audit slice 10 over-reported and only N < 17 files are actually legacy → **FALSE OPPOSITE.** Audit under-counted; 26 legacy files exist (still all `DELETE_SAFE`).

T1 proceeds to map without escalation.

## Deletion map

Verdict legend:
- `DELETE_SAFE` — zero inbound imports from non-legacy code; pure dead surface
- `KEEP_LIVE` — imported by AnimatedWizardShell tree (`page.tsx` → `wizard-definition.ts` → step + lib files)
- `NEEDS_MIGRATION` — live inbound from non-legacy code requires migration before deletion

### Legacy DELETE_SAFE group (26 files)

| File | Last-modified | Purpose | Inbound (non-legacy) | Outbound EF calls | Verdict |
|---|---|---|---|---|---|
| `apps/web/src/app/onboarding/WizardContext.tsx` | 2026-04-20 | Legacy React context orchestrator wiring `useOnboardingState` + `useBotsson` + `useScrollProgress` for old scroll-wizard | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` | 2026-04-23 | Legacy state hook with direct ADR-0123-violating EF invocations | 0 | L426 `gather-workspace-intelligence`, L583 `search-brreg`, L655 `scrape-website`, L831 finalize-workspace | DELETE_SAFE |
| `apps/web/src/app/onboarding/hooks/useBotsson.ts` | 2026-05-10 | Legacy voice-session hook (LiveKit room URL fetch, no UltravoxSession import) | 0 | LiveKit room-init fetch (no Edge Function) | DELETE_SAFE |
| `apps/web/src/app/onboarding/hooks/useScrollProgress.ts` | 2026-04-20 | Legacy scroll-position tracker for old vertical scroll-wizard layout | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/lib/tool-schemas.ts` | 2026-04-20 | Legacy Zod schemas for old wizard's voice-tool registrations | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/HeroSection.tsx` | 2026-04-20 | Legacy scroll-wizard hero pane | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/WelcomeSection.tsx` | 2026-04-20 | Legacy welcome pane | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/BusinessSection.tsx` | 2026-04-20 | Legacy business-confirmation pane | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/SeasonSection.tsx` | 2026-04-20 | Legacy season-selection pane (now confirmed inside Confirm steps) | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/DepartmentsSection.tsx` | 2026-04-20 | Legacy departments pane (replaced by `steps/ConfirmDepartments`) | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/LocationsSection.tsx` | 2026-04-20 | Legacy locations pane | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/ProceduresSection.tsx` | 2026-04-20 | Legacy procedures pane | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/DoneSection.tsx` | 2026-04-20 | Legacy finalize/done pane | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/sections/CustomerDocumentView.tsx` | 2026-04-20 | Legacy doc-preview overlay for old wizard | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/AgentControlPanel.tsx` | 2026-04-20 | Legacy voice-agent sidebar | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/AmbientBackground.tsx` | 2026-04-20 | Legacy ambient gradient + particles bg | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/BigBoard.tsx` | 2026-04-28 | Legacy big-board summary surface | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/BotssonAvatar.tsx` | 2026-05-09 | Legacy avatar component (note: live tree uses different Botsson avatar in `@/app/Botsson/`) | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/BusinessCardGrid.tsx` | 2026-04-20 | Legacy business-suggestion card grid | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/DataMaterializer.tsx` | 2026-04-28 | Legacy data-arrival animation | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/FinaleOverlay.tsx` | 2026-04-28 | Legacy completion-animation overlay | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/KeyFactsPanel.tsx` | 2026-04-28 | Legacy facts side-panel | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/SectionReveal.tsx` | 2026-04-20 | Legacy section reveal-on-scroll wrapper | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/TypewriterText.tsx` | 2026-04-28 | Legacy typewriter animation primitive | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/components/VoiceSessionOverlay.tsx` | 2026-04-28 | Legacy voice-session modal | 0 | none | DELETE_SAFE |
| `apps/web/src/app/onboarding/steps/ConfirmProfessions.tsx` | 2026-04-24 | Orphan step file — present in `steps/` but NOT imported by `wizard-definition.ts` (replaced by `ConfirmRoles`+`ConfirmPositions`) | 0 | none | DELETE_SAFE |

### KEEP_LIVE tree

| File | Last-modified | Purpose | Verdict |
|---|---|---|---|
| `apps/web/src/app/onboarding/page.tsx` | 2026-04-20 | Entry — mounts `AnimatedWizardShell` with `onboardingWizard` definition | KEEP_LIVE |
| `apps/web/src/app/onboarding/layout.tsx` | 2026-05-12 | Server layout — auth gate + `BotssonProvider` wrap | KEEP_LIVE |
| `apps/web/src/app/onboarding/wizard-definition.ts` | 2026-04-20 | `WizardDefinition` config — 6 Confirm steps + intelligence-data loader | KEEP_LIVE |
| `apps/web/src/app/onboarding/types.ts` | 2026-04-20 | `BusinessData`, `LocationData`, `RoleOption` shared types (consumed by live steps + lib) | KEEP_LIVE |
| `apps/web/src/app/onboarding/types-v2.ts` | 2026-04-20 | `OnboardingConfirmState` + default — canonical confirm-flow state shape | KEEP_LIVE |
| `apps/web/src/app/onboarding/lib/data-merger.ts` | 2026-04-20 | `mergeBusinessData` — merges intelligence + Places + form state | KEEP_LIVE |
| `apps/web/src/app/onboarding/lib/finalization.ts` | 2026-04-20 | `buildWorkspaceFinalizationRequest` → finalize-workspace EF | KEEP_LIVE |
| `apps/web/src/app/onboarding/lib/industry-defaults.ts` | 2026-04-20 | NACE-keyed industry defaults (departments, procedures, professions) | KEEP_LIVE |
| `apps/web/src/app/onboarding/lib/motion.ts` | 2026-04-20 | Framer Motion variants for confirm-step transitions | KEEP_LIVE |
| `apps/web/src/app/onboarding/lib/redirect.ts` | 2026-04-20 | `redirectToDashboard` post-finalize | KEEP_LIVE |
| `apps/web/src/app/onboarding/lib/season-suggestions.ts` | 2026-04-20 | `suggestSeason` heuristic (NACE → season template) | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx` | 2026-04-28 | Step 1 — business identity confirmation | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx` | 2026-04-28 | Step 2 — departments confirmation | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/ConfirmRoles.tsx` | 2026-04-24 | Step 3 — roles confirmation | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/ConfirmPositions.tsx` | 2026-04-24 | Step 4 — positions confirmation | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/ConfirmLocations.tsx` | 2026-04-28 | Step 5 — locations confirmation | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/ConfirmProcedures.tsx` | 2026-04-28 | Step 6 — procedures confirmation | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/ConfirmSummary.tsx` | 2026-04-28 | Step 7 — final summary + finalize | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/tools/business-tools.ts` | 2026-04-20 | Botsson voice/chat tools for ConfirmBusiness | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/tools/departments-tools.ts` | 2026-04-20 | Botsson tools for ConfirmDepartments | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/tools/locations-tools.ts` | 2026-04-20 | Botsson tools for ConfirmLocations | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/tools/procedures-tools.ts` | 2026-04-20 | Botsson tools for ConfirmProcedures | KEEP_LIVE |
| `apps/web/src/app/onboarding/steps/tools/summary-tools.ts` | 2026-04-20 | Botsson tools for ConfirmSummary | KEEP_LIVE |
| `apps/web/src/app/onboarding/__tests__/data-merger.test.ts` | 2026-04-20 | Unit tests against live `lib/data-merger.ts` | KEEP_LIVE |
| `apps/web/src/app/onboarding/__tests__/finalization.test.ts` | 2026-04-20 | Unit tests against live `lib/finalization.ts` | KEEP_LIVE |
| `apps/web/src/app/onboarding/__tests__/industry-defaults.test.ts` | 2026-04-20 | Unit tests against live `lib/industry-defaults.ts` | KEEP_LIVE |
| `apps/web/src/app/onboarding/__tests__/season-suggestions.test.ts` | 2026-04-20 | Unit tests against live `lib/season-suggestions.ts` | KEEP_LIVE |
| `apps/web/src/app/onboarding/hooks/__tests__/useBotsson.test.ts` | 2026-05-09 | **Hygiene test only** — reads `useBotsson.ts` source file as string to assert it does not import `UltravoxSession`. Has no symbol-level dependency on `useBotsson`. **Becomes obsolete when `useBotsson.ts` is deleted in T2 → delete this file together with `useBotsson.ts`.** | DELETE_SAFE (paired with `hooks/useBotsson.ts`) |

> Correction: `hooks/__tests__/useBotsson.test.ts` is functionally tied to the legacy `useBotsson.ts` source. When T2 deletes the hook, this test loses its subject. Re-classify as `DELETE_SAFE` together with the hook. Listed here under KEEP_LIVE/tests for visibility but T2 must delete both.

## Summary counts

- **DELETE_SAFE: 27 files** (26 audit-scope legacy + 1 paired hygiene test)
  - 1 `WizardContext.tsx`
  - 3 `hooks/{useOnboardingState,useBotsson,useScrollProgress}.ts`
  - 1 `hooks/__tests__/useBotsson.test.ts` (paired with `useBotsson.ts`)
  - 1 `lib/tool-schemas.ts`
  - 9 `sections/*.tsx`
  - 11 `components/*.tsx`
  - 1 `steps/ConfirmProfessions.tsx` (orphan, not imported by `wizard-definition.ts`)
- **KEEP_LIVE: 26 files** (live AnimatedWizardShell tree + 4 unit tests against live lib/)
- **NEEDS_MIGRATION: 0 files**

## ADR-0123 latent-violation inventory

For F-OB-10-04 audit cross-reference — `hooks/useOnboardingState.ts` performs three pre-workspace EF invocations that are outside ADR-0123 v2 allowlist (`accept-invitation` only). All three vanish on deletion:

| Line | EF name | ADR-0123 status |
|---|---|---|
| L426/L433 | `gather-workspace-intelligence` | Pre-workspace, JWT-auth, content-generation — NOT in allowlist |
| L583/L585 | `search-brreg` | Pre-workspace, JWT-auth — NOT in allowlist |
| L655/L657 | `scrape-website` | Pre-workspace, JWT-auth — NOT in allowlist |
| L831 | `finalize-workspace` | Canonical finalization EF — allowed |

T2 deletion of `useOnboardingState.ts` closes F-OB-10-04 automatically.

## Out of scope (per parent plan)

- F-OB-04 BFF wiring (`/api/emma/session` orphan) — separate decision
- `DomainChatOwnership` primitive build (ADR-0238 implementation)
- `createOnboardingTools` removal from `@smartout/agent-sdk` exports — T3 covers via doc updates per parent plan, but agent-sdk surface change itself sits in scope but is not part of T1 mapping
- `packages/ai/src/missions/registry.ts:57,152` instruction-text edits — T3 docs work
- `voice-sdk-architecture.md` + `environment-ui-control.md` doc updates — T3
