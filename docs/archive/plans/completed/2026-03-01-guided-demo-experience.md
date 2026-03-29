---
title: "Guided Demo Experience — Interaktiv demo med AI-assistent"
id: PLAN_GUIDED_DEMO
status: draft
layer: plan
created: 2026-03-01
updated: 2026-03-01
depends_on:
  - ADR_0031
  - FOUND_PRODUCT_ID
---

# Guided Demo Experience — Implementation Plan

> **For Claude:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-guided interactive demo on the landing page where visitors experience 6 real user journeys — with a chat assistant (text or voice) that guides them step by step through each scenario.

**Tech Stack:** Next.js App Router, Framer Motion, Tailwind v4, Ultravox (voice), scripted conversation config (JSON), existing feature page UIs reused as demo panels.

---

## Core Concept

When a visitor clicks "Interaktiv demo" on the landing page, they land on a **hub page** listing 6 user journeys. Each card shows: persona (ansatt / leder / ny ansatt), scenario name, estimated time (2–3 min), and a Start button.

Clicking Start opens a **split-screen shell**:

- **Left (70%)** — the product UI for that journey (adapted from existing feature pages)
- **Right (30%)** — the AI assistant chat panel (text + optional voice via Ultravox)

The assistant sends scripted messages that guide the visitor through the scenario. Quick-reply buttons appear in the chat. UI elements on the left are highlighted at each step. "Gå videre →" advances to the next step.

The visitor can switch to voice mode at any time. Voice uses Ultravox, same as the existing voice-assistant component.

---

## The 6 Journeys

| #   | Scenario                              | Persona   | Existing UI               |
| --- | ------------------------------------- | --------- | ------------------------- |
| 1   | Stämpla in på vakt og utfør oppgavene | Ansatt    | punchclock + task-rutines |
| 2   | Lag vaktlista med AI-assistent        | Leder     | shiftplanner              |
| 3   | Utfør en kunskapsquiz                 | Ansatt    | staff-training            |
| 4   | Registrer en avviksmeldning           | Ansatt    | Chat-only (ny UI)         |
| 5   | Utfør en HACCP-kontroll               | Ansatt    | haccp-complience          |
| 6   | Onboarding — første dag som ny ansatt | Ny ansatt | Ny onboarding-UI          |

**Journey 5 — HACCP:** Ansatt registrerer temperaturer i kjølerom, får godkjent-status, og forstår at avvik hadde utløst alarm til leder. Viser food safety compliance.

**Journey 6 — Onboarding:** Ny ansatt mottar velkommen fra Lise, godtar arbeidsreglement, fullfører sin første opplæringsprotokoll, og ser "Klar til vakt"-statusen. Viser core-løftet: klar fra dag én.

---

## Architecture Overview

```
apps/landing/src/app/demo/
  page.tsx                    ← Hub: 6 journey cards
  layout.tsx                  ← Minimal layout (no landing nav)
  [journey]/
    page.tsx                  ← Journey shell (split layout)

apps/landing/src/components/demo/
  DemoShell.tsx               ← Split: FeaturePanel (left) + AssistantPanel (right)
  AssistantPanel.tsx          ← Chat messages, input, voice toggle, quick replies
  JourneyCard.tsx             ← Hub card (icon, persona, name, time, CTA)
  JourneyProgress.tsx         ← Step indicator (1 of N dots at top)
  journeys/
    types.ts                  ← JourneyConfig, JourneyStep, QuickReply types
    index.ts                  ← Journey registry (all 6 configs)
    journey-1-punch-in.ts
    journey-2-schedule-ai.ts
    journey-3-quiz.ts
    journey-4-deviation.ts
    journey-5-haccp.ts
    journey-6-onboarding.ts
```

### Journey step schema (types.ts)

```typescript
type JourneyStep = {
  id: string;
  assistantMessage: string; // What the assistant says
  typingDelayMs?: number; // Simulate typing (default 800)
  quickReplies?: QuickReply[]; // Suggested responses in chat
  highlight?: string; // CSS selector to pulse-highlight in UI
  autoAdvanceMs?: number; // Auto-advance after N ms (no user action needed)
  uiState?: Record<string, unknown>; // State to inject into the feature UI
};

type QuickReply = {
  label: string;
  advancesToStep?: string; // Step ID to jump to (default: next)
};

type JourneyConfig = {
  id: string;
  persona: "ansatt" | "leder" | "ny-ansatt";
  title: string;
  subtitle: string;
  duration: string; // "2 min"
  icon: string; // lucide icon name
  accentColor: string; // tailwind color class
  steps: JourneyStep[];
  featureComponent: React.ComponentType<DemoFeatureProps>;
};
```

### State management

All demo state is local (no server). `useDemoJourney()` hook manages:

- current step index
- chat message history
- UI state injected into feature component
- voice mode on/off

---

## Prerequisites

- [ ] Existing feature pages readable (they are — confirmed)
- [ ] Ultravox credentials available in `.env.local` (existing voice-assistant uses it)
- [ ] Landing page has a "Interaktiv demo" CTA that routes to `/demo`

---

## Tasks

### Task 1: Journey types + config skeleton

**What:** Create `src/components/demo/journeys/types.ts` with all TypeScript types. Create `index.ts` exporting the registry. Create 6 empty journey config files with title/persona/icon/accentColor but no steps yet.

**Files:**

- `apps/landing/src/components/demo/journeys/types.ts` (new)
- `apps/landing/src/components/demo/journeys/index.ts` (new)
- `apps/landing/src/components/demo/journeys/journey-1-punch-in.ts` (new, skeleton)
- `apps/landing/src/components/demo/journeys/journey-2-schedule-ai.ts` (new, skeleton)
- `apps/landing/src/components/demo/journeys/journey-3-quiz.ts` (new, skeleton)
- `apps/landing/src/components/demo/journeys/journey-4-deviation.ts` (new, skeleton)
- `apps/landing/src/components/demo/journeys/journey-5-haccp.ts` (new, skeleton)
- `apps/landing/src/components/demo/journeys/journey-6-onboarding.ts` (new, skeleton)

**Acceptance:** TypeScript compiles. Registry exports array of 6 journey configs.

---

### Task 2: AssistantPanel component

**What:** Chat panel with message history, text input, send button, and voice toggle. Messages animate in with Framer Motion. Quick reply chips appear below messages. Voice toggle shows mic icon (Ultravox integration stubbed for now). Panel has Lise Botsson avatar at top.

**Files:**

- `apps/landing/src/components/demo/AssistantPanel.tsx` (new)

**Acceptance:** Renders correctly in isolation. Messages animate in. Quick replies clickable. Voice toggle switches icon state.

---

### Task 3: JourneyProgress component

**What:** Horizontal step indicator at the top of the journey shell. Shows numbered dots (e.g., ● ● ○ ○ ○) with current step highlighted in orange. Also shows journey title and persona badge (Ansatt / Leder / Ny ansatt).

**Files:**

- `apps/landing/src/components/demo/JourneyProgress.tsx` (new)

**Acceptance:** Renders correct number of dots. Active dot is orange. Completed dots are smaller/dimmer.

---

### Task 4: DemoShell component

**What:** Split layout wrapper. Left 70%: `{children}` (the feature UI). Right 30%: `AssistantPanel`. On mobile: stacked (assistant on top, feature below). Includes `JourneyProgress` at top. Manages the `useDemoJourney()` hook and passes state down.

**Files:**

- `apps/landing/src/components/demo/DemoShell.tsx` (new)
- `apps/landing/src/components/demo/useDemoJourney.ts` (new hook)

**Acceptance:** Shell renders with children on left, panel on right. Hook advances steps on quick-reply click. Auto-advance works.

---

### Task 5: Hub page + layout

**What:** `/demo` hub page with 6 `JourneyCard` components in a grid. Each card: icon, persona badge, title, subtitle, duration, "Start →" button. Dark background matching landing page style. Simple back arrow to home. No landing navigation (clean demo env).

**Files:**

- `apps/landing/src/app/demo/page.tsx` (new)
- `apps/landing/src/app/demo/layout.tsx` (new — minimal, no nav)
- `apps/landing/src/components/demo/JourneyCard.tsx` (new)

**Acceptance:** Hub page renders 6 cards. Clicking "Start →" routes to `/demo/[journey-id]`.

---

### Task 6: Journey shell page (routing)

**What:** `/demo/[journey]` page. Reads `journey` param, looks up config from registry, renders `DemoShell` with the correct feature component and journey steps.

**Files:**

- `apps/landing/src/app/demo/[journey]/page.tsx` (new)

**Acceptance:** Each of the 6 routes renders without error. 404 for unknown journey IDs.

---

### Task 7: Journey 1 — Stämpla in + utfør oppgaver

**What:** Feature component: adapted punchclock UI → task list UI. Demo state machine:

- Step 1: "Hei! Du starter vakt om 15 minutter. La oss starte med innstemplingen." → highlight clock-in button
- Step 2: [User clicks in UI or replies "Stem inn"] → animation: clock-in confirmed → "Perfekt! Du er nå innstemplet. Her er oppgavene dine for i dag."
- Step 3: Task list appears → "Start med å huke av den første oppgaven."
- Step 4: [User checks task] → "Bra! Du er godt i gang. Fortsett slik til vakten er ferdig."
- Step 5: Auto-advance → "Slik ser det ut fra lederens side — de ser status i sanntid." → brief stats view

**Files:**

- `apps/landing/src/components/demo/journeys/journey-1-punch-in.ts` (fill steps)
- `apps/landing/src/components/demo/features/FeaturePunchIn.tsx` (adapted from punchclock page)

**Acceptance:** Journey plays through all 5 steps. Transitions feel natural.

---

### Task 8: Journey 2 — Lag vaktlista med AI

**What:** Feature component: shiftplanner grid with a pre-seeded coverage gap (Housekeeping mangler tirsdag). Chat guides manager to ask Lise to fix it. Lise "replies" with a suggestion that fills the gap in the grid. Manager approves → shift turns green.

**Files:**

- `apps/landing/src/components/demo/journeys/journey-2-schedule-ai.ts`
- `apps/landing/src/components/demo/features/FeatureSchedule.tsx` (adapted shiftplanner with controllable state)

**Acceptance:** Coverage gap visible at start. Lise's suggestion fills it in the grid. Approval animation works.

---

### Task 9: Journey 3 — Kunskapsquiz

**What:** Feature component: quiz UI (adapted from staff-training page, expanded to 3 questions). Assistant presents each question with encouragement. Wrong answer: gentle correction. Right answer: advance. Final score screen.

**Files:**

- `apps/landing/src/components/demo/journeys/journey-3-quiz.ts`
- `apps/landing/src/components/demo/features/FeatureQuiz.tsx`

**Acceptance:** 3 questions. Correct/wrong feedback. Score shown at end.

---

### Task 10: Journey 4 — Avviksmeldning via chat

**What:** Feature component: a clean chat-only UI (no grid — chat IS the feature). Assistant guides through: "Hva skjedde?" → user types → "Når skjedde dette?" → structured → "Takk, meldingen er registrert og sendt til leder." Shows the submitted summary card at the end.

**Files:**

- `apps/landing/src/components/demo/journeys/journey-4-deviation.ts`
- `apps/landing/src/components/demo/features/FeatureDeviation.tsx` (chat-only UI, new)

**Acceptance:** Free-text input accepted. Summary card shown at end. Feels like a real chat.

---

### Task 11: Journey 5 — HACCP-kontroll

**What:** Feature component: adapted haccp page. Temperature slider for kjølerom. Steps: check 3 units → one is at +9°C (too warm) → assistant flags it → user confirms → alert generated.

**Files:**

- `apps/landing/src/components/demo/journeys/journey-5-haccp.ts`
- `apps/landing/src/components/demo/features/FeatureHaccp.tsx`

**Acceptance:** 3 temperature checks. Avvik triggers red alert. Resolved state shown.

---

### Task 12: Journey 6 — Onboarding ny ansatt

**What:** Feature component: new onboarding UI. Steps: Welcome screen with name → accept arbeidsreglement (toggle) → first protocol (3 items to read + confirm) → "Klar til vakt!" completion screen with green badge.

**Files:**

- `apps/landing/src/components/demo/journeys/journey-6-onboarding.ts`
- `apps/landing/src/components/demo/features/FeatureOnboarding.tsx` (new UI)

**Acceptance:** Full flow completes. "Klar til vakt" screen renders. Feels like real onboarding.

---

### Task 13: Connect voice (Ultravox)

**What:** When visitor toggles voice mode in AssistantPanel, Ultravox session starts. System prompt is the current journey context. Assistant speaks the scripted message. Visitor can speak quick replies. Text mode resumes if voice is turned off.

**Files:**

- `apps/landing/src/components/demo/AssistantPanel.tsx` (update)
- `apps/landing/src/components/demo/useVoiceDemo.ts` (new hook, wraps Ultravox)

**Acceptance:** Voice toggles on/off without error. Assistant speaks current step message. Basic STT for quick replies works.

---

### Task 14: Landing page CTA → /demo

**What:** Update the primary landing page CTA button(s) to route to `/demo`. Check VariantS, VariantA, VariantK and any other active variants.

**Files:**

- `apps/landing/src/components/landing/VariantSLanding.tsx`
- `apps/landing/src/components/landing/VariantALanding.tsx`
- `apps/landing/src/components/landing/VariantKLanding.tsx`
- (others as found)

**Acceptance:** "Interaktiv demo" CTA navigates to `/demo`. Waitlist/signup CTAs unchanged.

---

## Validation

- [ ] `pnpm typecheck` passes (no TypeScript errors)
- [ ] `pnpm --filter landing dev` starts without errors
- [ ] All 6 journeys reachable via `/demo/[id]`
- [ ] Each journey plays through all steps without errors
- [ ] Voice toggle opens/closes Ultravox without crash
- [ ] Mobile layout: stacked (assistant above, feature below)
- [ ] Hub page shows all 6 cards with correct persona/color

---

## Build order rationale

Tasks 1–6 are the skeleton (types, shell, hub, routing). Tasks 7–12 are the 6 journeys — they can be built one at a time and shipped incrementally. Task 13 (voice) can be done last or skipped for v1. Task 14 is the final wire-up.

**Recommended ship order:**

- v0.1: Tasks 1–6 + Journey 2 (schedule AI — most impressive, best demo)
- v0.2: Journeys 1, 3, 4
- v0.3: Journeys 5, 6 + Voice

---

## Post-Implementation

- [ ] ADR for demo routing strategy (static scripted vs live AI)
- [ ] Register in `docs/INDEX.md` under Plans
- [ ] Move to `docs/plans/completed/` when done

---

> After writing: add to `docs/INDEX.md` under Plans.
