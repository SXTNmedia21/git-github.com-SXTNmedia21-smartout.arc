---
title: "Roadmap — Platform admin authors a new journey via the wizard"
roadmap_id: roadmap_platform_admin_authors_journey
fires_mission: journey_platform_admin_authors_journey_v1
journey_id: platform-admin-authors-journey
created: 2026-04-29
updated: 2026-04-29
---

# Roadmap — Platform admin authors a new journey via the wizard

## Entry point

| Surface | Where | Affordance |
|---|---|---|
| Web | `/platform-admin/journeys/wizard` | Button "Ny journey" (Plus-ikon) — top-right of the wizard launcher list |
| Mobile | — | Not exposed (ADR-0133 — authoring is web-only) |

## Trigger

A platform admin (godmode) clicks "Ny journey". The launcher inserts a new
`wizard_session` row (`status='active'`, `current_phase='discovery'`) and
redirects to `/platform-admin/journeys/wizard/{wizard_session_id}`. The
wizard chat surface opens. The first user message fires the mission.

## Pairing

- `roadmap_id` → `roadmap_platform_admin_authors_journey`
- `fires_mission` → `journey_platform_admin_authors_journey_v1`
- The mission record at `MISSION.md` has matching `roadmap_id`.

## Why a roadmap, not a Server Action

The wizard is a multi-turn conversational flow, not a single mutation. The
roadmap captures the entry-point UX (the button + initial state); the
mission captures the agent's manuscript over the 6 phases. They are paired
1:1 and must agree on `mission_id` (enforced at `/journey-protocol approve`
per `folder-layout.md` §"Pairing rules").

## Authority

- Owner / admin (godmode): `autonomous` — wizard accessible.
- Manager / employee: `disabled` — wizard route returns 403.

Seeded by `supabase/migrations/20260519100002_seed_journey_authoring_authority.sql`.

## Channel

`chat` only. ADR-0078 forbids voice for journey authoring (long-form
structured creation that voice cannot reliably express).
