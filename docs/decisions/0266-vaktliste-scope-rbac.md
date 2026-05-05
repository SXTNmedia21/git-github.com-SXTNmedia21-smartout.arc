---
title: "Vaktliste Scope RBAC — Client-Filter Now, Server-Gate Deferred"
id: ADR-0266
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
---

# ADR-0266: Vaktliste Scope RBAC

## Context

Mobile vaktliste (handoff `shiftlist.jsx → ScopeChips`) introduces four scope-modes for shift visibility:

| Scope | Description |
|---|---|
| `me` | Innlogget ansatts egne skift |
| `all` | Hele teamet — alle ansatte i workspacet |
| `dept` | Alle ansatte i en valgt avdeling |
| `person` | Spesifikk kollegas plan (4-kol grid → person-detail) |

Phase 1 lovsen-rapport (2026-05-04) found:

- `jwt_read_schedule_shift` policy already returns ALL workspace shifts to ANY workspace member — RLS does not gate by scope-mode (F-06 MEDIUM).
- `engine_authority_config` has no `schedule.view_team` / `schedule.view_person_detail` capability seeded (F-08 MEDIUM).
- `isShiftLead` flag is per-shift visual badge, not a profile-level role (F-07 MEDIUM).
- GDPR art. 6(1)(f) (berettiget interesse) is the operative legal basis for showing kolleger names + roles + times to all workspace members in a hospitality/restaurant context (lovsen Q1 confidence MEDIUM).

The handoff plan §Phase 3d (shift list redesign) ships before any server-side scope gate. Decision: codify the RBAC model as **client-filter for now, server-gate deferred to backlog**, with a clear capability-table draft for the eventual `engine_authority_config` seed.

## Decision Drivers

- ADR-0133 codifies mobile as D6/C4 execution surface — calendar/vaktliste are READ surfaces; client-filter on RLS-scoped reads is acceptable for read-only views per Cascade Invariant 5 (permissions do not alter truth).
- GDPR art. 6(1)(f) berettiget interesse is sufficient legal basis for all four scope-modes in the workspace context — lovsen Q1 confirms.
- Existing RLS already restricts to workspace members. Cross-workspace leak is impossible.
- Adding a server-side BFF gate per scope-mode introduces a new auth surface that must follow ADR-0151 (server-derived workspace_id) and ADR-0099 (gate_action audit) — premature for an MVP read view.
- L-0177 (silent body-supplied row fallback) — any future BFF route MUST fail-fast on missing JWT-derivable workspace.

## Considered Options

1. **Client-filter only (chosen for now).** Wt-3 implements scope filter in `useCalendarItems({ scope })` against RLS-scoped reads. No new BFF route, no `engine_authority_config` seed.
2. **Server-side gate per scope-mode now.** Add BFF route + capability seed + `gate_action` call per scope shift. Rejected for Phase 3 — adds auth surface complexity for a read-only view; no documented attack surface (RLS already enforces tenant isolation).
3. **Mixed (`me`/`dept`/`person` client, `all` server-gated).** Rejected for Phase 3 — adds branching complexity without proportional security gain. Re-evaluated for backlog.

## Decision Outcome

**Chosen: Option 1 — client-filter on RLS-scoped reads, server-gate deferred to backlog.**

### Implementation contract

**`useCalendarItems({ date, scope, filter })`** (Phase 3c):

- Reads `schedule_shift`, `session_task`, `schedule_day_booking`, `deviation` directly from Supabase via existing JWT-scoped clients.
- Applies scope filter client-side using mapping below.
- Department link: `position_id → position.department_id` (NOT `schedule_shift.department_id` which is NULLABLE-by-design — see memory entry "schedule_shift fetch pattern 2026-04-24").
- `profile.role` is canonical differentiator. `isShiftLead` (per-shift badge) does NOT gate scope-mode access.

### Client-filter logic per scope

| `profile.role` | `scope='me'` | `scope='all'` | `scope='dept'` | `scope='person'` |
|---|---|---|---|---|
| `employee` | always | allowed (GDPR f-basis dokumentert i personvernreglement) | allowed | allowed (kun navn/rolle/tid; ingen PII) |
| `manager` | always | always | always | always + ekstra kontaktinfo |
| `admin` / `owner` | always | always | always | full PII |

(Booking PII per `CalendarItem.contact` follows ADR-0267 — gated separately.)

### Backlog: deferred server-side `scope='all'` gate

When the workspace has organizational reasons to restrict employee visibility into team-wide schedules (e.g., union contract, GDPR DPIA outcome, customer wish), seed `engine_authority_config`:

| capability | level | min_role | allowedChannels | Notes |
|---|---|---|---|---|
| `schedule.view_team` | `read_only` | `employee` (default open) | `["chat","ui"]` | Workspace can override `min_role='manager'` for stricter setting |
| `schedule.view_person_detail` | `read_only` | `manager` | `["chat","ui"]` | Person-specific PII (contact info, attendance patterns) — gated to managers |

Until seeded, both default to OPEN per Cascade Invariant 5 (permissions do not alter truth — RLS provides tenant isolation; visual scope is product, not permission).

### Workspace-level documentation requirement

Workspace admins must document in personvernreglement (privacy notice) that vaktplan internal sharing is on GDPR art. 6(1)(f) basis (driftsformål). This is a **product / legal task**, not a code task. Tracked as backlog (lovsen F-06).

## Rules

### R1. Client-filter on RLS-scoped reads is canonical for read-only scope-modes

Mobile vaktliste/calendar reads MUST filter scope client-side. RLS guarantees workspace isolation; scope is product UX, not auth.

### R2. `profile.role` is the canonical differentiator

Not `isShiftLead`. Not `team.leader_profile_id`. The scope-mode access table above MAY be tightened per workspace-admin override in the future, but `profile.role` is the only attribute consulted today.

### R3. No body-supplied workspace_id in any future BFF route for scope-gating

If a workspace eventually opts into `schedule.view_team` server-gate, the BFF route MUST resolve `workspace_id` from JWT via `getProfileContext()` per ADR-0151 + L-0177.

### R4. ADR-0267 governs booking-PII separately

`CalendarItem.contact` (gjeste-navn + telefon) is **field-level** access control, not scope-mode. Even an `employee` who can see `scope='all'` shifts must see masked contact for booking-type items per ADR-0267.

## Consequences

### Positive

- Phase 3d (shift list redesign) UNBLOCKED — no auth surface to design.
- No new `engine_authority_config` seed needed for Phase 3 ship.
- Cascade Invariant 5 preserved: domain truth (who-works-when) not altered by permission.
- Future server-side gate path is documented and seedable when product/legal demands it.

### Negative / Debt

- Client-filter can be bypassed by malicious actor reading raw `schedule_shift` rows via Supabase client. Mitigated by: workspace RLS still applies; only own-workspace data exposed; lovsen confirms this is GDPR-acceptable.
- Workspace-admin override (per-workspace `min_role` lift) requires backend work when activated.

## Cross-references

- **ADR-0078** — channel restriction (chat/voice for PII)
- **ADR-0099** — gate_action audit (any future server-gate must emit gate_evaluation)
- **ADR-0133** — web composes, mobile executes (calendar = D6 read surface)
- **ADR-0151** — stage-engine profile_id server-derivation (any future BFF route)
- **ADR-0267** — booking-PII access control (field-level, separate from scope)
- **L-0044** — mobile-parity-graveyards
- **L-0177** — silent body-supplied row fallback
- **Lovsen F-05/F-06/F-07/F-08** — RBAC backlog items
- **Cascade spec** — Invariant 5 (permissions do not alter truth)

## Status

`proposed` — accepts on Phase 3d implementation merge once `useCalendarItems` lands with documented client-filter behavior + commented capability-table draft.
