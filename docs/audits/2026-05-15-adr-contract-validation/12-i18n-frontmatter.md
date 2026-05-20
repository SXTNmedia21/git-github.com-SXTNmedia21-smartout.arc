---
title: Slice 12 — i18n Adoption + Frontmatter Coverage Audit
status: done
updated: 2026-05-15
created: 2026-05-15
module: audit
tags: [audit, i18n, frontmatter, convention]
---

# Slice 12 — i18n Adoption + Frontmatter Coverage

**Audited:** 2026-05-15 | Branch: development HEAD | Scope: `apps/web/src/app/dashboard/**/*.tsx` + `docs/**/*.md`

---

## Summary

| Metric | Value | Severity |
|--------|-------|----------|
| i18n adoption (t() vs hardcoded NO strings) | **76.1%** | MEDIUM |
| Hardcoded Norwegian strings in dashboard | **412** | MEDIUM |
| Hardcoded Norwegian toasts specifically | **35** | MEDIUM |
| Files with any i18n import | 119 / 569 (20.9%) | HIGH |
| Frontmatter complete (all 6 fields) | 1690 / 2512 (67.3%) | MEDIUM |
| Frontmatter missing entirely | 108 / 2512 (4.3%) | LOW |
| Frontmatter incomplete (partial fields) | 714 / 2512 (28.4%) | MEDIUM |
| Stale `updated:` in recently-changed docs | 20+ | LOW |

---

## Findings Table

| # | Area | Finding | Severity | Count |
|---|------|---------|----------|-------|
| F-01 | i18n | Hardcoded Norwegian strings in dashboard (non-toast) | MEDIUM | 381 |
| F-02 | i18n | Hardcoded Norwegian toasts (`toast()` / `toast.*()`) | MEDIUM | 35 |
| F-03 | i18n | `@smartout/i18n` not imported in 450/569 dashboard files | HIGH | 450 |
| F-04 | Frontmatter | Files missing ALL frontmatter | LOW | 108 |
| F-05 | Frontmatter | Files with partial frontmatter (missing 1+ required fields) | MEDIUM | 714 |
| F-06 | Frontmatter | `module:` field most commonly missing field | MEDIUM | ~600+ |
| F-07 | Frontmatter | `docs/engines/**` agent/skill files have near-zero compliance | HIGH | ~20 |
| F-08 | Freshness | Recently-committed docs with `updated:` > 30 days stale | LOW | 20+ |

---

## i18n Adoption Rate

### Method

- **t() calls:** `grep -rn "\bt(" dashboard/**/*.tsx` → **1314 hits** (i18n-compliant strings)
- **Hardcoded Norwegian:** regex `[æøåÆØÅ]` in quoted strings, minus comments and `t()` wrappers → **412 hits**
- **Adoption ratio:** 1314 / (1314 + 412) = **76.1%** (up from 15% baseline — NOTE: baseline methodology likely differed; see Delta section)

### Breakdown by area

| Area | Hardcoded NO strings | Notes |
|------|---------------------|-------|
| payroll/[periodId]/_components/ | ~35 | Highest density; LineDrawer 16, LineOverrideModal 12 |
| settings/_components/ | ~25 | shift-types, salary-codes, supplement-rules, meal-rules |
| reconciliation/_components/ | ~16 | DayList 10, OversiktTab 6 |
| people/[id]/_components/ | ~16 | LonnsprofilSection 9, HrTabSections 7 |
| reports/_components/ | ~21 | TrainingSection 8, PeopleSection 7, OverviewSection 6 |
| komm/_components/ | ~11 | CreateChannel 11 |
| schedule/_components/ | ~10 | daily-briefing, marketplace, proposed-plan |

### i18n import coverage

Only **119 of 569** dashboard `.tsx` files import from `@smartout/i18n` (20.9%). The remaining 450 files either use no user-facing strings or hardcode Norwegian directly. The `t()` count (1314) concentrated in a small subset of files inflates the per-string ratio; per-file coverage is much lower.

### Sample hardcoded toasts (35 violations)

```
schedule/daily-briefing.tsx:1164         toast("Oppslag slettet")
schedule/day-control/MeldingerTab.tsx:150 toast("Oppslag slettet")
reconciliation/AdminOverrideDialog.tsx:53 toast.success("Oppgjør godkjent med overstyring. Loggført i revisjonslogg.")
reconciliation/DayDetail.tsx:123          toast.success("Dagen er låst")
payroll/ManualSupplementForm.tsx:182      toast.success("Lønnslinje lagt til.")
payroll/PeriodDetailClient.tsx:132        toast.success("Perioden er låst.")
website/SetupWizard.tsx:111               toast.error("Velg en mal for å fortsette")
year-wheel/year-wheel-page-client.tsx:132 toast.info("Klikk og dra i lerretet for å tegne en sesong.")
komm/CallRoom.tsx:278                     toast.info("Inviter medlem", { description: "Member-picker kommer snart." })
proposals/ProposalDetailClient.tsx:293    toast.success("Override godkjent. Recalc kjører.")
```

---

## Frontmatter Coverage

**Total docs files:** 2512 | **Scope:** `docs/**/*.md`

| Status | Count | % |
|--------|-------|---|
| Complete (all 6 fields) | 1690 | 67.3% |
| Incomplete (1–5 fields missing) | 714 | 28.4% |
| No frontmatter at all | 108 | 4.3% |

### Most-missing field: `module:`

Approximately 600+ files missing `module:`. This is the single highest-frequency gap, concentrated in:
- `docs/learnings/*.md` — nearly all 100+ files miss `module:`
- `docs/engines/**` — agent/skill files frequently missing all fields
- `docs/needs-rewrite/*.md` — all missing `module:`
- `docs/research/*.md` — all missing `module:`

### Files with no frontmatter at all (108)

Concentrated in:
- `docs/archive/` — legacy files, lower priority
- `docs/research/` — 3+ files (INVESTOR-RESEARCH.md, Connecteam-analyse, VIKTIGA-FUNKSJONER.md)
- `docs/BUILD_ORDER.md`
- `docs/engines/industri-inteligence/Lov-og-rett/agents/lovsen-agent/` — 4 agent files with no frontmatter

---

## Worst-Offender List

### i18n — Highest hardcoded NO string density

| File | Count |
|------|-------|
| `payroll/[periodId]/_components/LineDrawer.tsx` | 16 |
| `payroll/[periodId]/_components/LineOverrideModal.tsx` | 12 |
| `komm/_components/CreateChannel.tsx` | 11 |
| `settings/_components/shift-types-settings.tsx` | 10 |
| `reconciliation/_components/DayList.tsx` | 10 |
| `people/[id]/_components/LonnsprofilSection.tsx` | 9 |
| `ai/config/page.tsx` | 9 |
| `settings/_components/salary-codes-settings.tsx` | 8 |
| `reports/_components/TrainingSection.tsx` | 8 |
| `settings/_components/supplement-rules-settings.tsx` | 7 |

### Frontmatter — Worst by missing field count

| File | Missing fields |
|------|---------------|
| `docs/design/smartout-design-helpdesk/project/SKILL.md` | all 6 |
| `docs/engines/industri-inteligence/Lov-og-rett/agents/lovsen-agent/SKILL.CLASSIFYER.md` | all 6 |
| `docs/engines/industri-inteligence/Lov-og-rett/agents/lovsen-agent/lovsen.md` | all 6 |
| `docs/engines/artificial-intelligence/sixten-agent/sixten.md` | all 6 |
| Multiple `docs/engines/Lov-og-rett/journeys/*/mission.md` | 5 fields each |
| `docs/research/Connecteam help desk analyse.md` | all 6 |
| `docs/archive/2026-04-17-invoice-engine-breakdown-v1.md` | all 6 |

---

## Delta vs 2026-05-13 Baseline

| Metric | 2026-05-13 Baseline | 2026-05-15 | Change |
|--------|--------------------|-----------:|--------|
| i18n adoption (hardcoded NO toasts) | 38 hardcoded | 35 hardcoded toasts | -3 (minor improvement) |
| i18n adoption (%) | ~15% (different method) | 76.1% (per-string) / 20.9% (per-file) | **Methodology gap** — baseline counted files, this audit counts strings |
| Frontmatter complete | not tracked | 67.3% | New baseline |

**Methodology note:** The 2026-05-13 baseline of 15% adoption counted file-level adoption (files with any i18n import). This audit's 76.1% measures per-string adoption (t() calls vs hardcoded). The per-file metric (20.9%) is the closer comparator — showing adoption has not meaningfully changed since baseline. The 38→35 toast count is a minor improvement (+3 toasts resolved).

---

## Recommended Actions

1. **HIGH — Per-file i18n adoption:** 450/569 dashboard files never import `@smartout/i18n`. The payroll and settings areas are highest ROI for remediation.
2. **MEDIUM — Toast strings:** 35 hardcoded Norwegian toasts. Mechanical fix; batch with `toast.success(t("key"))` substitution.
3. **MEDIUM — `module:` field:** Add `module: learnings` / `module: engine` bulk pass over `docs/learnings/` and `docs/engines/`. ~600 files, low-risk change.
4. **LOW — No-frontmatter files:** 108 files. Priority: active `docs/research/` and `docs/engines/` agent files; deprioritize `docs/archive/`.
