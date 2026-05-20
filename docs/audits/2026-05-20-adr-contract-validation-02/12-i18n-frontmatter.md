---
title: Slice 12 — i18n + Frontmatter Audit (audit-02, post-PR-#432)
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, i18n, frontmatter, docs, convention]
---

# Slice 12 — i18n + Frontmatter Audit

**Date:** 2026-05-20 (second run, post-PR-#431 + #432)
**Scope:** `apps/web/src/**/*.tsx` (i18n), `docs/**/*.md` (frontmatter)
**Method:** Full-corpus grep counts + targeted spot-checks + delta against same-day pre-PR baseline
**Baseline:** `docs/audits/2026-05-20-adr-contract-validation/12-i18n-frontmatter.md` (pre-PR-#431/#432)

---

## Summary

1. **F-01 (HIGH, MAJOR IMPROVEMENT)** — Files with æøå and zero `t()` calls dropped from **376 → 90** (−286). Campaign/ui-shell-followup i18n sweep (H3/H4, ADR-0366 sortier) landed via PR #431 and accounts for the bulk of the movement. 90 files remain fully un-migrated; 30 of these have ≥6 hardcoded Norwegian strings in rendered JSX.
2. **F-02 (MEDIUM, UNCHANGED)** — Three specific surfaces still carry hardcoded Norwegian: `reset-password/page.tsx` (2 rendered strings, no auth.json keys), `proposed-plan/page.tsx` (Next.js metadata, 2 lines), `WebDayControl.tsx` (`NORWEGIAN_DAYS` constant, not migrated). `DashboardShell.tsx` lines 161+201 remain AI-prompt strings (non-rendered — borderline acceptable).
3. **F-03 (LOW, UNCHANGED)** — `docs/superpowers/plans/` pattern persists: 56 of 187 files in `docs/superpowers/` have no frontmatter at all. No remediation since baseline.
4. **F-04 (LOW, +6 NEW)** — 6 new docs created since baseline (audit-02 slices + ADR-0248 amendment) are missing `module:` field. Total missing-module corpus unchanged at ~729.
5. **F-05 (LOW, UNCHANGED)** — `docs/handoffs/HANDOFF-mobile-addsheet-booking-stack.md` carries `updated: 2026-05-24` — a future date. 15 docs have stale `updated:` (committed after the date in the field), with `docs/decisions/0000-decision-log.md` being the highest-visibility case (`updated: 2026-05-16`, last touched 2026-05-20 by ADR-0378 commit).
6. **F-06 (INFO, UNCHANGED)** — No ESLint rule for hardcoded Norwegian strings exists. `packages/eslint-config/plugins/smartout/` has 3 rules (no-direct-supabase-write, no-gated-write-in-capabilities, no-empty-string-identifier-fallback) — none targeting i18n. Recommended in baseline; still absent.

---

## Findings Table

| ID | Severity | File:line | Rule | Evidence |
|----|----------|-----------|------|----------|
| F-01 | HIGH | `apps/web/src/**/*.tsx` (90 files) | CLAUDE.md §i18n | 90 files contain æøå with zero `t()` calls; down from 376 pre-PR-#431. Campaign H3/H4 sweep landed. Top offenders: `CockpitActionRail.tsx` (12 lines), `ai/config/page.tsx` (12 lines), `__density-sandbox/page.tsx` (11 lines), `LonnsgrunnlagViewer.tsx` (10 lines) |
| F-02a | MEDIUM | `apps/web/src/app/reset-password/page.tsx:71,115` | CLAUDE.md §i18n | "Hvis kontoen finnes…" + "Vi sender deg en lenke…" hardcoded in rendered JSX; `auth.json` has no reset-password keys. Pre-existing from prior slice; today's auth fixes did NOT address i18n |
| F-02b | MEDIUM | `apps/web/src/app/dashboard/schedule/proposed-plan/page.tsx:23-24` | CLAUDE.md §i18n | `metadata.title` "Foreslått plan" + `metadata.description` hardcoded Norwegian — Next.js metadata object, not i18n-able via `t()`, but inconsistent with other pages |
| F-02c | MEDIUM | `apps/web/src/components/day/WebDayControl.tsx:57` | CLAUDE.md §i18n | `NORWEGIAN_DAYS = ["Søndag","Mandag",…]` constant hardcoded; 7 `t()` calls present in same file but this date-locale array unresolved — should use `Intl.DateTimeFormat` with locale or i18n keys |
| F-02d | LOW | `apps/web/src/components/dashboard/DashboardShell.tsx:161,201` | CLAUDE.md §i18n | Norwegian strings are AI system-prompt content (not rendered UI); line 1919 is a JSX doc comment. Technically in violation but semantically acceptable — recommend documenting as intentional exception |
| F-03 | LOW | `docs/superpowers/plans/2026-05-19-sm-*.md` (+ 46 older) | CLAUDE.md §frontmatter | 56 of 187 files in `docs/superpowers/` have no frontmatter at all. Pattern: plan files in this subdirectory are created without YAML headers. No new batch since baseline but no remediation either |
| F-04 | LOW | `docs/decisions/0248-*.md`, `docs/audits/2026-05-20-adr-contract-validation-02/02,05,06,09,11-*.md` | CLAUDE.md §frontmatter | 6 docs created since baseline are missing `module:` field. Audit slice files are the main contributor (5 of 6) — audit doc template does not include `module:` |
| F-05a | LOW | `docs/handoffs/HANDOFF-mobile-addsheet-booking-stack.md` | CLAUDE.md §frontmatter | `updated: 2026-05-24` — future date. Likely pre-dated to anticipated delivery. |
| F-05b | LOW | `docs/decisions/0000-decision-log.md` | CLAUDE.md §frontmatter | `updated: 2026-05-16` but file was last committed 2026-05-20 (ADR-0378 registration). Highest-visibility stale-updated instance. 14 additional files in same class (handoffs, plans, journeys). |
| F-06 | INFO | `packages/eslint-config/plugins/smartout/` | CLAUDE.md §i18n | No ESLint rule for hardcoded Norwegian strings. Recommended by baseline to mirror the empty-string-identifier-fallback rule pattern. 2 days without action; same gap that allowed the 376-file backlog to accumulate silently. |

---

## Delta vs Same-Day Baseline (pre-PR-#431/#432)

| Metric | Baseline (pre-PR) | Now (post-PR) | Delta |
|--------|-------------------|---------------|-------|
| Total .tsx files (apps/web/src) | 1 280 | 1 281 | +1 |
| .tsx files with æøå | 420 | 420 | 0 |
| .tsx files with æøå AND `t()` | 44 | 330 | **+286** |
| .tsx files with æøå AND zero `t()` | **376** | **90** | **−286** |
| reset-password hardcoded lines | 2 | 2 | 0 (unresolved) |
| WebDayControl NORWEGIAN_DAYS | present | present | 0 (unresolved) |
| Total docs .md files | 2 999 | 3 010 | +11 |
| Docs with no frontmatter | 114 | 113 | −1 |
| Docs with stale `updated:` (since 2026-05-18) | ~10 | 15 | +5 |
| ESLint i18n rule | absent | absent | 0 |
| `docs/superpowers/` files without frontmatter | 56 | 56 | 0 |

**Net verdict:** Significant progress on F-01 corpus — campaign PR #431 moved 286 files from zero coverage to partial coverage. The 90 remaining files are the stubborn tail: 30 have ≥6 rendered Norwegian strings and represent genuine HIGH backlog. Three specific medium-severity surfaces (reset-password, proposed-plan metadata, NORWEGIAN_DAYS) remain verbatim from the prior baseline. Frontmatter discipline is flat: audit-02 slice files themselves are introducing the `module:` gap. ESLint enforcement still absent.

---

## Per-Convention Rollup

This slice is convention-check (CLAUDE.md rules), not ADR-gated.

| Convention | Compliant | Partial | Violation |
|------------|-----------|---------|-----------|
| i18n: no hardcoded Norwegian in rendered JSX | 1 191 files | 330 files | 90 files |
| Docs: frontmatter present | 2 897 docs | — | 113 docs |
| Docs: all 6 required fields (incl. `module:`) | sample-estimated ~2 270 | — | ~740 |
| Docs: `updated:` current at commit date | 2 995 docs | — | 15 docs |
| ESLint i18n enforcement | absent | — | — |

---

## Verified Intentional

- `DashboardShell.tsx:161,201` — AI system-prompt strings, not rendered UI. Not a user-visible i18n violation. Recommend annotating with `// i18n-exempt: AI prompt content` per L-0083 precedent.
- `apps/web/src/app/dashboard/schedule/__density-sandbox/page.tsx` — density sandbox is a dev-only route; Norwegian acceptable in prototype code.
- `proposed-plan/page.tsx` metadata — Next.js `export const metadata` object cannot use React hooks (`t()`). Pattern is consistent with other Next.js metadata objects in the codebase. Recommend documenting as structural exception.

---

## In-Progress / Owned

- F-01 remediation: `campaign/ui-shell-followup` owns the remaining 90-file sweep (per baseline forward plan). 286-file progress validates the campaign is executing. Next milestone: reduce to <30 files.
- F-06 ESLint rule: Recommended by baseline as mandatory before sweep #3 to prevent re-accumulation. No owner assigned.
- Stale `updated:` fields: Recurring pattern across handoff + plan + journey files committed in sub-sortie batches. Root cause: authors write `updated:` to reflect intended date, not commit date. No tooling enforcement.

---

## Top 3 Findings

1. **F-01 (HIGH)** — 90 files, æøå + zero `t()`. Campaign sweep landed (−286) but 90 remain; 30 with ≥6 rendered strings. Campaign/ui-shell-followup is the active owner. Blocker for F-06: ESLint rule must ship before sweep #3.
2. **F-02a (MEDIUM)** — `reset-password/page.tsx:71,115` — two rendered Norwegian strings, zero auth.json keys. Small fix (<1 hour), not owned by any campaign.
3. **F-05b (LOW)** — `docs/decisions/0000-decision-log.md` stale `updated:` (2026-05-16, committed 2026-05-20). Highest-visibility instance of a 15-file pattern. No tooling enforces `updated:` sync on commit.
