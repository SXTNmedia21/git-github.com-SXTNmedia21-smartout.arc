---
title: "Slice 12 — i18n + Frontmatter Audit"
status: done
created: 2026-05-18
updated: 2026-05-18
module: audit
tags: [audit, i18n, frontmatter, docs, convention]
---

# Slice 12 — i18n + Frontmatter Audit

**Date:** 2026-05-18  
**Scope:** `apps/web/src/**/*.tsx` (i18n), `docs/**/*.md` (frontmatter)  
**Method:** 20-file random sample + broad grep counts + 5 high-traffic spot-checks  

---

## 1. i18n — Hardcoded Norwegian Text

### Counts

| Metric | Value |
|---|---|
| Total `.tsx` files | 1 248 |
| Files containing Norwegian characters (æøå) | **420 (33 %)** |
| Files using `useTranslation` / `t()` | 183 (15 %) |
| Files with Norwegian chars AND using `t()` | **42 of 420 (10 %)** |
| Files with Norwegian chars AND no i18n at all | **378 (90 % of violators)** |

**Violation rate in 20-file random sample:** 3 / 20 files had hardcoded Norwegian in JSX text positions (15 %).

### High-Traffic Spot-Check

| Surface | File | Status |
|---|---|---|
| DashboardShell | `components/dashboard/DashboardShell.tsx` | FAIL — 0 `t()` calls; "Årshjul", "Min lønn", "Å gjøre", "Søk i drift…" hardcoded |
| WebDayControl | `components/day/WebDayControl.tsx` | FAIL — 0 `t()` calls; NORWEGIAN_DAYS array, toast strings, label strings hardcoded |
| Login page | `app/login/page.tsx` | FAIL — 0 `t()` calls; 10+ UI strings hardcoded ("Logg inn", error messages, nav copy) |
| TimelineTab | `components/day/tabs/TimelineTab.tsx` | PASS — no Norwegian characters found |
| Join wizard | `app/join/page.tsx` | PASS — no Norwegian characters found |

### Notable Violations (sample)

- `DashboardShell.tsx:1886` — `<ListChecks />Å gjøre` in rendered JSX
- `DashboardShell.tsx:1749` — `<span>Søk i drift...</span>` in rendered JSX
- `ReconciliationView.tsx:142,197,327` — toast.error/success strings + rendered label text ("I går", "godkjent og låst", "godkjent eller håndtert") — partially migrated (2 `t()` calls present, 7 Norwegian chars remain)
- `schedule/proposed-plan/page.tsx:23-24` — metadata `title` and `description` fields hardcoded Norwegian
- `WebDayControl.tsx:56` — `const NORWEGIAN_DAYS = ["Søndag"…]` constant (format utility, borderline acceptable if date-locale, but string data should come from i18n)

### i18n Infrastructure

`packages/i18n` is fully operational: English (`en/`) and Norwegian Bokmål (`nb/`) locale JSON files exist across 20 namespaces. The system is ready — the adoption gap is call-site discipline, not infrastructure.

---

## 2. Frontmatter — docs/*.md

### Counts (2 936 total .md files)

| Metric | Value |
|---|---|
| Files with NO frontmatter at all | **108 (3.7 %)** |
| Files with frontmatter but missing `module:` field | **2 831 (96 %)** |
| Sample (200 files): fully conformant (all 6 fields) | **169 / 200 (84.5 %)** |
| Template placeholder `YYYY-MM-DD` in updated field | Present in `docs/templates/` — acceptable |
| Future `updated:` dates (beyond 2026-05-18) | **3 files** — `JOURNEY-audit-fsc04-*.md` dated 2026-06-10 |

### Missing Frontmatter (no-FM) — Sample

Concentrated in older/non-standard paths:
- `docs/research/` — 3+ files with no frontmatter
- `docs/architecture/` — several old PRD files (`SMARTOUT_TIPS_*.md`, `SMARTOUT_TIPS_ARCHITECURE.md`)
- `docs/superpowers/plans/` — most 2026-04 plans lack frontmatter
- `docs/design/` — `smartout-design-system/README.md`, `mobile-layout.md`

### Partial Frontmatter — `module:` Field

The `module:` field is missing from the vast majority of docs with frontmatter. Affected doc categories in sample:
- ADRs (`docs/decisions/`) — `module:` and `tags:` consistently absent
- User Manual files — `module:` absent
- Architecture docs — `module:` absent
- Learnings (`docs/learnings/`) — `module:` absent

**CLAUDE.md mandates all 6 fields** (title, status, updated, created, module, tags). The `module:` field appears to have been added to the protocol after most docs were written and was never backfilled.

### `updated:` Staleness

- Oldest dates: 2026-02-24 (first ADRs — never updated since creation, expected for immutable ADRs)
- Most recent: 2026-05-18 (today)
- 3 files with **future dates** (2026-06-10): `JOURNEY-audit-fsc04-day-control-widgets-no-direct-db-access.md`, `JOURNEY-audit-fsc04-event-detail-deviation-via-server-action.md`, `JOURNEY-audit-fsc04-oversikt-tab-duty-leader-via-server-action.md` — these are pre-dated anticipated deliverables; low risk but technically violates the "current" requirement.

---

## 3. Findings Summary

| # | Finding | Severity | Count |
|---|---|---|---|
| F-01 | Hardcoded Norwegian text in `.tsx` with no i18n at all | HIGH | ~378 files |
| F-02 | DashboardShell, WebDayControl, Login page fully un-migrated | HIGH | 3 critical surfaces |
| F-03 | `module:` field missing from the overwhelming majority of docs with frontmatter | MEDIUM | ~2 800 files |
| F-04 | 108 docs with no frontmatter at all | MEDIUM | 108 files |
| F-05 | 3 JOURNEY docs with future `updated:` date (2026-06-10) | LOW | 3 files |
| F-06 | `ReconciliationView` partially migrated — mixed i18n + hardcoded | LOW | 1 file |

---

## 4. Recommendations

**F-01/F-02 (i18n):** The 183 files that already use `t()` show the pattern is established. The 378-file gap is a migration backlog, not a system problem. Priority order: (1) DashboardShell — highest visibility, 0 i18n; (2) Login page — entry point; (3) WebDayControl — operational surface. Each is a contained sortie. No new infrastructure needed.

**F-03 (module: field):** The `module:` field requirement appears aspirational — backfilling 2 800 files is not feasible manually. Recommend either: (a) treat `module:` as optional/best-effort for non-module docs (ADRs, plans, journeys) and only enforce on `docs/modules/**`, or (b) run a bulk-fill script using path-derived module names. Do not block on this.

**F-04 (no frontmatter):** 108 files — concentrated in `docs/research/`, `docs/superpowers/plans/`, `docs/design/`. These are lower-governance paths. Bulk-add minimal frontmatter as a chore commit.

**F-05 (future dates):** Update `JOURNEY-audit-fsc04-*.md` timestamps to 2026-05-18.
