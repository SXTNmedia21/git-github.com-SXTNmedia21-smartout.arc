---
title: "Journey: Manager re-planlegger etter avbestilling (Botsson assist)"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, day-control-panel, p10, manager, botsson, voice]
---

# Journey: Manager re-planlegger etter avbestilling (Botsson assist)

**Precondition:** Tidslinje-tab åpen. Botsson Orb passive (DayControlPanel deklarerer ikke `DomainChatOwnership`; Orb interaktiv per ADR-0238).

1. Avbestilling kommer på sms kl 11:00 (bord 8, 6 personer kl 19:00) → Manager åpner Tidslinje-tab
2. Manager trykker Orb og sier "Avbestilling kveld, fjern Per fra 18-vakta og flytt cleaning til 17:00"
3. Botsson leser pinned context (`pinDayControlPanelContextAction` ga den date + dept) → klassifiserer intent → kaller `schedule.unassign_employee(shift_id, profile_id=Per)` + `task.update_scheduled_at(task_id=cleaning, scheduled_at=17:00)`
4. Begge tools wrappes i `gatedMutation` per ADR-0204 → gate_action validerer → DB updates + emits
5. Tidslinje-tab rerender live (TanStack invalidation triggered av emit-bus) → Manager ser Per fjernet + cleaning på 17:00 + toast "2 endringer utført"
6. Botsson svarer "Per fjernet fra 18-vakta. Cleaning flyttet til 17:00. Per er nå tilgjengelig — vil du tilby ekstra-vakt et annet sted?"

**Postcondition:** 2 mutations via samme capability surface som DnD bruker (single pipeline preserved per Steward synthesis L-0338). `authority_config` tillot suggest-level uten ekstra confirm fordi manager-rolle + lav-risiko (mindre enn 2 timer endring).

**Error paths:**
- Botsson tolker feil ("flytt cleaning til 17:00" → 17:00 i morgen) → suggest-authority betyr Botsson foreslår + ber confirm → Manager kanselerer → ingen DB-write
- Tool ikke seedet i authority_config for denne rollen → gate_action DENY + Botsson sier "Trenger admin for denne handlingen"
- Channel-guard treffer (Orb i voice-modus prøver task-tool) → ADR-0078 double-guard rejecter → "Bruker chat for denne"

**V1 scope note (2026-05-23):** Steg 3 (`schedule.unassign_employee` + `task.update_scheduled_at`) er DEFERRED til capability-sortie (G19b). V1 kan demonstrere intent classification + suggest-confirm UX-flow med EKSISTERENDE tools (f.eks. `day-line.update_hours`). Full journey låses opp ved G19a/b/c closure.
