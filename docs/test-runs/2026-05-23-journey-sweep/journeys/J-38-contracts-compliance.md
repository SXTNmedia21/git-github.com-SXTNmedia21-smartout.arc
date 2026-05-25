---
title: J-38 Contracts Compliance + Compliance-Debt
status: FAIL
journey_docs:
  - JOURNEY-contract-* (compliance-related)
  - JOURNEY-billing-payment-terms-config.md (debt subset)
spec: apps/e2e/tests/contracts-compliance/ + contracts-compliance-debt/
result: 0 passed / 11 failed / 3 skipped (consistent across initial + rerun)
evidence: ../evidence/run-34-contracts-compliance.log + run-38-contracts-compliance-rerun.log
---

# J-38 Contracts Compliance — FAIL (11 real)

## BUG-16 (CRITICAL) — ALL compliance specs auth-fail with `Invalid login credentials`
- 11 tests in 5 spec files all fail at auth step
- Fixture pre-check says `[fixture] verified login: admin@smartout.local` works
- These specs use a different auth path (probably direct Supabase signInWithPassword for API client tests)
- Hypothesis: GoTrue rate-limit (many login attempts during batch), OR helper hardcodes wrong creds, OR password drifted from fixture-provisioning value
- Action: trace `tests/contracts-compliance*/journey-*.spec.ts` auth helper; compare creds vs fixture; check supabase auth logs for rate-limit
