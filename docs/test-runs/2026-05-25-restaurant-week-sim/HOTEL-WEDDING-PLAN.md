---
title: Hotel Wedding Simulation — Plan (Phase 2)
status: in_progress
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [simulation, hotel, wedding, hospitality-event]
---

# Hotel Wedding — Grand Hotel Sjølyst, 80 guests, 3 days

> Phase 2 of the full-week sim. After the bistro week (Phase 1), simulate a high-stress
> 3-day wedding event at a 120-room boutique hotel. Different surface stack from a bistro:
> banquet ops, room ops, event timeline, multi-department coordination.

## Persona

**Hotel:** Grand Hotel Sjølyst — 120 rooms, restaurant, conference + event venue, 45 staff
**Event:** Marit + Espen wedding — 80 guests, 35 rooms booked, 3-night stay (Fri-Sun)
**Owner:** Pontus (admin role)
**General manager:** Henrik (admin role)
**Event manager:** Linda (manager role) — owns the wedding from inquiry to settlement
**Banquet captain:** Andreas (manager role) — leads service team during reception
**F&B manager:** Camilla (manager role) — kitchen + bar coordination
**Housekeeping lead:** Ingrid (manager role) — room turnaround across 3 days
**Front-desk lead:** Sara (manager role) — guest check-in spike Fri afternoon
**Staff:** 25 servers/bartenders/cooks/housekeepers/receptionists (employee role)
**Trainee:** Jonas (employee, trainee status) — first event week

## 3-day schedule

### Friday — Arrival + welcome dinner (40 guests, hotel + 22 staff working)

1. **12:00 — Linda opens event day-line** for wedding. Sees all sessions per department.
2. **13:00 — Housekeeping** turns 35 rooms (Ingrid manages parallel sessions across 8 housekeepers).
3. **14:00 — Front-desk pre-stages** keys + welcome amenities.
4. **15:00 — Guests start arriving** — Sara handles check-in surge (15 check-ins in 90 min).
5. **17:00 — Bridal party meets Linda** for run-through — last-minute changes captured.
6. **18:30 — Welcome dinner setup** in main restaurant (Andreas leads 6-server team).
7. **19:00 — Welcome dinner service** for 40 (bride/groom + close family).
8. **22:00 — Bar service** in lounge until 02:00.
9. **23:00 — Camilla closes kitchen**, F&B reconciliation.
10. **02:30 — Late shift settlement**, temporal lock.

### Saturday — The wedding (80 guests, full hotel + 30 staff)

1. **08:00 — Breakfast** for 80 hotel guests in restaurant.
2. **10:00 — Housekeeping** services 35 rooms (rolling, around guest schedule).
3. **11:00 — Ceremony setup** — chairs, sound, flowers in garden venue (banquet team).
4. **14:00 — Ceremony** outdoor, 30 min (front-desk staff support).
5. **14:30 — Reception begins** in ballroom (champagne reception + canapés, 80 guests).
6. **17:00 — Dinner service** in ballroom — 3 courses, 80 covers, 8 servers + 4 cooks + 2 bartenders.
   - Andreas runs pass; Linda coordinates with DJ/photographer.
   - **Trainee Jonas** assigned as runner (low-stakes role, supervised).
7. **20:00 — Speeches** — service pause.
8. **21:00 — Cake + dancing** — bar transitions to night service.
9. **23:00 — Late-night snack station** (pizza + sliders).
10. **01:00 — Bar last call**, 02:00 close.
11. **02:30 — Service team checkout**, temporal lock.

### Sunday — Brunch + departure + settlement (60 guests, 18 staff)

1. **09:00 — Departure breakfast** for 80 hotel guests.
2. **10:00 — Late wedding brunch** for 60 staying guests (lounge).
3. **11:00 — Check-out surge** — Sara handles 35 rooms checking out.
4. **12:00 — Linda meets bride/groom** for thank-you + feedback.
5. **14:00 — Housekeeping deep-clean** of ballroom + event spaces.
6. **15:00 — Linda runs event settlement** — total cost calc, tips, deviation review.
7. **16:00 — Linda closes event** — invoice draft to bride's father (payer).
8. **17:00 — Camilla + Henrik review** the 3-day P&L for event.
9. **18:00 — Pontus reviews** event in Smartout owner dashboard (commercial layer).

## Surfaces unique to hotel/event (NOT in bistro week)

- **Multi-department orchestration** — banquet + kitchen + bar + housekeeping + front-desk on one timeline
- **Room ops** — D6 sessions tied to room turnaround (different than restaurant prep)
- **Event timeline** — wedding is its own "session" with checkpoints (does Smartout model this?)
- **Guest count surge** — 80 in one room vs distributed bistro covers
- **Multi-day operation continuity** — staff overlap across 3 service periods
- **Tip pool across departments** — complex (banquet 50%, kitchen 30%, bar 20%)
- **Invoice + commercial layer** — event invoice ≠ regular monthly subscription
- **Last-minute coordination** — bride changes table plan at 16:30 Sat — does any surface support this?

## Open hypothesis (verify in sim)

Hotel + event ops is a **mostly unsupported sector** in current Smartout. The bistro week
will exercise most cascade dimensions. Hotel wedding will surface:

- Event-as-first-class-citizen gap (vs treating wedding as 80 anonymous covers)
- Multi-department session orchestration gap
- Banquet captain role nuances (not currently a Smartout role distinction)
- Room/F&B revenue split gap

## What "gap" means here

If Smartout has nothing for a journey step → **gap CRITICAL**.
If Smartout has a generic surface that could do it but is not specialized → **gap MEDIUM** (configurability question).
If Smartout has it and works → confirm, then move on.

Phase 2 lead agent writes to `findings/agent-{6,7,8}-hotel-*.md`.
