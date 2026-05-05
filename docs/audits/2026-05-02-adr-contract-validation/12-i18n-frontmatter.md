---
title: "Audit 12 — i18n + Frontmatter Compliance"
status: done
updated: 2026-05-02
created: 2026-05-02
module: meta
tags: [audit, i18n, frontmatter, compliance, norwegian, docs]
---

## Summary

**i18n:** The `@smartout/i18n` package is fully wired (`LocaleProvider`, `useTranslation`, 19 namespace JSON files) but adoption is critically low — only 166 of 1754 source files (9.5%) use it. The remaining 90%+ hardcode Norwegian strings directly. 81 distinct hardcoded-Norwegian occurrences found across 30+ files using the audited terms alone. The common action words (`Lagre`, `Avbryt`, `Slett`, `Bekreft`) ARE defined in `common.json` — violation is omission, not missing infrastructure.

**Frontmatter:** 1434 of 1529 docs files (93.7%) have `---` frontmatter. Of those with frontmatter, 533 are missing at least one required field. The `module:` field is the worst offender (491 files). 128 files have stale `updated:` dates (>60 days old, i.e. before 2026-03-03), all in `docs/decisions/` early ADRs and `docs/User Manual/`.

---

## Hardcoded NO strings — top 30 offenders

| File | Line | String | Likely i18n key |
|---|---|---|---|
| `apps/web/src/hooks/shift-clock/useShiftClock.ts` | 262,378,640 | `"Ansatt"` | `common.roles.employee` |
| `apps/web/src/app/dashboard/schedule/page.tsx` | 738,1568 | `"Ansatt"` | `common.roles.employee` |
| `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx` | 854,1058 | `"Ansatt"`, `"Leder"` | `common.roles.employee`, `common.roles.manager` |
| `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx` | 360,783 | `"Innstillinger"`, `"Lagrer..."`, `"Lagre"` | `common.save`, `dashboard.settings` |
| `apps/web/src/components/dashboard/DashboardShell.tsx` | 1586,1680 | `"Innstillinger"` (×2) | `dashboard.settings` |
| `apps/web/src/app/dashboard/schedule/_components/employee-drawer.tsx` | 150,194 | `"Ansatt"`, `"Lagrer..."`, `"Lagre"` | `common.roles.employee`, `common.save` |
| `apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx` | 33,153 | `"Ansatt"` (×2) | `common.roles.employee` |
| `apps/web/src/app/platform-admin/billing/integrations/_components/EditIntegrationDialog.tsx` | 145 | `"Sletter…"`, `"Slett"` | `common.delete` |
| `apps/web/src/app/platform-admin/billing/settings/dispatch/_components/EditDispatchRuleDialog.tsx` | 167 | `"Sletter…"`, `"Slett"` | `common.delete` |
| `apps/web/src/app/signup/page.tsx` | 535,616 | `"Bekreft"` (×2) | `common.confirm` |
| `apps/web/src/components/welcome-wizard/steps/OptionalStep.tsx` | 7,186 | `"Lagre"` (×2) | `common.save` |
| `apps/web/src/app/platform-admin/contracts/[id]/action-buttons.tsx` | 103 | `"Avbryter..."`, `"Avbryt"` | `common.cancel` |
| `apps/web/src/app/platform-admin/contracts/[id]/contract-editor.tsx` | 369 | `"Lagrer..."`, `"Lagre"` | `common.save` |
| `apps/web/src/components/contract-editor/contract-editor.tsx` | 316 | `"Lagrer..."`, `"Lagre"` | `common.save` |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ContractTab.tsx` | 271 | `"Lagrer..."`, `"Lagre"` | `common.save` |
| `apps/web/src/app/dashboard/billing/settings/_components/EhfSettingsSection.tsx` | 83 | `"Lagrer…"`, `"Lagre"` | `common.save` |
| `apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx` | 492 | `"Lagre"`, `"Rediger"` | `common.save`, `common.edit` |
| `apps/web/src/app/dashboard/schedule/_components/day-control/OversiktTab.tsx` | 195 | `"Lagre"`, `"Rediger"` | `common.save`, `common.edit` |
| `apps/web/src/components/dashboard/GlobalCreateMenu.tsx` | 76,84 | `"Vakt"`, `"Oppgave"` | `dashboard.shift`, `dashboard.task` |
| `apps/web/src/components/day/DayTimelineStrip.tsx` | 57 | `"Oppgave"` | `dashboard.task` |
| `apps/web/src/components/day/DayActivityLog.tsx` | 21 | `"Oppgave"` | `dashboard.task` |
| `apps/web/src/components/day/EventDetailPanel.tsx` | 43 | `"Oppgave"` | `dashboard.task` |
| `apps/web/src/components/day/DayEventList.tsx` | 36 | `"Oppgave"` | `dashboard.task` |
| `apps/web/src/components/day/tabs/RosterTab.tsx` | 372 | `"Ferdig"` | `common.done` |
| `apps/web/src/app/platform-admin/journeys/_components/runner-header.tsx` | 102 | `"Ferdig"` | `common.done` |
| `apps/web/src/app/dashboard/website/_components/SetupWizard.tsx` | 51 | `"Ferdig"` | `common.done` |
| `apps/web/src/app/update-password/page.tsx` | 212 | `"Bekreft"` | `common.confirm` |
| `apps/web/src/lib/journey/module-meta.ts` | 81 | `"Ansatt"` | `common.roles.employee` |
| `apps/web/src/app/Botsson/_components/BotssonArena.tsx` | 70 | `"Innstillinger"` | `dashboard.settings` |
| `apps/web/src/app/dashboard/reconciliation/_components/tabs/OppgaverTab.tsx` | 139 | `"Oppgave"` | `dashboard.task` |

**Pattern:** The top 5 strings by frequency are `"Ansatt"` (role label, ~15 hits), `"Lagre"/"Lagrer..."` (save button, ~12 hits), `"Oppgave"` (task label, ~8 hits), `"Innstillinger"` (settings, ~5 hits), `"Avbryt"/"Ferdig"` (~4 hits each). All have direct equivalents already defined in `common.json`.

**Root cause:** i18n is wired but adoption is not enforced. Only 166/1754 files import from `@smartout/i18n`. No lint rule prevents hardcoded strings. No ADR mandates i18n adoption timeline.

---

## docs/ frontmatter compliance

| Metric | Count |
|---|---|
| Total docs/*.md files | 1529 |
| Files WITH `---` frontmatter | 1434 |
| Files WITHOUT frontmatter | 95 |
| Coverage | 93.7% |

**Missing frontmatter by directory (95 total):**

| Directory | Missing |
|---|---|
| `docs/superpowers/` | 50 |
| `docs/engines/` | 25 |
| `docs/design/` | 10 |
| `docs/architecture/` | 5 |
| `docs/research/` | 3 |
| `docs/journeys/` | 1 |
| `docs/leadGen/` | 1 |
| `docs/archive/` | 1 |

**Of the 1434 files WITH frontmatter — missing required fields:**

| Required field | Files missing it |
|---|---|
| `module:` | 491 (34.2%) |
| `tags:` | 239 (16.7%) |
| `created:` | 83 (5.8%) |
| `updated:` | 60 (4.2%) |
| `status:` | 46 (3.2%) |
| `title:` | 5 (0.3%) |

Files with frontmatter but at least one missing field: **533** (37.2% of those with frontmatter).

The `module:` field is almost never populated outside of well-structured ADR and journey files. Most `docs/learnings/`, `docs/decisions/`, and `docs/reference/` files lack it entirely.

---

## Stale `updated:` files (>60 days — top 20)

All 128 stale files have `updated:` earlier than 2026-03-03. Clusters:

| Path | Updated |
|---|---|
| `docs/decisions/0001-use-turborepo-pnpm.md` | 2026-02-24 |
| `docs/decisions/0002-state-vs-hooks.md` | 2026-02-24 |
| `docs/decisions/0003-shadcn-integration.md` | 2026-02-24 |
| `docs/decisions/0004-unified-telemetry-engine.md` | 2026-02-24 |
| `docs/decisions/0007-dashboard-architecture.md` | 2026-02-24 |
| `docs/decisions/0005-testing-infrastructure.md` | 2026-02-27 |
| `docs/decisions/0006-secrets-and-environment.md` | 2026-02-27 |
| `docs/decisions/0009-tailwind-v4-css-config.md` | 2026-02-27 |
| `docs/decisions/0010-ai-sdk-openrouter.md` | 2026-02-27 |
| `docs/decisions/0011-user-identity-table-naming.md` | 2026-02-27 |
| `docs/decisions/0012-subscription-on-company.md` | 2026-02-27 |
| `docs/decisions/0013-database-types-generation.md` | 2026-02-27 |
| `docs/decisions/0015-bubble-rebuild-strategy.md` | 2026-02-27 |
| `docs/decisions/0016-services-directory.md` | 2026-02-27 |
| `docs/decisions/0018-tanstack-table-recharts-platform-admin.md` | 2026-02-27 |
| `docs/User Manual/INDEX.md` | 2026-02-28 |
| `docs/User Manual/nb/01-kom-i-gang.md` | 2026-02-28 |
| `docs/User Manual/nb/02-onboarding.md` | 2026-02-28 |
| `docs/User Manual/nb/03-vaktplan.md` | 2026-02-28 |
| `docs/User Manual/nb/04-ansatte.md` | 2026-02-28 |

**Assessment:** The early ADRs (0001-0018) are legitimately "written once, never touched" — their stale `updated:` is expected for immutable historical decisions. The `docs/User Manual/` cluster (5 files) is more concerning as these are user-facing docs that should track product evolution.

---

## Critical paths affected

1. **i18n non-adoption is the primary risk.** The infrastructure exists but ~90% of UI strings bypass it. This means any future locale switch (e.g. Swedish or English client) requires touching hundreds of files. The most critical paths: `schedule/page.tsx` (1568 lines, 2 hardcoded labels), `DashboardShell.tsx` (1680+ lines, 2 hardcoded labels), `invite-member-dialog.tsx` (1058 lines, multiple role labels).

2. **No lint enforcement.** There is no ESLint rule blocking hardcoded Norwegian strings. The `common.json` already has `save`, `cancel`, `delete`, `confirm`, `back` defined — zero adoption in the 30+ files above. A `no-hardcoded-strings` lint rule or at minimum an eslint `no-restricted-syntax` rule would close this gap structurally.

3. **`module:` field absence is systemic.** 491 files missing it suggests it was added to the frontmatter spec after the majority of docs were written. Not a critical runtime risk but degrades semantic searchability and doc-index tooling.

4. **`docs/superpowers/` is the worst frontmatter offender** (50 of 95 no-frontmatter files). These are active plan and spec files — the ones most likely to be read by agents. Missing frontmatter means no status, no module, no searchable tags.
