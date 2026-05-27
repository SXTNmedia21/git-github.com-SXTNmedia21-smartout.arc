---
title: "STATE Summary — Quick Session Start"
updated: 2026-05-26
derived-from: docs/STATE.md (817 lines full version)
---

# STATE Summary

> Read this instead of STATE.md at session start. For deep dives, use semantic search on STATE.md.

## Active Work (2026-05-26)

| Worktree | Branch | HEAD | Status | Notes |
|---|---|---|---|---|
| main repo | `development` | `79e383c33` | clean | 6 fixes shipped today (security + tests + tokens) |
| `~/dev/smartout.ai-botsson-arena` | `campaign/botsson-arena` | `5ef8ab203` | clean | Sync-only ahead of dev |
| `~/dev/smartout.ai-bubble-migration` | `campaign/bubble-migration` | `35803937f` | clean | 126 commits ahead dev; G7-readiness council passed; blocked on T9–T13 |
| `~/dev/smartout.ai-daily-operation` | `campaign/daily-operation` | `c7ba770dc` | 1 untracked | Sync-only ahead |
| `~/dev/smartout.ai-mobile` | `campaign/mobile` | `ace36c7f5` | clean | Sync-only ahead |
| `~/dev/smartout.ai-payroll` | `campaign/payroll` | `d4cc83f54` | clean | Sync-only ahead |
| `~/dev/smartout.ai-ui-shell` | `campaign/ui-shell` | `fd569c0d1` | clean | Sync-only ahead |
| `~/dev/smartout.ai-ui-shell-followup` | `campaign/ui-shell-followup` | `932e91ec0` | clean | Sync-only ahead |
| `~/dev/smartout.ai-world-best-wfm` | `campaign/world-best-wfm` | `84902705e` | clean | Sync-only ahead |

Open PRs (2026-05-26): _none_.

Recently merged (2026-05-25 → 2026-05-26 UTC):
- **PR #486** — setup-flow redirect-loop guard + storage godmode bypass → merged 2026-05-25 23:30 UTC (`cf62db965`)
- **PR #488** — DashboardShell sub-header `min-h-16` (oppgaver redesign Track A) → merged 2026-05-26 03:04 UTC (`a8a66a454`)

Sortie pool entirely free. No active sub-sorties.

Campaign drift refreshed 2026-05-26: ui-shell + ui-shell-followup + mobile all synced with development (39/40/40 commits respectively). `sync-campaign.sh` patched with `pnpm install --prefer-offline` pre-flight to pre-empt L-0190 4th occurrence.

## Production / Preview State (2026-05-25)

- **Production smoke:** GREEN (Vercel web 200, landing 200, Supabase REST alive, EFs alive, droplet reachable)
- **Preview smoke:** GREEN (Vercel preview SSO-gated, Supabase Branch DB intentionally absent per ADR-0360)
- **Drift-check:** PASS — 56-entry Vercel manifest matches baseline, env.ts traced, droplet env aligned
- **Dev ahead of preview:** 159 commits (promotion window open)

## Today's Shipped Fixes (2026-05-25 → 2026-05-26 session-end)

| Commit | What |
|---|---|
| `ea36f17e1` | `test(payroll-calculate)`: align W09 severity expectation with code (BUG-SIM-15) — unblocks vitest CI gate for all PRs |
| `3d5e2f07f` | `chore(env)`: fix stage-engine vault reference smartout_ai_dev → smartout_ai |
| `fd2824c1a` | `fix(security)`: auth before delete in ingest-workspace-knowledge — CRITICAL audit finding |
| `03d62f25d` | `test(oppgaver)`: align grep tests with PR-487 + DnD merged state (5 stale assertions) |
| `f2568d762` | `fix(security)`: inline SET search_path on SECURITY DEFINER billing fns (2 HIGH audit findings) |
| `ca97b8485` | `docs(audit)`: 2026-05-25 smoke summary + 3 slice reports |
| `79e383c33` | `fix(security)`: verify caller owns profile_id in shift-clock-compliance (1 HIGH audit finding) |
| `17a3750aa` | `docs(state-summary)`: refresh from 2026-05-06 to 2026-05-25 |
| `de98f16d1` | `fix(security)`: server-derive workspace_id in queryOthersAvailability (HIGH ADR-0151) |
| `59d157bb3` | `fix(telemetry)`: add emit() to guardian/acknowledgeSignal (HIGH ADR-0358) |
| `e513b2cfa` | `fix(security)`: gate getTeamReadiness against workspace-wide PII leak (HIGH ADR-0099 §2) |
| `c7f145363` | `feat(payroll)`: approve-period BFF + Godkjenn UI — **closes P0 GAP-SIM-B02** (Bokf §13) |
| `fa09f2158` | `fix(tips)`: hide not_implemented stubs from LLM router — **closes P0 ADR-0422 conflict** |
| `c33c1437c` | `fix(tooling)`: WSL2 OOM pre-flight gate in close-feature.sh — **closes P0 ADR-0412 mitigation** |
| `5a982ce57` | `fix(authority)`: seed 5 missing caps + shift_marketplace backfill — **closes P0 #3 (CVE-class)** |
| `e7c97d989` | `feat(schema)`: add volunteer enum + ADR-0428 — **closes P0 #2 (BUG-SIM-01)** |
| `39578426a` | `test(engine-dispatch)`: 5 structural tests — **PARTIAL P0 #1** (runtime E2E still deferred) |
| `390b5053d` | `fix(journey)`: publishMission via mutateWithGate (ADR-0204 Pathway B) |
| `c17a4b715` | `fix(contract)`: 3 template-write tools via mutateWithGate (continues P0 #4) |
| `c54bc71f0` | `fix(contract-intake)`: mutations via mutateWithGate — **closes P0 #4 + audit H-1** |

**Closed today:** 1 CRITICAL + 7 HIGH audit findings (H-1 + 5 in-session + 1 verified-overstated) + **7 of 8 P0 blockers** (#2, #3, #4, #5, #6, #7, #8). Remaining: P0 #1 invoke_capability_tool runtime E2E (5 structural tests landed `39578426a`; full local-stack E2E genuinely needs supabase + stage-engine + Node ai-tools-runner running — ~2-4h memory-bound setup not autonomous-safe under ADR-0412 WSL2 endemic).
**Audit verified-overstated:** schedule "zero gates" (has inline role-check), schedule "phantom events" (both emit), helpdesk engine_trigger orphan (row exists, dispatcher dual-key).

## Top Priority Gaps

### P0 — Blockers

1. **PARTIAL ✅ 2026-05-26 (`39578426a`)** — `invoke_capability_tool` 5 additional structural tests landed (24/24 pass). Phase 3 runtime E2E with full local stack (supabase + stage-engine + Node ai-tools-runner) still deferred — ~2-4h memory-bound setup, not autonomous-safe under WSL2 OOM endemic (ADR-0412). Structural invariants now cover: success-branch tool_result_summary, ok:false-branch tool_result_summary, dual engine_state+engine_state_step failed transition, idx_engine_state_step_invoke_cap migration existence, gate_evaluation_id→gate_action_id rename.

2. ✅ **CLOSED 2026-05-26 (`e7c97d989`)** — `employment_form` BUG-SIM-01 closed via ADR-0428 + two-part forward migration. `'volunteer'` is now an explicit enum value (was 5→6 values: permanent/temporary/apprentice/practice/freelance/volunteer). Bubble-migration recovery heuristic restored NULL-source volunteers. ADR-0109 §Clause B superseded in form, intent preserved. Tripletex sync EF update filed separately (feature-flagged, no prod blast). Local DB verification: enum extended cleanly, 0 bubble rows to recover.

3. ✅ **CLOSED 2026-05-26 (`5a982ce57`)** — `capability_default_registry` seed gap closed. 6 missing caps (bootstrap, day-line, org, routine, schedule.view_preference.write, shift_marketplace) seeded with ADR-defined authority. CI parity script extended to detect hyphen literals. `scripts/authority-seed-parity.ts` exits 0 (was exit 1 with 5 missing).

4. ✅ **FULLY CLOSED 2026-05-26 (`390b5053d` + `c17a4b715` + `c54bc71f0`)** — ADR-0204 Pathway B wave H complete for all 3 originally-flagged capabilities. journey.publish_mission + 3 contract template tools (fork/publish/deprecate) + 2 contract-intake tools (submitFieldGroup/declineIntake) all wrap their writes in `mutateWithGate.exec` callback. 817/817 ai tests pass. Audit H-1 closed. Remaining 2 contract tools (create_employee_contract, send_employee_contract) use external service fetch() — Pathway B doesn't strictly apply (no direct DB writes). All other 5 audit HIGH findings closed earlier today: guardian/acknowledgeSignal emit (`59d157bb3`), training PII gate (`e513b2cfa`), schedule verified-overstated, availability workspace_id (`de98f16d1`), call-command body workspaceId (`5a982ce57`).

5. ✅ **CLOSED 2026-05-26 (`fa09f2158`)** — `tips` capability 4 not_implemented stubs hidden from LLM router. Tool defs kept in tools.ts for Sortie 2/3 to fill bodies. ADR-0196 (no phantom emit) + ADR-0422 (no phantom-tool antipattern) both satisfied.

6. ✅ **CLOSED 2026-05-26 (`c7f145363`)** — payroll `approve-period` BFF + Godkjenn UI shipped. POST /api/payroll/approve-period with gate_action + status-must-be-locked hard-gate + payroll.period_approved emit. UI: Godkjenn button visible when status="locked".

7. ✅ **VERIFIED RESOLVED (audit was stale 2026-05-25)** — Phase 0 helpdesk_query_lifecycle engine_trigger row exists; dispatcher accepts both action_payload.event_type AND payload.event_type keys.

8. ✅ **CLOSED 2026-05-26 (`c33c1437c`)** — WSL2 OOM `close-feature.sh` pre-flight gate codified. Warns when MemAvailable<6500MiB + TURBO_CONCURRENCY=1 default. Environmental mitigation only — endemic root cause is WSL2 swap=0B × Next.js 16 tsc ~5GB peak.

### P1 — Active Campaigns

**bubble-migration** (in `campaign/bubble-migration`):
- G7-readiness council passed; 126 commits ahead of development (189 files, +32k lines).
- Blocked on 5 remediation sorties: T9 consumer patches, T10 RPC hardening, T11 ADR rebase + ADR-0380, T12 T3 pre-live, T13 weekend bucket. All blockers for T6 re-emit.

**world-best-wfm** (in `campaign/world-best-wfm`):
- Phase 1 turnus shipped: `diagnose_turnus_disabled` + `list_week_template` + `apply_week_template` + `accept_proposal` kind=template_apply + mr-botsson classifier wiring (ADR-0417). Scheduler: 54/54 tests pass.
- Phase 2 (`create_planning_cycle`, `set_day/hour_factor`) queued. Phase 3 (`publish_week`) deferred ADR-first.

**payroll** (in `campaign/payroll`):
- Tips leader flows + tip-divider shipped (36-commit merge 2026-05-01). Phase 7f capability tools unblocked.
- Period-approve BFF route (GAP-SIM-B02) is next blocker for production completeness.

**botsson-arena** (in `campaign/botsson-arena`):
- `engine_world` Phase 1+2 shipped (ADR-0281 + ADR-0290). "Sett opp juni for meg" 4-phase plan approved. Phase 1 shipped to development. Phase 2 queued.

**helpdesk** (NO ACTIVE WORKTREE — needs investigation):
- Phase 1.1 work (reassign capability tool, conditional queue-tab, Phase 0 engine_trigger fix) has no active campaign. Either merge to development first or restart campaign worktree.

### P1.5 — Structural Gaps from Restaurant-Week Sim (2026-05-25, 28 bugs, 47 gaps)

- **C2 intelligence pipeline gap (GAP-A4-12)** — `compile-day-brief.ts` + `briefing.ts` capability tools designed but no Event Engine process invokes them. `supabase/functions/ops-day-brief/index.ts` runs daily 05:00 but does not call `compileDayBrief`. Highest-leverage single change. Sortie G (ops-day-brief refactor) target.

- **`event` entity missing at D4/D6 boundary (ADR-0426 proposed)** — Hotel wedding (3+ depts, 3 days) + festival (multi-vendor, multi-zone) require first-class `event` entity above `department_session`. ADR-0426 (proposed) must resolve collision with ADR-0367 tri-layer D6 before implementation. Pattern 2 (tip_pool UNIQUE blocks cross-dept) and BUG-SIM-02 (daily_reconciliation UNIQUE blocks multi-zone) depend on this ADR.

- **`employment_form_enum` missing 3 Norwegian categories** — `volunteer`, `tilkalling` (on-call), `dagarbeid`/event-only. Five independent agents flagged this. BUG-SIM-01 schema conflict is immediate fix; enum extension is structural fix. NHO Reiseliv tilkallingsvakt has separate OT thresholds — currently misclassified.

### P2 — Queued

- `invoke_capability_tool` Phase 3 E2E tests
- Sortie G — ops-day-brief refactor (C2 pipeline)
- Period approve BFF route (GAP-SIM-B02)
- W-feriepenger deviation check (GAP-SIM-B03)
- GPS guard wire to usePunch verification (PR #470 partial)
- `communication` authority seed (sortie A from sim council)
- Capability registry seed CVE sweep verify (ADR-0413 + L-0354)
- Gatedwrite Wave 2A — Season wizard migration
- Bubble-migration T9–T13 remediation sorties
- ADR-0422 `not_implemented` audit sweep

### Deferred / Blocked

- Helpdesk Phase 2 (auto-assign + SLA) — needs Phase 1.1 cleanup + engine_trigger fix + campaign worktree resurrection
- Helpdesk Phase 3 (call recording via LiveKit) — blocked on ADR-0135 acceptance
- `event` D4/D6 entity family (X03 ADRs) — ADR-0426 proposed
- B6 engine-dispatch Node migration — deferred per ADR-0424 §Future evolution
- Reconciliation ADR (dual-gate cleanup) — open since 2026-04-16
- Build performance Wave 2/3

## Cascade Status (~88% complete)

- **Phase A (Schema):** DONE
- **Phase B (Pure Functions):** DONE — 10 functions, 8 test files
- **Phase C (Bootstrap):** DONE — framework seeded, I1 wired
- **Phase D (Operational Layer):** DONE
- **Phase E (Control Planes / C4 governance):** MOSTLY DONE
  - WP1–WP3 shipped
  - WP4 (Wave 2B capability dual-gate): not started
  - WP5: N/A (schedule uses TanStack per ADR-0032)
  - Dual-gate risk: agent tools call old `gate_action`, Server Actions call `cascade_gate_write`. No reconciliation ADR yet.
- **Phase F (External Adapters):** NOT STARTED — Tripletex first target.

## Recent Merges (2026-05-13 → 2026-05-25)

| Date | PR / Branch | What |
|---|---|---|
| 2026-05-25 | PR #487 | Oppgaver page fixes (i18n bundle + chip dedup + seed-tasks + emit-fix) |
| 2026-05-25 | PR #485 | Sim fast-wins batch 3 |
| 2026-05-25 | PR #482 | Sortie F Phase 2-B EF thin proxy |
| 2026-05-25 | PR #483 | ADR-0424 status flip + B6 stub |
| 2026-05-25 | PR #484 | Sim schema bug triage |
| 2026-05-25 | PR #481 | Sortie F Phase 2-A Node endpoint |
| 2026-05-25 | PR #480 | ADR-0424 §Transport amendment |
| 2026-05-25 | PR #475 | Restaurant-week sim (28 bugs + 47 gaps) |
| 2026-05-25 | PR #474 | Sim fast-wins batch 2 |
| 2026-05-25 | PR #471 | Sim fast-wins batch 1 (HelpDesk deprecated table fix) |
| 2026-05-25 | PR #470 | GPS guard wired to usePunch |
| 2026-05-25 | PR #469 | Capability registry seed sweep (ADR-0413) |
| 2026-05-24 | feat/v0-1-walking-skeleton | V0-1 walking skeleton |
| 2026-05-23 | campaign/tier0-polish | Roadmap + motion tokens (merged + removed) |
| 2026-05-23 | feat/procedure-engine-2b | Procedure engine 2b photo→routine extract (49 commits) |
| ~2026-05-20 | campaign/payroll | Tips leader flows + tip-divider (36 commits) |
| ~2026-05-13 | First prod release | PR #381 squash-merged 1229 commits |

## Process Hardening (recent councils)

- **L-0147 precedent count: 14** (as of 2026-05-25 PM)
- **ADR-0421 (2026-05-25)** — Declared Contract Fulfillment Rule — accepted
- **ADR-0422 (2026-05-25)** — `not_implemented` antipattern ban — accepted
- **ADR-0423 (2026-05-25)** — workspace_id read-side parity — accepted
- **ADR-0425 (2026-05-25)** — Phase 2.5 Fact-Check Methodology — accepted
- **ADR-0427 (2026-05-25)** — Forward-only repair for timestamp-collision class — accepted
- **L-0354 (2026-05-25)** — Capability registry seed gap = CVE-class
- **L-0357 (2026-05-25)** — `not_implemented` LLM-callable antipattern (sibling L-0176)
- **L-0358 / L-0359** — Forward-only doctrine extension
- **L-0361 (2026-05-25)** — ADR-missing-cross-runtime-dimension (3rd occurrence, promotion-grade)
- **ADR-0366 enforcement (2026-05-28)** — `nordic-split/no-oklch-literal` ESLint rule live in pre-push + CI; ADR-0366 promoted `proposed → accepted`; 2 helpdesk-orb runtime gradient violations swept

## Quick References

- **421 ADRs** on disk (latest: ADR-0427; gap at 0159 + 0368 reserved)
- **361 Learnings** (L-0001 → L-0361)
- Canonical cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Full state: `docs/STATE.md` | Worktrees: `docs/DASHBOARD.md`
- Council log: `docs/council/COUNCIL-LOG.md`
- Audit reports: `docs/audits/2026-05-25-adr-contract-validation-smoke/`
- Sim findings: `docs/test-runs/2026-05-25-restaurant-week-sim/`
