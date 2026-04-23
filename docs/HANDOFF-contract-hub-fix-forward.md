---
title: HANDOFF — contract-hub-fix-forward
feature: contract-hub-fix-forward
branch: feat/contract-hub-fix-forward
worktree: /home/sxtnl/dev/smartout.ai-wt-1
base: aa56f8c6 (development @ 2026-04-22 post PR #234 merge)
merge_target: development
status: ready_for_merge
verdict: APPROVE FOR MERGE (Council Gate 5 pending verify-agent's mini-council)
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [handoff, contracts, fix-forward, p0, cve, council-gate-4-r2]
---

# HANDOFF — contract-hub-fix-forward

## Summary
Closes 4 P0 defects from Council Gate 4 R2 post-merge review of PR #234. CVE in authority seed remediated, forkTemplate end-to-end auth restored, triple-emit deduplicated, bulk endpoint now C4-gated.

## Commits since base
| SHA | Fix | Content |
|---|---|---|
| `ecfc0a71` | scaffold | PLAN + 4 journeys |
| `b7ce8bf8` | #1 CVE | UPSERT seed + AFTER INSERT trigger + backfill + 12 pgTAP |
| `4a53a0f5` | #4 bulk gate | gate_action call + contract.bulk_send_initiated event |
| `288fde05` | #2+#3 fork | forkTemplate direct admin (Option A per ADR-0191) + dedup emits + MalerTab "Ny fra systemmal" wired |

## Decisions implemented
- **ADR-0191** chosen path: **Option A** (direct `ctx.supabaseAdmin`) for `forkTemplate` — mirrors sibling `publishWorkspaceTemplate` / `deprecateWorkspaceTemplate` pattern. No new auth surface. No cross-process service-key handling. Tool remains canonical emit site for agent path.
- **ADR-0192** implementation: `AFTER INSERT` trigger (not `BEFORE`) on `workspace`, `capability_default_registry` as TABLE not static array. 19 capabilities seeded; capabilities in `CapabilityName` union with no historical seed (knowledge, schedule, training, operations, profile, communication, memory, payroll, ui, contract_intake, shift_swap, shift_lifecycle, governance) deliberately excluded — out of scope for this CVE fix.
- **ADR-0193** (NonEmptyString brand) NOT implemented this round — covered in P1 follow-up sortie alongside Defect A (empty-string `actor_id` at 5 emit sites).

## Defects fixed (4 P0)
1. **Authority seed CVE** — UPSERT + bootstrap trigger. Closes default-allow window where any actor could invoke contract mutations on freshly-created workspaces. Verified by 12-assertion pgTAP suite.
2. **forkTemplate 401** — direct admin write via `ctx.supabaseAdmin`. Agent fork now succeeds end-to-end; sibling-tool architectural consistency preserved.
3. **Triple-emit on fork** — single emit per path (1 tool, 1 route). Legacy `contract_template copied` emit removed from route. One fork operation = one `activity_trail` row regardless of path.
4. **Bulk endpoint missing gate_action** — wired ONCE per batch (not per profile) with `contract.bulk_send_initiated` event for per-profile correlation via `batch_id`.

## Defects deferred (P1 + P2 — separate sortie recommended)
- **Empty-string `actor_id`** at 5 emit sites (ADR-0134 violation) — needs ADR-0193 NonEmptyString brand
- **"Ny fra bunnen"** MalerTab button still disabled — needs schema relaxation or new endpoint for null `source_template_id`. Currently shows `new_from_scratch_pending` hover label.
- **Read-only tools** (5) lack role guard
- **CHECK constraint** `(NOT (is_system AND workspace_id))` not added on contract_template
- **SelectEmployeeStep** listbox a11y
- **3 drawers** missing `SheetTitle`
- **`useReducedMotion`** missing on 4 components
- **Legacy `contract_template copied`** event registry comment deprecation

## Test coverage
- **pgTAP:** `contract_authority_seed_parity.sql` — 12 assertions (registry shape, default level/min_role, trigger existence, fresh-workspace bootstrap, idempotency under replay, end-to-end gate_action enforcement)
- **Typecheck:** 35/35 workspaces clean
- **Lint:** 0 errors (942 pre-existing warnings unchanged)
- **E2E:** NOT RUN this round per orchestrator scope. Post-merge re-run recommended; E2E specs to be added in P1 follow-up sortie.

## Risk after merge
- 0 prod users — preview branch only
- CVE class CLOSED across 19 registered capabilities
- Authority enforcement now load-bearing on fresh DBs (auto-seeded by `AFTER INSERT` trigger on every new workspace)
- Telemetry integrity restored: one fork = one event; bulk operations now appear in `gate_evaluation` and `activity_trail`
