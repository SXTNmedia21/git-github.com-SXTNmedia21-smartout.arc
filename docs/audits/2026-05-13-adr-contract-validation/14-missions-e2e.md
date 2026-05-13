---
title: "Audit Slice 14 — Missions / E2E Triple Coverage"
status: done
created: 2026-05-13
updated: 2026-05-13
module: missions-e2e
tags: [audit, missions, e2e, protocols, coverage]
---

# Audit Slice 14 — Missions / E2E Triple Coverage

**Baseline date:** 2026-05-10
**Audit date:** 2026-05-13
**Auditor:** Protocol Verification Engine (slice 14 of 14)
**Scope:** `packages/ai/src/missions/` + `apps/e2e/`

---

## Summary

The baseline findings F-ME-01 and F-ME-02 are largely superseded by a batch of capability harness specs shipped between 2026-05-11 and 2026-05-12. However, the **mission registry triple** (mission → journey doc → E2E spec) remains broken for 6 of 7 missions. F-ME-07 (mr-botsson dashboard orb voice) is confirmed open: no journey doc exists under the mission's own ID, no `e2e_test` frontmatter, and no Playwright spec targets the voice surface directly.

Key state as of 2026-05-13:

- 7 missions registered in `packages/ai/src/missions/registry.ts`
- 1 of 7 has a dedicated journey doc (lise-interview via a consolidation doc)
- 0 of 7 have an `e2e_test` frontmatter field pointing to a live spec
- 5 voice-plane-consolidation journeys all read `e2e_test: "deferred — see Phase F sortie 4"` — that sortie does not yet exist
- The capability harness matrix (`apps/e2e/coverage.md`) is at 100% capability coverage but tests the **Botsson BFF pipe**, not the **mission persona definitions** themselves
- P-001 (admin-onboarding protocol) remains `test.skip(true, ...)` — permanently blocked on missing `data-testid` attributes in the onboarding UI
- P-LOGIN is the only protocol in `PROTOCOL_REGISTRY` that is runnable without skipped gates; P-001 is the sole other entry

---

## Mission / Journey / E2E Triple Table

| Mission ID | Registered | Dedicated Journey Doc | `e2e_test` field | Live E2E Spec |
|---|---|---|---|---|
| `onboarding-interview` | yes | none | n/a | none |
| `landing-demo` | yes | none | n/a | none |
| `lise-interview` | yes | `JOURNEY-voice-plane-consolidation-lise-interview-livekit.md` (indirect) | `"deferred — see Phase F sortie 4"` | none |
| `mr-botsson` | yes | none | n/a | none |
| `haccp-inspector` | yes | none | n/a | none |
| `shift-assistant` | yes | none | n/a | none |
| `botsson-session` | yes | none | n/a | none |

Notes:
- `JOURNEY-onboarding-mission.md` exists but describes the orchestration flow (wizard + Lise voice), not the `onboarding-interview` mission definition itself. It has no `e2e_test` field.
- The capability harness `mission-harness-e2e.spec.ts` tests `get_active_missions` and `get_workspace_roadmap` tool routing through the BFF — this is capability pipe coverage, not mission persona coverage.
- `journey-mission-resolution.spec.ts` tests `engine_missions` DB artefact integrity (L-0125 closure) — again not persona coverage.
- No spec file in `apps/e2e/` references any of the 7 mission IDs (`onboarding-interview`, `landing-demo`, `lise-interview`, `mr-botsson`, `haccp-inspector`, `shift-assistant`, `botsson-session`) directly.

---

## Orphan Specs

Specs that exist in `apps/e2e/` with no clear link back to a registered mission or dedicated journey doc:

| Spec | Likely purpose | Journey doc exists? | Linked to mission? |
|---|---|---|---|
| `tests/harness-candidate-0-crown.spec.ts` | unknown / exploratory | no | no |
| `komm-nyheter/journey-{1-4}.spec.ts` (standalone directory) | komm-nyheter module | `JOURNEY-nyheter-engagement-wave-a-*.md` set | no mission |
| `governance-training-mvp/engine-dispatch.spec.ts` | governance training | partial | no mission |
| `governance-training-mvp/observer-request.spec.ts` | governance training | partial | no mission |
| `payroll-phase-5/reveal.spec.ts` | payroll PII reveal | `JOURNEY-payroll-phase-5-*.md` set | no mission |

These are not critical orphans — they have functional purpose — but none register an `e2e_test` backlink in a journey doc.

The more structurally concerning orphan is `tests/protocol.spec.ts` + `tests/protocol-login.spec.ts`: these are the Protocol Verification Engine's own test files. P-001 is permanently skipped; P-LOGIN is runnable. Neither protocol registers a journey doc via frontmatter.

---

## Orphan Journeys

Journey docs with `e2e_test: null` or `e2e_test: "deferred — see Phase F sortie 4"` where the Phase F sortie does not exist:

| Journey Doc | `e2e_test` value | Phase F sortie exists? |
|---|---|---|
| `JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md` | `"deferred — see Phase F sortie 4"` | no |
| `JOURNEY-voice-plane-consolidation-krisp-nc-kitchen-noise.md` | `"deferred — see Phase F sortie 4"` | no |
| `JOURNEY-voice-plane-consolidation-lise-interview-livekit.md` | `"deferred — see Phase F sortie 4"` | no |
| `JOURNEY-voice-plane-consolidation-pii-guard-uniform-web-mobile.md` | `"deferred — see Phase F sortie 4"` | no |
| `JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit.md` | `"deferred — see Phase F sortie 4"` | no |
| `JOURNEY-botsson-fase-4-proposal-pipeline-voice-propose-shift.md` | `null` | n/a |
| `JOURNEY-botsson-fase-4-proposal-pipeline-accept-creates-shift.md` | `null` | n/a |
| `JOURNEY-botsson-fase-4-proposal-pipeline-auth-recorder-pipe.md` | `null` | n/a |
| `JOURNEY-botsson-fase-4-proposal-pipeline-cross-workspace-auth-boundary.md` | `null` | n/a |
| `JOURNEY-botsson-fase-4-proposal-pipeline-reject-emits-trail.md` | `null` | n/a |

The five "deferred — Phase F sortie 4" journeys are a debt cluster. Phase F sortie 4 is not open in the worktree list; no plan doc references it; no branch `feat/*-phase-f-sortie-4` exists. The deferral pointer is a dangling reference.

---

## Findings Table

| ID | Severity | Finding | Status vs Baseline |
|---|---|---|---|
| F-ME-01 | HIGH | Zero E2E coverage for any of the 7 registered mission persona definitions (onboarding-interview, landing-demo, lise-interview, mr-botsson, haccp-inspector, shift-assistant, botsson-session). The capability harness covers the BFF pipe; it does not validate that the mission's persona, voice config, system prompt, or tool wiring are exercised end-to-end. | OPEN — unchanged from 2026-05-10. |
| F-ME-02 | MEDIUM | 5 voice-plane-consolidation journey docs reference a "Phase F sortie 4" that does not exist. The `e2e_test` deferral pointer is dangling. | OPEN — Phase F sortie 4 was not created between baseline and today. |
| F-ME-03 (new) | MEDIUM | `e2e_test` frontmatter field is absent from the `JOURNEY-onboarding-mission.md` doc and from all 7 mission-adjacent journey docs. No cross-reference mechanism exists from a journey doc to the one spec that exercises it. | NEW FINDING — field adoption is sparse: only ~12 of ~250 journey docs contain `e2e_test`. |
| F-ME-04 (new) | LOW | Protocol registry (`apps/e2e/protocols/index.ts`) contains only one entry (P-001). P-LOGIN is embedded directly in its spec file, not registered. No mechanism enforces "every journey declared in `docs/journeys/` has a protocol entry". | NEW FINDING |
| F-ME-05 (new) | LOW | P-001 (admin-onboarding protocol) remains `test.skip(true)` since authoring. Missing `data-testid` attributes are reported in the skip message but no Linear issue or DASHBOARD entry tracks the work. The block has no assigned owner or deadline. | NEW FINDING — P-001 has never run. |
| F-ME-06 (new) | LOW | `apps/e2e/coverage.md` (`updated: 2026-05-11`) declares "100% capability coverage achieved" but this refers to BFF capability pipe, not mission persona surface. The two coverage dimensions are conflated. | NEW FINDING |
| F-ME-07 | HIGH | `mr-botsson` (dashboard orb voice) has no journey doc, no `e2e_test` field, and no Playwright spec. It is the primary in-product voice surface (per registry: `firstSpeaker: "user"`, `maxDurationSeconds: 1800`, Jarvis-mode butler). | OPEN — confirmed unchanged. |

---

## Counts and Top 3 Critical

**Totals:** 7 missions | 1 partial journey doc link | 0 live E2E specs covering missions | 5 dangling voice deferral pointers | 1 permanently-skipped protocol | 7 findings (2 from baseline open, 5 new)

**Top 3 critical:**

1. F-ME-01 / F-ME-07 (combined): The entire `packages/ai/src/missions/` registry — 7 personas including the primary in-product voice surface (`mr-botsson`) and the onboarding interview (`onboarding-interview`) — has zero end-to-end test coverage. A breaking change to system prompt, voice config, or tool wiring would not be caught by CI.

2. F-ME-02: Five voice-plane-consolidation journey docs point to a "Phase F sortie 4" that does not exist and has no plan, branch, or Linear ticket. These journeys describe the LiveKit voice consolidation path (krisp NC, lise-interview, PII guard, wizard via LiveKit) — all high-risk surfaces with zero automated coverage and a broken deferral pointer.

3. F-ME-05: P-001 (admin onboarding protocol) has never executed. The Protocol Verification Engine infrastructure is in place and functional (P-LOGIN runs), but the only substantive protocol is permanently skipped on missing `data-testid` attributes with no tracking issue. The protocol engine produces zero verified protocol outputs.
