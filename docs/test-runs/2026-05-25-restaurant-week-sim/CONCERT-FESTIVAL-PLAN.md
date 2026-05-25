---
title: Concert + Festival Simulation — Plan (Phase 3)
status: in_progress
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [simulation, festival, concert, multi-vendor, peak-event]
---

# Concert + Festival — "Sjølyst Sommerfest" — 1 day, 1200 guests, 60 staff

> Phase 3 — extreme stress test. Pop-up event with multi-vendor F&B, stage production,
> security ops, ticket scanning, cash + cashless float, all under a single workspace.

## Personas

**Festival director:** Pontus (admin) — owns event P&L
**Operations chief:** Magnus (manager) — runs the day
**Stage manager:** Liv (manager) — artist liaison, set times, sound
**Bar manager:** Jens (manager) — 3 bar zones, 12 bartenders
**Food court coordinator:** Yara (manager) — 4 food vendors (sub-workspaces? or just vendors?)
**Restaurant chef:** Truls (manager) — VIP restaurant 60 covers
**Security lead:** Sigrid (manager) — 10 security + crowd ops
**Front-of-house lead:** Kasper (manager) — ticket scan + entrance
**Production lead:** Trine (manager) — stage crew, runners, backstage hospitality
**Trainee:** Vegard (employee, trainee) — runner role, first festival

**60 staff distribution:**
| Department | Count | Notes |
|-----|-----|-----|
| Bar (3 zones) | 12 | Cashless POS, ID checks |
| Food court (4 vendors) | 15 | Each vendor may be sub-workspace |
| VIP restaurant | 8 | Truls + 2 sous + 5 servers |
| Stage crew | 10 | Sound/light/runners/load |
| Security | 10 | Crowd flow, ID, ejection, medical liaison |
| Ticket/entrance | 5 | Scanning, wristbands, lost ticket replace |

## Single-day timeline (festival day = Saturday)

### 08:00 — Load-in + setup

1. Stage crew load-in. Production schedule per artist (3 acts).
2. Bar zones setup. Cashless POS deployed (Adyen or whatever).
3. Food vendors arrive — each has own staff, own POS, but festival-wide ticketing/wristband system.
4. Security briefing. Medical liaison check-in.

### 11:00 — Staff briefing + all-hands

Magnus runs all-hands. All 60 staff acknowledge via mobile? Or paper? Smartout's announcement
capability scales to 60-on-shift fanout in one read?

### 14:00 — Doors open

1. Kasper's ticket team scans 1200 tickets over 90 min. Real-time capacity counter?
2. Bar opens. ID checks. First rush.
3. Food court opens. 4 vendors live.
4. VIP restaurant accepts pre-booked 60 covers.

### 15:00–22:00 — Concert blocks

- 15:30 — Opener act (45 min)
- 17:00 — Middle act (60 min)
- 19:00 — Headliner soundcheck (closed to public)
- 20:00 — Headliner (90 min)
- 21:30 — Encore + close

During each block: stage cues, lighting, hospitality runners. Bar peak at intermissions.
Security manages crowd surges at stage front.

### 22:00 — Wind-down

1. Last call at bars.
2. Food vendors close at 23:00.
3. Crowd dispersal — security manages exit flow.
4. Lost-and-found check-in (where does this live in Smartout?).

### 00:00 — Strike + settlement

1. Stage crew strike.
2. Cash count per bar zone + food vendor.
3. Cashless POS reconciliation (Magnus + Jens).
4. Vendor settlement — each food vendor gets their share (revenue split formula?).
5. Tip pool — bars + restaurant + security? (festival tip culture?).
6. Vegard (trainee) end-of-event debrief.

### Next morning 08:00 — Pontus reviews

- Total revenue per channel (bar / food court / VIP / merch)
- Cost per department (labor, ingredients, security, production)
- Deviation log (medical incidents, crowd alerts, breakages)
- Staff sign-off + payroll for casual labor (one-day employment?)

## Surfaces unique to festival (NOT in bistro week + NOT in hotel wedding)

- **Pop-up department** — no permanent D1 envelope; need temporary department + dissolve
- **Casual / one-day labor** — employment_contract for one day? OR shift-only without contract?
- **Multi-vendor sub-workspaces** — does Smartout support 4 vendors operating IN one festival?
- **Capacity tracking** — 1200 guest cap, real-time counter for safety regulations
- **Volunteer hours** — some festival staff are volunteers (no pay, perks instead)
- **Ticket scanning + wristband** — entirely outside Smartout's current scope (use external)
- **Multi-zone POS / cash + cashless split** — heavy F&B cash mgmt
- **Stage time as production schedule** — artist soundcheck windows hard-locked
- **Security incident logging** — does Smartout's deviation cover this? Ejections + medical?
- **Lost-and-found** — likely external; but flow could integrate
- **Revenue split between festival + food vendors** — commercial layer needs this
- **Tip pool across diverse depts** — bar+kitchen+security?
- **Crowd-surge alerts** — operational comms during the show

## Open hypothesis

Festival ops is **far outside current Smartout scope**. Even the cascade model
(I1 + 6D + 4C) may not bend to event-only workspaces. This phase should surface:

- Whether the cascade model accommodates a pop-up
- Whether multi-vendor co-existence in one workspace works
- Whether casual labor (no contract) is even possible
- Whether real-time capacity / crowd alerts have any home in current architecture

## Agents

A9 — Setup + arrival (08:00–14:00): load-in, vendor coordination, briefing, doors
A10 — Showtime + service (14:00–22:00): concert blocks, F&B peak, security ops
A11 — Strike + settlement (22:00–next morning): cash count, vendor settlement, payroll, P&L

Each writes findings/agent-{9,10,11}-festival-*.md.
