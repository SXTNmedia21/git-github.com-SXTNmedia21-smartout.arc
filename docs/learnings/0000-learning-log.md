---
title: Learning Log
status: in_progress
updated: 2026-04-17
last-reconciled: 2026-04-17
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
| 34  | 2026-04-16 | A capability without emit() is invisible to the cascade — 11/14 Botsson capabilities silent on PostHog, activity_trail, engine_event, logger ([0034](0034-capability-without-emit-invisible-to-cascade.md)) | Fix centrally in `toVercelTools` adapter (one emit covers 14 capabilities) rather than per-capability. CLAUDE.md "No mutation without emit" is a cascade invariant, not a style rule. |
| 36  | 2026-04-16 | Worktree Edit Hygiene — edits made in the wrong tree silently split docs from code ([0036](0036-worktree-edit-hygiene.md)) | Before any feature-scoped Edit: `pwd` + `git branch --show-current` + `git worktree list`. Planning docs belong in the feature PR, not stranded on development. |
| 37  | 2026-04-16 | Hono `app.route()` merges runtime context but not compile-time generics — sub-routes lose parent-set variables ([0037](0037-hono-appenv-subroute-drift.md)) | Share a single `AppEnv` type across root and sub-apps. `c.get("requestId" as never)` casts are rot — they replicate and erase middleware's type contract. |
| 38  | 2026-04-16 | Registry destinations can claim routes providers silently drop — `activity_trail` provider rejects events without `properties.entity`, `Promise.allSettled` in emit() swallows rejection ([0038](0038-registry-destinations-provider-silent-drop.md)) | Routing declaration is a CLAIM, not a contract. Add CI test that asserts every declared destination actually persists. Provider + type contracts must be co-located — if provider validates, type should require. |
| 39  | 2026-04-16 | Voice `message_preview` in analytics is a PII vector — transcripts leak to PostHog beyond ADR-0077's reach ([0039](0039-voice-message-preview-pii-vector.md)) | Any telemetry field carrying raw user content must be gated by channel. Gate preview on `channel === "chat"` and redact on voice. Prefer emitting derived signal (length, intent) over raw text. |
| 40  | 2026-04-17 | Identity-boundary ontology — pre-workspace flows are a distinct class that cannot pass through `workspace-api` because `resolveAuth` hard-requires `auth.workspaceId`. Invitation token IS the auth surface, not an absence of auth. ([0040](0040-identity-boundary-ontology-pre-workspace-flows.md)) | ADR-0123 amends ADR-0029 with explicit exceptions list + tripwire clause: on 3rd pre-workspace endpoint, open `identity-api` gateway ADR. `smartout-edge-function-guide` skill gains pre-workspace checklist item. |
| 41  | 2026-04-17 | `emit()` called ≠ mutation audit-covered — governance mutations all emit `"button clicked"` which registry routes to PostHog-only; activity_trail + engine_event receive nothing. Three distinct partial-routing failure modes: registry-declaration gap (this), provider silent drop (L-0038), event-name typo. ([0041](0041-registry-declaration-gap-partial-routing.md)) | PR-review checklist: when touching emit(), verify event name exists in registry AND destination set matches event classification (mutation→quad, UI→posthog-only). Audit guidance: grep both emit() invocations AND registry entries. ADR-0122 closes this for 7 governance events. |
| 42  | 2026-04-17 | Plan documents are not ground truth for migration dependencies — migration timestamps are CAUSAL order in a dependency DAG, not chronological markers. Plans chose "today's wall-clock" timestamps twice in one session; referenced tables/columns that don't exist at that timestamp; CLAUDE.md/skills silent on the rule; Phase 2.5 fact-check didn't cover temporal claims. Four failure modes on Task 1 alone: 2 missing tables, 1 missing column, 1 wrong schema qualifier. ([0042](0042-plan-documents-not-ground-truth-migration-deps.md)) | smartout-database-guide skill gains migration-timestamp-ordering rule; writing-plans skill gains migration-dependency checklist; council Phase 2.5 gains migration-dependency fact-check step. No ADR yet — escalate on 3rd occurrence. |
