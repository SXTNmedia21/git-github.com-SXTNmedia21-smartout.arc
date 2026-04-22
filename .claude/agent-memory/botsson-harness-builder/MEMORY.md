# Botsson Harness Builder Memory

Index to persistent lessons. Keep entries under ~150 chars.

## Phase progress

- [Recorder Phase 1 vs Phase 2 split](recorder-phase1-phase2-split.md) — what landed D1 vs what is pending Phase 2; authority-seed divergence noted

## Commit + lint

- [Commitlint kebab-case rejects digits](commitlint-kebab-trap.md) — `(e2e)` / `(recorder-e2e)` fail; use `(recorder-replay)` etc. Never `--no-verify`
- [Pre-commit secret regex](pre-commit-secret-regex.md) — test stubs for `*_key` / `*_KEY` fields must be under 20 chars, else husky blocks the commit
