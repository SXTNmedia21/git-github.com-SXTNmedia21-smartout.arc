---
title: "PLAN — Task Manager Sortie 2: fn_list_my_tasks RPC"
status: draft
created: 2026-05-14
updated: 2026-05-14
module: task-manager
tags: [sortie, rpc, security-definer, mobile, task-ontology]
---

# PLAN — Task Manager Sortie 2: `fn_list_my_tasks` RPC

## Scope

ADR-0298 Sortie 2 deliverable: ship a `SECURITY DEFINER` Postgres RPC `fn_list_my_tasks` that unions four user-facing task sources (`session_task`, `schedule_day_task`, `personal_task`, `emma_task`) into one normalized shape with `source` discriminator + normalized `status` enum. Mobile and web read paths both call this RPC. Stage-engine agent has a TS-fallback (already noted as drift risk per L-0245 — must include drift marker per its rule).

## Deliverables (in order)

1. **ADR-0314** — RPC contract: signature, columns, status normalization mapping, SECURITY DEFINER auth invariants (`auth.uid()` resolves caller's profile when called via anon JWT; agent-context callers bypass RPC entirely and use TS-fallback per L-0245).
2. **Migration** — `supabase/migrations/<timestamp>_fn_list_my_tasks.sql` creating the RPC. Timestamp must be strictly greater than current dev HEAD max. Reference tables must all exist at that point (grep `CREATE TABLE.*<table>` for each of `session_task`, `schedule_day_task`, `personal_task`, `emma_task`).
3. **Telemetry registry** — register `task.list_mine` event in `packages/telemetry/src/registry.ts` per L-0083 (no registry entry without producer).
4. **TS-fallback drift marker** — add paired comment in both the RPC body and `packages/ai/src/capabilities/task/...` TS fallback citing L-0245 + this ADR; CODEOWNERS gate optional.
5. **JOURNEY-task-mgr-sortie-2-rpc.md** — mobile employee opens task list, mobile manager opens task list, sees unioned tasks across all 4 sources, completing one updates source-of-truth table.
6. **HANDOFF** at close.

## Schema layer (must be loaded)

- `smartout-database-guide` skill — schema rules, migration timestamp discipline (L-0042)
- `smartout-edge-function-guide` — if RPC needs an Edge Function wrapper for mobile (likely not — Supabase JS client can call RPCs directly)
- ADR-0298 — source ontology
- ADR-0299 — Sortie A D6 RLS WITH CHECK (already shipped, RPC must respect)
- L-0042 — migration timestamp ordering
- L-0245 — RPC + TS-fallback paired drift markers

## Out of scope

- `task` capability with 6 tools — Sortie 3 (ADR-0301)
- Mobile Kalender UI — Sortie 4 (ADR-0302)
- E2E suite — Sortie 5

## Risks

- `auth.uid()` in SECURITY DEFINER context: must verify it resolves to caller's profile_id, not function-owner. Test path with anon JWT mobile call.
- `service_role` agent caller: `auth.uid()` is NULL. RPC will return zero rows. Agent capability uses TS-fallback per L-0245. Document this in ADR-0314 explicitly.
- Migration timestamp collision: parallel worktrees exist (wt-9 contracts-compliance + others). Reserve timestamp during preflight grep of all branches.

## Council escalation trigger

If `auth.uid()` semantic varies between PostgREST anon-JWT path and direct PG call from Stage Engine service_role, escalate to council for SECURITY DEFINER auth invariants ADR amendment.

## Worktree

`~/dev/smartout.ai-wt-4` on branch `feat/task-mgr-sortie-2-rpc` based on `development`.
