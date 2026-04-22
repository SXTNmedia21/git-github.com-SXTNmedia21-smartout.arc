---
name: Pre-commit secret regex catches test stubs over 20 chars
description: Husky pre-commit flags any `(password|secret|token|api_key|apiKey|API_KEY)[=:]"<20+ chars>"` as a secret
type: feedback
---

The husky pre-commit hook at `.husky/pre-commit` has a generic warning:

```
(password|secret|token|api_key|apiKey|API_KEY)[[:space:]]*[=:][[:space:]]*['"][A-Za-z0-9+/=_-]{20,}['"]
```

This fires on **any** string ≥20 chars assigned to a field whose name ends
in `_key` / `_KEY` / `password` / `secret` / `token`. It is a WARNING-turned-
ERROR: exit code 1.

**Why:** After 2026-04-07 "commit secret accidentally" incident, the hook
got tightened to default-fail on suspicious assignments.

**How to apply:** In test mocks for env-like objects, keep stub values
**under 20 characters**. Example that fails:

```ts
envMock: { STAGE_ENGINE_API_KEY: "test-dev-key-1234567890" }   // 23 chars — BLOCKED
envMock: { STAGE_ENGINE_API_KEY: "stub-key-for-tests-only" }   // 23 chars — BLOCKED
envMock: { STAGE_ENGINE_API_KEY: "stub-test-key" }             // 13 chars — OK
```

Do NOT reach for `--no-verify` — the regex exists for a reason. Just shorten
the stub.

The real `STAGE_ENGINE_API_KEY` has `z.string().min(16)` so production runs
the long form, but vi.mock never runs the real Zod validator so the mock
value can be short.
