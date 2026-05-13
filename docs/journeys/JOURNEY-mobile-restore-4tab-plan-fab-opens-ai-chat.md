---
title: "Journey — Center FAB opens AI chat sheet via BFF"
feature: mobile-restore-4tab-plan
journey: fab-opens-ai-chat
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: mobile
tags: [journey, mobile, fab, ai, botsson, adr-0132]
---

# Journey: Center FAB opens AI chat sheet via BFF

**Role:** any authenticated user (employee, manager, admin)

**Precondition:**
- User signed in on mobile PWA
- User on any of the 4 tabs (FAB persists across tabs)
- Network connection available (offline behavior covered in error paths)

## Happy Path

1. User taps **center FAB** → System opens AI chat bottom-sheet over current tab content
2. Sheet renders with greeting + input field → User sees chat surface (Nordic Split design system: warm OKLCH, Instrument Serif heading, no hardcoded zinc)
3. User types message + sends → System POSTs to `/api/emma/chat` (BFF route, ADR-0132 — never direct to capability)
4. BFF resolves workspace context server-side (ADR-0151 forbids body-supplied IDs), routes to stage-engine, returns assistant reply
5. Sheet displays reply → User reads response
6. User taps backdrop or close button → Sheet dismisses → Returns to current tab

**Postcondition:**
- `emit('mobile.fab.opened')` fired with `getProfileContext()` IDs (ADR-0134) on sheet open
- `emit('mobile.fab.message_sent')` fired on message send
- `emit('mobile.fab.closed')` fired on sheet dismiss
- No direct capability calls from mobile — all traffic through BFF (ADR-0132)
- LiveKit voice path available if voice toggle on (ADR-0135) — Ultravox forbidden
- No authoring tools exposed in sheet (ADR-0133)

## Error Paths

- **Scenario:** `/api/emma/chat` returns 500 → Sheet shows inline error + "Try again" button; emit `mobile.fab.error` event
- **Scenario:** User offline → FAB tap opens sheet; on send, message queued via offline queue (Zod-validated at enqueue per `apps/mobile/src/lib/sync/schemas.ts`); UI shows "Will send when online"
- **Scenario:** AI requests authoring action (write policy, edit schedule template) → Reply explicitly says "Please use the web app to do that" — mobile chat does not invoke write capabilities (ADR-0133)
- **Scenario:** Sheet open on slow network → Loading indicator shown; sheet remains responsive (no UI freeze)
- **Scenario:** Voice toggle enabled but LiveKit room connect fails → Falls back to text mode with toast "Voice unavailable, using text"

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested: FAB tap on each of 4 tabs reaches AI sheet
- [ ] Confirmed `/api/emma/chat` is the route (network tab in DevTools or stage-engine logs)
- [ ] Confirmed no direct capability invocations from mobile (grep for `supabase.functions.invoke` outside `api-client.ts`)

**Mark `status: verified` in frontmatter when all four boxes are checked.**
