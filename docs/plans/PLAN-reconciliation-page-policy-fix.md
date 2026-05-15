---
title: "Plan — reconciliation-page-policy-fix"
feature: reconciliation-page-policy-fix
spec: ../design/page-policy-audits/2026-05-15-reconciliation.md
status: draft
updated: 2026-05-15
created: 2026-05-15
module: dashboard
tags: [plan, polish, page-policy, reconciliation]
---

# Plan — reconciliation-page-policy-fix

> Branch: `feat/reconciliation-page-policy-fix` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4` | Module: dashboard

**Spec:** [Page Policy Audit — /dashboard/reconciliation (2026-05-15)](../design/page-policy-audits/2026-05-15-reconciliation.md)

**Policy:** [Page Policy](../design/page-policy.md) operasjonaliserer [dashboard-page-pattern.md](../design/dashboard-page-pattern.md) (canonical fra 2026-04-29).

## Journeys (the contract)

- [JOURNEY-reconciliation-page-policy-fix-admin-uses-compliant-reconciliation](../journeys/JOURNEY-reconciliation-page-policy-fix-admin-uses-compliant-reconciliation.md) — Admin åpner /dashboard/reconciliation og opplever layout som matcher /dashboard på alle fire Page Policy-akser

## Goal

Lukk 12 drift-findings rapportert i 2026-05-15-reconciliation-audit: 2 P0, 3 P1, 5 P2, 2 P3. Resultat: `/dashboard/reconciliation` passerer Page Policy §5 akseptansekriterier.

## Tasks

### P0 — kritisk

- [ ] **T1**: `reconciliation-page-client.tsx:52` outer wrapper → `relative flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 pt-1 md:p-6 md:pt-3` (fra `flex h-full flex-col overflow-y-auto p-6`)

### P1 — høy

- [ ] **T2**: `DayDetail.tsx:343-360` inline tab-bar → `<PageTabNav>` fra `@/components/dashboard/PageTabNav`
- [ ] **T3**: Motion-token-import + erstatt hardkodet spring i:
  - `DayDetail.tsx:254-255` → `{ type: "spring", ...motionTokens.spring }`
  - `PreflightGate.tsx:52-53` → `{ type: "spring", ...motionTokens.springSnappy }`
  - `ReconciliationView.tsx:320` → `{ type: "spring", ...motionTokens.spring }` (var 300/30 — langt utenfor range)

### P2 — medium

- [ ] **T4**: `DayList.tsx:261` list-container `rounded-xl` → `rounded-2xl shadow-sm`
- [ ] **T5**: `DayList.tsx:391` CounterTile `rounded-lg` → `rounded-2xl` (vurder migrasjon til `<KpiAccentTile>` fra `@smartout/ui`)
- [ ] **T6**: `DayDetail.tsx:300` detail-header `rounded-xl` → `rounded-2xl shadow-sm`
- [ ] **T7**: `ReconciliationRightRail.tsx:80` KPI-glance `rounded-xl p-4` → `rounded-2xl p-5 shadow-sm`
- [ ] **T8**: `ReconciliationView.tsx:623` `duration: 0.18, ease: "easeInOut"` → motionTokens-basert
- [ ] **T9**: Legg til ambient orb i `reconciliation-page-client.tsx` (radial-gradient via `var(--brand-orange)` color-mix)
- [ ] **T10**: Strukturer state-machine: `<AnimatePresence mode="wait">` rundt loading / no-data / ready i page-client

### P3 — kosmetisk

- [ ] **T11**: `DayList.tsx:173-179` + `DayDetail.tsx:303-313` — flytt eyebrow til subtitle-rad under H1; H1-classes → `leading-tight tracking-tight`

## Acceptance Criteria

- [ ] Page Policy §5 akseptanse: alle 9 sjekklister grønne
- [ ] Verifisering-grep i audit-rapporten returnerer 0 hits per regel
- [ ] Journey har `status: verified` i frontmatter
- [ ] Typecheck passerer: `pnpm turbo typecheck`
- [ ] Visuell røyktest: admin åpner /dashboard/reconciliation, ser ingen layout-shift mot /dashboard

## Out-of-scope

- Endring av reconciliation-funksjonalitet (CSV-export, filter-logikk, approve/reject)
- Mobile parity (ADR-0133) — egen sortie
- Telemetry-registry audit (smartout-page-polish Phase 5) — egen sortie
- ADR — mønster-følge, ikke ny beslutning
