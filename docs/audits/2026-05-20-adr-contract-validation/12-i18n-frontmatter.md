---
title: Slice 12 — i18n + Frontmatter Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, i18n, frontmatter, docs, convention]
---

# Slice 12 — i18n + Frontmatter Audit

**Date:** 2026-05-20  
**Scope:** `apps/web/src/**/*.tsx` (i18n), `docs/**/*.md` (frontmatter)  
**Method:** Full-corpus grep counts + targeted spot-checks on baseline violations + new-since-baseline delta  
**Baseline:** 2026-05-18 run (378 i18n violating files, 3 critical surfaces, 108 no-FM docs)

---

## Summary

1. **F-01 (HIGH)** — 376 .tsx files contain Norwegian text with zero `t()` calls; down 2 from baseline (378). No material progress — enforcement gap persists.
2. **F-02 (MEDIUM, partial improvement)** — DashboardShell and WebDayControl partially migrated since baseline (0 → 14 `t()` calls each); residual Norwegian chars remain but are non-rendered (AI prompt strings, JSX comment). Login page is now fully clean (0 Norwegian chars).
3. **F-03 (MEDIUM)** — 5 new plan files under `docs/superpowers/plans/` added without frontmatter since baseline. Pattern: plan files in this path never receive frontmatter.
4. **F-04 (LOW)** — 47 new docs since baseline missing `module:` field (total corpus: ~729 missing). No backfill occurred.
5. **F-05 (NEW, LOW)** — `apps/web/src/app/reset-password/page.tsx` modified 2026-05-20 with hardcoded Norwegian in rendered JSX; auth.json has no reset-password keys.

---

## Findings Table

| ID | Severity | File:line | ADR/Rule | Evidence |
|----|----------|-----------|----------|----------|
| F-01 | HIGH | `apps/web/src/**/*.tsx` (376 files) | CLAUDE.md §i18n | 376 files contain æøå with zero `t()` calls; corpus-wide enforcement gap unchanged |
| F-02a | MEDIUM | `apps/web/src/components/dashboard/DashboardShell.tsx:161,201` | CLAUDE.md §i18n | Norwegian strings at lines 161+201 are AI-system-prompt strings (not rendered UI); line 1919 is a JSX doc comment — borderline acceptable but technically violates rule |
| F-02b | MEDIUM | `apps/web/src/components/dashboard/ReconciliationView.tsx:63,142,197,217,256,327,692` | CLAUDE.md §i18n | 7 Norwegian chars remain; 2 `t()` calls exist (partial migration) — toast.error/success + label text still hardcoded |
| F-02c | MEDIUM | `apps/web/src/app/dashboard/schedule/proposed-plan/page.tsx:23-24` | CLAUDE.md §i18n | `metadata.title` and `metadata.description` hardcoded Norwegian (Next.js metadata, not i18n-able via `t()` — but pattern is inconsistent with other pages) |
| F-03 | MEDIUM | `apps/web/src/components/day/WebDayControl.tsx:57` | CLAUDE.md §i18n | `NORWEGIAN_DAYS` constant still hardcoded; 7 `t()` calls present but this date-locale array not migrated |
| F-04 | MEDIUM | `apps/web/src/app/reset-password/page.tsx:71,115` | CLAUDE.md §i18n | New file modified 2026-05-20; "Hvis kontoen finnes…" + "Vi sender deg en lenke…" hardcoded in rendered JSX; `auth.json` has no reset-password keys |
| F-05 | LOW | `docs/superpowers/plans/2026-05-19-sm-*.md` (5 files) | CLAUDE.md §frontmatter | 5 new plan files (2026-05-19) added without YAML frontmatter; pattern repeated from baseline |
| F-06 | LOW | `docs/learnings/0303-*.md`, `0280-*.md`, `0304-*.md` etc. (47 files) | CLAUDE.md §frontmatter | 47 new docs since baseline missing `module:` field; no backfill progress on existing 682 |
| F-07 | LOW | `docs/handoffs/HANDOFF-mobile-addsheet-booking-stack.md` | CLAUDE.md §frontmatter | `updated: 2026-05-24` is a future date (today is 2026-05-20); pre-dated anticipated delivery |
| F-08 | INFO | `packages/eslint-config/` | CLAUDE.md §i18n | No ESLint rule for hardcoded strings enforced; baseline recommended adding one; still absent 2 days later |

---

## Delta vs Baseline (2026-05-18)

| Metric | Baseline | Today | Delta |
|--------|----------|-------|-------|
| Total .tsx files | 1 248 | 1 280 | +32 |
| Files with Norwegian chars | 420 | 420 | 0 |
| Files using `t()` | 183 | 195 | +12 |
| Files with æøå AND `t()` | 42 | 44 | +2 |
| Files with æøå AND no `t()` | **378** | **376** | **-2** |
| DashboardShell `t()` calls | 0 | 14 | +14 (partial fix) |
| DashboardShell Norwegian chars | many | 3 | improved |
| Login page Norwegian chars | 10+ | 0 | **RESOLVED** |
| WebDayControl Norwegian chars | many | 1 | improved |
| Total docs .md files | 2 936 | 2 999 | +63 |
| Docs with no frontmatter | 108 | 114 | +6 |
| Docs missing `module:` field | ~2 800 | ~729 with FM | gap narrowed slightly |

**Net verdict:** Marginal improvement. Login page fully resolved. DashboardShell + WebDayControl partially migrated. 376 files (vs 378) still fully un-migrated — no systematic progress. One new violation added (reset-password). ESLint enforcement recommended in baseline not shipped.

---

## Per-ADR Rollup

This slice is convention-check (CLAUDE.md), not ADR-gated. No numbered ADRs in scope.

| Convention | Compliant | Partial | Violation |
|------------|-----------|---------|-----------|
| i18n: no hardcoded Norwegian in rendered JSX | 844 files | 44 files | 376 files |
| Docs: frontmatter present | 2 885 docs | — | 114 docs |
| Docs: all 6 fields incl. module: | ~2 270 docs | — | ~729 docs |
| Docs: updated: not future-dated | 2 995 docs | — | 4 docs |

---

## Verified Intentional

- **DashboardShell:161,201** — Norwegian strings are AI system-prompt context objects passed to Botsson (not rendered UI text). These are arguably outside the i18n mandate (LLM instructions, not user-facing strings). However, they are not documented as intentional in any ADR. Flagged as MEDIUM pending clarification — if confirmed intentional, should be documented.
- **WebDayControl:57 NORWEGIAN_DAYS** — date-locale constant; technically violates the rule but the question is whether a locale-bound date array should come from i18n keys or Intl.DateTimeFormat. Not currently documented as exception. Left as MEDIUM.
- **proposed-plan metadata** — Next.js `export const metadata` fields cannot use `t()` (RSC limitation). Pattern is widespread. Low actionability.

---

## In-Progress (Mid-Campaign)

The following files are in active campaign worktrees and should not be counted as violations:

- All 8 active campaigns noted in orchestrator brief. No specific overlap found with the 376-file i18n backlog — the backlog predates all campaigns. New files added by campaigns (hms/layout.tsx, CalendarPageShell.tsx, PoliciesPageClient.tsx, schedule/layout.tsx) all fall into the existing violation corpus but were added before or during campaigns — not new regressions introduced by campaigns.
- `docs/superpowers/plans/2026-05-19-sm-*.md` — these may be campaign plan files. Severity LOW maintained regardless.
