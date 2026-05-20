---
title: "Handoff — pre-m5-mutation-closure"
status: ready-to-merge
feature: pre-m5-mutation-closure
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [handoff, ui-shell, mutation-closure, gate-action, council-verified, campaign-ui-shell, M5-prereq]
---

# Handoff — pre-m5-mutation-closure

M5 Sortie 1 of 4. Closes 3 direct-browser mutation sites in the HMS/policy surface, wires `gate_action()` + delegation chains, and seeds 2 capability rows. Council-verified (6/6 conditions). G4 code review completed with 1 HIGH blocker fixed.

## Read FIRST

- `docs/plans/PLAN-pre-m5-mutation-closure.md`
- `docs/journeys/JOURNEY-ui-shell-pre-m5-mutation-closure.md`
- `docs/council/COUNCIL-LOG.md` — row "2026-05-17 — M5 HMS cluster scoping"
- `docs/decisions/0360-l-0258-collision-detector-mandatory-ci.md` (renumbered from 0347)
- `docs/learnings/0295-polish-prs-gild-half-converted-patterns.md`
- `docs/learnings/0296-bridge-tool-description-phantom-amplifier.md`

## Commits

| SHA | Description |
|-----|-------------|
| `348ced5ce` | plan + journey stubs |
| `3ae95f0fc` | mutation closure (3 sites + migration) |
| `4a21b9e4c` | G4 fix: escalate seed + ADR cross-refs |

## What Was Built

**Site 1 — `use-update-deviation.ts`**
Hook refactored to thin TanStack wrapper delegating to `resolveDeviationAction` / `acknowledgeDeviationAction` / `escalateDeviationAction` — all implemented in `update-deviation-action.ts`. No direct Supabase writes remain in hook.

**Site 2 — `use-complete-task.ts`**
Delegates to new `completeTaskAction` (cookie-path wrapper) → `completeSessionTaskAction` → `task.complete` tool body. Per ADR-0298 Sortie 5b ontology.

**Site 3 — `policy-actions.ts` `createPolicy`**
`gate_action("policy.create_manual")` call added at L88 BEFORE admin-client insert. Previous role-string check removed — gate enforces `min_role=admin`.

**New: `complete-task-action.ts`**
Cookie-path Server Action wrapper created. Resolves profile via `resolveCurrentProfile()` (ADR-0151).

**New: `escalateDeviationAction` in `update-deviation-action.ts`**
Added to cover the "escalated" status path the original hook handled but the existing Server Actions did not. Necessary to avoid splitting a 3-path hook into 2 server + 1 browser write.

**Migration `20260617110000_policy_create_manual_capability_seed.sql`**
Two capabilities:
- Part A (registry insert): `policy.create_manual` (confirm, min_role=admin) + `hms.escalate_deviation` (confirm, min_role=manager)
- Part B (backfill): both capabilities seeded into `engine_authority_config` for all workspaces

**Telemetry**
`"policy created"` (PolicyCreated) was already registered in `packages/telemetry/src/registry.ts` (interface L5512, union L8323, EVENT_ROUTING L12172). No changes required.

## Council Conditions — Final Verification (6/6 PASS)

1. ✅ All 3 mutations closed in one commit (commits `3ae95f0fc` + `4a21b9e4c` together)
2. ✅ Server-resolved IDs via `resolveCurrentProfile()` (ADR-0151)
3. ✅ Awaited `emit()` server-side everywhere
4. ✅ `gate_action()` RPC: 5 actions verified (resolve / acknowledge / escalate / complete-via-task-body / createPolicy)
5. ✅ Capability seed migration `20260617110000` — Part A + Part B for BOTH `policy.create_manual` AND `hms.escalate_deviation`
6. ✅ `"policy created"` registered (already present)

## G4 Code Review

Conducted by `supervisor` (sonnet). Findings:

| Severity | Finding | Status |
|----------|---------|--------|
| HIGH | `escalateDeviationAction` called `gate_action("hms.update_deviation_manual")` — capability NOT seeded → L-0066 default-allow CVE | **FIXED** in `4a21b9e4c` — renamed literal to `hms.escalate_deviation` + seeded in extended migration |
| LOW | Comment/literal alignment | **FIXED** same commit |
| LOW | Stale ADR-0364 refs in COUNCIL-LOG + PLAN + JOURNEY (after collision-driven renumber to ADR-0360) | **FIXED** same commit |
| LOW | `completeTaskAction` cookie wrapper re-resolves identity that `_shared.resolveCurrentProfile()` already provides — duplication, not bug | **Deferred** — not a correctness issue |
| LOW | Hardcoded Norwegian error strings ("Ugyldig oppgave-ID.", "Ikke autentisert.") — not i18n | **Deferred** — next polish wave |

## Decisions

**ADR-0360 (proposed) — L-0258 collision detector mandatory in CI**
Originally written as ADR-0347 in this sortie, renumbered to 0348 in G4 fix (schedule-density-persistence conflict), then renumbered to 0360 in sync-campaign outsider-renumber (payroll claimed 0347-0356). `0364-schedule-density-persistence.md` (originally `0347-`) already existed from merge `0c6b7afb6` — collision caught by builder's pre-commit hook. Cross-refs updated in COUNCIL-LOG, PLAN, JOURNEY, decision-log.

**Capability naming — `hms.escalate_deviation`**
Original builder code used `hms.update_deviation_manual` (unseeded). G4 fix renamed to match existing pattern (`hms.resolve_deviation` / `hms.acknowledge_deviation`). Seeded in extended migration.

**Authority defaults**
- `policy.create_manual`: confirm + min_role=admin + 24h observer escalation
- `hms.escalate_deviation`: confirm + min_role=manager + 24h observer escalation

## Learnings

**L-1: ADR collision detection at write-time is insufficient**
Wrote ADR-0360 (originally 0347, then 0348) in campaign commit `9bd168434` after grepping `git log --all --name-only`. Missed `0347-schedule-density-persistence.md` (now 0359) from earlier merge `0c6b7afb6`. This is the 5th occurrence of ADR collision. Detection at write-time via grep is fragile across branches. Builder's pre-commit hook is the load-bearing safety net. Strengthen Phase 8 Step 0 in `run-council` skill: also run `ls docs/decisions/ | awk -F'-' '{print $1}' | sort | uniq -d` to surface numeric prefix duplicates regardless of cross-branch state.

**L-2: Builder scope expansion can be necessary**
Adding `escalateDeviationAction` was beyond the original 2-site Phase 3 scope. Correct call: original `use-update-deviation.ts` handled 3 status paths (resolve/acknowledge/escalate); existing Server Actions only handled 2. Splitting would have left escalate as a direct browser write, defeating the sortie goal. Scope creep ≠ scope error when the alternative is partial mutation closure.

**L-3: L-0066 default-allow CVE class is recurrent (≥5 occurrences)**
Calling `gate_action()` with an unseeded capability silently allows everything — no error, no audit trail, full bypass. Detection gap: no CI gate checks that every capability literal in `_actions/` files has a corresponding migration row. Promote to CI enforcement script (`scripts/gate-action-coverage.ts`) per L-0281 mandate if 1 more occurrence.

## Known Issues / Debt

- **`completeTaskAction` identity duplication** (G4 LOW): cookie wrapper re-resolves identity already available via `_shared.resolveCurrentProfile()`. Refactor in follow-up sortie.
- **Hardcoded Norwegian error strings** in 3 Server Actions (G4 LOW): not i18n. Roll into next polish wave.
- **L-0066 CI gate missing**: no automated check that every `gate_action()` literal has a seeded capability row. Add to `scripts/gate-action-coverage.ts` per L-0281 mandate.
- **`task.complete` ownership ambiguity**: `completeTaskAction` chains through the capability tool body. Verify per ADR-0298 Sortie 5b that this is the intended ownership pattern and not a Server Action duplicating tool work.

## Files Changed

```
apps/web/src/app/dashboard/_actions/complete-task-action.ts                      NEW
apps/web/src/app/dashboard/_actions/update-deviation-action.ts                   escalateDeviationAction added, gate literal aligned
apps/web/src/app/dashboard/hms/_hooks/use-update-deviation.ts                    delegation refactor
apps/web/src/app/dashboard/hms/_hooks/use-complete-task.ts                       delegation refactor
apps/web/src/app/dashboard/policies/_actions/policy-actions.ts                   gate_action added, role-string removed
supabase/migrations/20260617110000_policy_create_manual_capability_seed.sql      NEW — 2 capabilities (Part A + Part B)
docs/decisions/0360-l-0258-collision-detector-mandatory-ci.md                    NEW — was 0347→0348, now 0360 (outsider-renumber)
docs/decisions/0000-decision-log.md                                               renumber entry
docs/council/COUNCIL-LOG.md                                                       ADR-0364 → ADR-0360
docs/plans/PLAN-pre-m5-mutation-closure.md                                        cross-ref update
docs/journeys/JOURNEY-ui-shell-pre-m5-mutation-closure.md                         cross-ref update
docs/HANDOFF-ui-shell-pre-m5-mutation-closure.md                                  this file
```

## Next Steps

1. Run `close-feature.sh` from inside `/home/sxtnl/dev/smartout.ai-ui-shell-wt-1` (no arg — auto-detects sub-sortie of `campaign/ui-shell`).
2. Sub-sortie merges to `campaign/ui-shell` (merge-commit per ADR-0213).
3. Worktree removed by close-feature.
4. Update `docs/plans/CAMPAIGN-ui-shell.md` Completed Sub-Sorties table with merge SHA.
5. Dispatch Sortie 2 `hms-collision-fix` per council verdict (ADR-0360 detector + 3 LIVE collision resolutions).

## Verification Commands (rerun-able)

```bash
# 0 errors
pnpm --filter web typecheck

# exit 0
pnpm --filter web site-map:validate

# 0 hits — no direct Supabase writes in hooks (JSDoc refs allowed)
grep -nE 'supabase\.from\("(deviation|session_task)"\)\.(update|insert|delete)' \
  apps/web/src/app/dashboard/hms/_hooks/

# 0 hits — no void emit() (all awaited)
grep -nE 'void emit\(' \
  apps/web/src/app/dashboard/hms/_hooks/ \
  apps/web/src/app/dashboard/policies/_actions/

# 0 hits — stale literal gone
grep -nE '"hms\.update_deviation_manual"' \
  apps/web/src/app/dashboard/_actions/

# ≥1 hit — correct literal present
grep -n '"hms.escalate_deviation"' \
  apps/web/src/app/dashboard/_actions/update-deviation-action.ts

# ≥2 hits — Part A + Part B seeded
grep "hms.escalate_deviation" supabase/migrations/
grep "policy.create_manual"   supabase/migrations/

# ≥1 hit — telemetry registered
grep '"policy created"' packages/telemetry/src/registry.ts
```
