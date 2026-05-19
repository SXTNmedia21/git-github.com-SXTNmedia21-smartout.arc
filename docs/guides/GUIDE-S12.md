---
title: "Guide: Sidebar Orphan Coverage — 20 linked-orphan routes reachable, 2 placeholders disabled"
protocol_id: S12
generated: 2026-05-15
status: draft
---

# Sidebar Orphan Coverage — 20 linked-orphan routes reachable, 2 placeholders disabled — Steg-for-steg

## 1. Dashboard shell laster ved /dashboard

![Steg 1](../../apps/e2e/test-results/protocols/S12_manager_01_1_dashboard_loads_light_1440x900.png)

Manager navigerer til /dashboard. Dashboard shell er montert.

## 2. Drift > Forslag — /dashboard/proposals er nåbar

![Steg 2](../../apps/e2e/test-results/protocols/S12_manager_02_2_proposals_light_1440x900.png)

Naviger til /dashboard/proposals.

## 3. Planlegging > Årshjul — /dashboard/year-wheel er nåbar

Naviger til /dashboard/year-wheel.

## 4. Planlegging > Setup-veiviser — /dashboard/setup er nåbar

Naviger til /dashboard/setup.

## 5. Administrasjon > Kontrakter — /dashboard/contracts er nåbar

Naviger til /dashboard/contracts.

## 6. Administrasjon > Kostnader — /dashboard/cost er nåbar

Naviger til /dashboard/cost.

## 7. Administrasjon > Fakturering — /dashboard/billing er nåbar

Naviger til /dashboard/billing.

## 8. Administrasjon > Nettside — /dashboard/website er nåbar

Naviger til /dashboard/website.

## 9. HMS & Compliance > HMS-oversikt — /dashboard/hms er nåbar

![Steg 9](../../apps/e2e/test-results/protocols/S12_manager_09_9_hms_light_1440x900.png)

Naviger til /dashboard/hms.

## 10. HMS & Compliance > Avvik — /dashboard/hms/deviations er nåbar

Naviger til /dashboard/hms/deviations.

## 11. HMS & Compliance > Dokumenter — /dashboard/hms/documents er nåbar

Naviger til /dashboard/hms/documents.

## 12. HMS & Compliance > Trening — /dashboard/hms/training er nåbar

Naviger til /dashboard/hms/training.

## 13. HMS & Compliance > Drift-sjekk — /dashboard/hms/drift er nåbar

Naviger til /dashboard/hms/drift.

## 14. HMS & Compliance > Styring — /dashboard/hms/governance er nåbar

Naviger til /dashboard/hms/governance.

## 15. HMS & Compliance > Policies — /dashboard/policies er nåbar

Naviger til /dashboard/policies.

## 16. HMS & Compliance > Handbok — /dashboard/handbook er nåbar

Naviger til /dashboard/handbook.

## 17. Kommunikasjon > Desks — /dashboard/komm/desks er nåbar

Naviger til /dashboard/komm/desks.

## 18. Kommunikasjon > Oversikt — /dashboard/komm/oversikt er nåbar

Naviger til /dashboard/komm/oversikt.

## 19. Integrasjoner > POS Lightspeed — /dashboard/admin/pos-accounts er nåbar

Naviger til /dashboard/admin/pos-accounts.

## 20. AI & Botsson > Onboarding-assistent — /dashboard/onboarding-assistant er nåbar

Naviger til /dashboard/onboarding-assistant.

## 21. Min Tid > Stempelur — /dashboard/shift-clock er nåbar

Naviger til /dashboard/shift-clock.

## 22. Disabled: Rutiner (/dashboard/tasks) — ikke-klikkbar placeholder

![Steg 22](../../apps/e2e/test-results/protocols/S12_manager_22_22_placeholder_tasks_light_1440x900.png)

Naviger til /dashboard (med sidebar synlig). Verifiser at Rutiner-elementet er til stede men ikke-klikkbart (data-disabled='true', ingen <a>-tag).

## 23. Disabled: Manualer (/dashboard/manuals) — ikke-klikkbar placeholder

Verifiser at Manualer-elementet i Veiledning-gruppen er til stede men ikke-klikkbart (data-disabled='true', ingen <a>-tag, tooltip 'Kommer snart').

---
*Generert av Protocol Verification Engine 2026-05-15*