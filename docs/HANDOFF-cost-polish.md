---
title: "HANDOFF — cost-polish"
status: done
feature: cost-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [handoff, ui-shell, cost, polish, campaign-ui-shell]
---

# HANDOFF — cost-polish

> Sub-sortie inside `campaign/ui-shell`. Closes S12 step 6 of 20 in `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`. M4 cluster progress: 2/3 sub-sorties done (pos-accounts + cost; billing-polish next).

## Summary

Polished the `/dashboard/cost` route — a single-route, no-cluster surface — with a targeted 3-gap fix: client error boundary (`error.tsx`), page-view telemetry on mount, and a Nordic Split `font-heading` header with Norwegian page instructions. The telemetry extension required adding `CostOverviewViewed` to `packages/telemetry/src/registry.ts` at four sites: the interface declaration, the `SmartoutEvent` union (two locations), the `EVENT_ROUTING` record, and the `EventCategory` + `EntityType` union extensions (`"cost"` and `"cost_overview"` respectively). G4 sonnet code-reviewer verified all ADR touchpoints and ruled the union expansions non-ADR-worthy — they mirror existing patterns (`"contracts"` / `"scheduling"` for categories; `"payroll_export_event"` / `"timeline_template"` for entity types). The surface was already 80% clean before this sortie; T0 recon compressed the phase plan to a single build agent, cutting dispatch overhead relative to the contracts-polish 4-track model.

## Files Changed

5 files, ~80 insertions / 0 deletions:

**New files (1):**
- `apps/web/src/app/dashboard/cost/error.tsx` — client error boundary with Norwegian copy ("Noe gikk galt") + retry button, `bg-background` / `border-border` tokens

**Modified files (2):**
- `apps/web/src/app/dashboard/cost/_components/CostOverview.tsx` — `page_cost_overview_viewed` telemetry on mount (DashboardContext `workspaceId` + `profile.id`, `nonEmpty()` guards per ADR-0134); `font-heading` on the h1 header; Norwegian page instructions below the header
- `packages/telemetry/src/registry.ts` — `CostOverviewViewed` interface; `SmartoutEvent` union extended at 2 sites; `EVENT_ROUTING` entry (`cost_overview_viewed → PostHog + activity_trail`); `"cost"` added to `EventCategory` union; `"cost_overview"` added to `EntityType` union

**Docs (2 files):**
- `docs/plans/PLAN-cost-polish.md` — plan seed
- `docs/journeys/JOURNEY-ui-shell-cost-polish-admin-overview.md` — primary journey (`status: verified`, `feature: cost-polish`)

## Commits

2 commits on `feat/ui-shell-cost-polish` vs `campaign/ui-shell`:

| SHA | Message |
|---|---|
| `fecde50e9` | `docs(cost-polish): seed plan + primary journey` |
| `7f856c7d6` | `feat(cost): add error boundary, telemetry, and header polish` |

## Decisions

No new ADRs. Polish-only sortie — no architectural changes. The following ADRs were respected and verified by G4 sonnet code-reviewer:

- **ADR-0134** — `workspace_id` + `actor_id` resolved from `DashboardContext`, guarded by `nonEmpty()` before `emit()` call in `CostOverview.tsx`
- **ADR-0151** — server-resolved IDs only; no profile_id passed through body-supplied references
- **ADR-0173** — no cross-namespace writes; cost surface is read-only, telemetry `emit()` is the only side effect
- **ADR-0204** — no direct DB writes; cost is a read-only analytics surface, `emit()` is the sanctioned mutation path
- **ADR-0238** — `BotssonShell` passive on cost surface; no `DomainChatOwnership` declaration needed (cost has no embedded domain chat)
- **EventCategory + EntityType expansion** — `"cost"` and `"cost_overview"` added to telemetry registry unions. G4 ruled NOT ADR-worthy: expansion mirrors existing patterns and does not alter routing logic, ownership boundaries, or inter-capability contracts. Documented here rather than in a new ADR.

## Learnings

**L: T0 recon compressed to a single sonnet build agent when surface is already 80% clean.**
Contracts-polish ran 4 parallel tracks because the surface had 5 routes + 4 tool bridges + Nordic Split drift. Cost had 1 route, no tool bridge, no palette drift — only 3 gaps. The recon agent (haiku, ~400 words) surfaced this immediately. Outcome: a single sonnet build agent handled all 3 gaps in one phase. Pattern: invest in recon before planning fanout; recon cost is trivially small against avoided dispatch overhead.

**L: `Record<K, V>` registry pattern requires both a runtime entry AND union type extensions at all affected sites.**
`CostOverviewViewed` required changes at 4 registry sites: interface, SmartoutEvent union (×2), EVENT_ROUTING, plus both EventCategory and EntityType union extensions. Contracts-polish established the same checklist (L from that handoff). The build agent self-recovered after 2 typecheck cycles when it initially missed the EntityType extension. Checklist going forward: after adding any new event interface, grep registry.ts for all union/record sites before declaring the phase done.

**L: Stop-hook SIGTERM (exit 143) during agent's own typecheck is known noise (L-2026-05-04).**
The build agent's Stop-hook emitted SIGTERM during its own `tsc --noEmit` verification pass. Exit 143 appeared in console. Agent persisted; final fresh `tsc` was clean. Pattern: trust the tsc output from the agent's final report, not the harness signal. Confirmed as same class as L-2026-05-04.

## Known Issues / Debt

- None introduced. Cost surface had no pre-existing Nordic Split palette drift, no tool bridge, and no loading.tsx skeleton (the page is synchronous with no async data boundary requiring a skeleton). The 3-gap scope was exhaustive for this route.

## Next Steps

- Sub-sortie ready for `close-feature.sh` from inside worktree at `/home/sxtnl/dev/smartout.ai-ui-shell-wt-1` (no arg)
- M4 cluster final sub-sortie: **billing-polish** — 3 routes (`/dashboard/billing`, `/dashboard/billing/[invoice_id]`, `/dashboard/billing/settings`). Billing has tool bridges and likely Nordic Split palette exposure; expect contracts-polish 4-track model, not cost-polish 1-agent model
- Optional follow-up: Playwright E2E spec for cost overview at `apps/web/e2e/cost/` (deferred; S12 orphan-coverage fulfilled by route-returns-<500 check)

## Verification

All gates passed:

- `pnpm --filter web typecheck` → 0 errors (verified post-build commit `7f856c7d6`)
- `pnpm --filter @smartout/telemetry typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0 (cost route registered)
- G4 code-reviewer (sonnet) → APPROVE WITH MINOR ISSUES; all minor items resolved or confirmed non-blocking before close
- Journey Guardian frontmatter (`status: verified`, `feature: cost-polish`) → `JOURNEY-ui-shell-cost-polish-admin-overview.md` satisfied
- Husky pre-commit lint-staged → green on both commits
