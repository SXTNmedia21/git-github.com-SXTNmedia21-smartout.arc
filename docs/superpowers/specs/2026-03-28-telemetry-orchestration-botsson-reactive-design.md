---
title: Telemetry Orchestration & Reactive Botsson — Join, Onboarding, Setup
status: draft
updated: 2026-03-28
created: 2026-03-28
module: telemetry, ai, onboarding
tags: [telemetry, botsson, reactive, error-handling, onboarding, council-reviewed]
---

# Telemetry Orchestration & Reactive Botsson

> Council-reviewed 2026-03-28. Verdict: APPROVE WITH CHANGES.
> Agents: System Steward (chair), Supervisor, Agent Coordinator, Frontend Designer.

## 1. Problem

The join -> onboarding -> setup journey has telemetry infrastructure but three critical gaps:

1. **Errors are silent.** 10+ error paths in setupActions.ts, JoinScrapingProvider, and onboarding finalization only `console.error` or `throw`. No telemetry. No visibility. No user help.
2. **No reactive assistance.** When something goes wrong (scrape fails, auth error, provision fails), the user gets a generic error or nothing. Botsson has context to help but no mechanism to appear.
3. **Existing telemetry has bugs.** Double-emit on join completion, anonymous actor_id on onboarding events, wizard abandoned never fires, engine_event routing with null workspace_id.

## 2. Solution Overview

An error-first telemetry system where every failure emits a structured event, and Botsson reacts to errors immediately and to stalls conservatively.

```
Error occurs → emit(error event) → useBotssonReactive fires → Botsson appears (0ms delay)
User stalls  → timer threshold   → useBotssonReactive fires → Botsson appears (15-20s delay)
```

Three layers:

1. **Telemetry layer** — error events, BaseEvent extensions, routing fixes
2. **Reactive layer** — client-side hook that watches events and triggers Botsson
3. **UI layer** — Warm Orb Companion that presents help contextually

## 3. Design Principles

- **Error > progress.** Knowing when things break is more valuable than knowing when things work.
- **Deterministic > LLM.** Autofill is a pure mapping function, not AI inference. Botsson assists, never owns state (AI Runtime section 10.4).
- **Client-side > server-side.** Stall detection and nudges are UI concerns, not workflows. No engine_sessions, no engine_process, no server roundtrips.
- **Immediate on error, conservative on stall.** Error = 0ms delay. Stall = 15-20s + secondary signal.
- **Circuit breaker.** Botsson response events NEVER route to engine_event. Category `agent` events NEVER trigger Botsson reactions.

## 4. Three Botsson Contexts

| Phase          | Route              | workspace_id                       | Authority                           | Botsson capabilities              |
| -------------- | ------------------ | ---------------------------------- | ----------------------------------- | --------------------------------- |
| Pre-workspace  | `/join`            | null                               | Hardcoded client-side               | autofill, nudge, explain          |
| Bootstrap      | `/onboarding`      | exists, onboarding_completed=false | engine_authority_config (if seeded) | autofill, nudge, explain, suggest |
| Post-bootstrap | `/dashboard/setup` | exists, onboarding_completed=true  | Full authority                      | All capabilities                  |

Pre-workspace Botsson does NOT use AgentToolContext, engine_sessions, mission_runner, or authority tables. It is a client-side reactive companion with hardcoded capabilities. This is not a workaround — it is architecturally correct because authority is workspace-scoped and `/join` is pre-workspace.

## 5. BaseEvent Extensions

Add optional context fields to BaseEvent:

```typescript
interface BaseEvent {
  workspace_id: string | null;
  actor_id: string;
  timestamp?: string;
  correlation_id?: string;
  // NEW — auto-populated by emit()
  page?: string; // window.location.pathname
  phase?: "pre_auth" | "bootstrap" | "post_bootstrap";
  surface?: "wizard" | "dashboard" | "walkAi" | "mobile";
}
```

`emit()` auto-populates `page` from `window.location.pathname` on client-side only (`typeof window !== 'undefined'`). On server-side, `page` is `undefined` (omitted) — server-side emits don't have a route context. `phase` is derived from presence of workspace_id and onboarding_completed status. `surface` is passed by the calling component.

### Correlation ID

Client-generated UUIDv4 stored in `sessionStorage`. Passed on all `emit()` calls during the join session. After auth completes, the same correlation_id continues into post-auth events, enabling PostHog funnel linkage across the auth boundary.

## 6. Error Events (Priority 1 — MUST)

### 6.1 New error events to register

| Event                          | When                                                          | Destinations                    | Category   |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------- | ---------- |
| `scrape failed`                | Scraping timeout, 404, blocked, network error                 | posthog, logger                 | onboarding |
| `scrape partial`               | Scraping OK but missing expected fields                       | posthog, logger                 | onboarding |
| `brreg lookup_failed`          | Bronnysund registry lookup fails                              | posthog, logger                 | onboarding |
| `ai generation_failed`         | AI content generation (About/concept) fails                   | posthog, logger                 | onboarding |
| `auth signup_failed`           | Supabase auth error (duplicate email, weak password, network) | posthog, logger                 | auth       |
| `workspace provision_failed`   | RPC provision_onboarding_workspace fails                      | posthog, logger, activity_trail | onboarding |
| `workspace finalize_failed`    | Edge function finalize/activate fails                         | posthog, logger, activity_trail | onboarding |
| `industry_package load_failed` | Industry bootstrap fails                                      | posthog, logger, activity_trail | onboarding |

Note: Pre-workspace errors go to posthog + logger only (no activity_trail — no workspace to scope to). Post-workspace errors add activity_trail.

### 6.2 Error event interface

```typescript
interface ErrorEventData {
  error_code: string; // machine-readable: "SCRAPE_TIMEOUT", "AUTH_DUPLICATE_EMAIL"
  error_message: string; // human-readable (English, not user-facing)
  step_id?: string; // which wizard step the error occurred on
  wizard_id?: string; // "join", "onboarding", "setup"
  recoverable: boolean; // can the user retry or recover?
  context?: Record<string, unknown>; // step-specific context
}
```

### 6.3 Error event emission points

These are the specific code locations where emit() calls must be added:

| File                                 | Error path                   | Event                        |
| ------------------------------------ | ---------------------------- | ---------------------------- |
| `_hooks/useScrapedData.ts`           | catch blocks (3 locations)   | `scrape failed`              |
| `_context/JoinScrapingProvider.tsx`  | prefetchStatus="failed"      | `ai generation_failed`       |
| `_lib/setupActions.ts`               | identityError                | `workspace provision_failed` |
| `_lib/setupActions.ts`               | provisionError (RPC fails)   | `workspace provision_failed` |
| `_lib/setupActions.ts`               | workspaceUpdateError         | `workspace provision_failed` |
| `_lib/setupActions.ts`               | profileError                 | `workspace provision_failed` |
| `_components/Step6CreateAccount.tsx` | Supabase auth fails          | `auth signup_failed`         |
| `onboarding/wizard-definition.ts`    | Finalize edge function fails | `workspace finalize_failed`  |

Note: Scrape errors originate in `useScrapedData.ts` (the actual fetch hook), not `JoinScrapingProvider.tsx`. The provider handles AI content prefetching — its catch block maps to `ai generation_failed`.

### 6.4 Existing error event (already registered)

`wizard validation_failed` — already registered and emitted by useWizardTelemetry. No changes needed.

## 7. Botsson Response Events (Priority 1 — MUST)

New events for tracking Botsson interventions. Category: `agent`. NEVER route to `engine_event`.

| Event                      | Destinations    | When                                       |
| -------------------------- | --------------- | ------------------------------------------ |
| `botsson nudge_shown`      | posthog, logger | Botsson appears (error or stall triggered) |
| `botsson nudge_accepted`   | posthog, logger | User accepts Botsson's help                |
| `botsson nudge_dismissed`  | posthog, logger | User dismisses Botsson                     |
| `botsson autofill_applied` | posthog, logger | Botsson fills form fields from scrape data |

Properties on all Botsson events:

```typescript
{
  data: {
    trigger_type: 'error' | 'stall' | 'user_request';
    trigger_event?: string;     // the event that caused the nudge, e.g. "scrape failed"
    wizard_id: string;
    step_id: string;
    nudge_count: number;        // how many times Botsson has appeared this session
    action_type?: string;       // "autofill", "explain", "suggest_retry"
  }
}
```

### Circuit breaker rule

`useBotssonReactive` MUST ignore all events with category `agent`. This prevents:

```
botsson nudge_shown → useBotssonReactive sees event → triggers another nudge → infinite loop
```

Enforced in the hook, not by convention. The hook filters `e.detail.category !== 'agent'` before processing.

## 8. Telemetry Bug Fixes (Priority 2 — MUST)

### 8.1 Double-emit on join completion

**Problem:** `setupActions.ts:337` emits `wizard completed` with `wizard_id: "setup"`. `useWizardTelemetry` also emits `wizard completed` with `wizard_id: "join"` via AnimatedWizardShell's onComplete callback.

**Fix:** Remove the manual emit in `setupActions.ts`. The canonical path is `useWizardTelemetry.onComplete`. If server-side guarantee is needed, create a separate event `workspace provisioned` (not a wizard event).

### 8.2 Anonymous onboarding events

**Problem:** `/onboarding` page passes no `workspaceId` or `actorId` to AnimatedWizardShell. All onboarding telemetry events have `workspace_id: null` and `actor_id: "anonymous"`.

**Fix:** The onboarding `loadState()` already fetches `workspace_id`. Surface this to AnimatedWizardShell props. Also resolve `actorId` from the authenticated user.

### 8.3 engine_event routing with null workspace_id

**Problem:** `wizard step_completed` and `wizard completed` route to `engine_event`. During `/join`, workspace_id is null. engine-dispatch receives null-workspace payloads and drops them silently. In dev mode, client-side engine_event is disabled entirely (engine-event.ts:62).

**Fix:** Remove `engine_event` from wizard event routing. Wizard events are analytics, not workflow triggers. If `/onboarding` needs workflow triggering later, add separate workspace-scoped events.

### 8.4 Legacy useOnboardingState emits

**Problem:** `useOnboardingState.ts` lines 381 and 814 emit `wizard step_completed` and `wizard completed` manually.

**Verified:** `onboarding/page.tsx` renders ONLY `AnimatedWizardShell`. The legacy section components (BusinessSection, HeroSection, DepartmentsSection, etc.) and `WizardContext.tsx` that import `useOnboardingState` are NOT rendered by the current page. The manual emits are orphaned dead code — they do not cause double-emit today.

**Fix:** Remove the manual emit calls in `useOnboardingState.ts` (lines 381 and 814). Consider removing the entire legacy `WizardContext.tsx` + section components in a follow-up cleanup PR, since they are dead code.

### 8.5 wizard abandoned never emitted

**Problem:** Registered in registry (line 2479) but no code emits it.

**Fix:** Add `beforeunload` listener in WizardShell that emits `wizard abandoned` when wizardState !== 'completed' AND at least one step has been entered. Properties: `{ wizard_id, last_step, duration_ms }`.

**Browser limitation:** `beforeunload` severely limits what can execute. Use `navigator.sendBeacon()` for the abandon event to maximize delivery reliability. Accept that some abandon events will be lost (best-effort). This affects the `abandon_after_error` escalation gate — it is inherently best-effort, not guaranteed.

## 9. Reactive Layer — useBotssonReactive Hook

Client-side hook that subscribes to the `smartout:telemetry` CustomEvent bus and decides when Botsson should appear.

### 9.1 Interface

```typescript
interface BotssonReactiveState {
  shouldShow: boolean;
  nudgeType: "error" | "stall" | null;
  message: string; // Norwegian, user-facing
  actions: BotssonAction[]; // what Botsson can do right now
  dismiss: () => void;
  applyAction: (actionId: string) => void;
}

interface BotssonAction {
  id: string;
  label: string; // "Fyll ut for meg", "Prøv igjen"
  type: "autofill" | "retry" | "explain" | "skip";
}
```

### 9.2 Trigger rules

```typescript
type InterventionRule = {
  trigger: "error_event" | "stall" | "validation_repeated";
  match?: string; // event name pattern, e.g. "scrape failed"
  delay: number; // ms before Botsson appears (0 for errors)
  secondarySignal?: boolean; // require field interaction before stall triggers
  message: string; // Norwegian user-facing message
  actions: BotssonAction[]; // available actions
};
```

Rules live alongside the wizard definition in the same file — they are UI behavior, not business logic. They do not belong in cascade dimensions, control planes, or engine_process blueprints.

### 9.3 Error rules (immediate, 0ms delay)

> **i18n note:** All Norwegian strings below are design-time examples showing intended UX tone. Implementation MUST use i18n keys via `t()` from `@smartout/i18n`. Keys should be namespaced under `botsson.nudge.*` (e.g., `t("botsson.nudge.scrape_failed")`).

| Error event                      | Message                                                             | Actions        |
| -------------------------------- | ------------------------------------------------------------------- | -------------- |
| `scrape failed`                  | "Nettsiden svarte ikke. Du kan fylle ut manuelt, eller prøv igjen." | retry, skip    |
| `scrape partial`                 | "Vi fant noe, men ikke alt. Skal jeg fylle ut det vi har?"          | autofill, skip |
| `brreg lookup_failed`            | "Klarte ikke hente bedriftsinfo fra Brønnøysund."                   | skip           |
| `ai generation_failed`           | "AI-genereringen feilet. Her er noen maler du kan bruke."           | explain        |
| `auth signup_failed` (duplicate) | "Denne e-posten er allerede registrert. Logg inn i stedet?"         | explain        |
| `auth signup_failed` (weak pw)   | "Passordet er for svakt. Prøv med minst 8 tegn."                    | explain        |
| `workspace provision_failed`     | "Noe gikk galt under opprettelsen. Prøv igjen."                     | retry          |
| `workspace finalize_failed`      | "Kunne ikke fullføre oppsettet. Prøv igjen."                        | retry          |

### 9.4 Stall rules (conservative, 15-20s delay)

| Condition                              | Threshold      | Secondary signal                   | Message                                                              | Actions  |
| -------------------------------------- | -------------- | ---------------------------------- | -------------------------------------------------------------------- | -------- |
| Step 3 (About) + scrape data exists    | 15s            | Field focused but < 20 chars typed | "Jeg har allerede hentet info fra nettsiden din. Skal jeg fylle ut?" | autofill |
| Step 2 (Business) + brreg data exists  | 15s            | Field focused but empty            | "Jeg fant bedriftsinfo i Brønnøysund. Skal jeg fylle ut?"            | autofill |
| Step 4 (Hours) + scrape has hours      | 20s            | At least 1 day row empty           | "Jeg fant åpningstider på nettsiden. Skal jeg legge dem inn?"        | autofill |
| Any step + 3x validation_failed in 60s | 0s (immediate) | N/A                                | "Ser ut som noe er vanskelig. Trenger du hjelp?"                     | explain  |

### 9.5 Frequency capping

- Max 3 proactive appearances per wizard session (error + stall combined)
- After 3 dismissals, Botsson transitions to passive indicator (small orb, clickable)
- Counter stored in React `useRef` — resets on page reload
- Error events bypass frequency cap for the first occurrence per error type

### 9.6 Autofill mechanism

Deterministic mapping, not LLM. Pure function:

```typescript
function mapScrapedDataToStepState(
  scraped: ScrapedData,
  stepId: string,
): Partial<JoinState[keyof JoinState]> | null;
```

When user accepts autofill, Botsson calls `updateState()` from WizardShell — the canonical state mutation path. This ensures validation runs, `wizard fact_edited` fires, and localStorage persists. Botsson NEVER writes to DOM inputs directly or uses a side-channel.

## 10. UI Layer — Warm Orb Companion

### 10.1 Visual identity

- **Form:** 40px warm orb using `radial-gradient` with `--color-accent` (oklch 0.75 0.18 55)
- **Idle:** Gentle pulse (scale 0.95-1.05, 3s ease-in-out infinite)
- **Active:** Orb brightens, speech bubble extends from it
- **Speech bubble:** `--color-card` background, `backdrop-blur-xl`, 1px `--color-border`, noise overlay on dark surfaces
- **Text:** `--color-foreground` primary, `--color-muted-foreground` secondary

### 10.2 Spatial model

**Desktop:** `position: fixed`, bottom-right of form panel (offset by brand panel width). Speech bubble opens upward-left.

**Smart dodge:** If currently focused input is in bottom-right quadrant, Botsson relocates to bottom-left. Simple quadrant check.

**Mobile:** `position: fixed`, bottom-right above safe area. Speech bubble as bottom-sheet (full-width minus 32px margin). Suppress entirely when keyboard is open.

### 10.3 Motion choreography

**Entrance (600ms total):**

1. 0ms — Orb fades in at 0.5 scale, `springEntrance` (stiffness 38, damping 22, mass 2.2)
2. 200ms — Orb full size, glow shadow expands
3. 300ms — Speech bubble unfolds, `springSubtle` (stiffness 45, damping 24)
4. 400ms — Text fades in (opacity 0→1, 200ms)

**Exit (350ms total):**

1. 0ms — Text fades out (100ms)
2. 100ms — Bubble collapses toward orb (150ms spring)
3. 200ms — Orb shrinks and fades (150ms, easeIn)

**Autofill animation:**

1. Orb pulses once (scale 1→1.15→1)
2. Target fields receive `--color-accent / 0.2` box-shadow glow (300ms)
3. Values appear with typewriter stagger (30ms per character)
4. Glow fades over 500ms

**prefers-reduced-motion:** All motion collapses to instant opacity toggle.

### 10.4 Accessibility

- `role="status"` with `aria-live="polite"` — announced without stealing focus
- Placed after form content in DOM for natural Tab order
- Escape key dismisses
- Accept/dismiss buttons have Norwegian aria-labels
- After autofill, changed fields get brief `aria-live` announcements

### 10.5 Interaction states

| State     | Visual                                 | Trigger                     |
| --------- | -------------------------------------- | --------------------------- |
| Hidden    | No element                             | Default                     |
| Entering  | Orb scales up + bubble unfolds         | Error or stall rule fires   |
| Present   | Orb pulses, bubble visible with CTA    | Until action or 15s timeout |
| Accepted  | Orb glows, autofill animation          | User clicks accept          |
| Dismissed | Fade down and out                      | User clicks X or Escape     |
| Passive   | Tiny 24px orb, subtle pulse, clickable | After 3 dismissals          |

## 11. Escalation Gates

When errors cluster, something is systematically wrong. Botsson must detect this and escalate — not keep offering band-aids.

### 11.1 Escalation model

```
Single error → Botsson helps (explain, retry, autofill)
Pattern detected → Botsson escalates (captures context, alerts team, offers fallback)
```

Botsson has a dedicated `escalate` tool alongside its existing capabilities. Escalation is NOT "give up" — it is "get the right help."

### 11.2 Escalation gates

Gates listen to error event frequency and type patterns in the `useBotssonReactive` ring buffer.

| Gate                     | Trigger                                    | Botsson says                                                    | Escalation action                                                           |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Error burst**          | 3+ error events within 10 seconds          | "Noe ser ut til å være systematisk galt. Vi tar det herfra."    | Capture wizard state + error log → emit `escalation triggered` → team alert |
| **Repeated same error**  | Same error_code 3x (any timeframe)         | "Dette problemet vedvarer. La oss finne en løsning."            | Log pattern → offer alternative path or contact                             |
| **Auth loop**            | `auth signup_failed` 3x                    | "Det ser ut som det er et problem med kontoen. Vi hjelper deg." | Offer login link, password reset, or support contact                        |
| **Provision failure**    | `workspace provision_failed` after 1 retry | "Opprettelsen feilet to ganger. Vi fikser dette for deg."       | Capture e-post + state → team alert → "vi kontakter deg"                    |
| **Total error count**    | 5+ errors in a single wizard session       | "Du har truffet på flere problemer. Vi bør ta en titt."         | Offer direct support channel                                                |
| **Abandon after errors** | `wizard abandoned` AND error_count > 0     | (no UI — user left)                                             | Emit `escalation triggered` with full context for follow-up                 |

### 11.3 Escalation event

```typescript
interface EscalationTriggered extends BaseEvent {
  event: "escalation triggered";
  properties: {
    data: {
      gate: string; // "error_burst" | "repeated_error" | "auth_loop" | etc.
      error_count: number;
      error_codes: string[]; // all error_codes in the window
      wizard_id: string;
      last_step: string;
      session_duration_ms: number;
      user_email?: string; // if captured in step 1
      wizard_state_snapshot?: Record<string, unknown>; // non-PII fields only
    };
  };
}
```

Destinations: `posthog`, `logger`, `activity_trail` (if workspace exists). NOT `engine_event`.

### 11.4 Escalation actions (Botsson tools)

Botsson gets an `escalate` tool in its pre-workspace capability set:

| Action                   | What happens                                                                                                                                                | User sees                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `capture_and_alert`      | Emit escalation event with context. If e-post exists (from step 1), store for follow-up.                                                                    | "Vi har logget problemet. Du hører fra oss snart."        |
| `offer_support_channel`  | Show support contact (email or chat link)                                                                                                                   | "Kontakt oss direkte: support@smartout.ai"                |
| `offer_alternative_path` | Suggest skipping problematic step or manual entry                                                                                                           | "Du kan hoppe over dette steget og komme tilbake senere." |
| `schedule_callback`      | Capture contact info via separate form submission (NOT telemetry — GDPR). Stores in a dedicated `lead_callback_request` or similar, never in event payload. | "Legg igjen nummeret ditt, så ringer vi."                 |

**GDPR note:** `schedule_callback` captures PII (phone/email). This data MUST NOT flow through `emit()` into PostHog/logger payloads. It must be handled via a separate form submission endpoint. Deferred to V2 if the endpoint doesn't exist yet — V1 uses `offer_support_channel` instead.

### 11.5 Gate configuration

Gates are declared alongside wizard intervention rules — same file, same pattern:

```typescript
type EscalationGate = {
  id: string;
  trigger: "error_burst" | "repeated_error" | "total_errors" | "abandon_after_error";
  window_ms?: number; // time window (default: 10000 for burst)
  threshold: number; // error count threshold
  match?: string; // specific error_code pattern (optional)
  action:
    | "capture_and_alert"
    | "offer_support_channel"
    | "offer_alternative_path"
    | "schedule_callback";
  message: string; // Norwegian, user-facing
  cooldown_ms: number; // don't re-trigger same gate within this window (default: 30000)
};
```

### 11.6 Ring buffer for pattern detection

`useBotssonReactive` maintains a ring buffer of the last 50 error events with timestamps. Gates evaluate against this buffer on every new error event:

```
new error arrives →
  for each gate:
    filter buffer by gate.match (if set)
    count events within gate.window_ms
    if count >= gate.threshold AND gate not in cooldown:
      trigger escalation
      set cooldown timer
```

This is pure client-side — no server calls for detection. The escalation _action_ (emit event) is the only thing that leaves the client.

### 11.7 Priority override

When an escalation gate fires, it overrides normal Botsson behavior:

- Frequency cap is bypassed (escalation is always shown)
- Stall nudges are suppressed (errors take priority)
- The escalation message replaces any pending nudge
- After escalation, Botsson enters passive mode (no more proactive nudges this session)

## 12. Scope Boundaries

### In scope

- Error event registration and emission (8 new events)
- Escalation gates and `escalation triggered` event
- Botsson response event registration (4 new events + escalation)
- BaseEvent extension (page, phase, surface)
- Telemetry bug fixes (5 issues)
- `useBotssonReactive` client-side hook with error ring buffer + gate evaluation
- Botsson escalation tools (capture_and_alert, offer_support_channel, offer_alternative_path)
- Warm Orb Companion component
- Deterministic autofill mapping from scrape data
- `wizard abandoned` implementation

### Out of scope

- LLM-based autofill or content generation
- Server-side stall detection or engine_process blueprints
- engine_sessions for Botsson nudges
- Mission runner integration for pre-workspace context
- WalkAi data attribute consumers (tracked as tech debt)
- Botsson in dashboard beyond setup guide (future work)
- A/B testing of thresholds (future — needs data first)

## 13. Implementation Priority

| #   | What                                               | Type        | Why first                                                 |
| --- | -------------------------------------------------- | ----------- | --------------------------------------------------------- |
| 1   | Error events + emit calls                          | Telemetry   | Know when things break before building reactions          |
| 2   | Telemetry bug fixes                                | Cleanup     | Fix double-emits, anonymous events, dead routing          |
| 3   | BaseEvent extensions (page, phase, surface)        | Telemetry   | Needed by PostHog funnels and Botsson context             |
| 4   | Botsson response + escalation events               | Telemetry   | Registry entries for nudge/escalation tracking            |
| 5   | `useBotssonReactive` hook + ring buffer + gates    | Reactive    | Client-side listener, error pattern detection, escalation |
| 6   | Autofill mapping function                          | Logic       | Deterministic scrape-to-state mapper                      |
| 7   | Warm Orb Companion component                       | UI          | Visual identity, motion, accessibility                    |
| 8   | Escalation actions (capture, support, alternative) | Logic       | What happens when gates fire                              |
| 9   | Wire everything in /join                           | Integration | Connect hook + orb + rules + gates to join wizard         |
| 10  | Wire /onboarding + /setup                          | Integration | Extend to remaining phases                                |
| 11  | `wizard abandoned` + abandon-after-error gate      | Telemetry   | Close pre-existing gap + escalation on abandon            |

## 14. ADR Required

**ADR: Pre-Workspace AI Companion Pattern.** Must cover:

- Pre-workspace context is fundamentally different (no authority, no engine_sessions, no engine_event)
- Hardcoded client-side capability set (autofill, nudge, explain)
- Deterministic autofill only (pure function mapping, no LLM)
- Botsson telemetry routing: posthog + logger (no activity_trail pre-workspace, no engine_event ever)
- AI Runtime section 10.4 compliance: assists but never owns state
- Correlation_id pattern for pre-/post-auth telemetry linking
- Circuit breaker: agent-category events never trigger Botsson reactions
- Escalation gate pattern: frequency-based error detection with cooldown and priority override

## 15. Risks

| Risk                                                       | Severity            | Mitigation                                                                                                                   |
| ---------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Circular event loop                                        | HIGH                | Circuit breaker: useBotssonReactive ignores category `agent`. Hard filter, not convention.                                   |
| Botsson feels like surveillance                            | MEDIUM              | 15-20s stall threshold, secondary signal required, max 3 appearances. Error reactions are immediate but justified.           |
| Autofill applies wrong data                                | MEDIUM              | Deterministic mapping only. User confirms before apply. Never silent autofill.                                               |
| engine_event with null workspace_id                        | HIGH (existing bug) | Remove engine_event from wizard routing. Fix regardless of Botsson.                                                          |
| Scope creep into agent sessions                            | MEDIUM              | ADR explicitly forbids engine_sessions for pre-workspace Botsson. Scope: error help + stall nudges + autofill + escalation.  |
| Mobile keyboard conflicts                                  | LOW                 | Suppress Botsson entirely when keyboard is open.                                                                             |
| Escalation spam                                            | MEDIUM              | Cooldown per gate (minimum 30s). After escalation, Botsson goes passive — no more proactive nudges.                          |
| False escalation (3 fast validation errors = normal typos) | MEDIUM              | Error burst gate only counts error events, NOT validation_failed. Validation has its own separate stall rule.                |
| Escalation without contact info                            | LOW                 | Step 1 captures email first. If user reaches escalation gate, email is almost always available. Fallback: show support link. |

## 16. Success Metrics

| Metric                    | Source                                  | Target                                            |
| ------------------------- | --------------------------------------- | ------------------------------------------------- |
| Error event coverage      | PostHog                                 | Every error path emits (0 silent failures)        |
| Scrape failure visibility | PostHog funnel                          | Know exact % of users where scraping fails        |
| Botsson acceptance rate   | `nudge_accepted / nudge_shown`          | > 40% (if lower, thresholds are wrong)            |
| Autofill usage            | `autofill_applied` count                | Track adoption, no target yet                     |
| Join completion rate      | PostHog funnel                          | Baseline first, improve after                     |
| Drop-off by step          | PostHog funnel                          | Identify which step loses most users              |
| Escalation rate           | `escalation triggered` / total sessions | < 5% (if higher, underlying errors need fixing)   |
| Escalation recovery       | Users who complete after escalation     | Track — no target yet                             |
| Error burst frequency     | Error burst gate triggers               | Monitor trend — should decrease as bugs are fixed |
