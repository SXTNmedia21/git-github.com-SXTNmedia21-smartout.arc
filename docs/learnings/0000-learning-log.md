---
title: Learning Log
status: in_progress
updated: 2026-04-10
created: 2026-03-26
module: schedule
tags: [learnings]
---

# Learning Log — mal-modus-schedule

| #   | Date       | Learning                                                                                                                | Impact                                                                               |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | 2026-03-26 | session_task PK is `id` not `session_task_id` — confirmed from database.types.ts                                        | Avoided broken FK joins in task query                                                |
| 2   | 2026-03-26 | TS strict mode rejects `parts[0]![0]` on string arrays — need optional chaining `parts[0]?.[0]`                         | Fixed TS2532 in MalGhostTag getInitials                                              |
| 3   | 2026-03-26 | schedule_shift.template_shift_id added by our migration must be included in ALL test fixtures                           | Fixed mobile typecheck failure in shift-phase.test.ts                                |
| 4   | 2026-03-26 | Bridge component returning null can be changed to render dialog alongside children without breaking side-effect pattern | Enabled AgentConfirmationDialog rendering in bridge                                  |
| 5   | 2026-03-28 | Drift councils must truth-sync key doc claims against runtime before prioritization                                     | Avoided false P0 urgency and aligned roadmap to real blockers                        |
| 6   | 2026-03-28 | Live ops feed must normalize mixed human/agent/system events before first-screen rendering                              | Prevented noisy timeline and authority confusion in cockpit V1                       |
| 7   | 2026-03-28 | Temporal shift lock must be DB-canonical across web/voice/MCP channels                                                  | Prevented bypass risk from service-role and side-channel writes                      |
| 8   | 2026-03-28 | Absence approval flow is a missing prerequisite — status field exists but no transition logic, no UI, no hooks          | Any absence-triggered workflow (smart-cover, payroll, guardian) will fail without it |
| 25  | 2026-04-07 | Stage Engine WebSockets (`/ws/:sessionId`, `/guardian/ws`) + in-process guardian-bus are structural Vercel Fluid Compute blockers | Future Vercel migration of stage-engine requires WS→SSE refactor + guardian-bus externalization first. shift-mcp is the only clean-migration candidate. See learning 0025. |

module: dashboard
tags: [learnings]

---

# Learning Log — admin-daily-loop

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |

---

module: contracts
tags: [learnings]

---

# Learning Log — employee-contract-management

| #   | Date       | Learning                                                                                                                                                                                  | Impact                                                                                                                                      |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-04-07 | Drawer→API boundary requires end-to-end shape verification — Zod silently strips unknown keys, typecheck doesn't catch it ([0026](0026-drawer-api-boundary-verification.md))             | Adds API-level regression test pattern + code review checklist for drawer→route flows                                                       |
| 2   | 2026-04-07 | Every Botsson mutation tool must call emit() — capability layer is part of telemetry coverage ([0027](0027-botsson-mutation-tools-must-emit.md))                                          | Refactored telemetry to be importable from server-only packages; added Botsson emit pattern to review checklist                             |
| 29  | 2026-04-08 | Four parallel permission mechanisms is an ontology drift smell ([0029](0029-four-parallel-permission-mechanisms-ontology-smell.md))                                                        | Before adding new permission flags, enumerate existing mechanisms (C4 authority, action_type handlers, allowed_channels). If it can be expressed via combinations, don't add. |
| 30  | 2026-04-08 | "contract" word overloaded across two unrelated systems — `employment_contract` (HR) vs `contract` (ADR-0024 platform legal) ([0030](0030-contract-word-overloaded-across-two-systems.md)) | Migrations must always use `public.contract_status` explicitly. Variable naming must mirror the table, not the concept. UI-text uses "Arbeidsavtale" vs "Brukeravtale". |
| 31  | 2026-04-10 | Clickable row actions need explicit propagation + a11y contract in row-click tables ([0031](0031-clickable-row-action-propagation-contract.md)) | Prevents double-trigger UX bugs (row open + inline action), especially for external handoff actions like PostHog links. |
| 32  | 2026-04-10 | App Router directory renames are safer than they appear — relative imports survive, only string references break ([0032](0032-app-router-rename-blast-radius.md)) | Prefer clean renames + redirects over rewrites that create permanent URL/filesystem discrepancy. Count actual broken references, don't estimate from file count. |

---

module: strike-mcp
tags: [learnings, migration, operations]

---

# Learning Log — strike-mcp / Bubble→v3 migration

| #   | Date       | Learning                                                                                                                                                                                                              | Impact                                                                                                                                                                                                                                                          |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 33  | 2026-04-16 | Migration "attestation complete" does not equal "apply ready" — operational wrappers (bridge tool, cutover docs, apply-script error handling) are first-class deliverables ([0033](0033-migration-attestation-not-apply-ready.md)) | Pair every migration ADR with an "Operations" section. Reference promises like "future ADR in another package" are warnings, not architecture. Cutover communication artifacts must exist as drafts before any production apply. Surfaced by council 2026-04-16. |
| 34  | 2026-04-17 | Migration is knowledge extraction, not table-by-table transfer — when source schema encoded workarounds for source-platform UX limits, 1:1 mapping imports the limits and creates phantom decision work ([0034](0034-migration-as-knowledge-extraction.md)) | Before building a 1:1 mapper, ask "is this schema the source's data model, or the source's UX model?" If UX model, extract knowledge and re-create target-native, don't translate. Collapsed Tier 2 council verdict from 7 ADRs → 1. Future migration councils should include a "is the framing correct?" gate before Phase 3 dispatch. |
| 35  | 2026-04-17 | Schema UNIQUE constraints invalidate bookkeeping-container migration patterns — "1 synthetic parent for N children" throws `23505 unique_violation` on row 2 when target schema enforces UNIQUE on the FK ([0035](0035-schema-unique-invalidates-bookkeeping.md)) | Before emitting migration SQL, grep target migrations for UNIQUE on every FK in the INSERT chain. Caught in Tier 2 v1.5 post-impl council — `unique_policy_protocol` would have aborted apply. Fix: emit 1:1 parent-child pairs. |
| 36  | 2026-04-17 | Post-implementation trace catches what per-file review misses — 4-layer model (per-file semantic + column-payload trace + trigger/constraint semantics + capability-consumer trace) ([0036](0036-post-impl-trace-beats-per-file-review.md)) | Post-implementation briefings must assign all 4 layers to reviewers, not just per-file. Each layer caught a different real bug in Tier 2 v1.5. Add to run-council SKILL.md as a hard rule for topic type = post-implementation. |
| 37  | 2026-04-17 | Idempotency claims require `ON CONFLICT` evidence, not manifest assertions — deterministic UUIDs give reproducibility, not idempotency. Re-apply without `ON CONFLICT` throws `23505` on second run ([0037](0037-idempotency-claims-require-on-conflict-evidence.md)) | Migration manifests must grep for `ON CONFLICT` on every INSERT before claiming idempotent. Add as automated pre-commit check. Strike-mcp `emitRowSql` now emits `ON CONFLICT (pk) DO NOTHING` for all governance PKs. |
| 38  | 2026-04-17 | `source` is an overloaded term — verify semantics before citing convention. v3 has 3 different meanings for `source` (domain classifier, event-origin type, FK). Actual provenance convention is `provenance JSONB` (5 cascade precedents). Steward's single-precedent Phase 3 reading overturned in Phase 5 after Supervisor's full-repo grep ([0038](0038-source-term-is-overloaded-verify-semantics.md)) | Before citing ONE precedent as convention, grep for competing patterns. For semantic-heavy terms (source/status/type/owner/key/role), "we already have this elsewhere" is the wrong reflex. Validates Learning 0036's 4-layer model: Layer 3 (Supervisor code-trace) catches what Layer 1 (per-file reading) misses. |
