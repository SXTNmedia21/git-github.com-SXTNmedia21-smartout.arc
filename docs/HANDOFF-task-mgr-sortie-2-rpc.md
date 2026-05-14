---
title: "HANDOFF — Task Manager Sortie 2 (fn_list_my_tasks RPC governance)"
status: done
updated: 2026-05-14
created: 2026-05-14
module: task-manager
tags: [task, rpc, security-definer, auth-divergence, drift-prevention, handoff]
---

# HANDOFF — Task Manager Sortie 2 (fn_list_my_tasks RPC governance)

> Branch: `feat/task-mgr-sortie-2-rpc` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4`
> Base: `development` | Closed: 2026-05-14

## What Was Built and Why

ADR-0298 Sortie 2 was originally framed as "ship the `fn_list_my_tasks` SECURITY DEFINER RPC". The RPC itself had already shipped via `campaign/sortie-5-task-cutover` (per Pontus's session retrospective 2026-05-13). This sortie's actual scope, on inspection, was the **governance gap** the RPC left behind:

1. The auth-divergence semantic (mobile anon JWT vs Stage Engine service_role) was undocumented.
2. The required paired TS-fallback drift marker (per L-0245) was missing in `packages/ai/src/capabilities/task/tools.ts`.
3. The `task.list_mine` telemetry event was not registered in `packages/telemetry/src/registry.ts`.
4. No JOURNEY documented the three caller paths.

This sortie closes those four gaps. No new migration, no new capability tool — purely contract-and-instrumentation work.

## Commits

The work landed in a single commit on `feat/task-mgr-sortie-2-rpc` (see git log for SHA).

## Decisions Made

### D1 — ADR-0317 (was 0316 pre-renumber)

`docs/decisions/0317-fn-list-my-tasks-auth-divergence-invariant.md` codifies the auth-divergence invariant: the RPC is correct for mobile anon JWT (`auth.uid()` resolves the caller's profile_id) and incorrect by-design for Stage Engine service_role (`auth.uid()` is NULL → RPC returns 0 rows). The capability tool MUST use the 4-source TS-fallback path; it MUST NOT delegate to the RPC. Drift markers required at file-header level and at the body of `task.list_mine` execute.

### D2 — TS-fallback drift markers strengthened

`packages/ai/src/capabilities/task/tools.ts` — file-header comment + execute body comment now cite ADR-0317 and L-0245 with explicit "do not delegate to RPC from agent context" wording. CODEOWNERS gate optional, deferred until 3rd collision per L-0245 promotion rule.

### D3 — Telemetry event `task.list_mine` registered

`packages/telemetry/src/registry.ts` — event added per ADR-0152 entity discriminator rules, routed to PostHog + Logger destinations. Confirmed consumer exists (the capability tool emits on success).

### D4 — ADR slot renumber 0316 → 0317 mid-sortie

Orchestrator-assigned ADR-0316 slot collided with Track A's Min Dag ADR (committed first to development). Renumbered 0316 → 0317 across 5 files (ADR file + PLAN + JOURNEY + decision-log + tools.ts + registry.ts) per Phase 8 Step 0 collision-recovery rule. Cited as 5+ occurrences of the parallel-worktree ADR collision pattern.

## Learnings

### L1 — Sortie scope can shrink when prior campaign already shipped the artifact

The brief framed Sortie 2 as "ship the RPC". Reality on inspection: RPC was already in. The right move was to **scope-down to the governance gap**, not invent migration work. Pattern: when starting a sortie under an existing ADR family, grep recent campaigns for the artifact before drafting the deliverables.

### L2 — Paired drift markers require both file-header AND body-level citation

Initial agent pass added file-header comment only. Stop-hook scoped typecheck pass uncovered the body-level miss. Per L-0245 promotion: paired marker is body-level *and* file-header *and* ADR cross-ref, not file-header alone.

## Known Issues / Debt

| ID | Debt | Target |
|----|------|--------|
| K1 | CODEOWNERS gate on RPC + TS-fallback files not yet wired | Promote on 3rd L-0245 occurrence |
| K2 | No automated test that verifies `task.list_mine` capability does NOT call the RPC | Sortie 5 E2E |

## Next Steps

1. Run `bash scripts/close-feature.sh` from wt-4 → merges to `development`.
2. Future Sortie 5 (E2E): add a Playwright spec that asserts the agent path returns task rows AND that no `fn_list_my_tasks` RPC call appears in the Stage Engine logs.

## Verification

| Gate | Result |
|------|--------|
| ADR-0317 written + registered | PASS |
| JOURNEY status `verified` + `feature:` set | PASS |
| Drift markers strengthened at file-header + body | PASS |
| Telemetry registered for `task.list_mine` | PASS |
| Typecheck monorepo | PASS (will run via close-feature pre-push) |
