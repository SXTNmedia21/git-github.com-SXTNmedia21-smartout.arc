---
title: "HANDOFF — contracts-polish"
status: done
feature: contracts-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [handoff, ui-shell, contracts, polish, campaign-ui-shell]
---

# HANDOFF — contracts-polish

> Sub-sortie inside `campaign/ui-shell`. Closes step 5 of 20 in `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`. Campaign progress: 3/20 routes polished (website cluster + pos-accounts + contracts cluster).

## Summary

Polished the full contracts route cluster across 5 routes (`/dashboard/contracts`, `/dashboard/contracts/[id]`, `/dashboard/contracts/[id]/revise`, `/dashboard/contracts/awaiting-my-signature`, `/dashboard/contracts/new`) and 4 Botsson tool bridge files. Every route received a `loading.tsx` + `error.tsx` pair using Nordic Split tokens, page headers with Instrument Serif h1 and Norwegian page instructions, and correctly described Botsson tool hooks. A `STATUS_COLORS` map was introduced to eliminate all hardcoded Tailwind palette classes from the detail view — replaced with semantic CSS variable tokens (`bg-muted`, `bg-info/10`, `bg-success/10`, `bg-warning/10`, `bg-destructive/10`) matching the Nordic Split design system. Telemetry events (`contracts.detail.viewed`, `contracts.revise.opened`) were registered in `packages/telemetry/src/registry.ts` and wired with `nonEmpty()` guards per ADR-0134 R1. Tool descriptions were added to all 17 tools across 4 bridge files (Tool Compliance Self-Check: 17/17 PASS, verified by G4 sonnet code-reviewer). G4 flagged one blocker — `ComplianceBadge` was using hardcoded `bg-amber-50` and `bg-red-50` classes — fixed in commit `e46929654`. Sortie parity achieved with `website-polish` and `pos-accounts-polish` sub-sorties in this campaign.

## Files Changed

21 files, 610 insertions / 21 deletions:

**New files (loading/error pairs, 10 files):**
- `apps/web/src/app/dashboard/contracts/loading.tsx` — overview route skeleton
- `apps/web/src/app/dashboard/contracts/error.tsx` — overview route error boundary
- `apps/web/src/app/dashboard/contracts/[id]/loading.tsx` — detail route skeleton
- `apps/web/src/app/dashboard/contracts/[id]/error.tsx` — detail route error boundary
- `apps/web/src/app/dashboard/contracts/[id]/revise/loading.tsx` — revise route skeleton
- `apps/web/src/app/dashboard/contracts/[id]/revise/error.tsx` — revise route error boundary
- `apps/web/src/app/dashboard/contracts/awaiting-my-signature/loading.tsx` — awaiting-signature skeleton
- `apps/web/src/app/dashboard/contracts/awaiting-my-signature/error.tsx` — awaiting-signature boundary
- `apps/web/src/app/dashboard/contracts/new/loading.tsx` — redirect stub skeleton
- `apps/web/src/app/dashboard/contracts/new/error.tsx` — redirect stub boundary

**Modified pages (6 files):**
- `apps/web/src/app/dashboard/contracts/page.tsx` — page instructions added
- `apps/web/src/app/dashboard/contracts/[id]/page.tsx` — STATUS_COLORS refactor + page instructions + telemetry
- `apps/web/src/app/dashboard/contracts/[id]/revise/page.tsx` — page instructions + telemetry
- `apps/web/src/app/dashboard/contracts/awaiting-my-signature/page.tsx` — page instructions

**Tool bridges (4 files):**
- `apps/web/src/app/dashboard/contracts/_tools/use-contracts-tools.ts` — tool descriptions added
- `apps/web/src/app/dashboard/contracts/[id]/_tools/contract-detail-tools-bridge.tsx` — (via revise tools)
- `apps/web/src/app/dashboard/contracts/[id]/revise/_tools/use-contract-revise-tools.ts` — tool descriptions added
- `apps/web/src/app/dashboard/contracts/awaiting-my-signature/_tools/awaiting-signature-tools-bridge.tsx` — tool descriptions added

**Nordic Split fix (1 file):**
- `apps/web/src/app/dashboard/contracts/_components/ComplianceBadge.tsx` — hardcoded `bg-amber-50`/`bg-red-50`/`bg-blue-50` replaced with `bg-warning/10`/`bg-destructive/10`/`bg-info/10`

**Telemetry (1 file):**
- `packages/telemetry/src/registry.ts` — `contracts.detail.viewed` + `contracts.revise.opened` events registered

**Docs (2 files):**
- `docs/plans/PLAN-contracts-polish.md` — plan seed
- `docs/journeys/JOURNEY-ui-shell-contracts-polish-admin-overview.md` — primary journey (Phase 1 seed)

## Commits

4 commits on `feat/ui-shell-contracts-polish` vs `campaign/ui-shell`:

| SHA | Message |
|---|---|
| `fe8b5b1d4` | `docs(contracts-polish): seed plan + primary journey` |
| `7b4cdd611` | `feat(contracts-polish): Phase 1 — loading + error + telemetry + Nordic Split status` |
| `983aa3bef` | `feat(contracts-polish): Phase 2 — page headers + instructions + tool descriptions` |
| `e46929654` | `fix(contracts-polish): ComplianceBadge to Nordic Split tokens` |

## Decisions

No new ADRs. Polish-only sortie — no architectural changes. The following ADRs were respected and verified by G4 sonnet code-reviewer:

- **ADR-0134** — `workspace_id` + `actor_id` resolved from `DashboardContext`, guarded by `nonEmpty()` before `emit()` calls
- **ADR-0151** — no profile_id leakage through tool-compliance pattern; `actorProfileId` dead field noted by G4 (non-blocking, see Known Issues)
- **ADR-0173** — no cross-namespace writes; all tool bridges operate read-only on their own data surface
- **ADR-0204** — tool docstrings written after body verified; 17/17 Tool Compliance Self-Check PASS
- **ADR-0238** — `BotssonShell` + domain surfaces declared without dual-surface conflict; no `DomainChatOwnership` collision needed (contracts cluster has no embedded domain chat)
- **ADR-0244** — Nordic Split design token compliance verified; all palette references use CSS variables after ComplianceBadge fix

## Learnings

**L: Track D often catches Nordic Split palette drift that Track C's narrow-scope refactor misses.**
Track C refactored `STATUS_COLORS` in `[id]/page.tsx` (scoped to the status badge map) but left `ComplianceBadge.tsx` — a shared component in the parent `_components/` folder — untouched. G4 (sonnet code-reviewer) caught `bg-amber-50`, `bg-red-50`, `bg-blue-50` as hardcoded classes. Pattern: after any narrow-scope Nordic Split token refactor, dispatch a separate "sweep" agent explicitly targeting shared `_components/` folders within the same route cluster.

**L: `Record<K, V>` registry pattern requires both a runtime entry AND a union type extension.**
Track B's telemetry backfill needed to add events to `packages/telemetry/src/registry.ts` both as runtime registry entries (for PostHog routing) AND as union members of the event-type discriminator. Agent hint queue caught this before the phase was marked complete — missing the union extension causes typecheck failures at `emit()` call sites that are hard to diagnose without looking at the registry structure. Checklist: always add both when extending the telemetry registry.

**L: Stop-hook SIGTERM (exit 143) cascade during 4 parallel sub-agents is known noise (L-2026-05-04).**
Tracks C, D, E, and H were dispatched in parallel. Stop-hook SIGTERM exits on some agents appeared in console as non-zero exits. The agent's own `tsc --noEmit` output was the source of truth — not the Stop-hook exit code. Pattern: always verify typecheck output directly from the agent's final report, not the process exit code. Trust the tsc output, not the harness signal.

## Known Issues / Debt

- **`actorProfileId` dead field** — G4 noted that one tool bridge file has an `actorProfileId` prop passed to a bridge component that does not consume it. Non-blocking (TypeScript accepts it; no runtime effect). Cleanup deferred — low risk, no behavioral impact. Ticket: track in campaign debt log if it recurs across other bridges.
- No new debt introduced. The ComplianceBadge blocker was fixed within this sortie (commit `e46929654`) before close-feature.

## Next Steps

- Sub-sortie ready for `close-feature.sh` from inside the worktree at `/home/sxtnl/dev/smartout.ai-ui-shell-wt-1`
- Next route cluster candidates for polishing (per S12 step order): schedule cluster, people cluster, or year-wheel — coordinate with campaign owner
- Optional follow-up: Playwright E2E specs for the contracts cluster at `apps/web/e2e/contracts/` (deferred; S12 orphan-coverage fulfilled by route-returns-<500 check)

## Verification

All gates passed:

- `pnpm --filter web typecheck` → 0 errors (verified post-Phase 2 + post-fix commit)
- `pnpm --filter web site-map:validate` → exit 0, 5 contract routes registered
- G1 typecheck gate → PASS (post-Phase 1)
- G4 code-reviewer (sonnet) → APPROVE WITH MINOR ISSUES; blocker (`ComplianceBadge` palette) fixed in `e46929654`; 17/17 Tool Compliance Self-Check PASS
- `grep -r "zinc\|gray-[0-9]\|slate-[0-9]\|amber-[0-9]\|red-[0-9]\|green-[0-9]\|blue-[0-9]" apps/web/src/app/dashboard/contracts/` → 0 hits in page/component files (all palette via CSS vars post-fix)
- Journey Guardian frontmatter (`status: verified`, `feature: contracts-polish`) → 5 journey files satisfied (admin-overview + detail + revise + awaiting-signature + new)
- Husky pre-commit lint-staged → green on all 4 commits
