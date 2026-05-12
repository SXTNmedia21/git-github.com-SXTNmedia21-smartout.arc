---
title: "Employee Contract Mobile Flow — D6/C4 Surface, Sign + Acknowledgement + Evidence"
id: ADR_0245
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
supersedes: []
relates_to:
  - ADR_0133
  - ADR_0134
  - ADR_0135
  - ADR_0136
  - ADR_0077
  - ADR_0078
  - ADR_0241
  - ADR_0242
  - ADR_0243
  - ADR_0244
---

# ADR-0245: Employee Contract Mobile Flow — D6/C4 Surface, Sign + Acknowledgement + Evidence

## Context and Problem Statement

Cycle-1 orchestration of the contract-E2E delivery surfaced an architectural defect in `docs/plans/PLAN-contract-employee.md`: Phase 4 (employee view + sign — lines 127–133) and Phase 6 (amendment review + re-sign — lines 144–152) were specified as **web** routes (`/dashboard/my-contract`) with the closing footnote "Mobile parity: web first, mobile follow-up OK" (line 169).

This collapses the cascade surface boundary established in ADR-0133. Per `docs/decisions/0133-web-composes-mobile-executes.md` Decision Outcome (lines 33–46) and Rule R1 (lines 48–52), **mobile owns D6 production + C4 acceptance**; per Rule R3 (lines 64–69) mobile-native superpowers (push, GPS, camera, biometric) are first-class cascade extensions, not "mobile features." The employee verbs in question — *receive notification → read contract → acknowledge → sign → review amendment → re-sign → see obligation due soon* — are exactly D6 production (clock-aware notification flow), C4 acceptance (acknowledgement + signature as authority confirmation), and witness-with-evidence (per ADR-0136). Building these on web with a `/my-contract` URL targeted at desktop browsers contradicts the surface model AND the timing reality: contract events happen *på vei til jobb*, *før vakt*, *under pause* — phone moments, not desk moments.

This ADR locks the employee-contract mobile flow before any code in `apps/mobile/src/` ships. It does not re-litigate the underlying contract data model (ADR-0241/0242/0243/0244 own that). It binds those proposals to the right surface.

## Decision Drivers

- **ADR-0133 R1+R3**: D6/C4 verbs are mobile-primary; the employee contract surface is exactly this verb set
- **ADR-0244** acknowledgement-ring is **legal evidence under Aml. §14-6** (per ADR-0244 lines 11–28, 65–76); evidentiary value depends on *how* the surface presents and audits it — moving to mobile changes the layout but the evidence chain MUST be preserved per-block
- **ADR-0078** Layer-1 (process-level) + Layer-2 (capability-level) + Layer-3 (tool-level) channel restriction (lines 68–113) — mobile contract surfaces interact with Høy-PII fields (personnummer, bank, tax) which `payroll` capability (ADR-0242) restricts to `allowedChannels: ["chat"]` only; voice readback during contract-screen mount must be suppressed
- **ADR-0134** mandates `getProfileContext()` resolution before any `emit()` on mobile (lines 47–58); this ADR's six new mobile telemetry events MUST conform
- **ADR-0135** routes mobile voice via LiveKit, not Ultravox (lines 36–60); voice integration on the contract screen is suppressed but remains a real surface that needs explicit handling
- **ADR-0136** camera-evidence model (lines 38–56) provides the storage + RLS pattern for biometric C4 confirmation artifacts
- **L-0178** dual-chat-surface silent misroute: per `/home/sxtnl/dev/smartout.ai/CLAUDE.md` line 311 and ADR-0238 lines 14–18, any page hosting a domain chat surface beside the global Botsson Orb causes silent misroute unless `<DomainChatOwnership>` is declared. The contract screen is itself an AI-mediated surface (Botsson surfaces signing prompts, explains clauses, answers `salary_query`) — dual-surface trap applies
- **PLAN-contract-employee.md line 169** `Mobile parity: web first, mobile follow-up OK` is incorrect for the contract domain and must be struck (corrective edit tracked separately — not this ADR's body change)

## Considered Options

1. **Web-only employee surface (status quo from PLAN line 169)** — ship `/dashboard/my-contract` as web, defer mobile. Rejected: contradicts ADR-0133, mistimes the user moment, leaves push-notification + biometric C4 + camera-evidence superpowers unused.
2. **Web + mobile dual-build with feature parity** — implement everything twice. Rejected: ADR-0133 explicitly rejects parity framing (line 27, "Pursue feature parity with web. Rejected: framing produces feature graveyards").
3. **Mobile-primary for D6/C4 verbs, web read-only fallback** — Phase 4 + Phase 6 employee verbs ship mobile-first. Web `/dashboard/my-contract` exists as read-only desktop fallback (browse contract PDF, read obligation list) but signing + acknowledgement + amendment-review actions are mobile-only. **Chosen.**
4. **Mobile-only, no web fallback** — drop web read entirely. Rejected: an employee on a desktop at home should be able to see "what does my contract say" without forcing app install for read-only browsing.

## Decision Outcome

Chosen: **Option 3 — mobile-primary for execution verbs, web read-only fallback for browse verb only.**

### A. Surface partitioning — what lives where

**Web (admin authoring per ADR-0133 R2, lines 53–62)** — unchanged from PLAN:
- `/dashboard/people/[id]` HR-tab — admin defines §14-6 grunnlag (PLAN Phase 2, Journey 1)
- `/dashboard/contracts/compose` send-drawer — admin sends (PLAN Phase 3, Journey 2)
- Bulk-amendment authoring at tariff-revision (PLAN Phase 6 step 5, Journey 4 step 5)
- `/dashboard/my-contract` — **read-only desktop fallback** for the employee: stilling, lønn, obligation list, last-ned-PDF. **No** sign action, **no** acknowledgement-toggle interaction, **no** amendment re-sign.

**Mobile (employee execution per ADR-0133 R1, lines 48–52)** — net-new surface tree:
- `apps/mobile/src/screens/contract/ContractInboxScreen.tsx` — push-driven inbox; lists pending sign, pending amendment review, due-soon obligations
- `apps/mobile/src/screens/contract/ContractDetailScreen.tsx` — read active contract; obligation list with progress; tariff badge per ADR-0244
- `apps/mobile/src/screens/contract/ContractSignScreen.tsx` — DocuSeal sign flow + biometric C4 confirmation
- `apps/mobile/src/screens/contract/AcknowledgementRingScreen.tsx` — full-screen sequential block-by-block; per-block timestamp; legal evidence trail
- `apps/mobile/src/screens/contract/ContractAmendmentReviewScreen.tsx` — diff view + re-sign trigger
- `apps/mobile/src/screens/contract/ObligationDetailScreen.tsx` — single obligation with linked protocol launcher

**Out of scope on mobile (per ADR-0133 R2)**:
- Composition / template selection
- §14-6 field authoring
- Tariff binding configuration
- Amendment authoring (admin verb)
- Workspace contract settings

### B. Sign-flow architecture — DocuSeal embed via WebView, NOT native bridge

**Decision: WebView-embedded DocuSeal signing, native shell wrapper.**

Two paths considered:

1. **Native sign-flow with API bridge** — call DocuSeal REST API directly from RN; render PDF in `react-native-pdf`; collect signature stroke via `@shopify/react-native-skia`; submit signed-PDF blob to DocuSeal via API.
2. **WebView-embedded DocuSeal** — mount `react-native-webview` against the same `signing_url` issued for the web flow; native shell wraps it with header + biometric prompt + result handling.

Chosen: **Path 2 (WebView)**.

Rationale:
- DocuSeal's signature-validity model (audit trail, IP, timestamp, signed-PDF hash) is established for the existing web flow. Native bridge would duplicate that model; risk of signature-validity divergence between channels.
- BankID is workspace-configurable (out of scope per PLAN), but DocuSeal already supports BankID as a signature method when the workspace enables it. WebView passthrough means `payroll` capability switch from DocuSeal → BankID does not require mobile re-build.
- `react-native-webview` is already a transitive dependency of multiple RN packages installed; no new top-level dep.
- Native bridge would hand mobile a draft PDF + raw signature blob, expanding mobile attack surface (PDF parsing CVEs, signature-stroke exfiltration).

WebView constraints:
- HTTPS-only (DocuSeal `signing_url` is HTTPS-issued).
- Cookie isolation: WebView uses ephemeral cookie store per session, no shared cookies with mobile-native Supabase auth (security boundary).
- Result handling: WebView injects a `postMessage` shim that listens for the DocuSeal "signed" / "declined" / "expired" events and bridges them into the native shell, which then closes the WebView and routes to the next screen.
- Future BankID switch: `signing_url` from `payroll` capability becomes a BankID URL when workspace enables BankID adapter. WebView path unchanged. Bridge contract preserved.

### C. AcknowledgementRing mobile-first layout — full-screen sequential blocks

ADR-0244 lines 30–37 codify the AcknowledgementRing as legal evidence with per-framework configurable blocks. Web layout (Phase 3 spec) is "4 nøkkelblokker" in a horizontal ring. Mobile screen is too narrow for that grid.

Three layout candidates considered:

1. **Vertical-stacked accordion** — all blocks visible, expand-collapse per block. Rejected: scroll-depth proof becomes ambiguous (did user *read* the block or just scroll past it?), legal-evidence value weakened.
2. **Vertical stack with progressive disclosure** — only the active block expanded; others collapsed but visible as chips. Rejected: user can pre-tap chips out of order, breaking "read sequentially" evidence chain.
3. **Full-screen sequential modals** — one block per screen; explicit "Jeg har lest og forstått" tap unlocks Next; final block reveals sign trigger. Last block transitions to PDF preview gate (per ADR-0244 Lovsen Aml. §14-5 amendment, lines 118–129) before sign.

**Chosen: Option 3 — full-screen sequential.**

Layout contract:
- Each block is a dedicated screen rendered via `@react-navigation/native` stack push.
- Header shows "Blokk 2 av 4 — Lønn" (count + label).
- Body renders the block content (stilling / lønn / kategori / framework — per `framework.acknowledgement_blocks` config from ADR-0244).
- Footer carries one primary CTA: "Jeg har lest og forstått" — fully tappable across full width, 56pt min height (mobile native standard exceeds 44pt floor).
- On tap: emit `contract.acknowledgement.block_confirmed` per ADR-0244 line 67 (audit row to `activity_trail`); record `block_confirmed_at` timestamp client-side; transition to next block.
- After last block: navigate to `PdfPreviewGateScreen` — full PDF render via `react-native-pdf` with scroll-to-end detection. PDF view fully scrolled = `pdf_preview_viewed_at` set per ADR-0244 line 124 + `contract.pdf_preview_viewed` event emit per ADR-0244 line 126.
- After PDF preview viewed: `Sign now` button enabled; tapping navigates to `ContractSignScreen` (WebView).

Evidentiary value preservation:
- Per-block `block_confirmed_at` timestamp is server-recorded via emit (ADR-0244 line 67). Forward-only chain: block N+1 cannot be reached without block N's `confirmed_at`.
- "Read and understood" copy is the legally binding affirmation per Aml. §14-6. Norwegian copy MUST be reviewed by Lovsen / arbeidsrettsadvokat before go-live (escalation flag carried over from ADR-0244).
- Skip-prevention: no swipe-back gesture during the ring; explicit Cancel exits the entire flow with a "kontrakt ikke akseptert" event (`contract.acknowledgement.cancelled`) — partial completion is NOT preserved on cancel. Reopen restarts from block 1 (audit chain integrity).
- WCAG AAA additions per ADR-0244 lines 70–74 apply on mobile: each block screen carries `accessibilityRole="alert"` on the block content; the CTA button carries `accessibilityState={{ disabled: false, ...}}` and an explicit `accessibilityLabel` matching visible copy; `aria-live`-equivalent on RN is `accessibilityLiveRegion="polite"` on the count "Blokk 2 av 4" label.
- `useReducedMotion()` from `react-native-reanimated` guards every transition spring per ADR-0244 line 74.

### D. Biometric C4 acknowledgement — required for sign, optional for per-block

Per ADR-0133 R3 (line 67) biometric is a mobile-native superpower mapping to **C4 authority confirmation**.

Decision:
- **Required** at the moment the WebView returns `signed=true` from DocuSeal — the native shell, before persisting acceptance, MUST prompt biometric (`expo-local-authentication` Face ID / Touch ID / device PIN fallback).
- **Optional** at per-block acknowledgement (forcing biometric N times in one flow exceeds friction tolerance for the moment-of-acceptance UX).
- Workspace-policy override: `engine_authority_config` row for `payroll` capability gains an optional `requires_biometric_on_sign` boolean (default true). Workspaces with a documented exception (e.g., kitchen-staff devices that don't support biometric) can flip false; the flip itself is a `gate_action` event audited per ADR-0099.

Storage:
- Biometric *result* (success/failure boolean + timestamp) is stored on the `contract_amendment.acknowledged_constructive_dismissal_risk` row per ADR-0244 line 114 for amendment-flow, and on a new `employment_contract.biometric_confirmed_at` timestamptz for first-sign flow.
- Biometric *artifact* (the fingerprint/face hash) is **never** transmitted off-device. Only the device-attested success flag crosses the network. iOS `LAContext.evaluatePolicy` and Android `BiometricPrompt` both produce a boolean — that boolean plus a device-issued attestation (Apple App Attest / Android Play Integrity) is what the BFF receives and persists.
- `engine_authority_config` schema change is additive; lives in the same Phase 0c migration as `payroll` capability authority seed (per ADR-0242 line 49).

Audit trail link:
- Emit `contract.mobile.biometric_confirmed` (registered in `packages/telemetry/src/registry.ts` per Section H below) on success.
- On failure: emit `contract.mobile.biometric_failed` with `reason` (`user_cancelled` / `lockout` / `not_enrolled` / `hardware_unavailable`) — ALL failure modes route to a fallback flow (re-tap "Sign now" → re-prompt; after 3 failures, surface Norwegian copy: "Vi kan ikke bekrefte deg. Logg ut og inn igjen, eller kontakt admin.").

### E. Push-notification trigger map

Mobile push is the timing surface that web cannot replicate (ADR-0133 R3 line 64).

**Trigger → push payload map** (BFF-resolved, mobile passive):

| Trigger event | Payload title (no) | Payload CTA (no) | Payload body inclusion | Deep link |
|---|---|---|---|---|
| `contract.send_initiated` | "Ny kontrakt klar for signering" | "Åpne" | NO PII; only employee name from JWT-resolved profile | `smartout://contract/inbox/${contract_id}` |
| `contract.amendment_initiated` | "Endring i kontrakt — handling kreves" | "Se endringen" | NO PII; only contract title placeholder | `smartout://contract/amendment/${amendment_id}` |
| `contract.obligation_due_soon` | "Frist om {N} dager" | "Fullfør nå" | Obligation TITLE (e.g., "HMS-opplæring") allowed; due date allowed; NO contract terms | `smartout://contract/obligation/${obligation_id}` |
| `contract.obligation_overdue` | "Forfalt: kan blokkere clock-in" | "Fullfør nå" | Same as above + "Du kan ikke starte vakt før dette er gjort" | `smartout://contract/obligation/${obligation_id}` |
| `contract.amendment_signed` (admin) | "Endring signert" | "Se" | NO PII | `smartout://contract/detail/${contract_id}` |

**ADR-0078 cross-check.** ADR-0078 forbids voice for personnummer / bank / belop (lines 16, 32, 41, 116). Push-notification payloads pass through Apple APNs / Google FCM, which are network surfaces and subject to lock-screen previews. **No personnummer, no bank account, no salary amount, no tax-card details** in any push body — ever. Title + CTA only, plus the deep-link path. Title may include a name (already widely visible) and an obligation title (not PII). Push payload is signed via `expo-notifications` token bound to the device's authenticated profile_id; no broadcast.

**BFF contract.** All push triggers fan out from `engine_event` consumers in stage-engine. The BFF route at `/api/emma/chat` is irrelevant to push — push uses `/api/push/dispatch` (existing pattern per ADR-0186 / guardian-bus pg_notify; deferred to that ADR's rules). Mobile passive role: accept FCM/APNs token registration only; never originates push.

### F. Botsson channel suppression — DomainChatOwnership marker

Per L-0178 (`/home/sxtnl/dev/smartout.ai/CLAUDE.md` line 311) and ADR-0238 (`docs/decisions/0238-botsson-surface-disambiguation.md` lines 36–47), pages with embedded domain chat MUST declare ownership.

The contract screens have a domain-chat dimension: Botsson surfaces clause explanations (`explainContractClause` tool per ADR-0242 line 40), salary breakdowns (`salary_query` per ADR-0242 line 41), and amendment reasoning. These are scoped Q&A, not free-form Orb chat. Two surfaces in one viewport = silent misroute (per ADR-0238 line 16).

Decision:
- `ContractDetailScreen`, `ContractSignScreen`, `AcknowledgementRingScreen`, `ContractAmendmentReviewScreen`, `PdfPreviewGateScreen` MUST mount `<DomainChatOwnership reason="contract-flow" />` on enter.
- Mobile BotssonShell (the equivalent of web BotssonShell — declared in the mobile root `<App>` per existing pattern) reads the flag and renders Orb in passive mode (icon-only, no chat-enterable surface) per ADR-0238 line 45.
- Voice activation via long-press: **disabled** on contract screens. ADR-0078 forbids voice for personnummer / bank / salary readback (lines 32, 116). The contract screen displays exactly those fields. Long-press voice is suppressed; tooltip on long-press: "Stemme ikke tilgjengelig her — sensitiv kontraktdata."
- ContractInboxScreen (the list screen, no PII visible) MAY allow Orb passive-with-voice (Botsson can answer "hvorfor har jeg fått denne meldingen?" without exposing PII); Orb still suppresses to passive mode but long-press allowed.

This extends ADR-0078 Layer-2 (capability-level channel restriction) into a UI-level pre-emption: even before a `payroll` tool is invoked, the surface refuses to be a voice surface.

### G. Offline cache policy

**Cache-OK (read works offline):**
- Active contract metadata (job_title, salary, start_date, framework_id) — refreshed on app foreground; stale-while-revalidate 60s.
- Obligation list (rows, status, due_at, is_blocker) — refreshed on app foreground; stale-while-revalidate 60s.
- Tariff badge state (per ADR-0244 lines 86–93) — cached with 7-day TTL; stale-OK because the badge itself indicates staleness.

**Cache forbidden (network-required):**
- DocuSeal sign WebView — DocuSeal `signing_url` is single-use and time-bounded; offline launch returns "Kontrakten kan ikke lastes — sjekk nett."
- Amendment review — `ContractAmendmentDiff` per ADR-0244 line 84 needs a fresh fetch (the amendment may have been recalled by admin since last sync; stale diff = wrong consent).
- AcknowledgementRing — emits per-block telemetry that is legal evidence (ADR-0244 line 67). Offline emit = silent drop = audit chain breaks. Refuse to start the ring offline; show: "Du må være tilkoblet for å bekrefte kontrakten."
- Biometric confirmation — must transmit attestation immediately; offline biometric = un-replayable (anti-replay requirement).
- Push delivery — by definition online.

**Cache invalidation:**
- Realtime subscription (Supabase Realtime, ADR-0029 RLS-gated channels) on `employment_contract` filtered by `profile_id=$user`. On any UPDATE → invalidate contract cache + obligation cache + tariff cache.
- `contract_amendment` realtime channel filtered by `contract_id` of any active employment_contract.
- Background eviction: when app backgrounded > **6 hours**, soft-expire all contract caches; re-fetch on next foreground. Six hours covers a sleep cycle and forces re-attestation if a manager pushed an amendment overnight.

**Persistence layer:** existing mobile cache (TanStack Query persistor with `@react-native-async-storage/async-storage`). No new infrastructure.

**PII at rest:** the cached contract row contains `monthly_salary`, `hourly_rate` — Medium-PII per ADR-0242 §9 tier table (line 38–43). Acceptable on-device (RLS-equivalent: only the employee's own contract is cached on their own device). Personnummer + bank are **not** cached — those fields are not returned by the read-side `contract` capability tools (per ADR-0242 line 40); they're behind `payroll` capability (line 41) which is `["chat"]`-only and not invoked from the contract screen's read path. Defence-in-depth is preserved.

### H. Telemetry contract on mobile

Per ADR-0134 R1 (lines 47–50), every mobile mutation MUST resolve `workspaceId` + `actorId` via `getProfileContext()` (verified at `apps/mobile/src/lib/profile-context.ts:30-57`) BEFORE `emit()`. The function throws fail-fast on missing IDs (`apps/mobile/src/lib/profile-context.ts:34, 43-45, 49-51`). L-0177 in CLAUDE.md (line 269) extends this to row-derived workspace_id resolutions: silent fallback to JWT-default workspace = bug.

**New mobile telemetry events introduced by this ADR** (registry update in `packages/telemetry/src/registry.ts` is a separate sub-plan task per ADR-0175 frozen-event-set discipline; this ADR only declares the contract):

| Event name | Routing | Payload (keys only — no values logged here) |
|---|---|---|
| `contract.mobile.viewed` | PostHog + activity_trail | `contract_id, profile_id, workspace_id` |
| `contract.mobile.acknowledgement_block_progressed` | PostHog + activity_trail | `contract_id, block_name, block_index, total_blocks, profile_id, workspace_id` |
| `contract.mobile.pdf_preview_viewed` | PostHog + activity_trail + engine_event | `contract_id, pdf_hash, profile_id, workspace_id` (mirrors ADR-0244 line 126) |
| `contract.mobile.signed` | PostHog + activity_trail + engine_event | `contract_id, profile_id, workspace_id` (DocuSeal webhook is canonical write per ADR-0187 single-emit-source rule applied to lifecycle; mobile event marks *client-observed* completion only, NOT the lifecycle source-of-truth) |
| `contract.mobile.biometric_confirmed` | activity_trail | `contract_id, profile_id, workspace_id, attestation_method` |
| `contract.mobile.biometric_failed` | activity_trail (rate-limited) | `contract_id, profile_id, workspace_id, reason` |
| `contract.mobile.amendment_reviewed` | PostHog + activity_trail | `amendment_id, contract_id, profile_id, workspace_id` |
| `contract.mobile.amendment_signed` | PostHog + activity_trail + engine_event | `amendment_id, contract_id, profile_id, workspace_id` (same single-source caveat as `signed`) |

All eight events conform to ADR-0134 R1 (`getProfileContext()` resolution) and ADR-0193 NonEmptyString brand on `profile_id` / `workspace_id` (per `apps/mobile/src/lib/profile-context.ts:18, 21-23, 53-56`). Empty-string fallbacks are forbidden (CLAUDE.md project rule, paragraph "Mobile Telemetry Contract").

ADR-0187 single-emit-source rule applies: `contract.signed` lifecycle event is fired by the DB trigger on `employment_contract.status` transition (or by stage-engine when DocuSeal webhook lands). The `contract.mobile.signed` event is a **client observation** — distinct namespace (`contract.mobile.*`), distinct semantic (UX completion observed by mobile), routed for analytics not lifecycle. No double-emit.

## Rules & Consequences

- **Good, because** mobile becomes coherent surface for the moment-of-acceptance flow (push → read → biometric → sign, in 90 seconds, on phone, before vakt); legal-evidence chain preserved per ADR-0244; ADR-0133 surface boundary upheld; ADR-0078 PII channel rules extended (UI-level voice suppression on screens displaying salary/PII).
- **Bad, because** WebView dependency for DocuSeal couples sign UX to DocuSeal availability (not new — same coupling exists on web); biometric C4 prompt adds 1 friction step at sign moment (acceptable, that's the legal-binding moment); contract domain becomes a 7-screen surface tree on mobile (must enforce IA discipline).
- **Bad, because** offline-refuse on AcknowledgementRing means an employee in a venue with bad WiFi cannot acknowledge a contract — they must move to better signal. Acceptable: legal-evidence chain integrity > offline convenience for a once-per-employment event.
- **Migration cost:** ~3 weeks net-new mobile screens + ~1 week WebView bridge + ~3 days biometric integration + ~2 days push-trigger map wiring; assumes ADR-0241/0242/0243/0244 schema + capability work has landed (Phase 0a/0b).

### Agent Impact

- **Build agents:** new mobile screens MUST mount `<DomainChatOwnership reason="contract-flow" />`; MUST call `getProfileContext()` before any `emit()`; MUST NOT introduce direct `supabase.from('employment_contract').update(...)` writes — all mutation paths go through BFF (`/api/contracts/...`) which re-derives `profile_id` server-side per ADR-0151.
- **Frontend agents:** AcknowledgementRing on mobile is the full-screen sequential variant (Section C). The web AcknowledgementRing is unchanged. Shared logic in `packages/ui` `.web.tsx` / `.native.tsx` per ADR-0158.
- **Capability authors:** `payroll` capability (per ADR-0242) gains no new tools from this ADR. Mobile contract screens consume existing `contract` read tools + DocuSeal sign URL minted by `payroll` server-only handler.
- **Steward:** Trust-Gate verdict for any mobile contract PR references this ADR; verify DomainChatOwnership declared, getProfileContext used, no PII in push payloads, biometric required at sign.
- **Coordinator:** push-trigger map (Section E) lands as a single seed migration in `packages/notifications` (not in this ADR's PR — separate sub-plan task).

## Open Questions

This ADR explicitly defers:

1. **BankID switch path.** When a workspace enables BankID adapter, DocuSeal `signing_url` becomes a BankID URL. WebView passthrough handles this transparently for first-sign. Open: how does biometric C4 confirmation interact with BankID's own biometric (BankID-on-mobile uses Face ID via the BankID app)? Likely **biometric_required = false** when sign-method is BankID (BankID itself is the C4 confirmation). Separate ADR when first BankID workspace lands.

2. **Lærling (apprentice) contracts.** ADR-0241 amendment 5 (lines 79–80) flags `apprentice` as schema-blocked pending Phase 2. When apprentice contracts ship, the trigger map (Section E) needs an `apprentice_milestone_due` event and the obligation list rendering needs apprentice-specific protocol routing. Separate ADR (ADR-0249 placeholder per orchestrator note).

3. **Multi-arbeidsgiver-deling.** `ContractInboxScreen` is currently scoped to one active employment_contract per profile. Konsern-bytte / multi-employer (PLAN line 186 + ARCHITECTURE §12 question 6) opens a "multiple active contracts visible to one employee" dimension. UX TBD — likely a contract switcher chip in the inbox header. Out of scope here.

4. **Re-attestation on amendment.** When an amendment lands on a contract that was originally signed >6 months ago, do we require fresh biometric confirmation (treating the amendment as a fresh consent event)? Likely yes for MATERIAL amendments, no for ADMIN amendments. Tracked under ADR-0244 lines 30–43; this ADR treats amendment-sign as identical to first-sign for biometric purposes by default.

5. **Norwegian copy review.** All AcknowledgementRing block copy + push notification copy is legally binding (Aml. §14-6). Lovsen / arbeidsrettsadvokat review required before go-live (escalation flag carries over from ADR-0241/0244). Not blocker for spec; blocker for production.

6. **Web-side `/dashboard/my-contract`.** Specified above as read-only fallback. Open: does it carry a "Continue on phone" CTA that pushes a deep link via SMS/email when the user tries to tap a sign-action on web? (Reduces support burden when employees mistakenly open the web URL.) Worth a small follow-up discussion with frontend-designer.

## References

### ADRs (all read and verified before citation)

- **ADR-0133** — `docs/decisions/0133-web-composes-mobile-executes.md` — surface boundary; verb table lines 35–45; R1 mobile owns D6+C4 lines 48–52; R3 mobile-native superpowers map to dimensions lines 64–69
- **ADR-0134** — `docs/decisions/0134-mobile-telemetry-contract-enforcement.md` — workspace_id + actor_id resolution required lines 47–58
- **ADR-0135** — `docs/decisions/0135-mobile-voice-via-livekit-not-ultravox.md` — LiveKit not Ultravox lines 36–60; channel guard applies regardless of provider lines 49–52
- **ADR-0136** — `docs/decisions/0136-witness-with-camera-evidence-model.md` — evidence_storage_path + evidence_kind columns + workspace-scoped RLS lines 38–56; storage bucket pattern reusable for biometric attestation if needed
- **ADR-0077** — `docs/decisions/0077-contract-intake-pii-handling.md` — RPC-controlled access for personnummer/bank lines 64–76; no-echo rule for agent tools lines 77–91; channel restriction binding to ADR-0078 lines 113–120
- **ADR-0078** — `docs/decisions/0078-engine-process-channel-restriction.md` — Layer 1 process-level lines 68–79; Layer 2 capability-level lines 80–93; Layer 3 tool-level lines 95–113; voice forbid for PII lines 16, 32, 41, 116
- **ADR-0132** — `docs/decisions/0132-mobile-thin-client-via-web-bff.md` — mobile thin client lines 33–46; channel pinning server-side lines 49–52
- **ADR-0151** — server-side profile_id derivation (mentioned, not separately read this session — established invariant in CLAUDE.md "Mobile Telemetry Contract" paragraph)
- **ADR-0158** — packages/ui dual-platform `.web.tsx` / `.native.tsx` (referenced for shared UI primitives)
- **ADR-0186** — guardian-bus pg_notify pattern (referenced as the push-fanout precedent for Section E)
- **ADR-0238** — `docs/decisions/0238-botsson-surface-disambiguation.md` — DomainChatOwnership marker lines 36–47; passive Orb mode line 45
- **ADR-0241** — `docs/decisions/0241-contract-schema-migration-foundation.md` — schema foundation; Lovsen amendments lines 67–91 (Aml. §15-3 notice period, §15-6 trial pause, §15-15 exit certificate, §10-6 overtime, Bokføringsloven §13 retention)
- **ADR-0242** — `docs/decisions/0242-contract-payroll-capability-split.md` — payroll capability isolation lines 36–55; legal capability lines 87–105; per-tool channels for legal capability lines 96–99
- **ADR-0243** — `docs/decisions/0243-obligation-lifecycle-trigger-semantics.md` — obligation status enum lines 56–61; classification in TS const lines 41–50
- **ADR-0244** — `docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md` — single state machine + `requires_employee_signature` boolean lines 41–63; AcknowledgementRing per-framework blocks + audit emit lines 65–76; mobile parity table lines 78–84; TariffBadge component lines 86–93; Lovsen amendments §15-7 endringsoppsigelse lines 103–116; PDF-preview obligatorisk Aml. §14-5 lines 118–129; Bokføringsloven §13 retention lines 131–141

### Learnings

- **L-0177** — `/home/sxtnl/dev/smartout.ai/CLAUDE.md` line 269 — never resolve workspace_id from row reference without fail-fast on row-not-found
- **L-0178** — `/home/sxtnl/dev/smartout.ai/CLAUDE.md` line 311 — never mount BotssonShell on a page hosting embedded domain chat without `<DomainChatOwnership>`

### Plan + journey

- `docs/plans/PLAN-contract-employee.md` Phase 4 lines 127–133 + Phase 6 lines 144–152 (the surfaces this ADR moves to mobile); line 169 ("Mobile parity: web first, mobile follow-up OK") to be struck for contract domain via separate corrective edit
- `docs/architecture/contract-service/JOURNEY-contract-module.md` Journey 3 lines 167–225 (employee signs — the prime mobile target) + Journey 5 (amendment-flow, employee re-sign portion)

### Law

- Arbeidsmiljøloven §14-5 (skriftlig avtale; bevis-byrde)
- Arbeidsmiljøloven §14-6 (innhold i arbeidsavtale; legally-binding acceptance event)
- Arbeidsmiljøloven §15-7 (saklig grunn — endringsoppsigelse risk per ADR-0244)
- Bokføringsloven §13 (retention basis: regnskapsår_slutt + 5 år, per ADR-0241/0244)
- Personopplysningsloven §9 / GDPR Art 9(2)(b) (særlig kategori, employment-law basis — same legal hook as ADR-0077 line 137)
- Prop. 57 L 2021-2022 (digital signering bevis-byrde)

---

> Registered in `docs/decisions/0000-decision-log.md` after orchestrator persists this file. Promote to `accepted` when (a) Phase 0c migration lands on `development`, (b) `apps/mobile/src/screens/contract/` skeleton scaffolded, (c) push-trigger map seed migration lands.
