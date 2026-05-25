---
title: "ADR-Contract Audit Smoke — 2026-05-25"
status: complete
mode: smoke
created: 2026-05-25
updated: 2026-05-25
---

# Smoke Audit Summary — 2026-05-25

3 specialist slices dispatched in parallel (smoke mode = 3 highest-risk slices).

## Top findings per slice

### 01 — capability-tools (5 HIGH, 8 MEDIUM, 6 LOW)

- **H-1:** `journey`, `contract`, `contract-intake` — gate called but DB writes outside `gatedMutation` exec callback; ADR-0204 Pathway B never fires.
- **H-2:** `guardian/acknowledgeSignal` — no `emit()`; direct `guardian_log` insert bypasses telemetry registry routing; event name mismatch.
- **H-3:** `training` — 3 tools, zero gates, zero emits; `getTeamReadiness` exposes workspace-wide PII without gate.
- **H-4:** `schedule` — 6 tools, zero gates, zero emits; 2 events registered in telemetry registry with no emit-sites (phantom contract per ADR-0358).
- **H-5:** `availability/queryOthersAvailability` — accepts `workspace_id` as schema parameter (ADR-0151 violation).

Clean PASS: task, shift-lifecycle, shift-swap, cascade, scheduler, routine, org, day-line, payroll, pos_account_management, shift_marketplace, timeline-template, bootstrap, engine-world, legal, personal, operations-intelligence, payroll/tariff-tools.

### 02 — edge-functions (1 CRITICAL [FIXED], 2 HIGH, 4 MEDIUM)

- **C-1 (FIXED 2026-05-25 in commit `fd2824c1a`):** `ingest-workspace-knowledge` — `trigger='delete'` path executed `workspace_doc_chunk` DELETE BEFORE auth identity check. Any caller with non-empty Authorization header + known (workspace_id, source_type, source_id) tuple could delete RAG knowledge chunks for any workspace.
- **H-1:** `shift-clock-compliance` — accepts `profile_id` from body without JWT ownership cross-check. ADR-0151 violation; employee can query other employees' compliance data.
- **H-2:** `call-command` — accepts `workspaceId` from body across all 4 handlers. ADR-0151 violation. Mitigated by profile lookup, but pattern is wrong.
- 4 MEDIUM: 3 EFs missing from config.toml (`send-login-code`, `create-invitation`, `delete-account`); raw string compare to detect service-role privilege (rotation risk); ops-triage workspace_id body resolution; payroll-period-locked-handler body workspace_id without verification.

Prior HIGH (5 ops cron EFs missing `verify_jwt=false`): CONFIRMED RESOLVED.

### 03 — db-rls (2 HIGH [FIXED], 3 MEDIUM, 4 LOW)

- **H-1 (FIXED 2026-05-25 in commit `f2568d762`):** `fn_generate_company_invoice` SECURITY DEFINER missing inline `SET search_path`. Session-level setting does NOT bind during function execution.
- **H-2 (FIXED 2026-05-25 in commit `f2568d762`):** `fn_check_billing_run` — same SECURITY DEFINER inline-search_path gap. Forward-only ALTER FUNCTION migration applied at `20260715210000_billing_fn_inline_search_path.sql`.
- 3 MEDIUM: `consent_acceptance` missing explicit service_role INSERT policy; `botsson-imports` bucket missing UPDATE policy.
- (Audit slice expected to find missing `20260715200000_setup_documents_godmode_bypass.sql` — that migration DOES exist in this repo, applied earlier today.)

No tables missing RLS among user-facing surfaces. Platform-admin tables intentionally exempt per ADR-0008.

## Resolution status

| Severity | Total | Fixed today | Open |
|---|---|---|---|
| CRITICAL | 1 | 1 | 0 |
| HIGH | 9 | 2 | 7 |
| MEDIUM | 15 | 0 | 15 |
| LOW | 10 | 0 | 10 |

## Open HIGH for next sortie wave

1. ADR-0204 Pathway B violations in journey/contract/contract-intake (cap-tools H-1)
2. guardian/acknowledgeSignal telemetry bypass (cap-tools H-2)
3. training PII exposure without gate (cap-tools H-3)
4. schedule capability zero gates + 2 phantom events (cap-tools H-4)
5. availability/queryOthersAvailability ADR-0151 violation (cap-tools H-5)
6. shift-clock-compliance ADR-0151 violation (ef H-1)
7. call-command body workspaceId across 4 handlers (ef H-2)

Recommend dedicated remediation sortie wave H — addresses 6 of 7 (5 capability + 1 EF). Wave I covers ADR-0151 sweep across both call-command + availability.

## Method

- Mode: smoke (3 slices in parallel)
- Specialists: 3 × claude sonnet
- Run duration: ~8 minutes (longest specialist)
- False-positive filter: in-place per specialist (known patterns documented in each slice report)

## References

- Slice 01: `01-capability-tools.md`
- Slice 02: `02-edge-functions.md`
- Slice 03: `03-db-rls.md`
- Skill: `~/.claude/skills/adr-contract-audit/SKILL.md`
