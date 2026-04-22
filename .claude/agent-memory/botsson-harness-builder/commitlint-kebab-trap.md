---
name: Commitlint kebab-case rejects digit-in-scope
description: Commit scopes with digits (e2e, v2, p3) fail commitlint even though they look kebab-case
type: feedback
---

Commitlint's `scope-case: [2, "always", "kebab-case"]` in `@commitlint/ensure` rejects **any digit**, not just uppercase. So:

- ❌ `test(e2e):` — FAIL
- ❌ `test(recorder-e2e):` — FAIL (digit-in-segment)
- ❌ `feat(v2-api):` — FAIL
- ✅ `test(recorder-replay):` — PASS
- ✅ `test(recorder-whisper):` — PASS

**Why:** kebab-case rule in commitlint is strict "lowercase letters + hyphens only", not a general "no camelCase / no PascalCase".

**How to apply:** When committing in a `(recorder-e2e)`-style scope, rename to a word without digits. Never use `--no-verify` to skip — per CLAUDE.md hard rule.
