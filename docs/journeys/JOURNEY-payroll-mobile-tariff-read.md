---
title: "Journey — payroll-mobile-tariff-read"
status: verified
feature: mobile-tariff-read
updated: 2026-05-17
created: 2026-05-17
module: mobile
tags: [journey, payroll, mobile, tariff, read-only, adr-0133, phase-7e]
---

# Journey — payroll-mobile-tariff-read

> Phase 7e Track 4. Mobile employee read-only "Min tariff" surface per ADR-0133.

## Journey: Employee views workspace tariff binding

**Precondition:** Employee authenticated, mobile app open, navigates to `(me)/tariff`.

1. Screen mounts, `useCurrentTariff()` hook fires GET `/api/payroll/tariff/current` (10-min stale)
2. View-emit `payroll.tariff_view_loaded_mobile` (currently commented out — pending registry)
3. `TariffSummaryCard` renders union + law_version + effective_from
4. `ParagrafReferenceList` shows paragraf citations with formatted rates (%, kr, kr/t)

**Postcondition:** Employee sees what tariff governs their pay with paragraf-level attribution.

## Empty / error states

| State | Trigger | UI |
|---|---|---|
| Skeleton | `isLoading && !data` | 4 muted placeholder rows |
| Auth error | `safeGetProfileContext()` returns `ok:false` | L-0177 fail-fast — explicit error card, no fallback |
| BFF error | `error && !isLoading` | AlertTriangle + BFF message |
| Unbound workspace | `data.is_bound === false` | Soft info card: "Ikke tariff-bundet — lønn baseres på lokal avtale" (Lovsen-soft-guide) |
| Refresh | `isLoading && data` revalidating | Small spinner, no layout shift |

## ADR-0133 boundary check

ZERO authoring affordances:
- No forms
- No Pressable write triggers
- No mutations
- ScrollView + display components only
- All verbs are Witness (read, display), never Approve/Author

Web `/dashboard/payroll/tariff` owns authoring (Track 3). Mobile mirrors read-only.

## Telemetry flag

`payroll.tariff_view_loaded_mobile` not in `packages/telemetry/src/registry.ts`. Emit call commented in `tariff.tsx` — Phase 7g registers event, removes comment.
