---
title: "License — dev-adr-0249-base-consolidation"
mission_id: dev-adr-0249-base-consolidation
authority_profile: internal-platform-admin
phase: 1
---

# Authority License

Phase 1 ADR-writer mission. Operates at `internal-platform-admin` scope.
Produces documentation only. No customer-data access. No workspace mutations.

## Allowed

- Read any file under `docs/` (architecture, templates, plans).
- Read any file under `infra/` (docker-compose.*.yml).
- Edit files under `docs/decisions/` (write ADR file, append decision-log row).
- Edit files under `docs/journeys/dev-adr-0249-base-consolidation/` (own
  mission folder — e.g. RESCUE.md if rescue path is taken).
- Execute `gh pr create` shell command (PR creation against `development`).
- Emit telemetry events to engine_event/activity_trail via @smartout/telemetry.
- Update own engine_state row (status, completed_at).

## Denied

- Any mutation to workspace, profile, or customer data tables.
- Any capability tool invocation (no stage-engine calls).
- Any schema migration or DDL.
- Any file edit outside `docs/decisions/` and own mission folder.
- Any `git push` or branch-switch operations.
- Shell commands other than `gh pr create` (no `rm`, no `git checkout`, no
  `psql`, no `curl` to external endpoints).
- Voice channel — this mission is chat-only per ADR-0078.

## Authority idempotency (ADR-0176 reference)

If this mission runs more than once (engine_state re-queued for idempotency
test per plan §Phase 1 gate), the ADR write and decision-log append must be
idempotent: check for existing `0249-base-yml-consolidation.md` before writing,
check for existing ADR-0249 row in decision-log before appending. If already
present, skip the write step — do not duplicate.

The pattern mirrors the CROSS JOIN authority-insert convention: act only when
the target row does not exist.
