---
title: "Journey — Admin uses compliant reconciliation"
feature: reconciliation-page-policy-fix
journey: admin-uses-compliant-reconciliation
status: draft
verified_at: null
e2e_test: null
created: 2026-05-15
updated: 2026-05-15
module: dashboard
tags: [journey, polish, page-policy]
---

# Journey: Admin uses compliant reconciliation

**Role:** admin

**Precondition:**
- Admin er innlogget på workspace med minst én reconciliation-rad i status `pending_signoff` eller `closed`
- `/dashboard` (WebDayControl) lever på `feat/reconciliation-page-policy-fix` som referanse

## Happy Path

1. Admin navigerer til `/dashboard/reconciliation` → side laster uten layout-shift mot `/dashboard`-shell → admin ser uke-oversikt med samme padding-rytme (`p-4 pt-1 md:p-6 md:pt-3`), samme kort-stil (`rounded-2xl shadow-sm`), ambient orb i bakgrunnen.
2. Admin filtrerer på status-pill (f.eks. "Venter oppgjør") → pill-row stiller seg ikke som tab-bar; counter-tiles oppdaterer seg → admin opplever filter-feedback som koherent del av `/dashboard`-systemet.
3. Admin klikker en rad → DayDetail laster med `<PageTabNav>` (samme komponent som `/dashboard` overview-tabs) → tab-swap bruker `motionTokens.spring` (35/22/2.2), ikke generic framer-defaults → ingen visuell hopp mellom skjermbilder.
4. Admin bytter mellom tabs (Oversikt, Omsetning, Vakter, Avvik) → AnimatePresence-crossfade matcher tab-bytte i `/dashboard` → admin oppfatter `/dashboard/reconciliation` som SAMME side-arkitektur som overview.

**Postcondition:**
- Admin har fullført uke-oppgjør uten å registrere visuell drift mellom `/dashboard` og `/dashboard/reconciliation`
- Page Policy §5 akseptansekriterier alle grønne
- 12 drift-findings fra audit lukket

## Error Paths

- **Scenario:** Ingen reconciliations i workspace → EmptyState i `DayList` viser ikon + heading + body + next-action (per smartout-page-polish Phase 6) → admin forstår hva som mangler og hva som skjer videre.
- **Scenario:** Reconciliation-API returnerer feil → page-client viser feilmelding med `text-foreground` + `bg-card rounded-2xl shadow-sm` → ikke generic spinner.

## Verification

- [ ] Implementasjon matcher stegene over
- [ ] E2E test eksisterer og passerer (path i `e2e_test:` frontmatter) — alternativt: manuell visuell sammenligning `/dashboard` ↔ `/dashboard/reconciliation` med skjermbilder vedlagt
- [ ] Manuelt testet ende-til-ende
- [ ] Page Policy grep-sjekker returnerer 0 hits (se audit-rapport §verifisering)

**Mark `status: verified` in frontmatter when all four boxes are checked.**
