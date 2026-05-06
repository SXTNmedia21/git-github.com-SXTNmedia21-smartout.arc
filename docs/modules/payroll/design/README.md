---
title: Payroll Module — Design Mockups
status: pending-population
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, design, mockups, html]
---

# Payroll Design Folder

> Pontus leverer HTML-mockup per surface her. Build-agent bruker disse som visuell SoT under implementering.

## Status

**FOLDER VENTER PÅ POPULATION.** Pontus shipper HTML-mockups her.

## Forventet liste

Per [UI-PLAN.md §13.5](../UI-PLAN.md):

### Web admin (Phase 1)
- [ ] W1-period-list.html
- [ ] W2-period-detail.html
- [ ] W3-line-drawer.html
- [ ] W4-deviation-drawer.html
- [ ] W5-lock-modal.html
- [ ] W6-manual-supplement-form.html
- [ ] W10-run-payroll.html

### Web admin (Phase 1.5)
- [ ] W7-team-registry.html
- [ ] W9-time-bank-admin.html

### Web admin (Phase 2+)
- [ ] W8-vacation-management.html
- [ ] W11-register-as-paid.html
- [ ] W12-reports-hub.html

### Web employee
- [ ] W18-payslip-acknowledge.html
- [ ] W19-employee-time-banks.html
- [ ] W20-amendment-review.html

### Mobile
- [ ] M1-mobile-timebank-filter.html
- [ ] M2-mobile-payslip-acknowledge.html
- [ ] M3-mobile-amendment-accept.html

## Build-agent regler

1. Les HTML-mockup som visuell SoT
2. Konverter til React/TSX m/ shadcn + Tailwind v4 + Nordic Split design tokens
3. Pixel-parity ikke krav; struktur/hierarki/spacing skal matche
4. Erstatt mockup-strings m/ TanStack Query hooks (eller server-action mutations)
5. Apply Nordic Split design tokens (smartout-nordic-split skill)
6. Mobile mockups: konverter til React Native + Expo komponenter

## Cross-references

- [UI-PLAN.md](../UI-PLAN.md) — full surface inventory + phase mapping
- [USER-FLOWS.md](../USER-FLOWS.md) — flow A–I detail per surface
- [ARCHITECTURE.md](../ARCHITECTURE.md) — system diagram
- smartout-nordic-split skill — design tokens + colors + fonts
