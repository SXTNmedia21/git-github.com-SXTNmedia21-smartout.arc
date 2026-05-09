# Botsson Harness Builder Memory

Index to persistent lessons. Keep entries under ~150 chars.

## Phase progress

- [Recorder Phase 1 vs Phase 2 split](recorder-phase1-phase2-split.md) — what landed D1 vs what is pending Phase 2; authority-seed divergence noted
- [Phase 0 Crown LOCKED 2026-04-30](phase-0-crown-progress.md) — 3× GREEN confirmed. Two fixes: (1) volume mount, (2) event_type dot-notation. Commit 99094590c.
- [Orb voice mount](orb-voice-mount.md) — LiveKit Orb integration: token BFF, livekit-token bypass reason, room naming, package.json change, mic button pattern
- [Phase 0d: voice tool wiring](voice-agent-tool-wiring.md) — adapter.ts ask() bridge, tool registration pattern, llm.ToolContext, Phase 0e gaps
- [Botsson capability parity](botsson-capability-parity.md) — chat (23 caps) vs voice (22 tools) surface; which caps are excluded and why

## SDK boundaries

- [Session ID not on client](session-id-not-on-client.md) — useAgent swallows sessionId; build BFF endpoints that resolve via recent turn lookup, not via forgeable client payloads

## DOM selectors (E2E)

- [E2E recorder spec drift](e2e-recorder-spec-drift.md) — Guardian is tabbed, BotssonChat uses data-role="assistant" not "agent", orb is a div not a button, chat placeholder is "Skriv en melding til Botsson"

## Engine dispatcher

- [Sequential step constraint](engine-dispatcher-sequential-constraint.md) — parallel-branch wait_for_event silently fails; trigger-spawn always starts at step 1; step_group is dead metadata

## Docker / infra

- [stage-engine compose keys](stage-engine-compose-keys.md) — .env.template has op:// refs; must use infra/.env.local (gitignored) for real local JWT keys + full --no-cache rebuild to pick up new workers/ dir

## Telemetry

- [engine_event dot-notation](engine-event-dot-notation.md) — engine_event stores "journey.run_started" (dot), not "journey run_started" (space). toDotNotation() in packages/telemetry/src/providers/engine-event.ts. Always assert dot-form in e2e specs.

## Payroll domain

- [Lønnsgrunnlag not lønnsslipp](feedback_lonnsgrunnlag_not_lonnsslipp.md) — Smartout produces wage basis, not a tax-compliant payslip. Bucket B safe-list for telemetry/file/component names.

## Commit + lint

- [Commitlint kebab-case rejects digits](commitlint-kebab-trap.md) — `(e2e)` / `(recorder-e2e)` fail; use `(recorder-replay)` etc. Never `--no-verify`
- [Pre-commit secret regex](pre-commit-secret-regex.md) — test stubs for `*_key` / `*_KEY` fields must be under 20 chars, else husky blocks the commit
