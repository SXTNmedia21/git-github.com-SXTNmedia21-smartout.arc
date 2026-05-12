---
title: Expo-web Surface Classification
id: ADR_0153
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
---

# ADR-0153: Expo-web Is a Distinct Surface, Governed by Mobile Verb Boundary but Subject to Web Runtime Constraints

## Context and Problem Statement

ADR-0133 ("Web Composes, Mobile Executes") classifies two surfaces: the Next.js dashboard (`apps/web`) and the React Native app (`apps/mobile`). It is silent on the third surface produced by `apps/mobile`: the Expo-web browser build, which runs the mobile codebase under `react-native-web` + `expo-router` in a desktop/mobile browser. This silence caused a runtime crash on 2026-04-19 where `History.pushState` surfaced `null.dispatchEvent` because expo-router's web adapter raced `auth-provider` route-guard redirects, and developers had been applying ad-hoc `Platform.OS === "web"` throw-stubs and `router.canGoBack()` guards without a canonical rule for what Expo-web is allowed to do.

## Decision Drivers

- ADR-0133's verb boundary (D1–D5 web, D6+C4 mobile) must still hold when a user opens the mobile app in a browser.
- Expo-web inherits web runtime constraints that native RN does not (no WebRTC without LiveKit web SDK, no native secure storage, no iOS/Android notification primitives, two history adapters fighting `window.history.pushState`).
- ADR-0132 ("Mobile is a thin client") already routes AI/capabilities through the web BFF — that stays true on Expo-web.
- ADR-0134 ("Mobile telemetry contract enforcement") applies to Expo-web identically — `workspace_id`/`actor_id` must be non-empty at `emit()`.
- Without classification, each developer invents their own Expo-web gating and the gates drift apart.

## Considered Options

1. **Expo-web is implicitly mobile** — status quo; leave ADR-0133 silent. Produces the current bug class.
2. **Expo-web is its own third surface** — separate verb table, separate ADRs. Too much governance overhead.
3. **Expo-web is classified as mobile for verb boundary but explicitly subject to web runtime constraints** — same D6/C4 responsibilities, declared incapacities for native-only features, shared UI.

## Decision Outcome

Chosen option: **"Option 3"**. Expo-web is the Expo-web build of `apps/mobile` running in a browser. It follows ADR-0133's mobile verb boundary (D6 + C4), routes AI through the web BFF per ADR-0132, and obeys ADR-0134 telemetry contract. It declares explicit incapacities where native primitives are required: LiveKit voice calls, WebRTC, camera-backed witness evidence (ADR-0136), biometric confirmation, GPS clock-in.

## Rules & Consequences

### Rules

1. **Incapacity declaration.** Native-only features MUST expose a typed `isSupported(): boolean` or equivalent capability check — never a throwing stub, never a silent no-op. Callers branch on capability; they do not `try/catch` a thrown stub.
2. **Navigation races.** Expo-web screens MUST NOT stack `router.replace` inside effects that can fire during another screen's passive unmount. If route-guard redirects are required (e.g., auth-provider), they MUST be gated behind `isMounted` refs or run inside `useLayoutEffect` after the outgoing screen's cleanup.
3. **Platform-gated imports.** `Platform.OS === "web"` branches for native-only modules MUST use Metro resolver aliases (one file per platform: `*.web.ts` / `*.native.ts`) rather than inline conditionals. Inline conditionals hide the contract from the bundler and produce inconsistent stubs (e.g., one call site throws, aliased stub returns null — both existed simultaneously as of 2026-04-19).
4. **Mutations are identical to native.** An Expo-web clock-in emits the same telemetry as a native clock-in. There is no "web-lite" mutation contract.
5. **Overlays follow the web overlay rule.** Any `bottom-sheet.web.tsx`-style fallback must render via `createPortal` to a stable overlay root under `document.body`, not inline under the route tree — otherwise parent-route unmount races overlay cleanup (same class of bug that produced the dashboard Radix Sheet issue).
6. **SDK pinning discipline.** Mobile SDK bumps (`expo`, `expo-router`, `react-native-web`, `react`, `react-dom`) MUST ship in a dedicated `chore(mobile-sdk): ...` commit, isolated from feature work. Mixed commits produced the 2026-04-19 uncommitted-drift that left `react@19.2.0` and `react@19.2.4` coexisting in the pnpm store.

### Good, because

- Developers now have a canonical answer to "can the mobile app do X on the web?"
- The incapacity-declaration pattern replaces defensive throw-stubs and `canGoBack()` guards with a documented capability contract.
- ADR-0133 stays small and focused on D1–D5 vs D6+C4 — this ADR extends it to the third surface without diluting the original.

### Bad, because

- Adds a second surface to reason about for every mobile feature author.
- Capability checks require more code than `Platform.OS !== "web"` branches — the trade-off is explicitness over brevity.
- Mobile SDK bump discipline slows routine maintenance (`expo install --fix` now requires a planned commit rather than an ad-hoc one).

### Agent Impact

- Any agent building a mobile capability that touches D6 execution MUST verify the Expo-web path separately (capability check + incapacity message).
- Any agent proposing a mobile SDK bump MUST produce a standalone commit with a rationale, not bundle it into feature work.
- Route-guard redirects in `apps/mobile/src/providers/auth-provider.tsx` are now governed by Rule 2 — no `router.replace` from within an effect without an `isMounted` ref guard.
- Overlays in `apps/mobile/src/platform/*.web.tsx` must follow Rule 5 (portal root under `document.body`), not inline absolute positioning.

### Related

- Extends **ADR-0133** (Web Composes, Mobile Executes) by classifying the third surface.
- Inherits from **ADR-0132** (Mobile is a Thin Client) — BFF routing applies on Expo-web.
- Inherits from **ADR-0134** (Mobile Telemetry Contract) — telemetry rules apply identically.
- Referenced from **Learning-0063** (Diagnosis-before-patch gate for crash bugs).

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
