# Botsson Harness Builder Memory

Index to persistent lessons. Keep entries under ~150 chars.

## Migration / strike-mcp

- [BM backport patterns](strike-mcp-bm-backport.md) — BM-01 owner via post-engine row fixup; BM-03 STRIKE_WORKSPACE_UUID template-substitute; language_code + day_category_from_iso + coalesce_false/true transforms

## Phase progress

- [Sortie 3 Phases 4+5 shipped 2026-05-13](sortie-3-phases-4-5.md) — 6 task tool bodies; fn_list_my_tasks skipped (service_role auth.uid()=NULL); 3 new telemetry events; emma dispatch via admin client; commit 3441556d7
- [botsson-harness-e2e-test closed 2026-05-11](botsson-harness-e2e-test.md) — 16-test spec, 14 pass, 2 skip by design. Caught stale-container + PostgREST-14 bugs. Commit a6bf3e4fa.
- [F-MEM-UNBLOCK-A3 closed 2026-05-11](f-mem-unblock-a3.md) — G1 unblocked: authority seeded, buildSessionSummary TDD, auto-summary on session close, pg_cron TTL, verify script. 7 commits.
- [pre-phase-e-foundation S5 closed 2026-05-09](pre-phase-e-foundation.md) — KRIT-1/2/4/6. A2 query-rewrite, B1 wizard EF, Track C get-server-context, D1 lise-interview coral. PR #353.
- [engine_world Phase 1+2 closed](engine-world-phase1-2-closed.md) — 11 commits, 2F closeout 2026-05-06. activity_trail actor_id nullable side-effect. ADR-ID squatting trap.
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

## ADR-0151 enforcement (2026-05-08)

- [B1 workspace_id forgery fix](b1-workspace-id-forgery-fix.md) — wizard/start + ultravox adapter; NonEmptyString brand, @smartout/ai mock needed for stage-engine vitest, telemetry dist must be built

## Commit + lint

- [Commitlint kebab-case rejects digits](commitlint-kebab-trap.md) — `(e2e)` / `(recorder-e2e)` fail; use `(recorder-replay)` etc. Never `--no-verify`
- [Pre-commit secret regex](pre-commit-secret-regex.md) — test stubs for `*_key` / `*_KEY` fields must be under 20 chars, else husky blocks the commit
- [Husky JWT pattern blocks well-known Supabase local key](husky-jwt-trap.md) — inline `eyJ*.*.* ` in test helpers fails pre-commit. Load from env only; comment explains why key can't be inlined.
