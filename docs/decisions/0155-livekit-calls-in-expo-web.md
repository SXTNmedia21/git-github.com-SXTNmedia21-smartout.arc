---
title: LiveKit Calls Are Supported In Expo-web
id: ADR-0155
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
---

# ADR-0155: LiveKit Calls Are Supported In Expo-web

## Context and Problem Statement

ADR-0153 ("Expo-web Surface Classification") lists "LiveKit voice calls" among the incapacities Expo-web must declare, on the premise that native-only modules are required. This is inaccurate: `livekit-client` (the npm package already in use by the Next.js dashboard) targets browsers natively via `RTCPeerConnection` and `getUserMedia`. `@livekit/react-native` only wraps the same `livekit-client` with platform-specific audio routing (`AudioSession`) and media plumbing for iOS/Android. Browsers provide WebRTC without any additional SDK.

At the same time, Smartout is committed to shipping a functional webapp version of the mobile experience alongside the native apps (iPad fast-login, tablet browsers, publishing-delay fallback). Keeping Expo-web blocked from channel calls forces users to install the native app just to answer a call, which contradicts that commitment.

## Decision Drivers

- `livekit-client` works in browsers without a second SDK.
- Native-only surface is limited to `AudioSession` from `@livekit/react-native`, which is already stubbed as a no-op on web in `apps/mobile/src/hooks/mutations/use-livekit-call.ts`.
- The webapp version of the mobile experience is a committed product surface, not a demo.
- Users need a web path to receive calls when the native app is unavailable.
- The edge-function call orchestration (`livekit-token`, `call-command`) is shared between surfaces and already works in browsers (used by `apps/web`).

## Considered Options

1. **Keep Expo-web blocked from LiveKit, direct users to native app.** Rejected: contradicts the commitment to a fully functional webapp.
2. **Build a separate Expo-web voice adapter.** Rejected: duplicates logic. `livekit-client` already ships browser support.
3. **Remove the Expo-web LiveKit incapacity, reuse the shared `livekit-client` Room lifecycle across native and web.** Chosen.

## Decision Outcome

Chosen option: **"Option 3"**. Expo-web can join, start, and receive LiveKit calls using the same `@smartout/walkie-talkie` package and `useLiveKitCall` hook that drives native. This supersedes the "LiveKit voice calls" incapacity listed in ADR-0153.

## Rules & Consequences

### Rules

1. **Shared Room lifecycle.** `useLiveKitCall` constructs `new Room()` on both native and web. `AudioSession.startAudioSession()` is a no-op on web (browser manages audio routing natively).
2. **No Metro alias for `@smartout/walkie-talkie`.** The package is pure `supabase-js` + types; Metro must resolve it to the real package on web too. Aliasing to a stub file (previously `src/platform/walkie-talkie.web.ts`) breaks the shared call flow.
3. **CallSheet renders on web.** The `Platform.OS === "web"` block in `CallSheet.tsx` that told users to install the app is removed. Browser WebRTC handles the call.
4. **Push notifications for incoming calls on web.** Expo-web cannot use iOS/Android push primitives. Until service-worker-based Web Push is wired, call alerts rely on the in-app Realtime subscription (`useWorkspaceCallAlerts` on dashboard, equivalent in mobile Expo-web) + the Browser Notification API for foreground tabs. Background push on Expo-web is a follow-up.
5. **No drift between native and web call semantics.** When a user joins a call from Expo-web, they publish/subscribe to the same LiveKit room as a native user. Mute, camera toggle, screen share (when browser supports), end-call emit identical telemetry events.

### Good, because

- One code path for channel calls across three surfaces (web dashboard, Expo-web, native).
- Users can join a meeting from any browser including iPad Safari.
- Removes an incapacity that was grounded on an inaccurate SDK assumption.

### Bad, because

- Expo-web still lacks background Web Push for call invites when the tab is closed — requires future service-worker work.
- Browsers vary in autoplay / permission prompts for getUserMedia — UX must handle deny cases gracefully.
- Screen share works in Chrome/Edge, limited in Safari — expose capability check instead of promise.

## Supersedes

- The "LiveKit voice calls" incapacity clause of ADR-0153 ("Expo-web Surface Classification"). ADR-0153's verb-boundary and incapacity-declaration rules otherwise remain in force; only the LiveKit line is lifted.

## Follow-ups

- Service-worker + VAPID Web Push for background call notifications (Expo-web and web dashboard both benefit).
- Typing-indicator realtime channel (`channel_typing`), referenced separately in channel-card indicator work.
- Capability check for screen share on Safari before enabling the control.
