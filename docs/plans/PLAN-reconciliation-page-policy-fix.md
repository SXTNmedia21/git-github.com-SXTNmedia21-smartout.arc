---
title: "Plan — reconciliation-page-policy-fix"
feature: reconciliation-page-policy-fix
spec: ../design/page-policy-audits/2026-05-15-reconciliation.md
status: complete
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

- [x] **T1**: `reconciliation-page-client.tsx:52` outer wrapper → `relative flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 pt-1 md:p-6 md:pt-3` (A1 commit `7b4f18550`)

### P1 — høy

- [x] **T2**: `DayDetail.tsx:343-360` inline tab-bar → `<PageTabNav>` (A3 commit `b7b150842`)
- [x] **T3**: Motion-token-import + erstatt hardkodet spring i:
  - [x] `DayDetail.tsx:254-255` → `{ type: "spring", ...motionTokens.spring }` (A3 `b7b150842`)
  - [x] `PreflightGate.tsx:52-53` → `{ type: "spring", ...motionTokens.springSnappy }` (A5 `ef26a0b33`)
  - [x] `ReconciliationView.tsx:320` → `{ type: "spring", ...motionTokens.spring }` (A5 `ef26a0b33`)

### P2 — medium

- [x] **T4**: `DayList.tsx:261` list-container `rounded-2xl shadow-sm` (A2 `2e40ef9a0`)
- [x] **T5**: `DayList.tsx:391` CounterTile `rounded-2xl shadow-sm` (A2 `2e40ef9a0`) — KpiAccentTile-migrasjon deferred
- [x] **T6**: `DayDetail.tsx:300` detail-header `rounded-2xl shadow-sm` (A3 `b7b150842`)
- [x] **T7**: `ReconciliationRightRail.tsx:80,113,148` 3 seksjoner `rounded-2xl p-5 shadow-sm` (A4 `64a1fa99e`)
- [x] **T8**: `ReconciliationView.tsx:623` `duration: motionTokens.exitMs/1000, ease: motionTokens.easingArray` (A5 `ef26a0b33`)
- [x] **T9**: Ambient orb i `reconciliation-page-client.tsx` (A1 `7b4f18550`)
- [x] **T10**: `<AnimatePresence mode="wait">` rundt list/detail state-machine (A1 `7b4f18550`)

### P3 — kosmetisk

- [x] **T11**: `DayList.tsx` + `DayDetail.tsx` header — eyebrow → subtitle, `leading-tight tracking-tight` (A2 `2e40ef9a0`, A3 `b7b150842`)

## Acceptance Criteria

- [x] Page Policy §5 akseptanse: alle 9 sjekklister grønne (A6 review 2026-05-15)
- [x] Verifisering-grep i audit-rapporten returnerer 0 hits per regel
- [x] Journey har `status: verified` i frontmatter
- [x] Typecheck passerer: `tsc --noEmit` exit 0 fra wt-4/apps/web
- [ ] Visuell røyktest: admin åpner /dashboard/reconciliation, ser ingen layout-shift mot /dashboard — **pending Pontus's manual G5 gate**

## Follow-ups

- Pre-existing bug: `ReconciliationView.tsx:159` — `profileId` brukt i `decide` useCallback men mangler i dep array. Stale-closure risiko ved kontekst-bytte mid-session. Confidence 80. Ikke introdusert av denne sortie. Logg som separat fix-ticket.
- KpiAccentTile-migrasjon for `CounterTile` (deferred fra T5). Større refaktor, egen sortie.

## Out-of-scope

- Endring av reconciliation-funksjonalitet (CSV-export, filter-logikk, approve/reject)
- Mobile parity (ADR-0133) — egen sortie
- Telemetry-registry audit (smartout-page-polish Phase 5) — egen sortie
- ADR — mønster-følge, ikke ny beslutning
