---
title: "PLAN — Fix Authority Seed Parity (F-CT-01 backlog)"
feature: fix-authority-seed-parity
status: in_progress
created: 2026-05-16
updated: 2026-05-16
module: governance
tags: [authority, seed, gate, adr-0189, adr-0204, parity]
---

# PLAN — Fix Authority Seed Parity

## Context

`scripts/authority-seed-parity.ts` returns FAIL on `development` tip as of 2026-05-16. 9 capabilities have `gateAction(...)` call sites in code with **no matching seed row** in `engine_authority_config`. Per `supabase/migrations/20260505110000_unified_authority_gate.sql §4`, `gate_action()` **default-allows** when no config row exists → every un-seeded call site is a silent authority escape (CVE-class, per ADR-0189).

This sortie closes the gap.

## Missing capabilities (from script JSON output, 2026-05-16)

| Capability | Sites | Notes |
|---|---|---|
| contract | 6 | compose, bulk_send, send_single, revise, regenerate, send_dispatch |
| handbook_chapter | 1 | update |
| helpdesk_query | 1 | create |
| memory | 1 | memory.add |
| organization.update_department | 1 | update |
| payroll | 18 | snapshot/lock/recalc/PDF/export + others |
| policy | 1 | update |
| protocol | 1 | update |
| task | 1 | gate.ts:53 |

Total: 31 call sites, 9 distinct capabilities.

## Goal

Single migration seeding 9 capabilities × N workspaces. Auth-seed-parity script returns PASS.

## Non-goals

- F-CT-01 audit finding (14 legacy `gate.ts` files bypassing `gatedMutation` orchestrator — ADR-0204 §SS-5). **Different finding.** Backlog stays.
- Migration of action_type-level gating (e.g. splitting `payroll` into 18 capabilities). One-row-per-capability follows existing pattern.
- `capability_default_registry` table seeds — separate gate, not enforced by auth-seed-parity.

## Success criteria

- [ ] `pnpm exec tsx scripts/authority-seed-parity.ts` exits 0 on this branch
- [ ] 9 new rows in `engine_authority_config` per workspace (idempotent on re-apply)
- [ ] Per-capability (level, min_role) decision documented in new ADR
- [ ] Pre-push typecheck green
- [ ] Journey Guardian passes (all journeys `status: verified`)

## Tracks

### T0 — Scope verification (Explore agent, haiku)
Read all 9 gateAction call sites. Per capability, identify:
- What does each call site mutate?
- What role currently invokes (read surrounding RBAC checks)?
- Risk class (binding legal, money, structural, operational, self-service)?

Output: `docs/plans/scope-fix-authority-seed-parity.md` with proposed (level, min_role) matrix + confidence rating per row.

### Council gate (conditional)
If any T0 row has confidence "medium" or "low": run-council on the matrix with focus on:
- contract (binding doc — admin floor? or manager?)
- helpdesk_query (autonomous self-service or confirm?)
- payroll (one capability vs split?)

### T1 — ADR (code-architect, opus)
Per T0 + Council verdict, write ADR `NNNN-authority-seed-parity-backlog-closure.md`:
- Decision matrix
- Per-capability rationale
- Idempotency contract
- Re-seed protocol on fresh DB

Register in `docs/decisions/0000-decision-log.md`.

### T2 — Migration (botsson-harness-builder, sonnet)
Author `supabase/migrations/2026MMDDHHMMSS_seed_authority_parity_backlog.sql` following pattern of `20260516100000_seed_reconciliation_authority.sql`:
- DO $$ block, fall back to first godmode user
- CROSS JOIN workspace × VALUES(capability, level, min_role)
- ON CONFLICT (workspace_id, capability) DO NOTHING
- RAISE NOTICE if no godmode user (graceful fresh-DB exit)

### T3 — Local verify (self)
1. Apply migration: `pnpm exec supabase db push` (local)
2. Run `pnpm exec tsx scripts/authority-seed-parity.ts` — expect exit 0
3. Confirm idempotency: re-apply, no duplicate rows
4. Run typecheck: `pnpm turbo typecheck`

### T4 — Journey + handoff (docs-tutor, sonnet)
- `docs/journeys/JOURNEY-fix-authority-seed-parity.md` — Journey Guardian (already drafted)
- `docs/HANDOFF-fix-authority-seed-parity.md` — at closure

### T5 — Close (self)
`/close-feature` → merge to development.

## Risks

- Wrong min_role = breaks live UI (e.g. `contract` admin-only blocks managers currently sending contracts)
- Wrong level=autonomous = silent auth bypass perpetuates
- Migration timestamp collision with other in-flight worktrees
- `payroll` is broad — single capability covers 18 disparate action_types; some lower-risk (snapshot) some critical (lock_period). Risk: blanket admin floor breaks reads, blanket manager floor over-permits lock.

## AI Council rules

- Trigger council when T0 returns ANY row with confidence ≤ medium
- Council answers per-capability with one of: `accept-as-proposed`, `lower-floor`, `raise-floor`, `defer-split` (the latter = punt to follow-up sortie, seed with current floor for now)
- 4 voices minimum: security-reviewer, smartout-arena-architect, system-steward, system-agent-coordinator

## Worktree

`/home/sxtnl/dev/smartout.ai-wt-4` @ `feat/fix-authority-seed-parity`

## Tmux

```
tmux new -s smartout.ai-4 -n "wt-4:fix-authority-seed-parity" -c /home/sxtnl/dev/smartout.ai-wt-4
```
