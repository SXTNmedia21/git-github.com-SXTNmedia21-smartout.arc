---
title: ADR/Contract Audit — Slice 12 — i18n + Frontmatter
status: draft
updated: 2026-05-13
created: 2026-05-13
module: audit
tags: [audit, i18n, frontmatter, conventions, read-only]
---

# Slice 12 — i18n + Frontmatter Compliance

Read-only audit. Sampling, not exhaustive. ADRs: none specific; CLAUDE.md rules.

## Summary

| Surface | Sample | Pass | Fail | Pass-rate |
|---|---|---|---|---|
| Frontmatter completeness (recent 30-day docs) | 40 | 32 | 8 | 80% |
| Frontmatter completeness (random 50 across all docs) | 50 | 42 | 8 | 84% |
| Frontmatter present at all (full sweep) | 2,134 | 2,029 | 105 | 95.1% |
| `updated:` date stale >90d behind mtime (100 random docs) | 100 | 90 | 0 stale, 10 no-date | n/a |
| i18n key drift — keys present in `nb/<ns>.json` (30 useTranslation files) | 165 keys | 165 | 0 | 100% |
| i18n adoption (tsx files using `useTranslation`) | 1,112 | 167 | 945 | 15% |
| Files with at least one hardcoded NO string (sampled patterns) | 1,112 | — | 77 | — |

**Bottom line:** Frontmatter discipline is **strong on `docs/` root and HANDOFFs (95%+)** but **drifts in legacy corpora** (engines/Lov-og-rett journeys, design/uploads, architecture/SMARTOUT_TIPS_*). i18n key drift is **clean** — no broken `t()` references found in sample. **i18n adoption is the real story: only 15% of `apps/web/src/*.tsx` files import the translator at all.** Hardcoded Norwegian persists in toasts, placeholders, and button labels across the day/tips/welcome-wizard surfaces.

## i18n drift sample

The drift is **not** in broken keys — it's in **non-adoption**. Pattern findings:

- **Toast strings hardcoded:** 38 files contain `toast.success("Lagre…")` / `toast.error("Kunne ikke…")` style hardcoded NO. Hotspots: `components/day/*` (EventDetailPanel, NoteEditDialog, AddShiftDialog, AddTaskDialog, RosterTab), `components/tips/*` (ApproveBar, AdjustmentDialog, PotRegistrationModal), `components/contracts/ContractDispatchDrawer.tsx`, `components/auth/InvitationStatusList.tsx`, `components/welcome-wizard/steps/OptionalStep.tsx`, `components/dashboard/wizard-steps/*` (4 wizard step files).
- **Placeholders hardcoded:** 64 files have `placeholder="Søk…|Velg…|Skriv…|Beskriv…|Oppgi…|Hvordan…"`. Examples: `tips/AdjustmentDialog.tsx:174`, `day/EventDetailPanel.tsx:207,352`, `day/NoteEditDialog.tsx:124`, `dashboard/entity-drawer/tabs/deviation/DeviationDetailTab.tsx:170`, `auth/InvitationStatusList.tsx:356`, `contract-editor/metadata-bar.tsx:128`, `day/AddTaskDialog.tsx:180,199`.
- **Button text hardcoded:** 17+ instances of `>Avbryt<`, `>Slett<`, `>Fjern<`, `>Lagre<`. Settings dialogs (`shift-types-settings.tsx:556`, `employee-groups-settings.tsx:345,592`, `meal-rules-settings.tsx:514`, `salary-codes-settings.tsx:314`, `supplement-rules-settings.tsx:1031`, `break-rules-settings.tsx:487`) and AlertDialog cancels across day/payroll/website/governance/platform-admin/billing.
- **Adoption skew:** of 167 i18n-using files, 120 live under `app/dashboard/` (year-wheel, komm, helpdesk surfaces — recently localized per git log). The `components/day/*`, `components/tips/*`, `components/welcome-wizard/*`, and `components/dashboard/wizard-steps/*` surfaces have **near-zero adoption** despite shipping mature features.
- **Mixed-language risk:** `components/platform-admin/*` is EN-only (intentional — godmode/internal). Verified: `audience-selector.tsx`, `in-app-compose.tsx`, `compose-email-sheet.tsx`, `document-drop.tsx` use English. **Not** a finding; convention.
- **Key drift (broken `t()` references):** None detected in 30-file sample (165 keys checked, all resolve against `nb/<ns>.json`). Dictionary structure is flat-dotted (`"bell.label": "…"`) — verified against `nb/notifications.json`.

20 namespaces ship in `nb/` and `en/`. Parity looks fine on file count.

## Frontmatter compliance sample

### Full-sweep results
- **2,239 total `.md` files** under `docs/`.
- **105 files missing frontmatter entirely** (4.7%). Distribution:
  - `superpowers/` — 52 (spec/plan corpus, mostly intentional — has its own header style with `> Date:` and `> Status:`)
  - `engines/` — 26 (mostly `Lov-og-rett/journeys/*/description.md` + `checklist.md` — 10 journey folders × 2 files)
  - `design/` — 11 (READMEs + uploaded design specs from external sources)
  - `modules/` — 5
  - `architecture/` — 5 (`SMARTOUT_TIPS_PRD.md`, `_UI_COMPS.md`, `_ARCHITECURE.md`, plus contract-service PRD duplicated)
  - `research/` — 3 (intake docs: `INVESTOR-RESEARCH.md`, `Connecteam help desk analyse.md`, `VIKTIGA FUNKSJONER SOM SMARTOUT LØSER.md`)
  - `journeys/`, `business/`, `leadGen/` — 1 each
- **Incomplete frontmatter (random sample 50):** 8/50 — most common missing keys: `status` (5), `created` (5), `updated` (4), `module` (3), `tags` (2).
- **Recent docs (last 30 days, sample 40):** 32/40 fully compliant; 8 incomplete. Mostly `module:` or `status,updated,created` missing on HANDOFFs and lovsen-agent learnings.
- **Stale `updated:` dates:** **0 stale** found in 100-doc sample (no doc had `updated:` >90 days behind file mtime). Discipline is solid here.

### Specific incomplete-frontmatter samples (recent, prefer-to-fix targets)
- `docs/STATE-SUMMARY.md` — missing `status`, `created`, `module`, `tags` (only `title` + `updated`)
- `docs/HANDOFF-lovdata-mcp.md` — missing `status`, `updated`, `created`
- `docs/HANDOFF-lovsen-foundation.md` — missing `status`, `updated`, `created`
- `docs/HANDOFF-arbeidstilsynet-mcp.md` — missing `status`, `updated`, `created`
- `docs/HANDOFF-mattilsynet-mcp.md` — missing `status`, `updated`, `created`
- `docs/engines/.../lovsen-agent/learnings/2026-05-06-payroll-module-blueprint.md` — missing `module`
- `docs/HANDOFF-f-mem-unblock.md` — missing `module`
- `docs/HANDOFF-journey-control-center.md` — missing `tags`

## Findings table

| # | Severity | Surface | Finding | Evidence |
|---|---|---|---|---|
| F1 | HIGH | apps/web/src | i18n coverage is **15%** (167/1112 tsx). Day/tips/welcome-wizard/wizard-steps surfaces have ~zero adoption despite shipping mature features. CLAUDE.md says "Never hardcode Norwegian text — use i18n keys." | grep on `useTranslation` vs total tsx count |
| F2 | HIGH | components/day/*, components/tips/*, components/welcome-wizard/* | 38 files with hardcoded NO toast strings (e.g., `toast.success("Notat oppdatert")`, `toast.error("Kunne ikke godkjenne dagen")`). Bypasses i18n entirely. | `EventDetailPanel.tsx:170,194,311,327`, `ReconciliationView.tsx:138,140,197`, `InvitationStatusList.tsx:263-305`, `ContractDispatchDrawer.tsx:542,546` |
| F3 | MED | apps/web/src (multiple) | 64 files with hardcoded NO placeholders, 17+ files with hardcoded button labels (`>Avbryt<`, `>Slett<`, `>Lagre<`). Settings dialogs are the heaviest offender (6 `_components/*-settings.tsx`). | `shift-types-settings.tsx:556`, `employee-groups-settings.tsx:345,592`, `supplement-rules-settings.tsx:1031`, `AdjustmentDialog.tsx:174`, etc. |
| F4 | MED | docs/architecture/, docs/research/, docs/engines/Lov-og-rett/journeys/ | 105 docs without YAML frontmatter. Of these, ~30 are legitimate (superpowers spec/plan headers, design/uploads from external sources). The other ~75 — especially `engines/Lov-og-rett/journeys/*` (20 files) and `architecture/SMARTOUT_TIPS_*` (5 files) — are first-class docs that should have frontmatter per CLAUDE.md. | `/tmp/no-fm.txt` distribution; CLAUDE.md "Every markdown file in docs/ MUST have frontmatter" |
| F5 | LOW | docs/HANDOFF-*.md | ~8/40 recent HANDOFFs ship with incomplete frontmatter (commonly missing `status`, `created`, `module`). Discipline drifts on Lovsen/mattilsynet/arbeidstilsynet MCP handoffs. | `HANDOFF-lovdata-mcp.md`, `HANDOFF-lovsen-foundation.md`, `HANDOFF-arbeidstilsynet-mcp.md`, `HANDOFF-mattilsynet-mcp.md` |
| F6 | INFO | apps/web/src/components/platform-admin/* | EN-only by convention (godmode/internal). Audience-selector, in-app-compose, compose-email-sheet, document-drop all use English. **Not** a finding — convention check confirms. | `audience-selector.tsx`, `in-app-compose.tsx`, `compose-email-sheet.tsx` |
| F7 | INFO | docs/* | `updated:` field discipline strong: 0/100 sampled docs had `updated:` >90d behind file mtime. Auto-touch behavior is working. | sample with `stat -c %Y` cross-check |
| F8 | INFO | i18n key resolution | No drift detected in 30-file sample (165 keys checked). Flat-dotted key style (`"bell.label"`) is consistently used in `nb/notifications.json`, `nb/komm.json` etc. | grep verification against `nb/*.json` |

## Counts

- **2,239** total `.md` files under `docs/`
- **105** docs without frontmatter (4.7%)
- **8/50** sampled docs with incomplete frontmatter (16%)
- **1,112** total tsx files in `apps/web/src/`
- **167** tsx files using `useTranslation` (15% coverage)
- **38** tsx files with hardcoded NO toast strings
- **64** tsx files with hardcoded NO placeholders
- **17+** tsx files with hardcoded NO button labels
- **0** i18n key references found broken in 30-file sample (165 keys)
- **0** docs with `updated:` >90d behind file mtime in 100-doc sample

## Top 3 critical (one-liners)

1. **i18n adoption is 15%, not 100%.** CLAUDE.md "Never hardcode Norwegian text" is aspirational, not enforced — day/tips/welcome-wizard surfaces ship mature features with zero `useTranslation` imports. Recommend ADR or sortie scope.
2. **38 files emit `toast.success("Notat oppdatert")` style hardcoded NO** — bypass i18n entirely; affects user-visible audit/feedback strings on shift/tip/reconciliation flows.
3. **105 docs (~4.7% of corpus) ship without YAML frontmatter** — concentrated in `engines/Lov-og-rett/journeys/` (20 files, 2 per journey), `architecture/SMARTOUT_TIPS_*` (5), and `research/intake` docs (3); break the "every `docs/*.md` has frontmatter" invariant.
