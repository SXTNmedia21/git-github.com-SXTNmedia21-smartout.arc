---
title: "Slice 12 — i18n + Frontmatter Convention Check"
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, i18n-frontmatter, convention]
---

# Slice 12 — i18n + Frontmatter Convention Check

**Scope:** `apps/web/src/**/*.tsx` (i18n) + `docs/**/*.md` (frontmatter)
**Method:** grep-based sampling — 1112 total `.tsx` files; 2170 total `docs/` `.md` files; random 49-file frontmatter sample.
**Known FP file:** `/home/sxtnl/.claude/skills/adr-contract-audit/known-false-positives.md` — reviewed, no active FPs apply to this slice.

---

## Summary

| Convention | Files sampled | Violations found | Rate |
|---|---|---|---|
| No hardcoded Norwegian text in JSX | 1112 `.tsx` files | 213 files / 620 occurrences | 19 % of `.tsx` files |
| Every `docs/*.md` has YAML frontmatter | 49 files sampled | **2 files missing** | 4 % of sample |

Key signal: 61 `.tsx` files contain Norwegian strings with **zero i18n imports/calls** — these are pure offenders with no partial mitigation. The remaining 152 files mix i18n calls with isolated hardcoded strings (partial compliance).

---

## Hardcoded Norwegian Samples

> Filtered: comments, `placeholder=`, `aria-label=`, `title=`, `alt=` attributes excluded. Only JSX text content and string literal values captured.

| File:line | String (truncated to 90 chars) |
|---|---|
| `apps/web/src/app/onboarding/components/AgentControlPanel.tsx:12` | `"[Systemmelding: Fokuser på å bli kjent. Spør om navnet og bedriften…]"` |
| `apps/web/src/app/onboarding/components/AgentControlPanel.tsx:18` | `"[Systemmelding: Finn bedriften på nett. Spør om nettside, by, org.nummer…]"` |
| `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx:75` | `"Helgetillegg gjelder lørdag fra kl. 12:00 og søndag hele døgnet. Sats: kr 100,00…"` |
| `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx:181` | `absence: "Fravær"` / `monthly_salary: "Fastlønn"` / `base: "Grunnlønn"` |
| `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx:546` | `"Lås perioden først"` / `"Last ned PDF lønnsgrunnlag for denne ansatte"` |
| `apps/web/src/app/dashboard/komm/_components/CreateChannel.tsx:86` | `lede: "Fag-skranke. Spørsmål rutes til ansvarlig kollega…"` |
| `apps/web/src/app/dashboard/komm/_components/CreateChannel.tsx:97` | `lede: "HR-skranke. Hver sak får sin egen private undertråd…"` |
| `apps/web/src/app/dashboard/komm/_components/CreateChannel.tsx:665` | `"Kanalen ble opprettet, men tilgangsoppsett feilet. Prøv via innstillinger."` |
| `apps/web/src/app/platform-admin/workspaces/new/page.tsx` (×10) | Mixed label strings despite 45 i18n calls present |
| `apps/web/src/app/dashboard/reconciliation/_components/DayList.tsx` (×10) | `"I går"` date label + toast messages |
| `apps/web/src/components/dashboard/entity-drawer/tabs/role/RoleRichCard.tsx:46` | `description: "Kan administrere ansatte, avdelinger, opplæring…"` |
| `apps/web/src/components/dashboard/entity-drawer/tabs/department/DepartmentRichCard.tsx:26` | `DAY_NAMES = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"]` |
| `apps/web/src/components/day/tabs/SignoffTab.tsx:191` | `label: "Lønnskostnad"` / `"Margin vs mål"` |
| `apps/web/src/components/auth/InvitationStatusList.tsx:263` | `toast.success("Invitasjon sendt på nytt")` |
| `apps/web/src/components/contract-editor/ai-chat-panel.tsx:33` | `prompt: "Forenkle språket i denne kontrakten…"` |
| `apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx:37` | `toast.error(result.error ?? "Noe gikk galt. Prøv igjen.")` |
| `apps/web/src/components/day/AddShiftDialog.tsx:255` | `toast.success("Vakt lagt til. Loggført i revisjonsloggen.")` |
| `apps/web/src/components/dashboard/ActivityView.tsx:44` | `"Bårdshaug Vegkro"` (hardcoded seed name in live component) |

### Top 3 Worst Offenders by Line Count

1. **`AgentControlPanel.tsx` — 16 Norwegian strings** — All are AI system-message prompts baked as string literals (no JSX text nodes). These are developer debug controls, not end-user UI. **Intentional pattern** (system prompt strings are intentionally Norwegian), but the strings are raw literals — if Botsson ever goes multilingual, this file will need refactoring.

2. **`LineDrawer.tsx` — 14 Norwegian strings** — Mix of tariff-annotation tooltips (legal-text, Norwegian by definition) and UI labels (`"Fravær"`, `"Fastlønn"`, `"Grunnlønn"`, `"Lås perioden først"`). The UI labels are the genuine violations here; legal-text tooltips are arguably intentional (same class as tariff rates per FP-002 pattern).

3. **`CreateChannel.tsx` — 11 Norwegian strings** — All UI-facing copy: channel type descriptions, example strings, error toast messages. These are active violations with no FP basis.

---

## Missing Frontmatter Samples

49 files sampled from `docs/` (all subdirectories, excluding `archive/`). 2 missing frontmatter:

1. `docs/modules/payroll/design/IMPLEMENTATION.md` — Starts with `# Smartout · Payroll Phase 1 — Implementation Handoff` prose, no YAML block.
2. `docs/superpowers/plans/completed/2026-03-28-entity-drawer-phase2.md` — Starts with `# Entity Drawer Phase 2 — Implementation Plan` prose, no YAML block.

Sample rate: **2 / 49 = 4 %** missing frontmatter. Extrapolated to full corpus (2170 files): ~87 files likely missing frontmatter — but sampling confidence is limited given subdirectory distribution is non-uniform (decisions/ and learnings/ have near-100 % compliance; older plan/handoff directories have higher miss rate).

---

## Verified Intentional

| Pattern | Verdict |
|---|---|
| `AgentControlPanel.tsx` system-prompt strings | **Intentional** — Norwegian system messages for AI voice agent (development-phase debug panel). No user-visible JSX text nodes confirmed. Not a UI i18n violation; flag only if product goes multilingual. |
| `LineDrawer.tsx` legal-text tooltips (Riksavtalen citations) | **Intentional** — Norwegian legal citations are language-fixed by nature (same reasoning as FP-002 for tariff rates). The UI labels on same file ARE violations. |
| `DepartmentRichCard.tsx` `DAY_NAMES` array | **Borderline** — Norwegian day-name abbreviations used as display values. No i18n wrapping. Should use `Intl.DateTimeFormat` or i18n keys but is low-priority cosmetic. |
| `ActivityView.tsx:44` `"Bårdshaug Vegkro"` | **Genuine violation** — hardcoded demo/seed workspace name in production component. Should be removed or replaced with a data-driven value. |

---

## Findings

| ID | Severity | File | Description |
|---|---|---|---|
| F12-01 | HIGH | 61 `.tsx` files (zero i18n refs) | 61 files contain Norwegian UI strings with no i18n infrastructure at all. Core offenders: `CreateChannel.tsx`, `DayList.tsx`, `SeasonCard.tsx`, many `day/tabs/*.tsx`. |
| F12-02 | MEDIUM | `LineDrawer.tsx:181,546,807,887` | UI labels and tooltip text hardcoded Norwegian alongside legal-text (which is intentional). Mixed — only UI labels need remediation. |
| F12-03 | MEDIUM | `ActivityView.tsx:44` | `"Bårdshaug Vegkro"` hardcoded workspace name in production activity-stream component. |
| F12-04 | LOW | `docs/modules/payroll/design/IMPLEMENTATION.md` | Missing YAML frontmatter. |
| F12-05 | LOW | `docs/superpowers/plans/completed/2026-03-28-entity-drawer-phase2.md` | Missing YAML frontmatter. |

**Not flagged (confirmed intentional):** `AgentControlPanel.tsx` system prompts (dev panel), `LineDrawer.tsx` Riksavtalen citation tooltips.
