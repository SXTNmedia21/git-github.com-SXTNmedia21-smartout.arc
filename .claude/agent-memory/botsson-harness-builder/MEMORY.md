# Botsson Harness Builder Memory

Index to persistent lessons. Keep entries under ~150 chars.

## Phase progress

- [Recorder Phase 1 vs Phase 2 split](recorder-phase1-phase2-split.md) — what landed D1 vs what is pending Phase 2; authority-seed divergence noted
- [Orb voice mount](orb-voice-mount.md) — LiveKit Orb integration: token BFF, livekit-token bypass reason, room naming, package.json change, mic button pattern

## SDK boundaries

- [Session ID not on client](session-id-not-on-client.md) — useAgent swallows sessionId; build BFF endpoints that resolve via recent turn lookup, not via forgeable client payloads

## DOM selectors (E2E)

- [E2E recorder spec drift](e2e-recorder-spec-drift.md) — Guardian is tabbed, BotssonChat uses data-role="assistant" not "agent", orb is a div not a button, chat placeholder is "Skriv en melding til Botsson"

## Engine dispatcher

- [Sequential step constraint](engine-dispatcher-sequential-constraint.md) — parallel-branch wait_for_event silently fails; trigger-spawn always starts at step 1; step_group is dead metadata

## Commit + lint

- [Commitlint kebab-case rejects digits](commitlint-kebab-trap.md) — `(e2e)` / `(recorder-e2e)` fail; use `(recorder-replay)` etc. Never `--no-verify`
- [Pre-commit secret regex](pre-commit-secret-regex.md) — test stubs for `*_key` / `*_KEY` fields must be under 20 chars, else husky blocks the commit
