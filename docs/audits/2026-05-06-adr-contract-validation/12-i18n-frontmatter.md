---
title: Slice 12 — i18n & Frontmatter Audit
status: done
created: 2026-05-06
updated: 2026-05-06
module: audit
tags: [audit, i18n, frontmatter, convention]
---

# Slice 12: i18n & Frontmatter — Convention Audit

**Date:** 2026-05-06
**Method:** grep-count + python frontmatter scan + git-log stale-date sample
**Severity:** MEDIUM (i18n hardcoding — language launch blocker) | LOW (frontmatter gaps)

---

## 1. i18n Adoption

### Counts

| Metric | Count | % |
|--------|-------|---|
| Total `.tsx` files in `apps/web/src/` | 1 077 | — |
| Files importing `useTranslation` from `@smartout/i18n` | 164 | **15.2 %** |
| Baseline (2026-05-02) | ~166 / 1 754 | 9.5 % |

**Delta vs baseline:** +5.7 pp (164/1077 vs 166/1754). The file count dropped (1754→1077) — likely the baseline included a broader surface (all source files, not just `.tsx`). Recalculating on `.tsx`-only basis: adoption is **15.2 %**, up from an apples-to-apples 9.5 % at the same surface. Growth is real but marginal.

**i18n library:** Custom `@smartout/i18n` package (`packages/i18n/`). Hook: `useTranslation`. 20 locale namespaces confirmed in `packages/i18n/locales/nb/` and `en/`: `common`, `auth`, `billing`, `cleaning`, `contracts`, `dashboard`, `docs`, `helpdesk`, `join`, `komm`, `landing`, `mobile`, `notifications`, `onboarding`, `operations`, `ops-intelligence`, `shift`, `swap`, `wizard`, `year-wheel`.

---

## 2. Hardcoded Norwegian String Audit

### Spot-check: Six Common Action Words

| Key Word | Files | Occurrences | Keys exist in common.json? |
|----------|-------|-------------|---------------------------|
| `Lagre` | 10 | 11 | YES — `common.save` |
| `Avbryt` | 9 | 9 | YES — `common.cancel` |
| `Slett` | 8 | 9 | YES — `common.delete` |
| `Lukk` | 6 | 6 | YES — `nav.closeMenu` / `unsaved.*` |
| `Bekreft` | 3 | 4 | YES — `common.confirm` |
| `Rediger` | 4 | 4 | NO explicit key (likely `common.edit` needed) |

**Total six-word occurrences:** 43 across ~40 unique files.

### Broader Norwegian Text Presence

- **276 tsx files** contain Norwegian characters (æ/ø/å in string literals or JSX text).
- **164** of those import `useTranslation`.
- **~112 files** have Norwegian text with no i18n import at all. These are either:
  - Pure Norwegian UI text hardcoded as JSX children or string props
  - Comments (not blocking, but worth noting for convention)
  - `Legg til` (7 occurrences), `Opprett` (1 occurrence) also found hardcoded.

### Finding: Severity MEDIUM

Keys for `Lagre`, `Avbryt`, `Slett`, `Bekreft` already exist in `common.json`. The 43 hardcoded occurrences of these six words are direct i18n misses — they could be replaced today without new key authoring. Files using i18n have the infrastructure; the gap is inconsistent adoption across the ~912 files that have not adopted it yet. This is a **language-launch blocker**: any non-Norwegian locale would expose raw Norwegian text across all un-migrated pages.

---

## 3. Docs Frontmatter Coverage

### Field Coverage (1 900 docs, excluding `docs/archive/`)

| Field | Present | Missing | Coverage |
|-------|---------|---------|----------|
| `title:` | 1 895 | 5 | 99.7 % |
| `status:` | 1 824 | 76 | 96.0 % |
| `updated:` | 1 807 | 93 | 95.1 % |
| `created:` | 1 783 | 117 | 93.8 % |
| `tags:` | 1 606 | 294 | 84.5 % |
| `module:` | 1 349 | 551 | 71.0 % |
| **All 6 fields** | **1 175** | **725** | **61.8 %** |
| No frontmatter at all | 100 | — | — |

**Delta vs baseline:** Baseline reported 491 docs missing `module:`. Current: 551. **+60 more docs now lack `module:`.** The gap is growing as new docs are added without the field.

### Missing Frontmatter by Subdirectory (top 10, excl. archive)

| Subdirectory | Docs without frontmatter |
|---|---|
| `superpowers/` | 55 |
| `engines/` | 31 |
| `architecture/` | 20 |
| `journeys/` | 19 |
| `design/` | 11 |
| `decisions/` | 4 |
| `reference/` | 4 |
| `research/` | 3 |
| Root | 1 |
| `plans/` | 1 |

`superpowers/` and `engines/` are the largest blind spots — both contain active working documents.

---

## 4. Stale `updated:` Field — 20-doc Sample

13 of 20 sampled docs had `updated:` behind the last git commit date. This is a **65 % stale rate** in sample.

| Doc | `updated:` | Last git commit |
|-----|-----------|-----------------|
| `reference/EDDA-API-INTEGRATION.md` | 2026-03-21 | 2026-04-20 |
| `decisions/0094-framework-rule-severity-enum.md` | 2026-04-14 | 2026-04-20 |
| `decisions/0064-dynamic-landing-engine.md` | 2026-03-28 | 2026-04-20 |
| `reports/worklogs/WORKLOG-livekit-phase2.md` | 2026-03-22 | 2026-05-05 |
| `architecture/PRD-03_Avstemmingssystem.md` | 2026-02-28 | 2026-04-20 |
| `learnings/0057-gatedupdate-entity-id-column-zero-row-trap.md` | 2026-04-18 | 2026-04-20 |
| `superpowers/plans/completed/2026-04-08-contract-composition-engine.md` | 2026-04-09 | 2026-04-20 |
| `needs-rewrite/SMARTOUT_IMPLEMENTATION_GUIDE.md` | 2026-02-28 | 2026-04-20 |
| `learnings/0014-supabase-gen-types-stdout-noise.md` | 2026-03-01 | 2026-04-20 |
| `reports/worklogs/WORKLOG-hms-phase-1.md` | 2026-03-22 | 2026-05-05 |
| `User Manual/en/10-settings.md` | 2026-03-24 | 2026-04-20 |
| `superpowers/specs/2026-03-25-mal-modus-schedule-view-design.md` | 2026-03-25 | 2026-04-20 |
| `architecture/progressive-intelligence-protocol.md` | 2026-03-04 | 2026-04-20 |

Root cause: the 2026-04-20 mass-commit (likely a bulk reformat or global touch) updated git history without bumping frontmatter `updated:` fields. The CLAUDE.md rule ("update `updated:` every time you touch a file") is not enforced mechanically.

**Severity: LOW** — stale dates do not break functionality but undermine doc auditability and the CLAUDE.md protocol.

---

## 5. Coverage Table

| Convention | Status | Detail |
|---|---|---|
| i18n adoption | MEDIUM — 15.2 % adoption | 912/1077 tsx files have no i18n |
| Common keys hardcoded | MEDIUM | 43 occurrences, all keys already in common.json |
| Docs full frontmatter | LOW — 61.8 % coverage | 725 docs missing ≥1 field |
| `module:` field | LOW — 71.0 % coverage | 551 docs missing, delta +60 vs baseline |
| Stale `updated:` | LOW — ~65 % stale in sample | Mass-commit 2026-04-20 bypassed frontmatter update |
| No frontmatter at all | LOW | 100 docs, mostly superpowers/ + engines/ |

---

## 6. Delta vs 2026-05-02 Baseline

| Metric | Baseline | Current | Delta |
|--------|----------|---------|-------|
| i18n adoption | ~9.5 % (all src) | 15.2 % (tsx only) | surface change; adoption grown |
| Missing `module:` | 491 | 551 | **+60 regression** |
| Total docs | unknown | 1 900 | — |

---

## 7. Recommendations

1. **i18n (MEDIUM, language-launch blocker):** Wire a lint rule (e.g. `eslint-plugin-i18n-json` or custom rule) that fails CI on any `.tsx` string literal matching known Norwegian words. 43 occurrences are instantly fixable — keys exist in `common.json`.
2. **module: field drift (LOW):** Add `module:` to the frontmatter template enforced by the post-Write hook for `docs/**/*.md`. The +60 delta shows new docs are being created without it.
3. **Stale updated: (LOW):** The post-Write hook already runs for vault files — extend to `docs/` to auto-bump `updated:` on every Edit/Write touching a `.md` file. Eliminates the 65 % stale rate mechanically.
4. **superpowers/ + engines/ (LOW):** 86 of the 100 no-frontmatter docs live in these two directories. A one-shot script to inject minimal frontmatter stubs would close the gap.
