---
title: "Handoff — nordic-split-final"
feature: nordic-split-final
status: done
created: 2026-04-23
updated: 2026-04-23
module: Dashboard
tags: [handoff, design-system, nordic-split, closure]
---

# Handoff — nordic-split-final

**Sub-sortie of:** `campaign/helpdesk`
**Branch:** `feat/helpdesk-nordic-split-final`
**Commits on this branch (ahead of campaign):**
- `a40c5dc9` — refactor(design-tokens): final Nordic Split sweep — zero zinc/gray/slate
- `f6f81a9a` — docs(nordic-split-final): declare journey

## Summary

Final sub-sortie of the Nordic Split design-token migration. Campaign/helpdesk had already completed Phase 1 (DashboardShell + GlobalSearchPalette), Reports cluster, Hub cluster, and Org-Dialogs cluster. This sortie completed all remaining `zinc/gray/slate` → Nordic Split semantic token migrations across the entire web application.

**Result:** `apps/web/src` now has **0** hardcoded `zinc/gray/slate` Tailwind classes. Down from 1 457 at migration start. Mobile already at 0.

## Scope (86 files, one commit)

Clusters touched in this sortie:
- `/dashboard/ai/*` (2 files — ai page + config)
- `/dashboard/contracts/[id]`
- `/dashboard/handbook/_components`
- `/dashboard/hms/_components` (8 files — CompetenceMatrix, Deviation*, DocumentBrowser, DriftSessionTable, OversiktDashboard, ProcedureDetailTabs, TaskCard)
- `/dashboard/my-salary/_components` (PeriodList)
- `/dashboard/organization/page.tsx`
- `/dashboard/reports/_components` (4 — ReportCard, ReportInsightDrawer, ReportsPageShell, chart-utils.ts)
- `/dashboard/schedule/_components` (11 + 1 hook)
- `/dashboard/settings/_components` (4 — ChangeProposal*, FrameworkRulesPanel, TariffRatesPanel)
- `/dashboard/_components/document-mode` (4)
- `/platform-admin/**` (~27 — guardian, health, landing, services, keys, content, contracts, communications, audit, users, workspaces, loading, badges, columns)
- `/public-site/[host]`, `/scrape`, `/select-plan`, `/sign/*`, `/access-denied`
- `/components/dashboard` (ActionStrip, SwipeReconciliation, UserMenu)
- `/components/onboarding` (DepartmentCanvas, LocationCanvas)
- `/components/platform-admin` (contract-columns, status-badge, workspace-columns)
- `/components/voice-assistant.tsx`
- `/lib/journey/module-meta.ts`
- `/Botsson/_components/BotssonShell.tsx`

## Mapping applied (canonical, same as earlier phases)

| Pattern | Replaced with |
|---|---|
| `bg-zinc-{50,100}`, `bg-white` (page) | `bg-background` |
| `bg-zinc-{800,900,950}`, `bg-white` (card) | `bg-card` / `bg-muted` (context-aware) |
| `text-zinc-{100,200,300,900}`, `text-white`, `text-black` | `text-foreground` |
| `text-zinc-{400,500,600,700}` | `text-muted-foreground` |
| `border-zinc-*` | `border-border` |
| `ring-zinc-*` | `ring-ring` |
| `hover:bg-zinc-*` | `hover:bg-accent` |
| `hover:text-zinc-*`, `group-hover:text-zinc-*` | `hover:text-accent-foreground` / `group-hover:text-accent-foreground` |
| `placeholder:text-zinc-*` | `placeholder:text-muted-foreground` |
| `data-[selected=true]:bg-zinc-*` | `data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground` |
| `shadow-zinc-300/50` | `shadow-border/50` |
| `divide-zinc-*` | `divide-border` |
| `focus:bg-zinc-*`, `focus:text-zinc-*` | `focus:bg-accent` / `focus:text-accent-foreground` |

## Decisions made

No new architectural decisions. Strategy (Option C — Hybrid collapse) was locked in by Phase 1 council 2026-04-23 and applied consistently here. No ADR needed.

## Learnings captured

No new learning file created. One yellow-flag discovered worth noting but not worth a formal learning:
- **Chart color strings escape className-based migration.** `StaffingSection.tsx:96` has `isDark ? "#3f3f46" : "#e4e4e7"` passed as a hex string to a chart legend dot. Never in className scope, so never matched by the grep gate. Not regressed by this sortie — pre-existing. Track as Phase 2.5 debt along with other chart color hex strings in `chart-utils.ts`.

Existing learnings already cover the generic pattern (Nordic Split migration discipline — Council Log entries 2026-04-23).

## Known issues / debt

| # | Issue | Severity | Location |
|---|---|---|---|
| 1 | Hardcoded `oklch()` values in asymmetric `isDark` ternaries | Phase 2.5 scope | DashboardShell.tsx + scattered (~15 ternaries) |
| 2 | `bg-orange-*`, `ring-orange-*`, `text-orange-*` brand signals not yet tokenized | Phase 2.5 scope | Chat NavItem, voice-assistant, ~30 sites |
| 3 | Light theme `--card` = `--background` (active-tab contrast weak in light, legal WCAG AA but visually subtle) | Phase 2.5 scope | tokens.css + consumer sites |
| 4 | Chart color hex strings (Recharts/ECharts SVG attrs, not className) | Phase 2.5 scope | `chart-utils.ts`, `StaffingSection.tsx:96`, likely others |
| 5 | 41 pre-existing lint warnings (unused imports, setState-in-effect) | Separate sortie | scattered |

## Gates passed

- **Grep:** 0 `zinc/gray/slate` in `apps/web/src` + `apps/mobile/src` (verified post-commit)
- **Typecheck:** `pnpm --filter web typecheck` → 0 errors
- **Lint:** 0 errors, 41 pre-existing warnings (none introduced)
- **Scope:** 86 files, all under `apps/web/src/`, 0 config/package/docs co-committed
- **Channel/chat safety:** 0 logic-pattern diff lines
- **Mobile boundary (ADR-0132/0133):** 0 mobile files touched
- **Code review:** PASS (feature-dev:code-reviewer, 7 cluster spot-checks)

## Visual QA

Deferred to pre-merge gate. Recommended before `campaign/helpdesk → development` promotion:
- Dev server on `/dashboard` (landing), `/dashboard/schedule`, `/dashboard/organization`, `/dashboard/reports`, `/dashboard/hms`, `/dashboard/ai`, `/dashboard/settings`, `/dashboard/handbook`, `/dashboard/my-salary`
- Platform-admin: `/platform-admin`, `/platform-admin/guardian`, `/platform-admin/health`, `/platform-admin/landing`, `/platform-admin/services`, `/platform-admin/keys`, `/platform-admin/content`, `/platform-admin/users`, `/platform-admin/workspaces`, `/platform-admin/contracts`
- Public / auth: `/select-plan`, `/sign/[token]`, `/sign/declined`, `/sign/success`, `/access-denied`, `/scrape`
- Both light and dark mode per view
- Screenshot-diff recommended vs last-known-good baseline

## Next steps

1. Merge `feat/helpdesk-nordic-split-final` → `campaign/helpdesk` via `/close-feature`
2. Visual QA on campaign branch (all views above)
3. Optional: Phase 2.5 sub-sortie for brand-signal tokens + `--card-elevated` + chart hex cleanup (per backlog above)
4. Eventually: merge `campaign/helpdesk` → `development` via PR (follow campaign-close-out protocol)

## Related

- Phase 1 council: `docs/council/COUNCIL-LOG.md` — 2026-04-23 Nordic Split Phase 1 review (APPROVE WITH NOTES)
- Design system docs: `docs/design/ren-og-varm-styleguide.html`, `docs/design/README.md`
- Tokens source: `packages/design-tokens/src/tokens.css`
- Theme mapping: `apps/web/src/app/globals.css` (`@theme inline`)
