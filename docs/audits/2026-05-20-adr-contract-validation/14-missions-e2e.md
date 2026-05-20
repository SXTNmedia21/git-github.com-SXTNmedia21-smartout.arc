---
title: Slice 14 — missions-e2e Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, missions-e2e, protocol-verification]
---

# Slice 14 — missions-e2e — 2026-05-20 (full)

Surfaces: `packages/ai/src/missions/` + `apps/e2e/`
ADRs in scope: none (convention-check slice)
Baseline: 2026-05-18 (reported late as transcribed copy — treated as full baseline)

Delta note: 2026-05-18-adr-contract-validation-02 contained a slice 14 (status: late-arrival, transcribed post-hoc). This run is the first on-disk delta since 2026-05-15.

---

## Summary

1. **F-14-05 (MEDIUM)** — `p-swap-marketplace-pipeline.ts` is an unregistered protocol: file exists in `apps/e2e/protocols/` but absent from `PROTOCOL_REGISTRY` in `index.ts` and its referenced spec file (`tests/p-swap-marketplace-pipeline.spec.ts`) does not exist. Protocol is unreachable via `protocol.spec.ts` runner.
2. **F-14-06 (MEDIUM)** — `apps/e2e/db/announcement-atomic-rpc.spec.ts:17` has a hardcoded Supabase local service role key as a `??` fallback. The key is gated behind `HAS_SUPABASE_ENV` (skips in CI), but the literal appears in git history and violates the secrets-protocol "no hardcoded credentials" rule even for test code.
3. **F-14-02 (LOW — OPEN)** — `SEASON_LIFECYCLE_MISSION_ID = "season-lifecycle"` is absent from `MissionIdSchema` with no inline comment explaining the intentional exclusion. Finding carried from 2026-05-15 baseline, not closed.
4. **F-14-03 (LOW — OPEN)** — No E2E spec exercises the `season-lifecycle` session-spawn path end-to-end. `season-activation.spec.ts` covers DB-level fanout; the stage-manager spawn in `session-manager.ts:259` has no Playwright coverage.
5. **F-14-04 (LOW — OPEN)** — `MISSIONS: Record<string, AgentMission>` (registry.ts:14) — no compile-time enum guard. `Record<MissionId, AgentMission>` would fail at tsc if registry and schema drift. Carried from 2026-05-15 baseline, not closed.

---

## Findings table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| F-14-05 | MEDIUM | `apps/e2e/protocols/p-swap-marketplace-pipeline.ts` (whole file) | — | Protocol file not registered in `PROTOCOL_REGISTRY` (index.ts). Referenced spec `tests/p-swap-marketplace-pipeline.spec.ts` does not exist. Runner can never execute this protocol. |
| F-14-06 | MEDIUM | `apps/e2e/db/announcement-atomic-rpc.spec.ts:17` | — | `process.env.SUPABASE_SERVICE_ROLE_KEY ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"` — hardcoded credential fallback in committed test code. HAS_SUPABASE_ENV guard prevents live use in CI, but the literal is in git history. Secrets-protocol: no hardcoded keys anywhere. |
| F-14-02 | LOW | `packages/ai/src/missions/registry.ts:5` | — | `SEASON_LIFECYCLE_MISSION_ID = "season-lifecycle"` intentionally absent from `MissionIdSchema` — design decision (session-spawned, not getMission()-routed) lacks an inline comment. Open from 2026-05-15. |
| F-14-03 | LOW | `apps/e2e/tests/season-activation.spec.ts` (gap) | — | No Playwright spec covers the stage-manager `SEASON_LIFECYCLE_MISSION_ID` session-spawn path (`session-manager.ts:259`). DB-level test exists; BFF path untested. Open from 2026-05-15. |
| F-14-04 | LOW | `packages/ai/src/missions/registry.ts:14` | — | `MISSIONS: Record<string, AgentMission>` — `string` key type loses compile-time enum guard. Drift between `MissionIdSchema` and `MISSIONS` would compile silently. Open from 2026-05-15. |

---

## Closed findings (confirmed since last baseline)

| ID | Closed | Evidence |
|----|--------|----------|
| F-14-01 | commit 628041add (2026-05-18) | `attach-routine-trigger` testid is now static at `DayLineStrip.tsx:101`. Confirmed present in DOM. |

---

## Per-ADR rollup

No ADRs formally assigned to this slice (convention-check / structural integrity). Informally assessed:

| Convention | Status | Notes |
|------------|--------|-------|
| Protocol registry completeness | ⚠️ partial | p-swap-marketplace-pipeline.ts unregistered |
| Secrets-protocol (test code) | ⚠️ partial | One hardcoded fallback key in announcement-atomic-rpc.spec.ts |
| MissionIdSchema ↔ MISSIONS parity | ✅ compliant | 7:7 match confirmed |
| SEASON_LIFECYCLE_MISSION_ID design comment | ⚠️ partial | Shared constant jsdoc says "used across stage-engine, hooks, and tools" — excludes MissionIdSchema rationale |
| HAS_SUPABASE_ENV guard pattern | ✅ compliant | 4 of 4 files with direct Supabase calls have consistent guard |
| L-0125 spirit-vs-letter | ✅ compliant | `journey-mission-resolution.spec.ts` + `journey-capability-publish-mission.spec.ts` assert artefacts, not just `ok:true` |
| Cleanup FK order in E2E specs | ✅ compliant | `engine_stages` deleted before `engine_missions` in all relevant afterAll hooks |

---

## Verified intentional

None new this run. All baseline false positives (FP-001 through FP-005) are outside this slice's scope.

The `botsson-session` mission having an empty `systemPrompt: ""` and empty `greeting: ""` is intentional — per the registry comment, "the persona engine on the client controls identity via context.persona_prompt." Not a finding.

The `SEASON_LIFECYCLE_MISSION_ID` constant living in `registry.ts` (not `types.ts`) is intentional: it is a string constant used by service consumers that need the ID without importing the full registry. No finding.

---

## In-progress (mid-campaign)

No mission or E2E files are in active campaign worktrees under `apps/e2e/` or `packages/ai/src/missions/` at the time of this audit. The 8 active campaigns do not touch this surface.

---

## MISSING TESTIDS carried from p-sidebar-orphan-coverage.ts

The `p-sidebar-orphan-coverage.ts` protocol (S12, registered) documents 11 missing testids in its header comment. These are already reported inline per protocol convention. Carrying forward for supervisor awareness:

```
MISSING TESTIDS:
- [data-testid="sidebar-nav"] needed in apps/web/src/components/dashboard/DashboardShell.tsx
- [data-testid="sidebar-group-drift"] needed in apps/web/src/components/dashboard/SidebarGroup.tsx
- [data-testid="sidebar-group-planlegging"] needed in SidebarGroup.tsx
- [data-testid="sidebar-group-administrasjon"] needed in SidebarGroup.tsx
- [data-testid="sidebar-group-hms-compliance"] needed in SidebarGroup.tsx
- [data-testid="sidebar-group-kommunikasjon"] needed in SidebarGroup.tsx
- [data-testid="sidebar-group-integrasjoner"] needed in SidebarGroup.tsx
- [data-testid="sidebar-group-ai-botsson"] needed in SidebarGroup.tsx
- [data-testid="sidebar-group-veiledning"] needed in SidebarGroup.tsx
- [data-testid="sidebar-disabled-tasks"] needed in SidebarGroup.tsx (DisabledNavItem for /dashboard/tasks)
- [data-testid="sidebar-disabled-manuals"] needed in SidebarGroup.tsx (DisabledNavItem for /dashboard/manuals)
```

These are owned by the frontend-designer agent. No code action from this slice.
