---
title: "STATE Summary — Quick Session Start"
updated: 2026-04-17
derived-from: docs/STATE.md (82KB full version)
---

# STATE Summary

> Read this instead of STATE.md at session start. For deep dives, use semantic search on STATE.md.

## Active Work

| Branch | Status | Notes |
|--------|--------|-------|
| wt-4 `feat/billing-engine-fase-1` | in-progress | Billing engine Fase 1 build |
| development | clean | 2026-04-17 merges landed (#216, #217, #218) |

See `docs/DASHBOARD.md` for full worktree map.

## Top Priority Gaps

No critical gaps. Next focus areas:

1. **Week 2 audit remediation** — PR4 i18n externalization (LeaderPulseCard + 10 siblings) + PR6 governance telemetry quad-destination (blocks on ADR-0122 acceptance).
2. **Week 3 audit remediation** — PR5 BotssonArena split at VIEW_COMPONENTS boundary + PR7 named-hooks extraction to `packages/dashboard-data/`.
3. **Cascade Phase E (Control Planes)** — NOT STARTED. C4 governance first.
4. **Cascade Phase F (External Adapters)** — NOT STARTED. Tripletex payroll sync first target.

### Deferred (queued tickets)

- **PR3b** (Week 2 candidate): dashboard avatars (komm x2, people x3) to `next/image` — needs `remotePatterns` tightening for authenticated Supabase Storage URLs.
- **`workspace.active_contract_id` FK audit**: semantic target unclear (candidates: `public.contract` vs `public.employment_contract`; surrounding `trial_*`/`suspended_at` columns suggest SaaS-lifecycle, not HR). Deferred after plan audit discovered original mapping was wrong (column was claimed on `profile`, actually on `workspace`).
- **Billing council 4 reserved ADRs** (0118–0121): still not written.

### Closed gaps (recent)

- ~~ultrareview blockers~~ — FIXED via PR #216 (`0989bd79`, 2026-04-17): gate_action signature + rate-limit fail-closed.
- ~~ultrareview correctness 5 bugs~~ — FIXED via PR #217 (`cd8e7460`, 2026-04-17): briefing day-index, engine-dispatch entity FK, swap notification gate, contract-intake engine-state filter, ops-monitor timezone.
- ~~Week 1 audit remediation~~ — SHIPPED via PR #218 (`5092d9cd`, 2026-04-17): FK on tariff_rate_table provenance + polymorphic COMMENTs (ADR-0124) + _hooks barrel removal + next/image in 6 public-site sites + ADR-0029 amendment cross-link.
- ~~Shift Publish -> Session~~ — FIXED. `schedule_control` handler implemented (`d730bedf`). Full flow: emit -> trigger -> upsert_session -> session hooks.
- ~~Trainee first-day redirect~~ — FIXED. Invite sets "trainee" for employees, dashboard layout redirects to my-training (`13fe0015`).
- ~~Notifications delivery~~ — DONE. All 4 channels implemented (push, email, SMS, in-app).
- ~~Settings incomplete~~ — DONE. All 19 tabs implemented.
- ~~my-schedule realtime~~ — DONE. `useMyShiftsRealtime()` called in MyWeekView.tsx:85.
- ~~AI classifier gaps~~ — NOT A GAP. `contract_intake` and `shift_swap` are chat-only by design (ADR-0078).

## Cascade Status (~80% complete)

- Phase A (Schema): DONE
- Phase B (Pure Functions): DONE — 10 functions, 8 test files
- Phase C (Bootstrap): DONE — framework seeded, I1 wired, rates corrected, 10 verification tests
- Phase D (Operational Layer): DONE — hooks, panels, engine actions, publish validation all wired
- Phase E (Control Planes): NOT STARTED — C4 governance first
- Phase F (External Adapters): NOT STARTED — Tripletex first target

## Recent Merges (last 2 weeks)

- **2026-04-17 — Week 1 audit remediation** (#218): FK + barrel removal + next/image + ADR-0029 amendment cross-link
- **2026-04-17 — ultrareview correctness** (#217): 5 non-blocker correctness bugs (briefing, engine-dispatch, swap notifications, contract-intake, ops-monitor TZ)
- **2026-04-17 — ultrareview blockers** (#216): gate_action p_entity_id + rate-limit fail-closed
- Cascade Phase D completion: publish validation dialog wired (Apr 14)
- E2E cleanup: 8 obsolete tests removed, skip messages improved (Apr 14)
- Gap fixes: schedule_control handler, trainee redirect flow (Apr 14)
- Training Module 6: admin assignment CRUD, mobile training wiring, readiness dashboard (Apr 14)
- Contract template binding K1b layer (Apr 14)
- Ops intelligence phases 1-3, e2e test repair, mobile shift completion (Apr 14)
- Contract workspace tab + DocuSeal integration + mobile signing (Apr 13)
- Year-wheel cascade resolution + season operating hours (Apr 13)
- Platform-admin workspace field inheritance (Apr 13)

## Process Hardening (2026-04-17)

Three `run-council` sessions today surfaced three systemic plan-authoring gaps; each is now enforced:

- **L-0042** + `smartout-database-guide` skill: migration timestamps are causal order in a dependency DAG, not chronological markers. Phase 2.5 now verifies timestamp ordering.
- **L-0043** + `run-council` Phase 2.5: audit column→table identity claims must be verified against `information_schema`, not migration-scan or grep. Phase 2.5 now checks identity claims (column location, file existence, grep hits), not just counts.
- **L-0040** + ADR-0123 + `smartout-edge-function-guide` skill: pre-workspace Edge Functions (invite tokens, signup) are explicit exceptions to ADR-0029 gateway rule. 3rd pre-workspace endpoint triggers `identity-api` gateway ADR.

## Quick References

- 87 ADRs (0122/0123/0124 proposed), 33 Learnings (0040–0043 new today), 93 Journeys, 130 enums, ~236 tables
- Canonical cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Full state: `docs/STATE.md` | Worktrees: `docs/DASHBOARD.md` | Boot cheat sheet: `docs/ORIENTATION.md`
