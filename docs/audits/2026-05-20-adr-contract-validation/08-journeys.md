---
title: "Audit Slice 08 — Journeys"
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, journeys, adr-0031, adr-0038, mobile-voice]
---

# Slice 08: Journeys — ADR-0031 + ADR-0038 Compliance

**Surface audited:** `docs/journeys/`, `packages/ai/src/journey/`, `packages/ai/src/missions/`, `apps/e2e/`
**ADRs:** ADR-0031 (Journey Portal System), ADR-0038 (Journey Agent & Output Generators)
**Focus:** 7 new mobile-voice journey docs (PR #430 + predecessor bootstrap-pipe sortie)
**Total corpus:** 494 JOURNEY-*.md files

---

## Summary

Top findings by severity:

1. **MEDIUM F1** — `mobile.ai_prefs.changed` telemetry documented in AIPrefsSection.tsx header comment but `emit()` call-site lives in `use-ai-prefs.ts` — docstring-to-callsite indirection acceptable but creates fragile cross-file contract (L-0176 family).
2. **MEDIUM F2** — ux-polish journey `status: verified-with-deferred-gaps` is a non-standard status value not in ADR-0031's 13-status lifecycle. Deferred gaps are documented correctly in `deferred:` frontmatter key, but the status string itself is not a recognised lifecycle state.
3. **LOW F3** — 4 pre-existing journey docs missing `module:` frontmatter field (JOURNEY-task-capability-unify, JOURNEY-sortie-5a-voice-task-infra, JOURNEY-hard-delete-operations-complete, JOURNEY-mobile-kalender-task-wire). Pre-existing drift, not introduced by today's PR.
4. **LOW F4** — 2 pre-existing journey docs carry non-standard `status: ready-for-merge` / `status: ready_for_merge` values outside the ADR-0031 13-state lifecycle.
5. **INFO F5** — 7 new mobile-voice journey docs have no E2E Playwright spec pointers. This is correct: voice-session journeys cannot be exercised end-to-end in PWA Playwright (LiveKit data channel + RTC not testable via browser automation). No E2E gap — code-level verification via docker-log + telemetry is the acceptance vehicle (documented in `verified_by: P7 steward gate`).

---

## Findings table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| F1 | MEDIUM | `apps/mobile/src/components/settings/AIPrefsSection.tsx:11` | ADR-0038 | Header comment claims `emit()` per ADR-0134 but no emit() call in file body; call-site in use-ai-prefs.ts:72 — works but violates co-location principle |
| F2 | MEDIUM | `docs/journeys/JOURNEY-mobile-voice-runtime-wire-ux-polish.md:4` | ADR-0031 | `status: verified-with-deferred-gaps` is not in ADR-0031's 13-status lifecycle (valid = `idea…broken`); deferred gaps properly documented but status string unrecognised |
| F3 | LOW | `docs/journeys/JOURNEY-task-capability-unify.md`, `JOURNEY-sortie-5a-voice-task-infra.md`, `JOURNEY-hard-delete-operations-complete.md`, `JOURNEY-mobile-kalender-task-wire.md` | ADR-0031 | Missing `module:` frontmatter field — required per CLAUDE.md + ADR-0031 schema; pre-existing, not introduced today |
| F4 | LOW | `docs/journeys/JOURNEY-cascade-gate-write.md:3`, `JOURNEY-agent-harness.md:8` | ADR-0031 | `status: ready-for-merge` / `ready_for_merge` not in 13-state lifecycle; pre-existing drift |
| F5 | INFO | All 7 `JOURNEY-mobile-voice-*.md` | ADR-0038 | No E2E Playwright spec pointers; intentional — LiveKit RTC not testable via PWA Playwright; verified_by P7 steward gate noted in frontmatter |

---

## Per-ADR rollup

### ADR-0031 — Journey Portal System

| File cluster | Verdict | Notes |
|---|---|---|
| 7 new `JOURNEY-mobile-voice-*.md` | ✅ compliant | All required frontmatter present; 3+4 journeys within 1–5 per feature; ADR cross-refs present |
| `JOURNEY-mobile-voice-runtime-wire-ux-polish.md` | ⚠️ partial | `status: verified-with-deferred-gaps` non-standard; deferred gaps documented |
| 4 pre-existing missing-module docs | ⚠️ partial | Missing `module:` field; pre-existing drift, not new |
| 2 pre-existing ready-for-merge docs | ⚠️ partial | Non-standard status values; pre-existing drift |
| Remaining 481 corpus | ✅ compliant | Status distribution healthy: 304 verified, 134 done, 33 draft, 11 in_progress, 5 accepted, 2 deferred |

**ADR-0031 summary:** 2 violation classes (F2, F3/F4) — all pre-existing or near-boundary. 0 new violations introduced today.

### ADR-0038 — Journey Agent & Output Generators

| Check | Verdict | Notes |
|---|---|---|
| Happy path documented (all 7) | ✅ | Numbered step sequences present in all 7 |
| Postcondition documented (all 7) | ✅ | `**Postcondition:**` section present |
| Error paths documented (all 7) | ✅ | Error path tables or sections present in all 7 |
| Roles explicit (all 7) | ✅ | Actor (Employee, Mobile, Voice-agent) declared in preconditions |
| E2E coverage pointer | ✅ | No pointer required — PWA Playwright cannot exercise LiveKit RTC; correctly omitted with steward-gate note |
| `packages/ai/src/journey/compile.ts` | ✅ | Journey compiler present; no mobile-voice entries needed (not mission-driven capabilities) |
| `packages/ai/src/missions/` | ✅ | No mobile-voice entries expected or missing — voice is ADR-0132 BFF routing, not a mission |

**ADR-0038 summary:** All 7 new journeys structurally compliant. F1 (telemetry indirection) is borderline L-0176 — emit wired, just not co-located with the docstring claiming it.

---

## Code-parity verification (new journeys)

| Journey | Referenced file | Exists | Key signal verified |
|---|---|---|---|
| context-publish | `apps/mobile/src/hooks/use-botsson-voice-session.ts` | ✅ | `botsson-context` publish at line 595; `voice.bootstrap.snapshot_published` emit at line 1137 |
| tool-rpc | `apps/mobile/src/lib/botsson-tools.ts` | ✅ | `botsson-tools-register` publish line 1048; `botsson-tool-call` DataReceived handler line 745; `executeMobileTool` dispatch line 810 |
| text-chat | `apps/mobile/src/hooks/use-emma-chat.ts` | ✅ | `mobile.chat.message_sent` emit line 228; `mobile.chat.response_received` emit line 253; `mobile.chat.error` emit line 278 |
| ux-polish | `apps/mobile/src/components/ai/BotssonSheet.tsx` | ✅ | `MicPermissionDialog` import line 34; `NetworkRetryBanner` import line 35; `useReducedMotion` gating line 158 |
| ux-polish | `apps/mobile/src/hooks/stores/use-botsson-settings-store.ts` | ✅ | Canonical store at path; `ai-prefs.ts` is now type-only re-export shim (write functions removed — compliant) |
| bootstrap-pipe (all 3) | `apps/web/src/app/api/emma/voice/transcript/route.ts` | ✅ | Snapshot return path in place |
| bootstrap-pipe (tool-rpc) | `services/voice-agent/src/client-tool-rpc.ts` | ✅ | RPC protocol file exists |

---

## Verified intentional

| Item | Why not a finding |
|---|---|
| No E2E Playwright specs for mobile-voice journeys | LiveKit DataChannel + RTC not exercisable in PWA Playwright. Steward-gate acceptance via docker-log + telemetry is the documented verification vehicle for ADR-0297-class journeys. |
| `apps/mobile/src/lib/ai-prefs.ts` still exists | Now a type-only re-export shim per file header `"Do NOT add MMKV instantiation, getter functions, or setter functions here."` — ai-prefs write functions removed as ux-polish journey requires. Not a violation. |
| ux-polish `deferred:` frontmatter key for mid-session policy-flip | Gap is honestly documented. `use-voice-transcripts.ts:257-268` handles 403 by clearing session, but provider-level mode-flip is deferred to follow-up sortie. Degraded mode non-blocking. |
| `verified_by: P7 steward gate` without a pointer to a spec file | Steward-gate is a review artifact, not a test spec. Acceptable given LiveKit constraint. |

---

## In-progress (mid-campaign)

No mid-campaign findings for this slice. The 7 new mobile-voice journey docs are on `campaign/ui-shell` (current branch) — not in a separate active worktree. All reviewed against current development tip.

---

## Per-ADR final verdict

| ADR | Compliant | Partial | Violation |
|-----|-----------|---------|-----------|
| ADR-0031 | 487 files | 7 files (F2/F3/F4 — all pre-existing or near-boundary) | 0 |
| ADR-0038 | 7 new + existing | 0 | 0 |

**Slice result:** CRITICAL 0 / HIGH 0 / MEDIUM 2 / LOW 2 / INFO 1
