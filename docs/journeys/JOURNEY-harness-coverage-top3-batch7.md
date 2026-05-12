---
title: "Journey — harness-coverage-top3-batch7"
feature: harness-coverage-top3-batch7
branch: feat/harness-coverage-top3-batch7
created: 2026-05-12
updated: 2026-05-12
module: ai
status: verified
tags: [e2e, harness, coverage, availability, contract-intake, guardian]
---

# Journey — harness-coverage-top3-batch7

## Why

Seventh wave of Botsson harness E2E coverage. Closes 3 capability gaps: availability (3 tools), contract-intake (3 tools), guardian (3 tools). Total +9 tools, 58 new test() calls. Brings tool coverage from 58% → 65% (74 → 83 of 127).

## Journey 1 — Availability capability E2E

**Precondition:** Stage-engine fresh, seed admin profile, `engine_authority_config` rows for dotted capabilities (`availability.set_own`, `availability.clear_own`, `availability.query_others`).

1. BFF call per tool — 3 tools (`set_own_availability`, `clear_own_availability`, `query_others_availability`)
2. `set_own_availability` writes availability row with `preference_type` ∈ {`unavailable`, `preferred`, `not_preferred`}
3. `clear_own_availability` deletes row, polled via 10s/500ms recorder-flush pattern
4. `query_others_availability` is read-only, structured response only (no DB write — `availability.queried` routes to activity_trail per L-0023)
5. A5 has pre-seed guard: if A4-DB did not capture an availability id (LLM chose different preference_type than expected), test inserts an `unavailable` row directly so clear_own has a target — prevents cascade failure on LLM under-commit

**Postcondition:** All 3 availability tools verified. 21 tests.

**Error paths:** N1 voice path skipped (LiveKit not driveable in Playwright). N1 outer + inner both `test.skip` with documented gap `availability-voice-channel-e2e`. Capability `allowedChannels` enforces channel guard at L1 + inline `if (channel !== "chat")` in `execute()` (ADR-0202, L-0097).

## Journey 2 — Contract-intake capability E2E

**Precondition:** Same. Contract row with `status='intake'` to drive `get_intake_progress` + `submit_field_group` + `decline_intake`. `__tests__/` fixtures in capability dir provide field group shapes.

1. BFF call per tool — 3 tools (`submit_field_group`, `decline_intake`, `get_intake_progress`)
2. PII-echo invariant enforced via `assertNoPiiInIntakeResponse` — banking group `bank_account` value MUST NOT appear in assistant text response on ANY of I1–I3, N2, N3, M1 (Category B PII per ADR-0163)
3. Authority-tolerant: `defaultAuthority='read_only'` means gate may block writes — both gate-blocked structured JSON path AND success path are accepted (what matters is pipe reached L4 + tool_call recording row written)
4. `afterAll` restores contract status if `decline_intake` succeeded — prevents test-run contamination

**Postcondition:** All 3 contract-intake tools verified. 17 tests.

**Error paths:** N1 structural-only if both tool file paths unreadable. N2 workspace isolation (FK soft-skip). N3 invalid personnummer structural-only.

## Journey 3 — Guardian capability E2E

**Precondition:** Same. Optional pre-seed of `guardian_signal` rows (service-role insert); if seed fails, A6/A7/A8/S2 conditionally skip with documented log line.

1. BFF call per tool — 3 tools (`get_signals`, `acknowledge_signal`, `get_workspace_health`)
2. `get_signals` reads structured list, classifier intent='guardian' verified
3. `acknowledge_signal` mutates `guardian_signal.status='acknowledged'`, `acknowledged_by=SEED_PROFILE_ID`, polled
4. `get_workspace_health` has TWO test blocks: A9–A12 (with active signals → aggregate count > 0) and A13–A16 (empty dataset → `overall='healthy'`)
5. Gate gap documented (not fixed): `acknowledge_signal` lacks `gate_action` call in `tools.ts` (G3 pattern from other capabilities) — flagged in spec header for separate sortie

**Postcondition:** All 3 guardian tools verified. 20 tests.

**Error paths:** N1 voice skipped (guardian `allowedChannels=['chat','voice','sms','email']` permits voice, but LiveKit not driveable). N2 unauthenticated → 401/403, no guardian data leaked.

## Cross-cutting

- All 3 specs use shared helpers from `apps/e2e/helpers/botsson-harness.ts`
- All 3 add capability-specific helpers (`availability-harness.ts`, `contract-intake-harness.ts`, `guardian-harness.ts`)
- All 3 use `test.describe.configure({ mode: "serial" })`
- Typecheck: 0 errors (`pnpm --filter e2e typecheck`)
- Commits: `fff320957` availability · `c96db4f4d` contract-intake + guardian (lint-staged stash bundled) · `b81c31855` coverage v4

## Postcondition (campaign)

19/29 capabilities covered (65%). 83/127 tools covered (65%). Remaining 🔴: journey-authoring, kb_query, operations-intelligence, shift-swap, ui.
