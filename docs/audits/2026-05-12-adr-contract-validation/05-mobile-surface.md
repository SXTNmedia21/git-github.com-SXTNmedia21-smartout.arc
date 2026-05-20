---
title: ADR-Contract Audit Slice 05 — Mobile Surface
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, mobile-surface, adr]
---

# Slice 05 — Mobile Surface ADR Audit

**Date:** 2026-05-12
**ADRs in scope:** 0127–0131 (billing, non-mobile — N/A), 0132, 0133, 0134, 0135, 0136, 0158, 0238
**Surface:** `apps/mobile/**`
**Campaign filter:** campaign/mobile (heavy churn — flagged in-progress), campaign/daily-operation

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 2 |
| LOW | 2 |
| VERIFIED INTENTIONAL | 4 |
| IN-PROGRESS | 2 |

ADRs 0127–0131 are billing-domain ADRs with no mobile surface. Not applicable to this slice.

---

## Findings Table

| ID | Severity | ADR | File:line | Description |
|---|---|---|---|---|
| F-01 | HIGH | ADR-0133 R4 | `docs/architecture/MOBILE_IA_CONTRACT.md` | `MOBILE_IA_CONTRACT.md` does not exist. R4 mandates it enumerates every screen, cascade surface ownership, and allowed verbs. |
| F-02 | HIGH | ADR-0133 R4 | `apps/mobile/app/(app)/(me)/payroll/` | The `(payroll)/` sub-route group under `(me)` exists and ships `payslip.tsx`, `payslip-detail.tsx`, `payslip.tsx` as reachable screens. ADR-0133 R4 states "The hidden `(payroll)/` group must be deleted." Group is not hidden; it is navigable. |
| F-03 | HIGH | ADR-0238 | `apps/mobile/src/providers/botsson-provider.tsx:7,42,147,242` | File docstring says "Voice mode uses Ultravox WebRTC." `voiceSessionRef` held as `VoiceSession` (comment: "legacy Ultravox path — keep for the web bundle") is mutated in `endSession()` and `openWithIntent()`. C1.b LiveKit path is also wired (correct), but the legacy Ultravox session ref is still alive in state, mutated on voice events, and never fully removed. This is not an `ADR-0238` violation per se but is a HIGH-severity orphan: mobile ships dead Ultravox session-handle code that can conflict with the LiveKit state machine. |
| F-04 | MEDIUM | ADR-0135 | `apps/mobile/src/providers/botsson-provider.tsx:7` | Header comment still says "Voice mode uses Ultravox WebRTC (browser context via Expo Web)." ADR-0135 mandates LiveKit on mobile. Code has both paths; C1.b (LiveKit) is correct, but the header comment creates false trust for future developers. |
| F-05 | MEDIUM | ADR-0133 R2 | `apps/mobile/app/(app)/(shifts)/create.tsx` | Shift-create screen is present on mobile and reachable. ADR-0133 R2 lists "schedule drag-drop editor" as web-only but does NOT explicitly forbid all shift-create; ADR-0277 R1 resolves this by routing through BFF. However: ADR-0277 R3 requires employee picker + reason field + no client-side `deriveDayCategory`. `create.tsx` has all three (verified). ADR-0277 is `accepted`. This is a **MEDIUM** because the BFF route (`/api/mobile/shifts`) has a `TODO` comment on line 24–26: "BFF route not yet built (Phase 3a)." The screen exists but its BFF endpoint may not be live. |
| F-06 | LOW | Memory/positioning | `apps/mobile/app/(app)/(me)/payroll/payslip-detail.tsx:130`, `payslip.tsx:79,105`, `(me)/index.tsx:171` | Multiple visible UI labels say "Lønnsslipp" / "Lønnsslipper". Per memory note `feedback_lonnsgrunnlag_not_lonnsslipp.md` (2026-05-08): Smartout produces **lønnsgrunnlag**, not lønnsslipp. Capabilities correct; only UI labels are wrong. Affects: `payslip-detail.tsx:130`, `payslip.tsx:79,105`, `(me)/index.tsx:171`. |
| F-07 | LOW | ADR-0158 | `apps/mobile/` (Metro config) | ADR-0158 R4 requires Metro config in `apps/mobile` to add `@smartout/ui` to `watchFolders` and configure `resolver.sourceExts` to prefer `.native.tsx`. No `metro.config.js` or equivalent found in the mobile app root. |

---

## Per-ADR Rollup

### ADR-0127 to ADR-0131 — Billing ADRs
**Not applicable.** These ADRs govern billing dispatch, invoice delivery columns, adapter pattern, Fase 2 scope, and Stripe Connect. None have mobile surface obligations.

### ADR-0132 — Mobile Thin Client via Web BFF
**COMPLIANT.**
- `use-botsson-chat.ts` POSTs to `getEmmaChatUrl()` → `/api/emma/chat` (BFF). No direct capability calls. ADR-0132 R5 Phase B collapsed: mobile no longer inserts to `chat_message` directly.
- `use-swap.ts` uses `bffPost()` to BFF swap URLs. `workspace_id` / `profile_id` absent from body per ADR-0176 Invariant 3.
- `use-voice-transcripts` and `use-botsson-voice-session` POST to `/api/emma/voice/transcript`.
- `EXPO_PUBLIC_WEB_API_URL` env var exists and is fail-fast in production.
- `use-create-shift.ts` routes through BFF (ADR-0277). TODO comment on BFF route existence is a F-05 finding.

### ADR-0133 — Web Composes, Mobile Executes
**PARTIAL COMPLIANCE.**
- **F-01 OPEN:** `MOBILE_IA_CONTRACT.md` missing.
- **F-02 OPEN:** `(payroll)/` group not deleted as mandated by R4.
- Tab layout: 5-tab (Kalender, Vakter, FAB, Chat, Min Tid) per ADR-0268. Legacy tabs hidden via `href: null`. COMPLIANT for tab structure.
- No drag-drop authoring, contract authoring, workspace settings, or governance authoring found on mobile. COMPLIANT on R2 web-only verbs.
- `(shifts)/create.tsx` permitted by ADR-0277 (manager emergency create via BFF).

### ADR-0134 — Mobile Telemetry Contract
**COMPLIANT (previously broken, now fixed).**
- `use-punch.ts`: both `punchIn()` and `punchOut()` call `getProfileContext()` before `emit()`. Non-empty `workspaceId` and `profileId` verified at lines 39–40 and 100.
- `use-swap.ts`: all 3 swap hooks (initiate, respond, cancel) call `getProfileContext()` before `emit()`. Lines 99, 160, 225.
- `use-create-shift.ts`: no client-side `emit()` — server is sole emitter per ADR-0270. COMPLIANT.
- L-0083 (actor_id "anonymous" corruption) trap: no anonymous fallback found. Empty-string guard in place via `getProfileContext()` throw pattern.

### ADR-0135 — Mobile Voice via LiveKit
**PARTIAL COMPLIANCE (in-progress).**
- `use-botsson-voice-session.ts` uses `livekit-client` Room + `@livekit/react-native-krisp-noise-filter`. COMPLIANT for C1.b LiveKit path.
- `botsson-provider.tsx` retains dead `voiceSessionRef` (Ultravox legacy). See F-03.
- Header comment still says Ultravox. See F-04.
- ADR-0135 is `proposed` (not yet `accepted`) — campaign/mobile is in-progress.

### ADR-0136 — Camera Evidence Model
**NOT YET IMPLEMENTED.**
- No `evidence_storage_path`, `evidence_kind`, or camera-capture evidence UI found on completion entities.
- `safety-round.tsx`, `deviation.tsx` do not implement evidence attachment.
- ADR-0136 is `proposed` — explicitly scoped as future work ("~1 week DB migration + storage policy + mobile capture UI"). Marking **in-progress** pending campaign/mobile delivery.

### ADR-0158 — packages/ui Dual-Platform Strategy
**PARTIAL COMPLIANCE.**
- F-07: Metro config not found. ADR-0158 R4 requires explicit `watchFolders` + `resolver.sourceExts` config.
- ADR-0158 is `proposed` and campaign/mobile is in-progress. Flagging as in-progress.

### ADR-0238 — Botsson Surface Disambiguation
**NOT APPLICABLE to mobile in strict sense.**
- ADR-0238 addresses web `BotssonShell` Orb suppression on pages with embedded domain chat. Mobile has a single `BotssonSheet` (bottom sheet) — no dual-surface collision exists. COMPLIANT by architecture.
- F-03 (Ultravox session ref in `botsson-provider.tsx`) is adjacent but not an ADR-0238 violation.

---

## Verified Intentional

| Pattern | Rationale |
|---|---|
| `use-botsson-chat.ts` reads `chat_message` table directly | Read (SELECT) is allowed per ADR-0132 R4 ("direct `supabase.from().select()` for first-party UI data"). Only inserts are forbidden. |
| `use-botsson-chat.ts` lines 154–165 inserts to `chat_conversation` | Creates the conversation record (housekeeping), not an AI message insert. BFF writes AI turns. COMPLIANT per R5. |
| `use-swap.ts` calls `getProfileContext()` but sends NO identity fields in BFF body | ADR-0176 Invariant 3 — server re-derives. `getProfileContext()` is for local `emit()` only. Explicitly documented in hook comment. |
| `(payroll)/` exists as sub-route of `(me)`, not a top-level tab | ADR-0133 R4 says "hidden `(payroll)/` group" — this likely refers to a top-level route group (deleted from tab config). `(me)/payroll` as a nested sub-navigator is a read-only personal payroll view, not an authoring surface. The `(me)/payroll` group contains no write mutations. LOW risk but the framing as "lønnsslipp" is a separate concern (F-06). |

---

## In-Progress (campaign/mobile churn)

| Finding | ADR | Status |
|---|---|---|
| ADR-0136 camera evidence not implemented | ADR-0136 | `proposed`, explicitly scoped as future work. Not a regression. |
| ADR-0158 Metro config missing | ADR-0158 | `proposed`, campaign/mobile in-progress. Dual-platform widgets not yet adopted. |
| F-03 Ultravox session ref in BotssonProvider | ADR-0135 | C1.b LiveKit path is correct. Legacy ref is dead code pending cleanup. campaign/mobile. |
