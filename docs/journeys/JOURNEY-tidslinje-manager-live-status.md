---
title: "Journey: Manager sjekker live-status under lunsj-rush"
status: verified
feature: p10-tidslinje-tab
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, day-control-panel, p10, manager, live-status]
---

# Journey: Manager sjekker live-status under lunsj-rush

**Precondition:** `department_session.status = 'active'`. Vakter check'et inn. Minst 1 `session_task` pågående.

1. Klokken 12:15. Manager på gulvet hører klage fra gjest → drar opp app, klikker dato i header → DayControlPanel åpnes → klikker **Tidslinje**
2. System renderer liste m/ live-status-dots per item:
   - 🟢 grønn = pågående/ferdig på tid
   - 🟡 gul = nær deadline
   - 🔴 rød = overdue/ikke startet
3. Manager ser `Prep grønnsaker 11:30 🔴 OVERDUE — ingen tildelt` + `Lunsj-vakt 10:30 🟢 Kari sjekket inn 10:28`
4. Manager klikker `Prep` rad → EntityDrawer åpnes m/ task-detalj (inherited fra DashboardShell globalt) → Manager tildeler `Per` → System ruter via `task.assign` capability → emit `task.assigned` → live-status oppdateres 🟡
5. Manager ser nederste linje: "1 åpen vakt 14:00 — Bar" → klikker linje → SlotPicker åpnes → Manager velger eksisterende ansatt fra liste → System ruter via `schedule.assign_employee` → vakt nå tildelt
6. Manager lukker panel → går tilbake til gulv

**Postcondition:** Live tidslinje viser current truth. Alle re-assignments gjennom gated tools. `activity_trail` logger hver action med `actor_id=manager`.

**Error paths:**
- Live-status drift (read-after-write inconsistency) → 5s polling via TanStack `staleTime` + WebSocket fallback (engine_event subscription) → user ser stale dot maks 5s
- Ansatt allerede fullbooket → gate_action DENY → modal "Per har konflikt: vakt 13-17 Sal" + foreslå alternativ
- Panel åpnes for dato uten session → "Ingen session for denne dagen" CTA → `[+ Opprett session]` knapp

**V1 scope note (2026-05-23):** Live-status-dots (steg 2) krever utvidet status-derivation i `useDayTimelineEvents` — egen task i Sortie 2 hvis det er V1, ellers V2.
