---
title: Slice 09 — ADR Coverage Gaps Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, adr-coverage-gaps, adr]
---

# Slice 09: ADR Coverage Gaps

## Scope

Gap-fill audit for `docs/decisions/`. Covers ADR file integrity, sequence gaps, superseded-ref drift, new ADRs since baseline (0372–0378), and the specifically-requested ADR-0378 parity check.

---

## ADR Landscape (current tip)

| Metric | Count |
|--------|-------|
| ADR files on disk (excluding 0000 index + template + archive/) | 368 |
| Unique ADR IDs in decision log | 368 |
| Highest ADR number | 0378 |
| New since 2026-05-18 baseline | 7 (0372–0378) |
| Undocumented sequence gaps | 1 (0322 — same as baseline) |

ADR-0368 was "reserved" in the 2026-05-18 baseline. It is now filled (Mobile Auth Universal-Link Bridge, accepted 2026-05-18). No new reserved-slot violations introduced.

---

## Known Sequence Gaps

| Slot | Disposition |
|------|-------------|
| 0092 | Reserved — "Monitor Mode Graduation Criteria (Phase E / WP6)", not yet written |
| 0159 | Reserved — slot skipped during 2026-04-19 kanaler-som-helpdesk mid-session renumber |
| 0232 | Renumbered to ADR-0236 at close-feature (cross-branch collision) |
| 0322 | **Undocumented** — no file, no log entry, no cross-reference, no reserved note |
| 0368 | **Filled** — Mobile Auth Universal-Link Bridge (was reserved in baseline) |

**F-09-01 (LOW — carried from baseline):** ADR-0322 remains undocumented with no file, no decision-log entry, no cross-reference. No change since 2026-05-18. Add a "reserved/renumbered — do not reuse" row to the decision log.

---

## New ADR Review (0372–0378)

All seven new ADRs have files on disk and decision-log entries.

| ADR | Status | File | Log | Notes |
|-----|--------|------|-----|-------|
| 0372 | proposed | ✅ | ✅ | Bursdag auto-publish pipe |
| 0373 | proposed | ✅ | ✅ | Profile visibility consent matrix; blocked on bursdag dependency |
| 0374 | accepted | ✅ | ✅ | Portal auth redirect |
| 0375 | accepted | ✅ | ✅ | Root-domain assert hard-fail |
| 0376 | proposed | ✅ | ✅ | Page-polish documented intentional skips — codifies SKILL.md, no code gate |
| 0377 | proposed | ✅ | ✅ | Telemetry emit coverage — enforcement script **not yet shipped** (see F-09-03) |
| 0378 | proposed | ✅ | ✅ | LiveKit data-channel protocol — code already live, ADR retroactive (see below) |

---

## ADR-0378 Parity Verification

ADR-0378 codifies the four-topic LiveKit data-channel protocol that `mobile-voice-runtime-wire` P3+P4 shipped. Verified:

**Registration:** Decision log has a full-text entry dated 2026-05-20 with status `proposed`. ✅

**Code parity — producers and consumers:**

| Component | File | Topics present |
|-----------|------|----------------|
| Mobile producer | `apps/mobile/src/lib/livekit-data-publish.ts` | `botsson-context` (line 115), `botsson-tools-register` (line 166), `botsson-tool-result` (line 209) ✅ |
| Mobile consumer | `apps/mobile/src/hooks/use-botsson-voice-session.ts` | `botsson-tool-call` guard at line 761 ✅ |
| Voice-agent consumer | `services/voice-agent/src/context.ts` | `botsson-context` guard at line 179 ✅ |
| Voice-agent producer | `services/voice-agent/src/client-tool-rpc.ts` | `botsson-tool-call` topic at line 46 ✅ |
| Web producer/consumer | `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx` | All four topics at lines 126, 207, 372, 382, 527 ✅ |

**Duplicate type sources (known ADR debt):** `BotssonContextInitPayload` in mobile and `ContextInitMessage` in voice-agent are maintained independently. ADR-0378 §Bad acknowledges this; follow-up to hoist into `@smartout/types/livekit-protocol.ts` is logged but not blocking. No shared module found in `packages/types/src/`. This is intentional debt, not a violation.

**Test obligations from ADR-0378:**

| Obligation | Status |
|-----------|--------|
| Topic guard on voice-agent side (`context.test.ts`) | ✅ Present at lines 122–124 |
| Topic guard on mobile side (`use-botsson-voice-session` DataReceived) | ⚠️ Guard exists in code (line 761) but no unit test covers it (F-09-04) |
| Envelope round-trip test (voice-agent `context.test.ts`) | ✅ Present |
| 10s timeout unit test (voice-agent `client-tool-rpc.test.ts:145`) | ✅ Present |
| 10s timeout **integration** test | ⚠️ ADR notes unit-only; integration test not found (F-09-05, LOW) |

---

## Superseded ADR Drift Check

**F-09-02 (MEDIUM — carried from baseline):** ADR-0321 (`status: superseded`) has 4 references in `supabase/migrations/20260620110200_shift_lifecycle_pipeline_v2.sql` at lines 41, 105, 188, 454. **Update from baseline:** all four are comment-only references (`-- ADR-0321 §V2 Schema Sketch (blueprint-only)`). No live code logic depends on the superseded ADR. The references explicitly note "instance superseded" and treat ADR-0321 as a blueprint ancestor. Risk assessment: comment-only, docs-equivalent. Still MEDIUM because the references cross the doc/code boundary, but no functional violation.

---

## ADR-0377 Enforcement Gap

**F-09-03 (MEDIUM):** ADR-0377 mandates `scripts/check-telemetry-emit-coverage.ts` as a pre-commit + CI gate. The script does **not exist** in `scripts/` and is not referenced in `.husky/pre-commit` or any `.github/` workflow. The ADR has `status: proposed`, but the code it describes was already shipped (telemetry emit wiring is live). The enforcement gap means new registry entries can be added without emit wiring — exactly the failure class ADR-0377 was created to prevent. File: `scripts/` (file missing).

---

## Summary

| Finding | Severity | ADR | Evidence |
|---------|----------|-----|----------|
| F-09-01: ADR-0322 undocumented gap | LOW | — | No file, no log entry, no reserved note in decision log |
| F-09-02: ADR-0321 superseded with 4 live migration comments | MEDIUM | 0321 | `supabase/migrations/20260620110200_shift_lifecycle_pipeline_v2.sql:41,105,188,454` — comment-only; not logic |
| F-09-03: ADR-0377 enforcement script missing | MEDIUM | 0377 | `scripts/check-telemetry-emit-coverage.ts` not found; pre-commit and CI not wired |
| F-09-04: ADR-0378 mobile topic-guard unit test absent | LOW | 0378 | `apps/mobile/src/hooks/__tests__/use-botsson-voice-session.test.ts` has no DataReceived topic guard test |
| F-09-05: ADR-0378 10s timeout integration test absent | LOW | 0378 | Unit test exists; integration-level obligation in ADR not yet met |

No CRITICAL or HIGH findings. The ADR registry is well-maintained: all 7 new ADRs (0372–0378) have files and log entries, ADR-0378 is fully registered with correct code parity on all four producers/consumers, and the one previously-reserved slot (0368) is now filled.

---

## Per-ADR Rollup

| ADR | Verdict | Note |
|-----|---------|------|
| 0321 | ⚠️ partial | Superseded; 4 comment-only refs in migration file |
| 0372–0375 | ✅ compliant | Files, log entries, code |
| 0376 | ✅ compliant | Codifies SKILL.md carve-out; no code gate required |
| 0377 | ⚠️ partial | ADR accepted content correct; enforcement script not shipped |
| 0378 | ⚠️ partial | All code parity verified; two minor test obligations outstanding (mobile topic-guard unit test + timeout integration test) |

---

## Verified Intentional

- **FP-001** through **FP-005** from known-false-positives.md: not in scope for this slice, not re-flagged.
- ADR-0378 dual type sources (`BotssonContextInitPayload` + `ContextInitMessage`): explicitly documented as "Bad, because" known debt in ADR-0378 §Outcome. Not a finding — intentional follow-up.
- ADR-0368 slot filled (was "reserved" in baseline): no gap remaining, correct.

---

## In-progress (mid-campaign)

No campaign-branch files were encountered in this slice (`docs/decisions/` is the sole surface). All findings are against the development tip.
