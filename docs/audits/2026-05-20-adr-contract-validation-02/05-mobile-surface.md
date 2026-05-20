---
title: "Audit Slice 05 — Mobile Surface"
status: complete
created: 2026-05-20
updated: 2026-05-20
slice: "05"
run_id: "2026-05-20-adr-contract-validation-02"
scope: "apps/mobile/**"
adrs: [0127, 0128, 0129, 0130, 0131, 0132, 0133, 0134, 0135, 0136, 0158, 0238, 0378]
tags: [audit, mobile, pii, livekit, telemetry, thin-client]
---

# Slice 05 — Mobile Surface

## Summary

**Verdict: GREEN**

Baseline HIGH MOB-01 (leader_phone PII on LiveKit wire) is **CLOSED** by PR #432 (commit 0d14334d4). All 5 PII tests in `botsson-tools-pii.test.ts` pass. The `buildCallLeader(phoneResolver)` factory pattern is fully wired — phone resolution happens client-side via `fetchLeaderPhone(profileId)`, never in tool args on the voice channel.

No new HIGH findings. One MEDIUM and one LOW surfaced.

| Severity | Count |
|---|---|
| HIGH | 0 (was 1 — CLOSED) |
| MEDIUM | 1 |
| LOW | 1 |
| INFO | 1 |

---

## Findings

### MOB-01 — CLOSED

- **Status**: CLOSED (PR #432, commit 0d14334d4)
- **Was**: `apps/mobile/src/lib/botsson-tools.ts:121-138` — `mobile_call_leader` schema carried `leader_phone` as a tool parameter, placing phone PII on the `botsson-tool-call` LiveKit data channel.
- **Fix verified**: `buildCallLeader(phoneResolver: LeaderPhoneResolver)` factory pattern. `leader_phone` is absent from `dynamicParameters` in `getDefinitionsForRegistration()`. Phone resolved via `fetchLeaderPhone(profileId)` chain: `team_member → team → profile → user_identity`. Wire payload carries only `leader_name` (acknowledgement text only).
- **Test coverage**: `apps/mobile/src/lib/__tests__/botsson-tools-pii.test.ts` 5/5 assertions (wire has no `leader_phone` param, handler resolves from injected resolver, legacy `leader_phone` in params ignored, null resolver returns graceful error, no other tool carries a `phone`-named param).

---

### MOB-02 — MEDIUM — ContentCreator `emit()` missing `nonEmpty()` guard

- **Severity**: MEDIUM
- **File**: `apps/mobile/src/components/spokesperson/ContentCreator.tsx:154-162`
- **ADR**: ADR-0134 (Mobile Telemetry Contract), L-0083 (actor_id "anonymous" corruption)
- **Issue**: `emit()` call passes `workspace_id: workspaceId` and `actor_id: profileId` directly from `getProfileContext()` return value without wrapping in `nonEmpty()`. All other emit sites in mobile (e.g. `ChecklistView.tsx:68-69`, `use-botsson-voice-session.ts`, `push.ts`) consistently use `nonEmpty(x, "field")` to enforce fail-fast on empty strings. `getProfileContext()` does guard against empty strings at the source (explicit `.trim() === ""` check + `nonEmpty()` wrap on the returned struct), so the values arriving at `ContentCreator` are technically `NonEmptyString` typed — but the emit call site drops the type-level guarantee by not re-applying `nonEmpty()`. This is a defence-in-depth gap, not a live bug, but inconsistent with the codebase-wide pattern.
- **Remediation**: Import `nonEmpty` from `@smartout/telemetry` and wrap: `workspace_id: nonEmpty(workspaceId, "workspace_id"), actor_id: nonEmpty(profileId, "actor_id")`. One-line fix.

---

### MOB-03 — LOW — ContentCreator direct `websites` schema write without BFF (acknowledged stub)

- **Severity**: LOW (acknowledged in code, pending ADR)
- **File**: `apps/mobile/src/components/spokesperson/ContentCreator.tsx:147-151`
- **ADR**: ADR-0132 (Mobile Thin Client — all mutations via BFF)
- **Issue**: `ContentCreator.handleSubmit` writes directly to `websites.website_spokesperson` via `supabase.schema("websites").from("website_spokesperson").update(...)`. The file header explicitly documents this as a placeholder stub: "NOTE: The direct websites schema write is a placeholder stub pending a full content-submission BFF route (Phase B). A BFF route for spokesperson content does not yet exist; creating one requires an ADR."
- **Assessment**: The comment is accurate and the write is RLS-protected. This is a known temporary deviation with a clear remediation path. Flagged LOW because it is a documented intentional deviation, not a silent violation.
- **Remediation**: When Phase B BFF route is built, route through `web-api.ts` like all other mutations. Requires a new ADR before the route is created.

---

### MOB-INFO-01 — INFO — Ultravox legacy ref in botsson-provider (dead branch)

- **Severity**: INFO
- **File**: `apps/mobile/src/providers/botsson-provider.tsx:257,468`
- **ADR**: ADR-0135 (LiveKit for mobile voice, not Ultravox)
- **Issue**: `voiceSessionRef` holds a legacy `VoiceSession` handle (described as "Ultravox path — keep for the web bundle") that is only activated if `mode === "voice"` and `voice.isConnected === false`. In practice the C1.b `useBotssonVoiceSession` hook owns all mobile voice and the `voiceSessionRef` path is a dead else-branch.
- **Assessment**: Not a functional problem — the live voice path is LiveKit throughout. The dead code creates minor confusion and misdirection when reading the provider. ADR-0135 compliance is satisfied.
- **Remediation**: Remove the legacy `voiceSessionRef` block in a housekeeping sortie. No urgency.

---

## Per-ADR Rollup

| ADR | Topic | Status | Notes |
|---|---|---|---|
| ADR-0078 | Channel PII guard | PASS | No PII on voice data channel. `botsson-tools.ts` comment references ADR-0078 at critical guard site. |
| ADR-0127–0131 | Mobile platform ADRs | NOT ASSESSED | No mobile-platform-specific ADRs with those IDs found active in scope; may be reserved slots. |
| ADR-0132 | Thin client — AI via BFF | PASS (with LOW exception) | All AI traffic routed through `/api/emma/chat` + `/api/emma/voice/transcript`. `web-api.ts` documents the BFF hop explicitly. Single LOW deviation: ContentCreator placeholder direct write (documented stub). |
| ADR-0133 | Surface boundary (web composes, mobile executes) | PASS | `ContentCreator` is correctly scoped as Execute/Witness (D6 task execution). Spokesperson approval = Accept verb, in scope. No authoring UIs (drag-drop schedule, onboarding wizard, governance config) mounted in mobile app routes. |
| ADR-0134 | Mobile Telemetry Contract | PASS (with MEDIUM gap) | `getProfileContext()` used universally. `profile-context.ts` enforces fail-fast with explicit `nonEmpty()` wrap on returned struct. `ContentCreator` drops the `nonEmpty()` guard at the emit call site (MOB-02). All other emit sites in scope use `nonEmpty()`. |
| ADR-0135 | LiveKit for mobile voice | PASS | `use-botsson-voice-session.ts` uses `livekit-client`. Dead Ultravox legacy ref in `botsson-provider.tsx` is an inert else-branch (INFO-01). |
| ADR-0136 | Camera evidence (mobile-native) | PASS | `ContentCreator` uses `expo-image-picker` for photo capture on D6 spokesperson tasks. |
| ADR-0158 | (Reserved slot) | N/A | No findings. |
| ADR-0238 | Dual-surface AI ownership | PASS | No web `BotssonShell` mounted in mobile; `BotssonSheet` is mobile-native. No `DomainChatOwnership` collision pattern found. |
| ADR-0378 R7 | PII on tool wire | PASS | MOB-01 closed. `leader_phone` absent from `mobile_call_leader` wire definition. PII test 5/5. |

---

## Verified Intentional Deviations

| Code | Location | Why intentional |
|---|---|---|
| Direct `websites` schema write | `ContentCreator.tsx:147-151` | Documented placeholder stub in file header; no BFF route exists yet; RLS-protected; ADR required before Phase B |
| Legacy Ultravox `voiceSessionRef` | `botsson-provider.tsx:257,468` | Dead else-branch kept for web-bundle backwards compat; functional path is LiveKit throughout |

---

## In-Progress / Follow-up

- **MOB-02** (ContentCreator `nonEmpty` gap): low-effort fix, can be included in next housekeeping commit on campaign/ui-shell.
- **MOB-03** (Phase B BFF for spokesperson content): requires ADR + dedicated sortie.
- **INFO-01** (Ultravox dead code): housekeeping sortie, no urgency.
