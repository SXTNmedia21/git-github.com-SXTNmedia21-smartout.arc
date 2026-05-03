---
title: "Plan — contract-mobile-employee"
status: draft
updated: 2026-04-30
created: 2026-04-30
module: contract
parent_plan: docs/plans/PLAN-contract-employee.md
adrs:
  - ADR_0133
  - ADR_0134
  - ADR_0135
  - ADR_0245
tags: [plan, contract, mobile, employee, journey-3, journey-5, paragraf-14-6]
---

# Plan — contract-mobile-employee

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the mobile-primary employee contract surface — receive, view, acknowledge, sign, review amendment, re-sign — fully on mobile per ADR-0133 R1 (mobile owns D6 production + C4 acceptance). Web `/dashboard/my-contract` is demoted to read-only desktop fallback.

**Tech Stack:** React Native + Expo, `react-native-webview`, `expo-local-authentication`, `react-native-pdf`, `@react-navigation/native`, TanStack Query with `@react-native-async-storage/async-storage` persistor, `@smartout/telemetry` (getProfileContext pattern).

**Source documents:**

- **ADR-0245** — `docs/decisions/0245-employee-contract-mobile-flow.md` — canonical source of truth for this plan (surface partitioning §A, sign-flow §B, acknowledgement-ring layout §C, biometric §D, push map §E, DomainChatOwnership §F, offline policy §G, telemetry contract §H)
- **ADR-0133** — `docs/decisions/0133-web-composes-mobile-executes.md` — D6/C4 verb boundary; R1 (mobile owns execution), R3 (superpowers as cascade extensions)
- **ADR-0134** — `docs/decisions/0134-mobile-telemetry-contract-enforcement.md` — `getProfileContext()` pattern; non-null/non-empty invariant on every `emit()`
- **ADR-0135** — `docs/decisions/0135-mobile-voice-via-livekit-not-ultravox.md` — voice routing (channel guard still applies on contract screens)
- **Parent plan** — `docs/plans/PLAN-contract-employee.md` — Phase 4 + Phase 6 web-track remain there as read-only fallback; mobile track lives here and runs in parallel
- **Journeys** — `docs/architecture/contract-service/JOURNEY-contract-module.md` — Journey 3 (employee signs, lines 167–225) and Journey 5 (amendment, employee re-sign portion, lines 292–350)

---

## Source of Truth

ADR-0245 is canonical for every decision in this plan. Where ADR-0245 cites another ADR, that ADR is authoritative on its domain; this plan does not re-derive those decisions.

**Relationship to parent plan:**

- `PLAN-contract-employee.md` Phase 4 (web sign page) and Phase 6 (web amendment page) are NOT split away from the parent. They remain there as the **read-only desktop fallback** track (view stilling, lønn, obligations, last-ned-PDF — no action verbs).
- The **execution verbs** for those phases — receive push, read contract, acknowledge, sign, view amendment diff, re-sign — are moved here.
- These two tracks run **in parallel**. Mobile does not wait for web. Web does not block mobile. Both tracks are required for feature completeness.

---

## Architecture Overview

The employee contract surface maps onto ADR-0133's verb boundary: the employee's execution verbs (D6 production, C4 authority confirmation) belong on mobile. The architecture has four layers:

**Surface tree (7 screens per ADR-0245 §A):**
`ContractInboxScreen` → `ContractDetailScreen` → `AcknowledgementRingScreen` (N full-screen blocks) → `PdfPreviewGateScreen` → `ContractSignScreen` (WebView) → `ContractAmendmentReviewScreen` → `ObligationDetailScreen`

Navigation uses `@react-navigation/native` stack push. There is no swipe-back during the AcknowledgementRing (evidence chain integrity per ADR-0245 §C).

**Sign flow (ADR-0245 §B):** DocuSeal WebView embed — same `signing_url` used on web, native shell wraps it with header + biometric prompt + result handling via `postMessage` shim. No native PDF-bridge; no signature-stroke extraction. Biometric C4 confirmation (`expo-local-authentication`) fires after WebView signals `signed=true`.

**Telemetry (ADR-0245 §H + ADR-0134):** All 8 new `contract.mobile.*` events resolve `workspaceId` + `actorId` via `getProfileContext()` before `emit()`. Zero empty-string fallbacks. Events registered in `packages/telemetry/src/registry.ts` in a dedicated PR (Phase M1) before screen work ships.

**Push (ADR-0245 §E):** Mobile is passive — accepts FCM/APNs token; never originates push. Push triggers fan from `engine_event` consumers in stage-engine via the existing guardian-bus pattern (ADR-0186). No PII in push payloads: title + CTA + deep-link only.

**Offline (ADR-0245 §G):** Contract metadata + obligation list: SWR 60s, realtime invalidation, 6h background expiry. AcknowledgementRing + signing + biometric: network required; refuse with Norwegian copy if offline.

---

## Prerequisites

- [ ] ADR-0241 schema migration applied to `supabase/migrations/` (Phase 0c in parent plan — `employment_contract` schema changes, `biometric_confirmed_at` column)
- [ ] ADR-0242 `payroll` capability and `contract` read tools live on `development` (needed for `signing_url` fetch and obligation list)
- [ ] ADR-0243 obligation lifecycle trigger semantics merged (obligation status enum + event routing)
- [ ] ADR-0244 AcknowledgementRing evidence spec accepted (defines block count, per-block emit, PDF-preview gate)
- [ ] Parent plan Phase 0 UX-fixes merged (no outstanding actor_id bug in contract emit path)
- [ ] `apps/mobile/src/lib/profile-context.ts` exists at lines 30–57 — verified (file confirmed present and `getProfileContext()` throws on missing IDs per ADR-0134 R1 + L-0177)

---

## Tasks

### Phase M0 — Mobile foundation verification

Verification-only phase. No code shipped. Gate for all downstream phases.

#### M0.1 — Verify profile-context helper
**What:** Read `apps/mobile/src/lib/profile-context.ts` lines 30–57. Confirm `getProfileContext()` resolves `workspaceId` + `actorId` as `NonEmptyString` and throws on missing/empty per ADR-0134 R1 + L-0177.
**Files:** `apps/mobile/src/lib/profile-context.ts` (read-only)
**Acceptance:** File exists at the path. Function signature matches. `nonEmpty()` brand applied on return. No `?? ""` fallback anywhere in the function body.

#### M0.2 — Verify DomainChatOwnership mobile support
**What:** Check whether `BotssonShell` (mobile root shell) reads a `DomainChatOwnership` context and renders Orb in passive mode when set. ADR-0245 §F escalation note flags this may need a mobile addendum to ADR-0238.
**Files:** `apps/mobile/` — search for `DomainChatOwnership` usage; `docs/decisions/0238-botsson-surface-disambiguation.md`
**Acceptance:** Either (a) `DomainChatOwnership` component is already importable in mobile context, or (b) a gap ADR is drafted (mobile addendum to ADR-0238) before Phase M3 begins. This is a blocker for M3.3.

#### M0.3 — Verify expo-local-authentication
**What:** Check `apps/mobile/package.json` for `expo-local-authentication`. Required for biometric C4 confirmation in Phase M6.
**Files:** `apps/mobile/package.json`
**Acceptance:** Dependency present. If absent: add it in a chore commit before Phase M6.

#### M0.4 — Verify react-native-webview
**What:** Check `apps/mobile/package.json` for `react-native-webview`. Required for DocuSeal sign flow in Phase M6.
**Files:** `apps/mobile/package.json`
**Acceptance:** Dependency present (expected as a transitive dep per ADR-0245 §B rationale). If absent: add in chore commit.

#### M0.5 — Verify react-native-pdf
**What:** Check `apps/mobile/package.json` for `react-native-pdf`. Required for `PdfPreviewGateScreen` in Phase M5.
**Files:** `apps/mobile/package.json`
**Acceptance:** Dependency present. If absent: add in chore commit + verify linking on iOS/Android.

---

### Phase M1 — Telemetry registry

Ships before any screen. ADR-0175 frozen-event-set discipline: event names must exist in the registry before any code emits them.

#### M1.1 — Register 8 contract.mobile.* events
**What:** Add all 8 events from ADR-0245 §H to `packages/telemetry/src/registry.ts`. Events:
- `contract.mobile.viewed` → PostHog + activity_trail
- `contract.mobile.acknowledgement_block_progressed` → PostHog + activity_trail
- `contract.mobile.pdf_preview_viewed` → PostHog + activity_trail + engine_event
- `contract.mobile.signed` → PostHog + activity_trail + engine_event (client observation only — NOT lifecycle source per ADR-0187; lifecycle emits from DB trigger)
- `contract.mobile.biometric_confirmed` → activity_trail only
- `contract.mobile.biometric_failed` → activity_trail (rate-limited)
- `contract.mobile.amendment_reviewed` → PostHog + activity_trail
- `contract.mobile.amendment_signed` → PostHog + activity_trail + engine_event (same caveat as `signed`)
**Files:** `packages/telemetry/src/registry.ts`
**Acceptance:** `pnpm turbo typecheck` passes. All 8 entries present with correct routing arrays. No duplicate event names across the registry.

#### M1.2 — Zod payload schemas per event
**What:** Add Zod schema for each event payload. All schemas include `contract_id: NonEmptyString`, `profile_id: NonEmptyString`, `workspace_id: NonEmptyString` at minimum. Event-specific keys per ADR-0245 §H table (e.g. `block_name`, `block_index`, `total_blocks` for `acknowledgement_block_progressed`; `reason` for `biometric_failed`; `pdf_hash` for `pdf_preview_viewed`; `attestation_method` for `biometric_confirmed`; `amendment_id` for amendment events).
**Files:** `packages/telemetry/src/schemas/` (or co-located per existing pattern)
**Acceptance:** `z.infer<>` for each schema resolves without error. `NonEmptyString` brand (from `@smartout/telemetry`) applied on `workspace_id`, `profile_id`, `contract_id`.

---

### Phase M2 — BFF endpoints

Three mobile-specific endpoints. All derive `profile_id` server-side per ADR-0151. Never accept body-supplied `profile_id`.

#### M2.1 — /api/contracts/mobile/push-token POST
**What:** Register FCM/APNs token bound to JWT-resolved `profile_id`. Write to `profile` or a dedicated `device_push_token` table. On re-registration (same device, new token): upsert. On first registration: insert.
**Files:** `apps/web/src/app/api/contracts/mobile/push-token/route.ts`
**Acceptance:** JWT must be valid; `profile_id` resolved server-side. Token stored. 200 on success, 401 on missing auth, 422 on invalid token format. Emits `contract.mobile.viewed` NOT applicable here — no telemetry event for token registration (not a user-observable action).

#### M2.2 — /api/contracts/mobile/biometric-attestation POST
**What:** Accept device-attested biometric success flag + `contract_id`. Write `employment_contract.biometric_confirmed_at = now()` on the matching contract. Validate that the contract belongs to the JWT-resolved profile (fail-fast on row-not-found per L-0177 — 403, not silent fallback). Accept optional `attestation_method` field (`face_id` / `touch_id` / `pin_fallback`).
**Files:** `apps/web/src/app/api/contracts/mobile/biometric-attestation/route.ts`
**Acceptance:** Writes `biometric_confirmed_at`. Emits `contract.mobile.biometric_confirmed` via server-side `emit()`. Returns 403 if contract not found for profile. Returns 409 if already confirmed (idempotency). Zod-validated body.

#### M2.3 — /api/contracts/mobile/sign-complete POST
**What:** Echo DocuSeal WebView sign-completion event to server. Emits `contract.mobile.signed` (client observation — NOT the lifecycle source; DocuSeal webhook is canonical). Does NOT write `employment_contract.status` — that is the webhook's responsibility (ADR-0187 single-emit-source rule).
**Files:** `apps/web/src/app/api/contracts/mobile/sign-complete/route.ts`
**Acceptance:** Emits event. Returns 200. Does not write contract status. Returns 409 if `signed_at` already set (protect against double-tap). JWT-resolved `profile_id` matches `contract_id` ownership (fail-fast on mismatch per L-0177).

#### M2.4 — BFF server-side profile_id derivation audit
**What:** Verify all three M2 endpoints derive `profile_id` from JWT (via `supabase.auth.getUser()`) and never accept it from request body. Code review gate: any `req.body.profile_id` usage is a merge blocker per ADR-0151.
**Files:** M2.1, M2.2, M2.3 routes
**Acceptance:** Grep for `body.profile_id` in the three routes returns empty. JWT-resolved profile used throughout.

---

### Phase M3 — ContractInboxScreen

Entry point for the mobile contract surface. Push-driven.

#### M3.1 — Component skeleton
**What:** Create `apps/mobile/src/screens/contract/ContractInboxScreen.tsx`. Declare screen in navigation stack. Add to `MOBILE_IA_CONTRACT.md` (or create that file if absent per ADR-0133 R4).
**Files:** `apps/mobile/src/screens/contract/ContractInboxScreen.tsx`, navigation config
**Acceptance:** Screen renders empty state without crash. TypeScript compiles.

#### M3.2 — Push-driven contract list
**What:** TanStack Query `useContractInbox()` hook fetches via mobile thin-client (ADR-0132): calls BFF `/api/contracts/mobile/inbox` (or existing `contract` capability read tool). Lists: pending sign, pending amendment, due-soon obligations. Each item is a navigation link. Respects offline cache policy (SWR 60s + realtime `employment_contract` subscription per ADR-0245 §G).
**Files:** `apps/mobile/src/screens/contract/ContractInboxScreen.tsx`, `apps/mobile/src/hooks/queries/use-contract-inbox.ts`
**Acceptance:** List renders. Realtime subscription invalidates on `employment_contract` UPDATE. Offline: shows stale data with staleness indicator. Empty state: "Du har ingen ventende kontrakter."

#### M3.3 — DomainChatOwnership marker
**What:** Mount `<DomainChatOwnership reason="contract-flow" />` on screen focus per ADR-0245 §F. Orb renders in passive mode (icon-only). Voice activation via long-press: **allowed** on InboxScreen (no PII visible; per ADR-0245 §F last paragraph). M0.2 must pass before this task.
**Files:** `apps/mobile/src/screens/contract/ContractInboxScreen.tsx`
**Acceptance:** `DomainChatOwnership` context set on focus, cleared on blur. Orb passive mode active. No crash on mount.

#### M3.4 — Telemetry on screen mount
**What:** `emit("contract.mobile.viewed")` with `{ contract_id: null, profile_id, workspace_id }` on screen mount (inbox is contract-scoped-nullable — use null contract_id for inbox view, or defer emit to DetailScreen). Use `getProfileContext()` per ADR-0134 R1.
**Files:** `apps/mobile/src/screens/contract/ContractInboxScreen.tsx`
**Acceptance:** `getProfileContext()` called before emit. `workspace_id` and `profile_id` non-empty. No emit if context unavailable (screen renders error boundary instead).

---

### Phase M4 — ContractDetailScreen

Active contract read view. Offline-cacheable.

#### M4.1 — Component skeleton
**What:** Create `apps/mobile/src/screens/contract/ContractDetailScreen.tsx`. Receives `contract_id` via navigation param.
**Files:** `apps/mobile/src/screens/contract/ContractDetailScreen.tsx`
**Acceptance:** Renders with navigation param. TypeScript compiles.

#### M4.2 — Contract metadata + obligation list
**What:** Fetch active contract (job_title, salary, start_date, framework_id) via `useContractDetail(contractId)` hook. Render obligation list with progress (per ADR-0244 obligation status). Tariff badge (per ADR-0244 lines 86–93 TariffBadge component — use `.native.tsx` variant per ADR-0158). CTA: if `status = 'pending_signature'`, render "Signer nå" → navigates to AcknowledgementRingScreen. If `status = 'active'` and amendment pending: render "Se endring" → navigates to AmendmentReviewScreen.
**Files:** `apps/mobile/src/screens/contract/ContractDetailScreen.tsx`, `apps/mobile/src/hooks/queries/use-contract-detail.ts`
**Acceptance:** Job title, salary, obligations, tariff badge all render. CTA shows correct action based on status. No personnummer / bank account data rendered here (Medium-PII cap per ADR-0245 §G PII-at-rest).

#### M4.3 — Offline cache + realtime invalidation
**What:** TanStack Query SWR 60s for contract metadata. Supabase Realtime subscription on `employment_contract` filtered by `profile_id` (RLS-gated per ADR-0029). On UPDATE: invalidate detail cache. Background expiry: 6h per ADR-0245 §G.
**Files:** `apps/mobile/src/hooks/queries/use-contract-detail.ts`
**Acceptance:** Cache TTL matches spec. Realtime subscription invalidates on UPDATE. After 6h background: data re-fetches on next foreground. `@react-native-async-storage/async-storage` persistor used.

#### M4.4 — Telemetry on mount
**What:** `emit("contract.mobile.viewed")` with resolved `contract_id`, `profile_id`, `workspace_id` on screen mount.
**Files:** `apps/mobile/src/screens/contract/ContractDetailScreen.tsx`
**Acceptance:** `getProfileContext()` called. All three IDs non-empty. Event fires once per mount.

---

### Phase M5 — AcknowledgementRingScreen + PdfPreviewGateScreen

Legal-evidence chain. Full-screen sequential. No swipe-back.

#### M5.1 — AcknowledgementRingScreen skeleton + navigation stack
**What:** Create `apps/mobile/src/screens/contract/AcknowledgementRingScreen.tsx`. Block count and content driven by `framework.acknowledgement_blocks` config (per ADR-0244). Navigation uses `@react-navigation/native` stack push per block. No swipe-back gesture during the ring (navigator option `gestureEnabled: false`). Cancel exits entire flow: emit `contract.acknowledgement.cancelled` (existing event from ADR-0244, not a new `contract.mobile.*` event — do not double-register). Restart from block 1 on re-entry per ADR-0245 §C.
**Files:** `apps/mobile/src/screens/contract/AcknowledgementRingScreen.tsx`, navigation config
**Acceptance:** N screens render (one per block). Swipe-back disabled. Cancel emits cancellation event. Re-entry restarts from block 1. TypeScript compiles.

#### M5.2 — Per-block emit
**What:** On each "Jeg har lest og forstått" tap: emit `contract.mobile.acknowledgement_block_progressed` with `{ contract_id, block_name, block_index, total_blocks, profile_id, workspace_id }`. `getProfileContext()` resolved once per ring session (not per-block re-fetch). Transition to next block only AFTER emit resolves (async, not fire-and-forget — legal evidence chain must confirm server receipt before advancing).
**Files:** `apps/mobile/src/screens/contract/AcknowledgementRingScreen.tsx`
**Acceptance:** Emit called once per block. All payload fields non-empty. Server receipt confirmed before navigation. No block-N+1 reachable if block-N emit fails.

#### M5.3 — PdfPreviewGateScreen
**What:** Create `apps/mobile/src/screens/contract/PdfPreviewGateScreen.tsx`. Fetch PDF URL from active contract. Render via `react-native-pdf` (M0.5 required). Scroll-to-end detection: `onLoadComplete` + page tracking → when last page reached: set `pdfViewed = true`, emit `contract.mobile.pdf_preview_viewed` with `{ contract_id, pdf_hash, profile_id, workspace_id }`. "Signer nå" button enabled only when `pdfViewed = true`. Offline: refuse to render ("Kontrakten kan ikke lastes — sjekk nett.") per ADR-0245 §G.
**Files:** `apps/mobile/src/screens/contract/PdfPreviewGateScreen.tsx`
**Acceptance:** "Signer nå" disabled until last page reached. `pdf_hash` in payload (SHA-256 of PDF URL or DocuSeal document ID — whichever is stable). Offline refuse copy in Norwegian. Emit fires exactly once.

#### M5.4 — WCAG AAA accessibility
**What:** Per ADR-0244 lines 70–74 and ADR-0245 §C: each block screen carries `accessibilityRole="alert"` on block content; CTA button has explicit `accessibilityLabel`; "Blokk N av M" counter has `accessibilityLiveRegion="polite"`. `useReducedMotion()` from `react-native-reanimated` guards every transition spring.
**Files:** `apps/mobile/src/screens/contract/AcknowledgementRingScreen.tsx`
**Acceptance:** `accessibilityRole`, `accessibilityLabel`, `accessibilityLiveRegion` present per code review. No spring animations when `isReducedMotionEnabled = true`.

#### M5.5 — Skip-prevention
**What:** No swipe-back during ring (M5.1). Additionally: Android hardware back button disabled during ring session via `useFocusEffect` + BackHandler. Explicit Cancel button only way to exit (triggers M5.1 cancellation event).
**Files:** `apps/mobile/src/screens/contract/AcknowledgementRingScreen.tsx`
**Acceptance:** Android back button does nothing during ring. Cancel button visible. Confirmation dialog on cancel tap ("Er du sikker? Du må starte fra begynnelsen.").

#### M5.6 — Norwegian copy review flag
**What:** All block copy and "Jeg har lest og forstått" copy is legally binding under Aml. §14-6. Add a prominent inline TODO in the component: `// ESCALATION: Norwegian copy MUST be reviewed by Lovsen/arbeidsrettsadvokat before go-live (ADR-0245 §C, ADR-0244).` This is not a blocker for dev merge, but IS a blocker for production promotion (tracked as a prerequisite in the Acceptance Criteria section of this plan).
**Files:** `apps/mobile/src/screens/contract/AcknowledgementRingScreen.tsx`
**Acceptance:** TODO comment present. Not merged to production without legal review.

---

### Phase M6 — ContractSignScreen + biometric C4 flow

The moment of legal-binding signature.

#### M6.1 — ContractSignScreen skeleton + WebView mount
**What:** Create `apps/mobile/src/screens/contract/ContractSignScreen.tsx`. Fetch `signing_url` from `payroll` capability (via BFF `GET /api/contracts/mobile/signing-url?contract_id=...`). Mount `react-native-webview` (M0.4 required) against the URL. HTTPS-only guard: reject non-HTTPS URLs. Ephemeral cookie store (no shared cookies with native Supabase auth session per ADR-0245 §B).
**Files:** `apps/mobile/src/screens/contract/ContractSignScreen.tsx`
**Acceptance:** WebView renders DocuSeal signing UI. HTTPS check. Cookie isolation. TypeScript compiles.

#### M6.2 — postMessage shim for DocuSeal events
**What:** Inject `postMessage` shim via `injectedJavaScript` prop. Listen for DocuSeal `signed` / `declined` / `expired` events. Bridge to native handler: on `signed` → proceed to biometric prompt. On `declined` → navigate back, emit `contract.acknowledgement.cancelled` (re-use existing event; no new event for decline). On `expired` → show Norwegian error copy + navigate to inbox.
**Files:** `apps/mobile/src/screens/contract/ContractSignScreen.tsx`
**Acceptance:** `signed` event triggers biometric flow. `declined` navigates back cleanly. `expired` shows error. No data leak from WebView context to native (postMessage payload contains only event type + contract_id).

#### M6.3 — Biometric C4 confirmation
**What:** After WebView signals `signed=true`: call `expo-local-authentication` (M0.3 required) `authenticateAsync()` with prompt copy "Bekreft signering med biometri". Success → submit attestation to M2.2 BFF. Check `engine_authority_config.requires_biometric_on_sign` workspace flag first (default true; false = skip biometric, proceed directly to M2.3). `attestation_method`: derive from `LocalAuthentication.AuthenticationType` result (`face_id` / `fingerprint` / `pin_fallback`).
**Files:** `apps/mobile/src/screens/contract/ContractSignScreen.tsx`
**Acceptance:** Biometric fires after WebView success. Workspace flag respected. `attestation_method` resolved correctly. Does not fire if `requires_biometric_on_sign = false`.

#### M6.4 — Attestation submission
**What:** On biometric success: POST to `/api/contracts/mobile/biometric-attestation` (M2.2). On success: POST to `/api/contracts/mobile/sign-complete` (M2.3). On both: navigate to `ContractDetailScreen` with fresh-fetch flag.
**Files:** `apps/mobile/src/screens/contract/ContractSignScreen.tsx`
**Acceptance:** Both POSTs called in sequence. `biometric_confirmed_at` written server-side. `contract.mobile.signed` emitted. Navigation occurs only after both succeed.

#### M6.5 — Failure mode + retry
**What:** Biometric failure modes: `user_cancelled`, `lockout`, `not_enrolled`, `hardware_unavailable`. Per-mode Norwegian copy per ADR-0245 §D. Up to 3 retries on `user_cancelled`. After 3 failures: surface "Vi kan ikke bekrefte deg. Logg ut og inn igjen, eller kontakt admin." Emit `contract.mobile.biometric_failed` with `reason` field for each failure.
**Files:** `apps/mobile/src/screens/contract/ContractSignScreen.tsx`
**Acceptance:** All 4 failure modes handled with Norwegian copy. 3-retry loop for `user_cancelled`. `biometric_failed` emitted per attempt. After 3 failures: escalation copy shown, no further retries.

#### M6.6 — Sign telemetry
**What:** `contract.mobile.signed` emitted via M2.3 server-side (not client-side, to satisfy ADR-0187 single-source rule — client POSTs to BFF which emits). `contract.mobile.biometric_confirmed` emitted by M2.2 server-side.
**Files:** BFF routes from M2.2 + M2.3
**Acceptance:** Neither event emitted from mobile client code directly. Emits come from server-side BFF handlers. Verify with a grep: `emit("contract.mobile.signed"` should appear in BFF routes only, not in screen code.

---

### Phase M7 — ContractAmendmentReviewScreen

Journey 5 (employee side) on mobile.

#### M7.1 — Component skeleton
**What:** Create `apps/mobile/src/screens/contract/ContractAmendmentReviewScreen.tsx`. Receives `amendment_id` via navigation param (from push deep-link `smartout://contract/amendment/${amendment_id}` per ADR-0245 §E).
**Files:** `apps/mobile/src/screens/contract/ContractAmendmentReviewScreen.tsx`
**Acceptance:** Renders with amendment_id param. TypeScript compiles.

#### M7.2 — Vertical-stacked amendment diff
**What:** Fetch amendment + parent contract via BFF (network-required per ADR-0245 §G — amendment may have been recalled since last sync). Render vertical-stacked diff (mobile narrow layout per ADR-0244 mobile-parity table lines 78–84): old value on grey background, new value highlighted. Each changed field labeled with its classification badge (MATERIAL / ADMIN). No side-by-side grid (too narrow on mobile).
**Files:** `apps/mobile/src/screens/contract/ContractAmendmentReviewScreen.tsx`
**Acceptance:** Diff renders. No cached data shown (always fresh fetch). Classification badges present. "Hent endring" error copy shown if offline. `contract.mobile.amendment_reviewed` emitted on screen mount.

#### M7.3 — Re-sign trigger
**What:** "Signer endringen" CTA → navigates to `AcknowledgementRingScreen` (if amendment requires full re-acknowledgement per `requires_employee_signature`) then to `ContractSignScreen`. If amendment is ADMIN classification only (no re-sign required): show "Endringen er notert" with dismiss CTA.
**Files:** `apps/mobile/src/screens/contract/ContractAmendmentReviewScreen.tsx`
**Acceptance:** MATERIAL amendments route through AcknowledgementRing → SignScreen. ADMIN amendments show notification-only UI. `contract.mobile.amendment_signed` emitted via BFF (same pattern as M6.6 — server-side emit only).

#### M7.4 — Amendment telemetry
**What:** `contract.mobile.amendment_reviewed` emitted on mount. `contract.mobile.amendment_signed` emitted by BFF on amendment sign-complete (same pattern as M2.3 / M6.6 — client POSTs, BFF emits).
**Files:** `apps/mobile/src/screens/contract/ContractAmendmentReviewScreen.tsx`, sign-complete BFF
**Acceptance:** `amendment_reviewed` fires on mount with `amendment_id`, `contract_id`, `profile_id`, `workspace_id`. `amendment_signed` fires server-side. No client-side emit for amendment_signed.

---

### Phase M8 — ObligationDetailScreen

Single obligation view with protocol deep-link.

#### M8.1 — Component skeleton
**What:** Create `apps/mobile/src/screens/contract/ObligationDetailScreen.tsx`. Receives `obligation_id` via navigation param. Fetches obligation metadata (title, description, due_at, status, linked protocol). Accessible from InboxScreen (due-soon push tap) and DetailScreen (obligation list item tap).
**Files:** `apps/mobile/src/screens/contract/ObligationDetailScreen.tsx`
**Acceptance:** Renders obligation data. TypeScript compiles.

#### M8.2 — Protocol deep-link launcher
**What:** If obligation has `policy_id`: render "Start opplæring" CTA. Tap navigates via deep-link to competence protocol screen at `smartout://competence/protocol/${policy_id}` (or internal navigation if competence module screen exists in mobile nav stack). If protocol screen does not exist in mobile nav: open web URL `https://app.smartout.ai/dashboard/competence/protocol/[id]` via `Linking.openURL()`.
**Files:** `apps/mobile/src/screens/contract/ObligationDetailScreen.tsx`
**Acceptance:** CTA visible when protocol exists. Tap navigates to protocol (native or web). Broken protocol_id: shows "Protokoll ikke funnet — kontakt admin" (no 404 crash).

---

### Phase M9 — Push-notification wiring

Stage-engine side. Mobile remains passive (token registration only via M2.1).

#### M9.1 — engine_event consumer for contract triggers
**What:** In stage-engine, add consumer for the 5 push trigger events from ADR-0245 §E trigger table: `contract.send_initiated`, `contract.amendment_initiated`, `contract.obligation_due_soon`, `contract.obligation_overdue`, `contract.amendment_signed`. Consumer pattern: ADR-0186 guardian-bus pg_notify. Each trigger → fetch FCM/APNs token for target `profile_id` from device_push_token table → dispatch payload.
**Files:** `services/stage-engine/` (consumer handler), or notification infra per existing push dispatch pattern
**Acceptance:** All 5 triggers wired. Payload builder produces title + CTA + deep-link only (no PII fields). Dispatch routed via existing `/api/push/dispatch` or equivalent.

#### M9.2 — Payload PII sanitization
**What:** Enforce per ADR-0245 §E cross-check with ADR-0078: no personnummer, no bank account, no salary amount, no tax card details in any push body. Title may include employee first name (already visible, not sensitive) and obligation title. Add a payload sanitizer function that strips any key matching `personnr|bank|salary|tax|kontonr|skattetrekk` before dispatch.
**Files:** Push payload builder / sanitizer utility
**Acceptance:** Sanitizer function exists and is called before dispatch. Unit test: a payload with `salary: 200000` field is stripped to `{}` by sanitizer.

#### M9.3 — APNs/FCM dispatch
**What:** Verify existing push dispatch infrastructure handles the 5 contract triggers, or add routing. Deep-link format per ADR-0245 §E: `smartout://contract/inbox/${contract_id}`, `smartout://contract/amendment/${amendment_id}`, `smartout://contract/obligation/${obligation_id}`, `smartout://contract/detail/${contract_id}`.
**Files:** Notification service / push dispatch
**Acceptance:** Test push received on device for each trigger. Deep-link opens correct screen.

---

### Phase M10 — E2E tests (Detox)

#### M10.1 — Detox setup verification
**What:** Check if Detox is configured in `apps/mobile/`. If not: flag as a separate setup sortie (Detox setup is potentially a 1–2 day task; do not block screen delivery on it). If Detox is present: verify `yarn detox build` passes.
**Files:** `apps/mobile/` — search for `.detoxrc.js` / `detox.config.ts`
**Acceptance:** Either Detox runs and `detox build` passes, OR a clear "Detox not configured — see [gap issue]" note is logged and E2E tests are marked pending.

#### M10.2 — Journey 3 mobile spec
**What:** Detox spec covering the full Journey 3 mobile path: receive push (mock) → open InboxScreen → navigate to DetailScreen → start AcknowledgementRing (N blocks) → reach PdfPreviewGate → scroll to end → tap "Signer nå" → WebView sign mock → biometric prompt mock → sign-complete POST → navigate to DetailScreen (status: signed).
**Files:** `apps/mobile/e2e/contract/journey-3-employee-signs.spec.ts` (or `apps/e2e/` if shared)
**Acceptance:** Spec executes end-to-end without timeout. All 4 block progression events emitted. `pdf_preview_viewed` event emitted. `biometric_confirmed` event emitted (mocked biometric success). Final screen shows contract as signed.

#### M10.3 — Journey 5 mobile spec
**What:** Detox spec covering Journey 5 mobile path: receive amendment push → open AmendmentReviewScreen → view diff → tap "Signer endringen" → AcknowledgementRing (if MATERIAL) → sign → navigate to DetailScreen (contract version updated).
**Files:** `apps/mobile/e2e/contract/journey-5-amendment-resign.spec.ts`
**Acceptance:** `amendment_reviewed` event emitted. `amendment_signed` event emitted. Contract version updated on DetailScreen after sign.

#### M10.4 — Offline-refuse tests
**What:** Detox spec: (a) attempt to start AcknowledgementRing while offline → expect "Du må være tilkoblet" error shown, no navigation to block 1; (b) attempt to open ContractSignScreen while offline → expect "Kontrakten kan ikke lastes" error, WebView not mounted.
**Files:** `apps/mobile/e2e/contract/offline-refuse.spec.ts`
**Acceptance:** Both offline refusals trigger Norwegian copy. No crash. No partial state written.

---

## Acceptance Criteria

- [ ] All 8 telemetry events emit with non-empty `workspace_id` + `actor_id` (ADR-0134 R1 + L-0177). Verified by unit test per event (assert `workspace_id` matches `.+` regex).
- [ ] `DomainChatOwnership reason="contract-flow"` flag present on all 5 listed screens: `ContractDetailScreen`, `ContractSignScreen`, `AcknowledgementRingScreen`, `ContractAmendmentReviewScreen`, `PdfPreviewGateScreen` (per ADR-0245 §F). Verified by grep: `DomainChatOwnership` in each file.
- [ ] WebView signing produces signed-PDF in DocuSeal AND `contract.mobile.signed` event emitted by BFF (dual-write is OK per ADR-0187 — DocuSeal webhook is lifecycle source, mobile BFF event is client observation).
- [ ] Biometric required on sign moment. Workspace can opt-out via `engine_authority_config.requires_biometric_on_sign = false`. Opt-out path tested.
- [ ] Offline AcknowledgementRing refuses to start with explicit Norwegian copy. `contract.acknowledgement.cancelled` NOT emitted on offline-refuse (nothing started; no audit row created for a session that never began).
- [ ] No push payload contains personnummer / bank account / salary amount / tax data. Lock-screen test: enable push previews on a test device + verify payload content for each of 5 triggers.
- [ ] Detox specs pass for Journey 3 + Journey 5 (or Detox setup gap is logged and specs marked pending with a dated ticket).
- [ ] Norwegian copy reviewed by Lovsen / arbeidsrettsadvokat before production promotion (Aml. §14-6 binding affirmation). This acceptance criterion is a **production promotion blocker** even if all technical criteria pass.
- [ ] `pnpm turbo typecheck` passes with 0 errors across `apps/mobile/` + `packages/telemetry/` + BFF routes.

---

## Risks / Open Questions

From ADR-0245 §"Open Questions" — carried here as action items for orchestrator:

1. **BankID switch path.** When workspace enables BankID adapter, DocuSeal `signing_url` becomes a BankID URL. WebView passthrough handles this transparently. Open: does biometric C4 prompt get suppressed when sign-method is BankID (BankID itself is the biometric)? Current assumption: `requires_biometric_on_sign = false` when BankID enabled. Separate ADR needed when first BankID workspace lands.

2. **Lærling (apprentice) contracts.** ADR-0241 amendment 5 blocks apprentice schema to Phase 2. When it ships: trigger map (Phase M9) needs `apprentice_milestone_due` event, obligation list needs apprentice-specific protocol routing. ADR-0249 placeholder per orchestrator note.

3. **Multi-arbeidsgiver-deling.** `ContractInboxScreen` scoped to one active `employment_contract` per profile. Konsern-bytte opens "multiple active contracts per employee" dimension. UX TBD (contract switcher chip in inbox header). Out of scope here.

4. **Re-attestation on amendment.** Is biometric required on amendment re-sign when the original contract was signed >6 months ago? Current default: yes (all amendment sign-moments treated as fresh consent). MATERIAL vs ADMIN distinction may change this. Tracked under ADR-0244.

5. **Norwegian copy review.** AcknowledgementRing block copy + push notification copy is legally binding (Aml. §14-6). Lovsen / arbeidsrettsadvokat review required before production. Escalation flag from ADR-0241/0244 carried forward. Acceptance criterion above reflects this.

6. **Web-side "Continue on phone" CTA.** `docs/decisions/0245-employee-contract-mobile-flow.md` §"Open Questions" item 6: should `/dashboard/my-contract` show a CTA that pushes a deep-link via SMS/email when the employee tries to tap a sign-action on desktop? Worth a small discussion with frontend-designer. Not blocking; reduces support burden.

7. **DomainChatOwnership mobile addendum.** M0.2 may reveal that ADR-0238 has no mobile implementation. If so: a mobile addendum ADR must be drafted and merged before Phase M3 can ship with `<DomainChatOwnership>` semantics.

---

## Validation

- [ ] `pnpm turbo typecheck` — 0 errors
- [ ] All 8 telemetry events registered in `packages/telemetry/src/registry.ts` before any screen emits
- [ ] `getProfileContext()` called in every screen that emits; no `?? ""` fallback anywhere in the contract screen tree
- [ ] Grep `emit("contract.mobile.signed"` in `apps/mobile/` returns empty (must be BFF-only)
- [ ] Grep `emit("contract.mobile.biometric_confirmed"` in `apps/mobile/` returns empty (must be BFF-only)
- [ ] Grep `body.profile_id` in BFF routes M2.1–M2.3 returns empty (server-side derivation only)
- [ ] `DomainChatOwnership` present in all 5 listed screens (grep)
- [ ] Push payload sanitizer unit test passes
- [ ] Detox Journey 3 + Journey 5 specs pass (or gap ticket present)
- [ ] Norwegian legal copy review sign-off in place before production promotion

---

## Post-Implementation

- [ ] Update `docs/decisions/0245-employee-contract-mobile-flow.md` status from `proposed` to `accepted` when Phase 0c migration lands + screens scaffolded + push-trigger seed migrated (per ADR-0245 footer promotion criteria)
- [ ] Register any net-new ADRs in `docs/decisions/0000-decision-log.md` (expected: mobile addendum to ADR-0238 if M0.2 reveals gap; BankID biometric interaction ADR)
- [ ] Write handoff at closure: decisions + learnings + next steps per feature-closure protocol
- [ ] Register in `docs/INDEX.md` under Plans
- [ ] Move to `docs/plans/completed/` when all acceptance criteria pass and production promoted

---

> After writing: add to `docs/INDEX.md` under Plans.
> Parent plan: `docs/plans/PLAN-contract-employee.md`
> Drives: Journey 3 + Journey 5 (employee portions) from `docs/architecture/contract-service/JOURNEY-contract-module.md`
