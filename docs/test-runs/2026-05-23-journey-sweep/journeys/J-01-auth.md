---
title: J-01 Auth — login / signup / session
status: PASS
journey_docs: [JOURNEY-auth-screens-redesign.md, JOURNEY-auth-security-friction.md]
spec: apps/e2e/tests/auth.spec.ts
result: 9/9 passed
evidence: ../evidence/run-01-auth.log
---

# J-01 Auth — PASS

## Coverage
- Login page renders + Norwegian labels (@smoke) ✓
- Email + password fields visible ✓
- Error on invalid credentials ✓
- Unauthenticated /dashboard → /login redirect (@smoke) ✓
- Login + dashboard reach (@smoke) ✓
- Session persists across navigation ✓
- Session persists on reload ✓
- Signup page renders ✓
- Signup link from login ✓

## Journey doc mapping
- `JOURNEY-auth-screens-redesign.md` → covered by all 9 tests
- `JOURNEY-auth-security-friction.md` → covered by tests 1-5

## Notes
- All canonical auth flows pass against local stack.
- No bugs, no gaps for these journeys.
