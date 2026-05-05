---
title: "Journey — Contract Employee Mobile Screens"
feature: contract-employee-mobile
status: draft
updated: 2026-04-30
created: 2026-04-30
module: contracts
tags: [contract, mobile, employee, signing, witness, ADR-0133, ADR-0134]
---

# Journey — Contract Employee Mobile Screens

> Mobile surface for the **employee-side** of the contract lifecycle. Authoring stays web (ADR-0133: web composes, mobile executes). Mobile owns Approve / Execute / Witness verbs.
>
> Companion to `JOURNEY-contract-employee.md` (web waves 3-6, status: verified). This spec covers the mobile gap flagged there: *"Mobile `MyContract.tsx` (documented gap per ADR-0133)"*.

## Hard Boundaries (do NOT cross)

| Allowed on mobile | Forbidden on mobile |
|---|---|
| View own contract | Author / compose contract |
| Reveal PII (with biometric step-up) | Edit contract terms |
| Sign DocuSeal envelope | Send / dispatch contract to others |
| Accept/decline amendment | Initiate amendment |
| View salary breakdown + Riksavtalen citation | Edit pay-rule / tip-rule |
| Witness obligation (clock-in gate) | Override obligation |

Source: ADR-0133. Cross any of these in mobile = merge blocker.

## Telemetry Contract (ADR-0134)

Every mutation MUST resolve `workspace_id` (non-empty) + `actor_id` (non-empty) via `getProfileContext()` BEFORE `emit()`. Empty-string fallback = forbidden. Offline queue payloads Zod-validated at enqueue.

Affected events (already in `packages/telemetry/src/registry.ts` per JOURNEY-contract-employee.md): `contract.viewed`, `contract.pii_revealed`, `contract.signed`, `amendment.accepted`, `amendment.declined`, `obligation.completed`. Mobile must emit same names with same shape.

## AI Routing (ADR-0132)

All chat / capability traffic via web BFF (`/api/emma/chat` → stage-engine). Never call capabilities direct from mobile. Mobile sends `channel: "chat"` hint; BFF enforces channel pinning per ADR-0078.

## Voice Restriction (ADR-0078, L-feedback_voice_forbidden_critical_data)

Personnummer, bankkonto, adresse = chat only. Voice forbidden for ALL contract data. Three-layer defence: process `allowed_channels` + capability `allowedChannels` + tool `ctx.channel` guard.

## Design Tokens (smartout-nordic-split)

- Colors via CSS variables (`bg-background`, `text-foreground`, `border-border`, `bg-muted`). No hardcoded zinc/slate/gray.
- Headings: `font-heading` (Instrument Serif). Body: Geist Sans. Data: `font-mono`.
- Motion: `motionTokens.spring` (35/22/2.2). Min 250ms exit, 500ms enter.
- Icons: Lucide React only. No emojis.
- Glassmorphism on biometric step-up overlay only.

---

## Screens

Five screens. Route group: `apps/mobile/app/(app)/(contract)/`. Surface placement under existing `(me)` tab if user prefers single personal-tab; otherwise new `(contract)` group with bottom-tab badge for unread amendments.

---

### Screen 1 — `index.tsx` — Mitt Kontrakt (Overview)

**Route:** `/(app)/(contract)` or `/(app)/(me)/contract`
**Mirrors:** web `/dashboard/my-contract`
**Owner:** employee role
**Cascade verb:** Witness (read own state)

#### Functions

| # | Function | Behavior | Telemetry |
|---|---|---|---|
| 1.1 | Fetch own active contract | `useMyContract()` hook → `employment_contract` via Supabase RLS (`profile_id = auth.uid()`) | `contract.viewed` on mount |
| 1.2 | Header card | Job title + workspace + start_date + status badge (`active` / `pending_signature` / `expired`) | — |
| 1.3 | Quick-stats row | Hourly rate (masked), weekly hours, prøvetid days remaining | — |
| 1.4 | Sections list | Tap → expands: Lønn / Arbeidstid / Prøvetid / Tariff-binding / Vedlegg | — |
| 1.5 | Reveal-PII button | Per ADR-0078: chat-channel only. Triggers biometric step-up (Screen 5) | `contract.pii_reveal_requested` |
| 1.6 | Pending amendment banner | Shows if amendment-status `pending_employee_signature`. CTA → Screen 3 | — |
| 1.7 | Empty state | "Ingen kontrakt enda. Spør HR." + Lucide `FileText` icon, no contract = `null` from RLS | — |
| 1.8 | Pull-to-refresh | RefreshControl → re-fetch + re-emit `contract.viewed` (debounced 30s) | — |
| 1.9 | Offline banner | If `useNetInfo` reports offline → top yellow banner "Offline — viser cache" | — |

#### Acceptance

- Cold mount → contract data visible < 1s warm cache
- Reveal-PII button disabled when `voice` channel pinned
- Empty state never shows for active employee
- All numbers via `font-mono`

---

### Screen 2 — `[id]/sign.tsx` — Sign Contract (DocuSeal Embed)

**Route:** `/(app)/(contract)/[id]/sign`
**Mirrors:** web DocuSeal flow (Journey 3 in JOURNEY-contract-employee.md)
**Owner:** employee role
**Cascade verb:** Approve / Execute (signature = C4 acceptance)

#### Functions

| # | Function | Behavior | Telemetry |
|---|---|---|---|
| 2.1 | Pre-sign checklist | 3 gates: PDF viewed (full scroll), key-terms acknowledged, identity confirmed | `contract.pre_sign_gates_passed` |
| 2.2 | DocuSeal WebView | `react-native-webview` with `DOCUSEAL_EMBED_URL`. signed_url from contract-service | `contract.docuseal_loaded` |
| 2.3 | Signature capture | DocuSeal handles draw/type. Mobile only displays + posts back webhook to `/api/contracts/docuseal-webhook` | — |
| 2.4 | Biometric step-up before submit | `expo-local-authentication` Face/Touch ID. Logs to `activity_trail` | `contract.biometric_passed` |
| 2.5 | Submit confirmation sheet | Bottom-sheet, "Du signerer som juridisk forpliktende. Bekreft." Cancel / Bekreft | `contract.signed` ON success |
| 2.6 | Network failure handling | Offline at submit → queue in `apps/mobile/src/lib/sync/` with Zod validation per ADR-0134 | `contract.signed_queued_offline` |
| 2.7 | Success state | Confetti motion (`motionTokens.springSnappy`) + auto-redirect to Screen 1 after 1.5s | — |
| 2.8 | Error state | Inline + retry. DocuSeal failures distinct from network failures | `contract.sign_failed` |

#### Acceptance

- Cannot reach this screen if contract not in `sent_pending_signature` status
- Biometric required (no bypass)
- Submit blocked if any of 3 pre-sign gates incomplete
- Telemetry `contract.signed` includes `signature_method`, `biometric_used`, `device_id`

---

### Screen 3 — `[id]/amendment.tsx` — Amendment Review

**Route:** `/(app)/(contract)/[id]/amendment`
**Mirrors:** web `AmendmentSection` (Journey 5 in JOURNEY-contract-employee.md)
**Owner:** employee role (admin-initiated, employee accepts/declines)
**Cascade verb:** Approve / Decline

#### Functions

| # | Function | Behavior | Telemetry |
|---|---|---|---|
| 3.1 | Diff card | Old → new for each changed field. `font-mono` for numbers, color-coded (gain green, loss amber) | `amendment.viewed` |
| 3.2 | Material classification badge | MATERIAL / ADMIN_ONLY / RISK_DISMISSAL via `lovsen` capability (legal) → display Riksavtalen ref + AML §15-7 link | — |
| 3.3 | Reason from admin | Admin-supplied amendment reason, full text | — |
| 3.4 | Effective-from picker (read-only) | Date displayed in NB locale | — |
| 3.5 | Accept button | Triggers DocuSeal re-signature flow if MATERIAL → routes to Screen 2 with new envelope | `amendment.accepted` |
| 3.6 | Decline button | Bottom-sheet asking decline reason (free text + 4 chips: "Lønn", "Arbeidstid", "Annet", "Trenger hjelp"). Submit triggers HR notification | `amendment.declined` |
| 3.7 | Eskalér til lovsen | If RISK_DISMISSAL → CTA "Spør lovsen" opens chat with pre-filled context. Channel = chat (ADR-0078) | `amendment.escalated_to_legal` |
| 3.8 | Expiry timer | If amendment expires soon (< 24h) → red banner "Utløper kl X" | — |

#### Acceptance

- MATERIAL amendment without re-signature = data integrity violation, never allowed
- Decline reason required (min 10 chars OR chip selected)
- Telemetry includes amendment_id, classification, decision_method (button/escalation)

---

### Screen 4 — `obligation-blocker.tsx` — Obligation Blocker (Modal)

**Route:** Modal overlay, not standalone route. Triggered by clock-in attempt with overdue obligations.
**Mirrors:** web `ObligationBlocker` (already exists in mobile per JOURNEY-contract-employee.md)
**Owner:** employee role
**Cascade verb:** Witness (gates clock-in)

#### Functions

| # | Function | Behavior | Telemetry |
|---|---|---|---|
| 4.1 | Block clock-in CTA | Shown when `clock_in_check` capability returns `obligations: overdue[]` | `obligation.blocked_clock_in` |
| 4.2 | Obligation list | Each: title, due_date, severity, "Fullfør" CTA | — |
| 4.3 | Inline complete | If obligation = quick-task (e.g. "Bekreft mottatt arbeidshåndbok") → checkbox + emit | `obligation.completed` |
| 4.4 | Deep-link complete | If obligation requires governance action → deep-link to `/dashboard/my-training` (web) via `expo-linking` | — |
| 4.5 | "Spør lovsen" escape | If employee disputes obligation → opens chat with lovsen, channel = chat | — |
| 4.6 | Emergency override | Admin-only deep-link signed-token (cannot self-bypass) | `obligation.admin_override` |

#### Acceptance

- Modal cannot be dismissed by swipe — only via complete or escape
- Re-checks `clock_in_check` after each completion (no stale state)
- Telemetry on every mount with full obligation set hash

---

### Screen 5 — `pii-step-up.tsx` — Biometric PII Reveal (Sheet)

**Route:** Bottom-sheet overlay. Triggered from Screen 1 reveal-PII.
**Mirrors:** No web equivalent (mobile-native superpower per ADR-0133)
**Owner:** employee role
**Cascade verb:** Witness (with elevated authority)

#### Functions

| # | Function | Behavior | Telemetry |
|---|---|---|---|
| 5.1 | Channel guard | Reject if `ctx.channel === "voice"` per ADR-0078 | `contract.pii_reveal_blocked_channel` |
| 5.2 | Biometric prompt | `expo-local-authentication` with reason "Vis personnummer" | `contract.biometric_prompted` |
| 5.3 | Decrypt + reveal | On pass: fetch unmasked PII via signed Edge Function call (`workspace-api/contract-pii`), display 30s, then auto-mask | `contract.pii_revealed` (with TTL) |
| 5.4 | Activity trail entry | Server-side INSERT to `activity_trail` with `event_type='pii_reveal'`, profile_id, ip, ua | — |
| 5.5 | Failure handling | Biometric fail / fallback rejected → sheet closes, toast "Avbrutt" | `contract.pii_reveal_failed` |
| 5.6 | Re-mask on background | If app backgrounds while revealed → instant mask via `AppState` listener | — |
| 5.7 | Copy to clipboard | Disabled by default. Long-press shows "Kopier kun ved nødvendighet" with 5s confirm timer | `contract.pii_copied` |

#### Acceptance

- Server-side audit row exists for every successful reveal
- Auto-mask after 30s (test with timer)
- Cannot reach without active biometric capability on device
- Telemetry includes channel, biometric_method, success/fail

---

## Cross-Screen Concerns

### Authority Config (engine_authority_config)

Every mobile mutation hits `cascade_gate_write` RPC. Capability tools delegate via `gatedMutation` per ADR-0204. Authority defaults seeded:

| Capability tool | Authority | Default |
|---|---|---|
| `contract.view` | low | auto |
| `contract.pii_reveal` | high | step-up required |
| `contract.sign` | critical | biometric + 4-eyes (admin sent envelope) |
| `amendment.accept` | critical | biometric on MATERIAL |
| `amendment.decline` | medium | confirmation sheet |
| `obligation.complete` | low | auto |
| `obligation.override` | critical | admin-only signed token |

### Offline Queue (ADR-0134)

Mutations 2.6 (sign), 3.5/3.6 (amendment), 4.3 (obligation) → queue with Zod validation. Sync on reconnect. Idempotency keys = `{user_id}:{contract_id}:{action}:{timestamp_minute}`.

### Notification Surface

Push notifications driven by `engine_event` server-side. Events that should ping mobile:

- `contract.sent_pending_signature` → "Du har en kontrakt å signere"
- `amendment.proposed` → "Endring i kontrakten din"
- `amendment.expires_soon` → "Utløper i morgen"
- `obligation.due_soon` → "Frist i morgen kl X"
- `obligation.overdue` → "Forfalt"

Channels: `expo-notifications` push tokens registered per profile_id, scoped to workspace.

### Lovsen Integration

Screens 1, 3, 4 expose "Spør lovsen" CTA. Routes via `/api/emma/chat` BFF with `capability: "legal"`, `channel: "chat"`, `context: {contract_id, screen, action}`. Lovsen returns Riksavtalen citation + paragraph reference (Aml. §-numre) per existing `legal` capability.

---

## File Layout (proposed)

```
apps/mobile/app/(app)/(contract)/
├── _layout.tsx                  # Stack with header
├── index.tsx                    # Screen 1 — Mitt Kontrakt
├── [id]/
│   ├── sign.tsx                 # Screen 2 — DocuSeal embed
│   └── amendment.tsx            # Screen 3 — Amendment review
├── obligation-blocker.tsx       # Screen 4 — Modal (also mounted from shifts/clock-in)
└── pii-step-up.tsx              # Screen 5 — Biometric sheet

apps/mobile/src/features/contract/
├── components/
│   ├── ContractHeaderCard.tsx
│   ├── ContractSectionList.tsx
│   ├── AmendmentDiffCard.tsx
│   ├── ObligationListItem.tsx
│   └── PiiRevealOverlay.tsx
├── hooks/
│   ├── useMyContract.ts
│   ├── useAmendmentReview.ts
│   ├── useBiometricStepUp.ts
│   └── useOfflineQueue.ts
└── lib/
    ├── docuseal-embed.ts
    ├── pii-decrypt.ts
    └── obligation-resolver.ts

packages/ui/src/contract/        # Shared web+native primitives where possible
├── ContractStatusBadge.tsx
└── ContractStatusBadge.native.tsx
```

---

## Out of Scope (this spec)

- Admin-initiated amendment composition (web only)
- Contract template editing (web only)
- Compliance dashboards (web only)
- Bulk-send (web only)
- Multi-employer contract switching (deferred — single workspace assumption)

---

## Dependencies

- Lovsen Phase 0c (deferred per JOURNEY-contract-employee.md)
- DocuSeal mobile-friendly embed config (verify with vendor)
- Push notification capability (via FCM/APNs registration in `apps/mobile/src/lib/notifications.ts`)
- `expo-local-authentication` (already in deps)
- `expo-linking` for deep-link to web for governance actions
- Existing `apps/mobile/src/lib/profile-context.ts` for ADR-0134 compliance

## Open Questions

1. Place under `(me)` tab or new `(contract)` tab? Single-tab simpler; new-tab clearer surface for unread amendments.
2. PDF rendering: native `react-native-pdf` or DocuSeal-only display? Affects offline-view of signed contract.
3. Biometric fallback: PIN allowed or biometric-only? Compliance impact.
4. Amendment expiry: how is "soon" defined — 24h fixed, or admin-supplied per amendment?

---

## Acceptance for Spec Approval

- [ ] All 5 screens have function table with telemetry events listed
- [ ] No authoring verbs leak into mobile spec (ADR-0133 boundary clean)
- [ ] All mutations resolve `workspace_id` + `profile_id` via `getProfileContext()` (ADR-0134)
- [ ] Voice forbidden where PII involved (ADR-0078)
- [ ] Each screen has explicit acceptance bullets (falsifiable)
- [ ] Authority defaults table covers every mutation
- [ ] Offline queue rules stated for relevant mutations
- [ ] Open questions surfaced (4 above)

---

## Next Step

Pontus reviews → comments inline or approves → spawn `walkai-bridge-builder` (sonnet) to scaffold file layout + capability wiring per JOURNEY-contract-employee.md Wave 7.
