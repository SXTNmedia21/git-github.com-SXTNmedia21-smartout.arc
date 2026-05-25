---
title: "Journey: Manager åpner panel for tom dag (edge)"
status: verified
feature: p10-tidslinje-tab
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, day-control-panel, p10, manager, bootstrap, edge-case]
---

# Journey: Manager åpner panel for tom dag (edge)

**Precondition:** Klikket dato uten `department_session`.

1. Manager klikker dato 3 uker fram → DayControlPanel åpner → klikker **Tidslinje**
2. System ser ingen `department_session` → renderer empty-state: "Ingen plan for denne dagen ennå" + `[+ Opprett dagsplan fra mal]` CTA
3. Manager trykker → SlotPicker viser tilgjengelige `timeline_template`-rader (week-day-templates) → velger `Standard mandag`
4. System ruter via `day-line.instantiate_template` (eksisterer, PASS Trust Gate) → oppretter `department_session` + `day_lines` + `session_hooks` + `session_tasks` atomært via delegation (ADR-0240/0356)
5. Tidslinje refresher → manager ser full struktur tom for assignments → kan begynne planlegging per Journey 1

**Postcondition:** Tom dag har struktur. Bootstrap-template ga D6 produksjons-skjelett uten å låse spesifikke ansatte.

**Error paths:**
- Template-versjon mismatch (template eldre enn nåværende `framework_rule`) → gate_action validerer + tilbyr "Bruk gammel mal" vs "Tilpass først"
- Ingen templates eksisterer → CTA viser i stedet "Sett opp dagsmal under Innstillinger →"

**V1 scope note (2026-05-23):** Steg 2-4 (empty-state + bootstrap CTA + template-instantiate) krever ny empty-state UI i TidslinjeTab. V1 kan ship med simpler empty-state ("Ingen aktivitet for valgte lokasjoner" — eksisterer per Task 17 i14n keys); template-bootstrap CTA i V2.
