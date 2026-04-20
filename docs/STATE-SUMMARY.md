---
title: "STATE Summary — Quick Session Start"
updated: 2026-04-20
derived-from: docs/STATE.md (817 lines full version)
---

# STATE Summary

> Read this instead of STATE.md at session start. For deep dives, use semantic search on STATE.md.

## Active Work (2026-04-20)

| Worktree | Branch | Status | Notes |
|----------|--------|--------|-------|
| main repo | `development` | clean | `79092d31` — helpdesk Phase 1 merged + dashboard cleaned |
| `~/dev/smartout.ai-helpdesk` | `campaign/helpdesk` | active | Phase 1 UI shipped; open for Phase 1.1 + Phase 2 |
| `~/dev/smartout.ai-year-wheel` | `campaign/year-wheel` | active | Shell-replacement spec approved (ADR-0164), implementation in progress |
| `~/dev/smartout.ai-botsson-arena` | `campaign/botsson-arena` | active | Agent observability stream |

No active sub-sorties (helpdesk wt-1/2/3 removed after PR #225 merge). Sortie pool (wt-1–wt-20) entirely free.

See `docs/DASHBOARD.md` for live git state.

## Top Priority Gaps

### P0 — Blockers

1. **Phase 0 helpdesk_query_lifecycle dispatcher mismatch** — engine_process seed at `20260515130200` uses `event_type_any_of` which the dispatcher doesn't support. State machine is dead (UI writes direct to engine_state, so UI works but no engine-driven lifecycle). Caught by agent-coord code-trace 2026-04-20.
2. **Season tools + `cascade_budget_engine_process` are orphaned** (L-0061) — tools exist in `packages/ai/src/tools/season/` but Season capability never registered in `registry.ts`. `engine_trigger` rows listen for events that nothing produces. Needs either delete or register+wire.
3. **`workspace.active_contract_id` FK audit** — column exists, no FK enforced. Semantic target unclear (`contract` vs `employment_contract`). Migration `20260511100000_orphan_fk_fixes_and_polymorphic_comments.sql` commented on the confusion but didn't resolve.

### P1 — Active Campaign Follow-ups

**Helpdesk Phase 1.1** (in `campaign/helpdesk`):
- 15 UI telemetry events from Spec §4.3 (page/dialog/row views — only backend events registered, UI events deferred)
- Reassign dropdown in TicketHeader (needs `helpdesk.query.reassigned` emit wiring in UI)
- Conditional queue-tab visibility (only show `(queue)` tab for profiles with `responsible_profile_id` on any desk)
- Mobile ticket message embed (extract existing `(app)/(chat)/[id].tsx` body into shared component)
- Fix Phase 0 seed dispatcher (item #1 above)

**Year Wheel** (in `campaign/year-wheel`):
- Shell-replacement implementation per ADR-0164
- Deferred Phase 1.1: activation-gate, missing-checklist, Activate/Archive/Duplicate buttons, Goals tab, Procedures tab (logged in spec §11.5 per L-0074)

**Botsson Arena** (in `campaign/botsson-arena`):
- Ongoing agent observability work. See campaign plan for details.

### P2 — Queued (documented, not started)

- **Gatedwrite Wave 2A — Season wizard migration** (council 2026-04-18, APPROVE WITH CHANGES) — 5 items: SeasonSetupStep → Server Action, telemetry fix, `gatedUpdate` `entityIdColumn` required, tests rewrite, new gate-client contract.
- **Waves 2B (capability dual-gate) and 2C (schedule TanStack)** — blocked on prereqs; schedule already uses TanStack per ADR-0032 (WP5 claim in old STATE-SUMMARY was wrong).
- **Phase F (External Adapters)** — Tripletex first target. Placeholder adapter + schema enum exist; no active integration code yet.
- **Mobile Trust Freeze Week 1** (council 2026-04-17, 12-week remediation plan). Trust Gate REJECTED for new mobile mutations until 3 gates pass (telemetry contract test, Zod at enqueue, Botsson bridge ADR+stub). Weeks 1-2 stop-the-bleeding.
- **Strike-MCP Verification Phase B** (live MCP smoke tests, 9 tools × happy+edge path).
- **Tripletex-Ready Schema** — Wrightegaarden pilot cutover prep (135 profiles, 2750 shifts); 2 upstream gaps identified (STYRK-08 code, employment_form).

### Deferred / Blocked

- **Helpdesk Phase 2** — Auto-assign + SLA via `engine_delayed_trigger` reuse. Needs Phase 1.1 cleanup first.
- **Helpdesk Phase 3** — Call recording via LiveKit. BLOCKED on ADR-0135 (`mobile-voice-via-livekit-not-ultravox`) reaching `accepted`.
- **Parked branches** (2): `chore/pin-tanstack-query-5-90-21` (blocked on ADR), `fix/mobile-chat-web-stub-errors` (blocked on regression test).

## Cascade Status (~85% complete)

- **Phase A (Schema):** DONE
- **Phase B (Pure Functions):** DONE — 10 functions, 8 test files
- **Phase C (Bootstrap):** DONE — framework seeded, I1 wired, rates corrected, 10 verification tests
- **Phase D (Operational Layer):** DONE — hooks, panels, engine actions, publish validation all wired
- **Phase E (Control Planes / C4 governance):** PARTIALLY SHIPPED (verified 2026-04-20 per L-0078)
  - WP1 `engine_authority_config` schema + pilot RPC — SHIPPED
  - WP2 `cascade_gate_write` RPC + `gate-client.ts` wrapper — SHIPPED (migrations `20260512100000` + `20260512100200`). 63 call sites in `apps/web/src/app/dashboard/` use `gatedUpdate`/`gatedInsert`.
  - WP3 Wave 2A Server Actions — SHIPPED (`season-actions.ts`, `people-actions.ts`)
  - WP4 Wave 2B capability dual-gate — not started; no attempt yet
  - WP5 Wave 2C schedule — `/dashboard/schedule` already uses TanStack per ADR-0032; not a migration target
  - Known dual-gate risk: agent tools call old `gate_action`, Server Actions call new `cascade_gate_write` — same mutation via different paths may yield different outcomes. Needs reconciliation ADR.
- **Phase F (External Adapters):** NOT STARTED — Tripletex first target

## Recent Merges (last 7 days)

- **2026-04-20 — Helpdesk Phase 1 UI** (PR #225): desks admin + ticket conversation + mobile queue. 13 commits; 3 new learnings (L-0079/0080/0081).
- **2026-04-19 — Botsson-arena test verification** (PR #224) + campaign milestone merge (PR #223).
- **2026-04-19 — Overview v2** (PR #222): WebDayControl as canonical D6 admin surface (ADR-0156).
- **2026-04-18 — Dashboard-fix** (PR #221).
- **2026-04-17 — Week 1 audit remediation** (PR #218): FK + barrel removal + next/image + ADR-0029 amendment cross-link.
- **2026-04-17 — Ultrareview correctness** (PR #217): 5 non-blocker bugs.
- **2026-04-17 — Ultrareview blockers** (PR #216): gate_action p_entity_id + rate-limit fail-closed.
- **2026-04-17 — Billing engine Phase 3 + 3b** (usage_snapshot, invoice tables, basis_drift_event, dispatch rule evaluation).
- **2026-04-14 — Training Module 6** (admin assignment CRUD, mobile training wiring, readiness dashboard).

## Process Hardening (recent councils)

- **L-0079 / L-0080 / L-0081 (2026-04-20 Helpdesk final merge council)**:
  - UI terminal `engine_state` transitions must stamp `completed_at` (mirror dispatcher invariant).
  - Reassignment mutations must demote prior holder (ghost accretion trap).
  - Supabase chainable-proxy mocks echo column names — 3rd occurrence, promote to process rule: code-tracer role must verify `.select(...)` columns against generated `Database` types.
- **L-0076 / L-0077 / L-0078 (2026-04-20 hybrid council)**:
  - Established-pattern bypass (new hook ignored `useWorkspaceOptional`).
  - ADR fail-closed enforcement requires per-consumer retrofit plan before acceptance (ADR-0163 saga).
  - PLAN-file decay — `PLAN-cascade-gate-write.md` stayed `exploration` while WP2 shipped; 4th occurrence.
- **L-0042 / L-0043 / L-0040 (2026-04-17)**: migration timestamp causality, Phase 2.5 identity-claim verification, pre-workspace Edge Function ADR.

## Quick References

- **164 ADRs** (accepted 0001–0164, with 0135/0151/0152/0153/0154/0155/0158 still `proposed`).
- **82 Learnings** (L-0001 through L-0081).
- Canonical cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Full state: `docs/STATE.md` | Worktrees: `docs/DASHBOARD.md` | Boot cheat sheet: `docs/ORIENTATION.md`
- Council log: `docs/council/COUNCIL-LOG.md`
