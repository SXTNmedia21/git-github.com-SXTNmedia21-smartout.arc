---
title: "Employee Onboarding Wizard — Design Spec"
status: draft
created: 2026-03-24
updated: 2026-03-24
module: onboarding
tags: [onboarding, wizard, employee, mobile, ux, design]
---

# Employee Onboarding Wizard — Design Spec

## Summary

A 5-step fullscreen stepper wizard that replaces the current `/welcome` page. It is the first thing an invited employee (or manager) sees after accepting their invitation via `/invite/[token]`. The wizard uses "guided tap" interaction with real Smartout component illustrations (shift cards, navigation cards, notification demos) powered by Framer Motion spring animations and the "Ren og Varm" design system.

**Goal:** Make every new user confident and oriented within 90 seconds. Teach _responsibilities_ (confirm shifts, check notifications, complete training), not just button locations.

**Platforms:** Web (Next.js) + Mobile (React Native/Expo). Shared state/logic in `packages/`, platform-specific UI.

---

## Context

### Current Flow

```
/invite/[token] --> /welcome (celebration + "Kom i gang") --> /dashboard
```

### New Flow

```
/invite/[token] --> /welcome (5-step onboarding wizard) --> /my-schedule (or role-specific)
```

### What Exists Today

- Company onboarding wizard (`/onboarding/`) — for admin/owner workspace setup. NOT for employees.
- Invite acceptance page (`/invite/[token]`) — creates auth user + profile + company_member.
- Welcome page (`/welcome`) — brief celebration, single CTA to dashboard.
- My Training (`/dashboard/my-training`) — protocol assignment tracking for employees.
- Mobile invite flow (`InviteEntry.tsx`) — token validation, no post-accept onboarding.

### The Gap

There is no guided post-invite onboarding flow. After accepting an invite, users land on a generic celebration page and are dropped into the dashboard with no context.

---

## AI Council Review

Stress-tested by 12-persona council. Key outcomes:

| Verdict  | Issue                                                              | Resolution                                                            |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| BLOCK    | Accessibility — guided tap inaccessible to screen readers/keyboard | Design keyboard/screen reader flow first, add visual on top           |
| MUST FIX | Simulated UI teaches button locations, not mental models           | Shift to responsibility-oriented content with illustrative components |
| MUST FIX | Shared hook will diverge — Framer Motion is web-only               | Share state interface in packages/, platform-specific animation       |
| MUST FIX | Single integer progress tracking insufficient for analytics        | JSONB column with step timestamps and completion data                 |
| CONCERN  | Swipe conflicts with system gestures on mobile                     | Tap-to-advance with "Next" button, not swipe                          |
| CONCERN  | i18n — many hospitality workers are not Norwegian speakers         | i18n keys from day 1, Norwegian + English                             |
| CONCERN  | Bundle size — heavy animations on first impression                 | Code-split per step, target < 50KB gzipped total                      |
| APPROVE  | Security — post-auth flow, limited attack surface                  | Sanitize inviter name against XSS (React default escaping)            |
| APPROVE  | Norwegian labor law — no compliance issues                         | Wizard must NEVER gate access to schedule or pay information          |

---

## Architecture

### Route & Component Tree

```
/welcome (route — replaces current welcome page)
|-- WelcomeWizard.tsx (fullscreen stepper container)
|   |-- StepIndicator (5 dots at top)
|   |-- BotsssonBubble (guide text with aria-live)
|   |-- AnimatePresence --> step components:
|   |   |-- Step1Welcome.tsx      — Personal welcome
|   |   |-- Step2YourWorkday.tsx   — Responsibilities + shift card illustration
|   |   |-- Step3Navigation.tsx    — Tool overview (4 cards)
|   |   |-- Step4StayUpdated.tsx   — Notifications + communication
|   |   |-- Step5Ready.tsx         — Summary + first task + CTA
```

### Web/Mobile Split

| Layer  | Location                           | Contents                                                                                                                           |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Shared | `packages/onboarding/`             | `OnboardingState`, `OnboardingStep`, `OnboardingEngine` interface, `advanceStep()`, `canResume()`, DB sync logic, telemetry events |
| Web    | `apps/web/src/app/welcome/`        | Framer Motion animations, Tailwind styling, shadcn/ui components                                                                   |
| Mobile | `apps/mobile/src/screens/Welcome/` | Reanimated 3 animations, React Native primitives, design tokens from `native.ts`                                                   |

### Data Persistence

New JSONB column on `profile` table:

```sql
ALTER TABLE profile ADD COLUMN onboarding_progress jsonb DEFAULT NULL;
```

Schema:

```typescript
type OnboardingStep = 1 | 2 | 3 | 4 | 5;

type OnboardingProgress = {
  current_step: OnboardingStep;
  completed_steps: OnboardingStep[];
  started_at: string; // ISO timestamp
  step_timestamps: Record<string, string>; // step number -> completion timestamp
  completed_at: string | null; // null until all 5 steps done
  skipped: boolean;
};
```

Updated after every step completion (not just at the end). RLS covered by existing profile policies.

### Resume Logic

1. User lands on `/welcome`
2. Hook checks `profile.onboarding_progress`
3. If `completed_at` exists --> redirect to `/my-schedule`
4. If `current_step > 1` --> show "Velkommen tilbake!" + jump to correct step
5. If null --> start from step 1

### Context Data

```typescript
type OnboardingContext = {
  workspace_name: string;
  inviter_name: string | null;
  department_name: string | null;
  team_name: string | null;
  first_name: string;
  role: string; // "employee" | "manager"
  assigned_protocols_count: number;
  first_shift: ShiftPreview | null; // real data if available
};
```

Sources:

- `workspace` + `inviter_name` --> from invitation (query params or DB lookup)
- `department_name`, `team_name` --> from profile + relations
- `first_shift` --> from `schedule_shift` (can be null)
- `assigned_protocols_count` --> from `protocol_assignment` count

---

## The 5 Steps

### Step 1: Velkommen til Smartout

**Purpose:** Personal, warm welcome. Build belonging.

**Content:**

- Botsson bubble: "Hei [first_name]! [inviter_name] har invitert deg til [workspace_name]. Jeg er Botsson — jeg hjelper deg a komme i gang."
- Animated reveal: workspace name with warm spring animation
- Brief overview: your team, your department, your leader
- Data: all from invitation + profile (already available after accept)

**Interaction:** Read + tap "Neste" (low friction — first step should feel safe)

**Accessibility:** Botsson text announced via `aria-live="polite"`. Focus on "Neste" button after animation completes.

---

### Step 2: Din arbeidshverdag

**Purpose:** Understand _responsibilities_, not features. "What is expected of you?"

**Content:**

- Botsson: "I Smartout ser du vaktene dine, bekrefter dem, og folger med pa endringer. La meg vise deg."
- An illustrative shift card slides in (with mock or real data: "I morgen kl 10:00-18:00, Kjokken")
- User taps the card --> it expands showing details (time, position, department, tasks)
- Botsson: "Nar du far en vakt, MA du bekrefte den. Slik vet lederen din at du kommer."

**Key principle:** Responsibility + consequence, not feature tour. The card illustrates, it is not a sandbox.

**Interaction:** Tap shift card to expand. Card must be expanded before "Neste" becomes active.

**Accessibility:** Card is focusable, Enter/Space opens it, `aria-expanded` state, expanded content announced.

---

### Step 3: Navigering & verktoy

**Purpose:** "Where do you find things?" — overview, not hands-on tour.

**Content:**

- Botsson: "Her er det viktigste du trenger a vite."
- 4 animated cards stagger in:
  - Schedule icon — "Vaktplan" — "Se vaktene dine og bekreft"
  - Book icon — "Opplaering" — "Fullfar oppgaver for a bli klar"
  - BookOpen icon — "Handboken" — "Alt du trenger a vite om arbeidsplassen"
  - Settings icon — "Innstillinger" — "Profil, varsler, sprak"
- Each card has Lucide icon, title, one sentence description

**Interaction:** Tap each card to see a brief elaboration (1-2 sentences + small animation). All 4 must be opened before "Neste" activates.

**Accessibility:** Tabbable with Tab, Enter opens, `aria-expanded`, screen reader reads card content. Focus order: card 1-4 then Neste.

---

### Step 4: Hold deg oppdatert

**Purpose:** "Smartout talks to you — this is how."

**Content:**

- Botsson: "Noen ganger skjer det endringer. Slik varsler vi deg."
- Animated demo notification slides in from top:
  - Bell icon: "Vakten din 25. mars er endret til 12:00-20:00"
- User taps notification --> it expands showing detail + action button ("Bekreft endring")
- Botsson: "Sjekk varslene dine jevnlig. Viktige ting dukker opp her."

**Key principle:** Notifications mean "something needs your attention NOW."

**Interaction:** Tap notification to expand. Must be expanded before "Neste" activates.

**Accessibility:** Notification announced with `aria-live="assertive"`. Focusable, Enter/Space to expand.

---

### Step 5: Du er klar!

**Purpose:** Celebration + direction. "What do you do now?"

**Content:**

- Botsson: "Bra jobba, [first_name]! Du er klar til a starte."
- Subtle celebration (warm-toned glow/pulse around profile avatar — not confetti. "Ren og Varm" is warm, not overdramatic.)
- Summary: 4 mini-icons for what they learned (shift card, tools, notifications, team)
- First task direction:
  - If assigned protocols exist --> "Din forste oppgave venter i Opplaering"
  - Else --> "Sjekk vaktplanen din"
- CTA button: "Start" --> navigates to `/my-schedule` (employee) or role-specific page

**Completion:** `profile.onboarding_progress.completed_at` is set. Telemetry `onboarding_completed` emitted.

**Accessibility:** Focus on CTA button. Summary announced via `aria-live`.

---

## Visual Design

### Layout

- Fullscreen, vertically centered content
- Web: max-width 640px, centered
- Mobile: full width, respecting safe areas (notch, home indicator, dynamic island)
- Background: `--background` (oklch 0.99 0.004 60 — warm cream light / oklch 0.145 dark)
- Cards: `--card` with `--border` shadow, rounded-2xl (16px)
- Step indicator: 5 dots at top. Active: `--brand-orange`. Completed: `--success`. Upcoming: `--border`.

### Typography

| Element           | Font                              | Size                  | Color                     |
| ----------------- | --------------------------------- | --------------------- | ------------------------- |
| Botsson name      | `font-heading` (Instrument Serif) | text-xl               | `--foreground`            |
| Botsson text      | `font-body` (Geist Sans)          | text-base             | `--foreground`            |
| Card titles       | `font-heading`                    | text-lg               | `--foreground`            |
| Card descriptions | `font-body`                       | text-sm               | `--muted-foreground`      |
| CTA buttons       | `font-body`                       | text-sm font-semibold | white on `--brand-orange` |

### Animations (Framer Motion — web)

```
Step transition:    exit: opacity 0, x -40
                    enter: opacity 0, x 40 --> visible
                    spring: stiffness 35, damping 22, mass 2

Card stagger:       staggerChildren: 0.12, delayChildren: 0.2
                    Each card: opacity 0 --> 1, y 20 --> 0, same spring

Botsson bubble:     opacity 0 --> 1, y 10 --> 0, 300ms ease
                    Text: typewriter effect, character by character, 20ms interval

Shift card tap:     layoutId for smooth expand
                    spring: stiffness 40, damping 24

Notification:       slides in from top, y -60 --> 0
                    spring: stiffness 30, damping 20

Celebration:        subtle glow-pulse on avatar
                    scale 1 --> 1.05 --> 1, 2s ease-in-out loop
```

### prefers-reduced-motion

All spring animations --> `duration: 0`. No typewriter effect. Minimal fade (150ms) for transitions. Glow-pulse --> static highlight. All content immediately visible.

### Dark Mode

Fully supported via CSS variables. Background switches to `--background` dark (oklch 0.145), cards to `--card` dark (oklch 0.205). All semantic colors adapt automatically.

### Icons

Lucide React only. Relevant icons:

- `CalendarDays` (schedule)
- `BookOpen` (handbook)
- `GraduationCap` (training)
- `Settings` (settings)
- `Bell` (notifications)
- `CheckCircle2` (completion)
- `Bot` (Botsson)

---

## Accessibility Requirements

These are mandatory, not nice-to-have.

1. **Keyboard navigation:** Every interactive element reachable via Tab. Enter/Space to activate. Visible focus indicators (`focus-visible:ring-2 ring-brand-orange`).
2. **Screen readers:** Botsson bubbles use `role="status"` + `aria-live="polite"`. Notification demo uses `aria-live="assertive"`. Card expand/collapse uses `aria-expanded`. Step changes announced.
3. **Reduced motion:** `prefers-reduced-motion: reduce` --> instant transitions, no typewriter, no springs. Content identical, just no animation.
4. **Touch targets:** Minimum 44x44px for all interactive elements.
5. **Color contrast:** All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text). Tested in both light and dark mode.
6. **No gating:** The wizard must NEVER block access to essential employment information (schedule, pay). It is an introduction, not a gate.

---

## i18n

All text via i18n keys from day 1. Two languages at launch:

- **Norwegian Bokmal** (default)
- **English** (second — many hospitality workers in Norway are international)

String interpolation with names uses ICU MessageFormat for grammatical safety across languages.

Namespace: `onboarding.*` (e.g., `onboarding.step1.botsson_greeting`, `onboarding.step2.shift_card_label`)

---

## Telemetry

All events emitted via `@smartout/telemetry` `emit()`:

| Event                       | When                        | Payload                                           |
| --------------------------- | --------------------------- | ------------------------------------------------- |
| `onboarding_started`        | Step 1 shown                | `{ profile_id, workspace_id, role }`              |
| `onboarding_step_completed` | Each step done              | `{ profile_id, step_number, duration_ms }`        |
| `onboarding_completed`      | Step 5 CTA tapped           | `{ profile_id, workspace_id, total_duration_ms }` |
| `onboarding_resumed`        | Returned after interruption | `{ profile_id, resumed_at_step }`                 |

Routes to: PostHog (analytics) + activity_trail (audit) + Logger (stdout).

---

## Performance Targets

- Total bundle for wizard: < 50KB gzipped
- Code-split: each step loaded on demand (dynamic import)
- CSS animations where possible instead of JS-driven springs
- Profile on 4x CPU throttle (Chrome DevTools) before shipping
- No `layout` animations from Framer Motion (expensive)
- Images/illustrations: SVG or Lucide icons only, no raster assets

---

## Database Migration

Single migration adding the JSONB column:

```sql
-- Add onboarding progress tracking to profile
ALTER TABLE profile ADD COLUMN onboarding_progress jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profile.onboarding_progress IS
  'JSONB tracking employee onboarding wizard progress. Schema: { current_step, completed_steps[], started_at, step_timestamps{}, completed_at, skipped }';
```

No new tables. No new enums. No RLS changes needed (existing profile policies cover it).

---

## Routing & Guards

### Web

```
/welcome --> WelcomeWizard (if profile.onboarding_progress.completed_at is null)
/welcome --> redirect to /my-schedule (if onboarding already completed)
```

The `/welcome` route checks auth session. If no session --> redirect to `/login`. If session but no profile --> redirect to `/invite` error.

### Mobile

Same logic via React Navigation. `WelcomeScreen` checks onboarding progress on mount.

### Admin bypass

The onboarding wizard only targets profiles created via invitation (role = employee or manager in a workspace). Admins/owners who create the workspace go through the company onboarding wizard (`/onboarding/`) instead. No overlap.

---

## Scope Boundaries

### In scope (this spec)

- 5-step wizard replacing `/welcome`
- Shared onboarding engine in `packages/onboarding/`
- Web implementation (Framer Motion, Tailwind, shadcn)
- DB migration (JSONB column)
- Telemetry events
- i18n keys (Norwegian + English)
- Accessibility (keyboard, screen reader, reduced motion)
- Resume logic

### Out of scope (future work)

- Mobile implementation (React Native) — separate PR, uses same shared engine
- Role-specific onboarding steps (manager tools, admin features) — separate spec
- Admin visibility into completion rates — separate feature
- Automated nudge for incomplete onboarding — separate feature
- Botsson voice (audio) — text only in this version
- Coach marks in real UI after onboarding — separate feature
- "Skip onboarding" admin control — separate feature

---

## File Structure (planned)

```
packages/onboarding/
|-- src/
|   |-- types.ts              -- OnboardingStep, OnboardingProgress, OnboardingContext, OnboardingEngine
|   |-- state.ts              -- State machine logic, step validation
|   |-- persistence.ts        -- DB read/write for onboarding_progress
|   |-- telemetry.ts          -- Event definitions and emit wrappers
|   |-- index.ts              -- Package exports

apps/web/src/app/welcome/
|-- page.tsx                   -- Route entry, auth guard, redirect logic
|-- _components/
|   |-- WelcomeWizard.tsx      -- Stepper container, AnimatePresence
|   |-- StepIndicator.tsx      -- 5-dot progress indicator
|   |-- BotsssonBubble.tsx     -- Botsson text bubble with typewriter
|   |-- Step1Welcome.tsx       -- Personal welcome
|   |-- Step2YourWorkday.tsx   -- Shift card illustration
|   |-- Step3Navigation.tsx    -- 4 tool cards
|   |-- Step4StayUpdated.tsx   -- Notification demo
|   |-- Step5Ready.tsx         -- Summary + CTA
|   |-- ShiftCardDemo.tsx      -- Interactive shift card (illustrative)
|   |-- NotificationDemo.tsx   -- Interactive notification (illustrative)
|   |-- NavigationCard.tsx     -- Expandable info card
|-- _hooks/
|   |-- useEmployeeOnboarding.ts  -- Web-specific hook wrapping packages/onboarding

supabase/migrations/
|-- YYYYMMDDHHMMSS_add_onboarding_progress.sql
```
