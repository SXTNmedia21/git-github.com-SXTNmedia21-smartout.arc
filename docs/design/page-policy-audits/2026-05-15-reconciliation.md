---
title: "Page Policy Audit — /dashboard/reconciliation"
status: draft
updated: 2026-05-15
created: 2026-05-15
audited_against: dashboard-page-pattern.md (2026-04-29) + page-policy.md (2026-05-15)
reference: /dashboard (WebDayControl.tsx)
module: design
tags: [audit, reconciliation, page-policy]
---

# /dashboard/reconciliation — drift-rapport

Audit kjørt 2026-05-15 mot kanonisk referanse `/dashboard` (WebDayControl). Reconciliation ble listet eksplisitt som "bygges neste" i dashboard-page-pattern.md 2026-04-29 men har ikke landet pattern-compliance.

## Sammendrag

| Severity | Count |
|---|---|
| **P0 critical** | 2 |
| **P1 high** | 3 |
| **P2 medium** | 5 |
| **P3 low** | 2 |

## Surfaces auditert

| Surface | Fil |
|---|---|
| Standalone-route shell | `apps/web/src/app/dashboard/reconciliation/_components/reconciliation-page-client.tsx` |
| Listevisning | `apps/web/src/app/dashboard/reconciliation/_components/DayList.tsx` |
| Detalj-visning | `apps/web/src/app/dashboard/reconciliation/_components/DayDetail.tsx` |
| Right-rail | `apps/web/src/app/dashboard/reconciliation/_components/ReconciliationRightRail.tsx` |
| Preflight-gate | `apps/web/src/app/dashboard/reconciliation/_components/PreflightGate.tsx` |
| In-shell variant | `apps/web/src/components/dashboard/ReconciliationView.tsx` |

---

## Funn

### A. Padding

| Fil:linje | Drift | Severity | Fix |
|---|---|---|---|
| `reconciliation-page-client.tsx:52` | Outer wrapper bruker `overflow-y-auto p-6` — siden scroller selv. Kanonen: `min-h-0 flex-1 overflow-hidden` + responsive `p-4 pt-1 md:p-6 md:pt-3` | **P0** | Bytt til `relative flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 pt-1 md:p-6 md:pt-3` |
| `reconciliation-page-client.tsx:52` | Mangler `min-h-0 flex-1` — bryter scroll-disiplin | **P0** | Inkludert i fix over |
| `reconciliation-page-client.tsx:52` | Flat `p-6`, ikke responsive | **P2** | Inkludert i fix over |

### B. Farger

Steg 2 (zinc/gray/slate/neutral/stone) returnerer **0 hits** i reconciliation. ✅ Compliant.

Indirekte drift:
| Fil:linje | Drift | Severity | Fix |
|---|---|---|---|
| `ReconciliationView.tsx:321` | Bruker `bg-background` i bunn-flytende handlingsbar — OK i seg selv, men er den eneste bruken av `fixed bottom-6` på reconciliation-flatene; potensiell konflikt med page-shell-mønster | **P3** | Vurder om handlingsbaren skal være page-scoped i stedet for global |

### C. Kort

Kanonen: `bg-card border-border rounded-2xl border p-5 shadow-sm`. Reconciliation bruker `rounded-xl` overalt + mangler `shadow-sm`.

| Fil:linje | Drift | Severity | Fix |
|---|---|---|---|
| `DayList.tsx:261` | List-container: `rounded-xl border` (ingen shadow-sm) | **P2** | `rounded-2xl` + `shadow-sm` |
| `DayList.tsx:391` | CounterTile: `rounded-lg` på primær-tile | **P2** | `rounded-2xl` (eller migrér til `<KpiAccentTile>` fra `@smartout/ui` per kanon §3) |
| `DayDetail.tsx:300` | Detail-header: `rounded-xl border p-5` (ingen shadow-sm) | **P2** | `rounded-2xl` + `shadow-sm` |
| `DayDetail.tsx:346` | Tab-bar container: `rounded-xl border p-1` | **P2** | Bør flyttes inn i `<PageTabNav>` (se Meny-drift) |
| `ReconciliationRightRail.tsx:80` | KPI-glance: `rounded-xl border p-4` | **P2** | `rounded-2xl` + `p-5` + `shadow-sm` |

### D. Meny

Kanonen: bruk `<PageTabNav>` (`apps/web/src/components/dashboard/PageTabNav.tsx`) når siden har sub-views.

| Fil:linje | Drift | Severity | Fix |
|---|---|---|---|
| `DayDetail.tsx:343-360` | Inline `role="tablist"` tab-bar — gjenoppfinner PageTabNav | **P1** | Bytt til `<PageTabNav tabs={TABS} active={tab} onChange={setTab} ariaLabel="Oppgjør-seksjoner" />` |
| `DayList.tsx:200-258` | Filter-pillerader — IKKE tabs, men deler visuell vokabular med tabs. Akseptabel hvis tydelig adskilt fra hovednavigasjon | **P3** | Behold som filter, men sørg for `mb-5` rytme mot resten |

### E. Motion-tokens

| Fil:linje | Drift | Severity | Fix |
|---|---|---|---|
| `DayDetail.tsx:254-255` | Hardkodet `stiffness: 38, damping: 22, mass: 2.2` | **P1** | `import { motion as motionTokens } from "@smartout/design-tokens"` → `{ type: "spring", ...motionTokens.spring }` |
| `PreflightGate.tsx:52-53` | Hardkodet `stiffness: 35, damping: 24, mass: 2.3` | **P1** | `{ type: "spring", ...motionTokens.springSnappy }` (nærmeste preset) |
| `ReconciliationView.tsx:320` | `stiffness: 300, damping: 30` — **langt utenfor** Nordic Split-range (35-45) | **P1** | `{ type: "spring", ...motionTokens.spring }` |
| `ReconciliationView.tsx:623` | `duration: 0.18, ease: "easeInOut"` | **P2** | `{ duration: motionTokens.exitMs / 1000, ease: motionTokens.easingArray }` |

### F. State-machine / Ambient orb (kanon §1, §9)

| Mangler | Severity | Fix |
|---|---|---|
| Ingen ambient orb på reconciliation-flatene — kanonen har phase-reactive radial-gradient | **P2** | Legg til orb i `reconciliation-page-client.tsx` outer wrapper (kopier mønster fra WebDayControl L172-175). Hue kan reflektere antall `pending_signoff` |
| Ingen `<AnimatePresence mode="wait">` rundt loading/empty/ready — bare Suspense + spinner i DayDetail | **P2** | Strukturer state-machine i page-client per kanon. Skeleton-crossfade-mønster fra smartout-page-polish skill Phase 2 |

### G. Header (H1 + subtitle pattern)

Kanonen: H1 `font-heading text-3xl leading-tight tracking-tight` + subtitle UNDER H1.

| Fil:linje | Drift | Severity | Fix |
|---|---|---|---|
| `DayList.tsx:173-179` | H1 har eyebrow OVER ("Avstemming" uppercase) — kanonen har subtitle UNDER. H1 bruker `tracking-[-0.02em]` ikke `leading-tight tracking-tight` | **P3** | Flytt eyebrow til subtitle-rad under H1; oppdater H1-classes |
| `DayDetail.tsx:303-313` | Samme eyebrow-over-mønster + samme tracking-drift | **P3** | Samme fix |

---

## Fix-rekkefølge

1. **P0 først:** `reconciliation-page-client.tsx:52` outer wrapper — fiksen er kort, og åpner scroll-disiplin for alle nedstrøms-fix.
2. **P1 batch:** PageTabNav-migrasjon (DayDetail), motion-token-import (DayDetail + PreflightGate + ReconciliationView).
3. **P2 batch:** Rounded-2xl + shadow-sm på alle bg-card-kort. Ambient orb. AnimatePresence state-machine.
4. **P3 cosmetic:** H1 eyebrow → subtitle-rad. Filter-pill rytme.

Estimert scope: 1 polish-sortie (`feat/reconciliation-page-policy-fix`), ~4 timer arbeid. Ingen schema-endring, ingen ADR (mønster-følge, ikke ny beslutning).

---

## Verifisering etter fix

```bash
# Padding
grep -n "overflow-y-auto\|overflow-auto" apps/web/src/app/dashboard/reconciliation/_components/reconciliation-page-client.tsx
# → 0 hits

# Kort
grep -rn "bg-card.*rounded-xl\|bg-card.*rounded-lg" apps/web/src/app/dashboard/reconciliation/
# → 0 hits på primær-kort

grep -rn "bg-card.*rounded-2xl" apps/web/src/app/dashboard/reconciliation/ | grep -v "shadow-sm"
# → 0 hits

# Motion
grep -rn "stiffness:\|damping:" apps/web/src/app/dashboard/reconciliation/ apps/web/src/components/dashboard/ReconciliationView.tsx | grep -v "motionTokens\."
# → 0 hits

# Meny
grep -rn "role=\"tablist\"" apps/web/src/app/dashboard/reconciliation/
# → 0 hits (eller bare via PageTabNav)
```

---

## Out-of-scope

- Endring av reconciliation-funksjonalitet (CSV-export, filter-logikk, approve/reject-flyt) — kun visuell pattern-compliance.
- Mobile parity (ADR-0133) — egen sortie.
- Telemetry-registry audit (smartout-page-polish Phase 5) — egen sortie.

---

## Changelog
| Dato | Endring | Forfatter |
|---|---|---|
| 2026-05-15 | Initial audit | Claude (Page Policy run) |
