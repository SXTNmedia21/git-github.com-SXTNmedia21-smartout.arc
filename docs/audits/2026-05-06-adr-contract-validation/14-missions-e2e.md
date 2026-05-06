---
title: "Slice 14 — Missions + E2E Protocol Audit"
status: done
updated: 2026-05-06
created: 2026-05-06
module: e2e
tags: [audit, missions, e2e, playwright, protocol-verification-engine]
---

# Slice 14: Missions × E2E Protocol Audit

**Scope:** `packages/ai/src/missions/` + `apps/e2e/` (all Playwright specs)
**Baseline claim (2026-05-02):** Only one Protocol (P-001), permanently skipped on missing data-testids. Pipeline produces zero generated artifacts.
**Verdict:** Baseline is PARTIALLY ACCURATE — updated below.

---

## Summary Numbers

| Metric | Count |
|---|---|
| Total `.spec.ts` files | 151 |
| Files inside `apps/e2e/tests/` | 141 |
| Files outside `tests/` (legacy dirs) | 10 |
| Files with at least one `test.skip` or `test.fixme` | 49 |
| Total `test.skip` / `test.fixme` occurrences | 183 |
| Protocol definitions (`P-XXX.ts`) | 2 (P-001 + P-LOGIN embedded) |
| Missions in registry | 6 |
| Missions with a Protocol spec counterpart | 0 |
| Generated GUIDE artifacts | 2 (GUIDE-P-001, GUIDE-P-LOGIN) |
| Generated MISSION-DRAFT artifacts | 1 (MISSION-DRAFT-P-001.json only) |
| Generated AUDIT artifacts | 3 (AUDIT-P-001-2026-04-13, AUDIT-P-LOGIN × 2) |
| Playwright projects wired in CI | 0 (no E2E job in ci.yml) |

---

## Missions × E2E Coverage Table

| Mission ID | Registry | engine_missions seed | Protocol spec | Dedicated E2E spec | Coverage |
|---|---|---|---|---|---|
| `onboarding-interview` | Yes | Yes (20260314300000) | None | Partial — `journey-full-wizard-flow.spec.ts` exercises onboarding UI | LOW |
| `landing-demo` | Yes | No dedicated migration | None | `landing.spec.ts` (smoke only, no mission invocation) | NONE |
| `mr-botsson` | Yes | Yes (20260301200100) | None | None for mission behavior | NONE |
| `haccp-inspector` | Yes | Yes (20260319120300) | None | None | NONE |
| `shift-assistant` | Yes | Yes (20260406110001) | None | None | NONE |
| `botsson-session` | Yes | Yes (20260311023524) | None | None | NONE |
| `season-lifecycle` | Constant only (no registry entry) | Yes (20260319120400) | None | `season-activation.spec.ts`, `season-planning.spec.ts` | LOW |

---

## Protocol Verification Engine Status

### P-001 (Admin Onboarding)
- **Status:** PERMANENTLY SKIPPED — `test.skip(true, ...)` at describe level.
- **Reason (verbatim):** References `data-testid` attributes (`onboarding-hero`, `onboarding-manual-mode`, `onboarding-step-business`, etc.) that do not exist on the onboarding page.
- **Protocol file:** `apps/e2e/protocols/P-001-admin-onboarding.ts` (1 definition file, alongside `schema.ts`, `types.ts`, `index.ts`).
- **Generated artifacts:** GUIDE-P-001.md and MISSION-DRAFT-P-001.json exist on disk but were generated from a partial/failed run (2026-04-13). GUIDE shows `Status: failed — Gate timed out before first check` on Step 3. MISSION-DRAFT has `[HUMAN REVIEW REQUIRED]` markers and `is_active: false`.

### P-LOGIN (Login Journey)
- **Status:** ACTIVE — no `test.skip`. The protocol lives inline in `apps/e2e/tests/protocol-login.spec.ts` rather than as a separate `protocols/P-LOGIN.ts` file.
- **Generated artifacts:** GUIDE-P-LOGIN.md (2026-04-14 run — shows all 4 steps with screenshots, clean completion). AUDIT-P-LOGIN-2026-04-13.md + AUDIT-P-LOGIN-2026-04-14.md. No MISSION-DRAFT for P-LOGIN.
- **Gap:** P-LOGIN generates docs and audit but skips the `generateMissionFromIR` call — intentional omission for a login flow, but inconsistent with the generator pipeline contract.

---

## Skip Pattern Categories

| Reason category | Occurrences |
|---|---|
| "Anna Olsen not found in seed" (fixture gap) | 19 |
| "Web dev server not running" (infra) | 8 |
| "M7: deploy first" / "M7: admin app not deployed to CI yet" | 9 |
| "M8: needs deployed env + accountant seed" | 5 |
| "No template" / "beforeAll did not seed a version" | 10 |
| DB schema gaps (`contract_amendment`, missing tables) | 4 |
| Seasonal/conditional env guards (`WATCHDOG_CRON_SECRET` not set) | ~3 |
| Misc test implementation gaps | ~125 |

The largest single category (19 occurrences) is the "Anna Olsen not found in seed" fixture gap — a single missing seed profile that cascades across all contract and governance specs.

---

## Playwright Project Configuration

Four projects defined in `playwright.config.ts`:
- `landing` — matches `landing.spec.ts` only
- `web` — all specs except `landing.spec.ts`
- `mobile` — `tests/mobile/*.spec.ts`
- `mobile-pwa` — `tests/mobile-pwa/*.spec.ts`

**CI wiring: ZERO.** `ci.yml` (315 lines) has no Playwright job. E2E specs exist entirely outside the CI gate — all 151 specs run only when a developer runs them locally. Playwright is not a required check for merge to `development`, `preview`, or `main`.

---

## Legacy Spec Dirs (Outside `tests/`)

10 spec files live in `apps/e2e/admin/`, `apps/e2e/contract-employee/`, and `apps/e2e/governance-training-mvp/`. All are fully skipped:
- `admin/*.spec.ts` — M7-gated (admin.smartout.ai not deployed)
- `contract-employee/*.spec.ts` — 5 files, all skipped on missing fixtures
- `governance-training-mvp/*.spec.ts` — 2 files, status unknown but not in `tests/` tree

These are picked up by `testDir: "."` + `testMatch: /\.(spec|test)\.ts$/` in the Playwright config — they run locally but are structurally orphaned from CI.

---

## Findings

### CRIT-14-01: Protocol Verification Engine produces zero CI signal — HIGH

**What:** The Protocol Verification Engine (`runners/`, `generators/`, `protocols/`) is complete infrastructure that produces zero output in normal operation. P-001 is permanently skipped; P-LOGIN runs locally only. Neither is in CI. The `MISSION-DRAFT-P-001.json` on disk was generated from a failed run 23 days ago and has `is_active: false` with `[HUMAN REVIEW REQUIRED]` on every stage.

**Impact:** The stated purpose of the engine — generating mission drafts and UX audits from protocol runs — has not produced any production-useful artifact since 2026-04-14 (P-LOGIN) and never for P-001. The generated artifacts in `docs/guides/` and `docs/missions/` are stale placeholders, not verified outputs.

**Root cause (P-001):** Missing `data-testid` attributes on onboarding components. The testids are documented in the skip message but no ticket or report has been filed to route the fix to the frontend-designer.

**Root cause (CI gap):** No Playwright job was ever added to `ci.yml`. The engine was built with the expectation of being wired later, but the wiring never happened.

### HIGH-14-02: 6 missions have zero E2E coverage of mission behavior

**What:** The mission registry (`packages/ai/src/missions/registry.ts`) defines 6 missions: `onboarding-interview`, `landing-demo`, `mr-botsson`, `haccp-inspector`, `shift-assistant`, `botsson-session`. None has a spec that verifies the mission is reachable, invokable, or produces correct `engine_state` rows. The closest thing is `journey-mission-resolution.spec.ts`, which tests the resolution layer with synthetic fixtures — not the actual mission content.

**Impact:** If a mission's `id` drifts from what `engine_missions` seeds (e.g., `mr-botsson` vs `mr_botsson`), the drift is invisible until a production failure.

### HIGH-14-03: Playwright has zero CI gate — any spec regression is invisible

**What:** 151 Playwright spec files, 183 skip occurrences, and 0 CI jobs. The only enforced test layer is Vitest (unit/integration) via `pnpm turbo run test`. E2E failures can merge to `main` silently.

**Impact:** Confidence in behavioral correctness of UI flows (onboarding, contracts, daily-operation, helpdesk) is entirely based on manual testing. The 49 files with skips means the majority of skipped tests represent known gaps that no system currently tracks.

### MEDIUM-14-04: P-LOGIN missing MISSION-DRAFT output

**What:** `protocol-login.spec.ts` calls `generateDocsFromIR` and `generateAuditFromIR` but does NOT call `generateMissionFromIR`. This is an inconsistent omission from the generator pipeline contract (all three generators are invoked in `protocol.spec.ts`).

**Impact:** The login journey has no mission draft, which means the journey-engine has no AI-guided complement for the login step — a gap if login-guidance is ever needed (e.g., first-time employee login on mobile).

### LOW-14-05: Legacy spec dirs orphaned from project structure

**What:** 10 specs in `admin/`, `contract-employee/`, and `governance-training-mvp/` live outside `tests/`. They are picked up by Playwright but structurally invisible to CI filtering patterns that use path-based matching (e.g., `tests/mobile/*.spec.ts`).

**Impact:** Low immediate risk since all are currently skipped, but future CI wiring that uses `tests/` as the test root will silently exclude these files.

---

## Delta vs 2026-05-02 Baseline

| Claim | Verified? |
|---|---|
| "Only one Protocol (P-001)" | PARTIAL — P-LOGIN is a second protocol, embedded inline in its spec file (not in `protocols/`) |
| "Permanently skipped" (P-001) | CONFIRMED |
| "Missing data-testid attributes" as root cause | CONFIRMED |
| "Pipeline produces zero generated artifacts" | PARTIAL — P-LOGIN DID generate GUIDE and AUDIT in April. P-001 generated stale artifacts from a failed run. No new artifacts since 2026-04-14. |
| Spec count | EXPANDED — 151 total specs (141 in `tests/`, 10 legacy) |
| CI wiring | CONFIRMED: zero Playwright job in ci.yml |

**Net delta:** The baseline was accurate on P-001. It missed P-LOGIN as a second active protocol and underestimated the scale of the skip problem (183 occurrences across 49 files, not just the 1 in protocol.spec.ts).

---

## Missing TestIDs — Required Actions

```
MISSING TESTIDS:
- [data-testid="onboarding-hero"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
- [data-testid="onboarding-manual-mode"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
- [data-testid="onboarding-step-business"] needed in apps/web/src/app/onboarding/ (P-001 Step 3)
- Additional testids referenced in P-001 protocol definition (see apps/e2e/protocols/P-001-admin-onboarding.ts)
```

These must be routed to `frontend-designer` — this agent does not write `apps/web/src/`.

---

*Slice 14 of 14. Scope: missions-e2e. Auditor: protocol-verification-engine agent.*
