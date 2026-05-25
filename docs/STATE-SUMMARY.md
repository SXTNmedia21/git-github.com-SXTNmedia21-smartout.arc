---
title: "STATE Summary — Quick Session Start"
updated: 2026-05-25
derived-from: docs/STATE.md (817 lines full version)
---

# STATE Summary

> Read this instead of STATE.md at session start. For deep dives, use semantic search on STATE.md.

## Active Work (2026-05-25)

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

Open PRs (2026-05-25 evening):
- **PR #486** — setup-flow redirect-loop guard + storage godmode bypass — 22 pass, 0 fail, 3 pending (essentially merge-ready)
- **PR #488** — DashboardShell sub-header `min-h-16` (oppgaver redesign Track A) — 18 pass, 1 lint-fail (local exit 0, CI exit 1 — known dev-debt divergence)

Sortie pool entirely free. No active sub-sorties.

## Production / Preview State (2026-05-25)

- **Production smoke:** GREEN (Vercel web 200, landing 200, Supabase REST alive, EFs alive, droplet reachable)
- **Preview smoke:** GREEN (Vercel preview SSO-gated, Supabase Branch DB intentionally absent per ADR-0360)
- **Drift-check:** PASS — 56-entry Vercel manifest matches baseline, env.ts traced, droplet env aligned
- **Dev ahead of preview:** 159 commits (promotion window open)

## Today's Shipped Fixes (2026-05-25 session-end)

| Commit | What |
|---|---|
| `ea36f17e1` | `test(payroll-calculate)`: align W09 severity expectation with code (BUG-SIM-15) — unblocks vitest CI gate for all PRs |
| `3d5e2f07f` | `chore(env)`: fix stage-engine vault reference smartout_ai_dev → smartout_ai |
| `fd2824c1a` | `fix(security)`: auth before delete in ingest-workspace-knowledge — CRITICAL audit finding |
| `03d62f25d` | `test(oppgaver)`: align grep tests with PR-487 + DnD merged state (5 stale assertions) |
| `f2568d762` | `fix(security)`: inline SET search_path on SECURITY DEFINER billing fns (2 HIGH audit findings) |
| `ca97b8485` | `docs(audit)`: 2026-05-25 smoke summary + 3 slice reports |
| `79e383c33` | `fix(security)`: verify caller owns profile_id in shift-clock-compliance (1 HIGH audit finding) |

## Top Priority Gaps

### P0 — Blockers

1. **`invoke_capability_tool` Phase 3 E2E tests pending** — ADR-0424 Phase 1.5 + 2-A + 2-B all shipped. Phase 3 E2E is the outstanding gate before Sortie G (ops-day-brief refactor). New env var `STAGE_ENGINE_INTERNAL_KEY` must be in 1Password + Vercel + Supabase + droplet manifest before any HOP A. `docs/plans/B6-ENGINE-DISPATCH-NODE-MIGRATION.md` deferred supersession path.

2. **`employment_form` NOT NULL conflict — BUG-SIM-01 (CRITICAL schema landmine)** — Migration `20260519150000:160` adds NOT NULL; migration `20260515100100:38` uses NULL = volunteer. Any workspace with volunteer contracts pre-Wave-3 fails forward migration. Documented in `docs/test-runs/2026-05-25-restaurant-week-sim/SCHEMA-BUGS-TRIAGE.md`. Forward-only migration required (ADR-0427 doctrine).

3. **`capability_default_registry` seed gap = new-workspace CVE-class** — L-0354 + ADR-0413. New workspaces silently get no `engine_authority_config` row for excluded capabilities → `gate_action` default-allows all callers. PR #469 partially addressed; verify `communication` is now in registry.

4. **6 HIGH audit findings still open** (per 2026-05-25 smoke):
   - 5 capability-tools: journey/contract/contract-intake gatedMutation Pathway B gap (ADR-0204); guardian/acknowledgeSignal telemetry bypass; training PII without gate; schedule capability zero gates + 2 phantom events (ADR-0358); availability/queryOthersAvailability body workspace_id (ADR-0151)
   - 1 edge-functions: call-command body workspaceId across 4 handlers (ADR-0151)
   - Recommend remediation sortie wave H (capability ADR-0204 + telemetry) + wave I (ADR-0151 sweep).

5. **`tips` capability — 4 tools return `not_implemented` (L-0357 / ADR-0422)** — DB schema complete, capability registered, tools in intent classifier — all 4 tool bodies are stubs. ADR-0422 (`not_implemented` antipattern ban) mandates tools ship with bodies or are hidden from LLM.

6. **`payroll.period_status='approved'` has no BFF route — GAP-SIM-B02 (CRITICAL compliance)** — Enum + `approved_by` column exist, NO `POST /api/payroll/approve-period`, NO Godkjenn CTA. Bokf. §13 audit needs recorded approver. 1 sortie.

7. **Phase 0 helpdesk_query_lifecycle engine_trigger row still missing** — Two bugs in `supabase/migrations/20260515130200`: (a) `action_payload.event_type` key mismatch; (b) no engine_trigger maps `helpdesk.query.opened` → `helpdesk_query_lifecycle`. Lifecycle never spawns. Helpdesk campaign worktree appears removed; needs investigation.

8. **WSL2 OOM endemic (L-0412 / ADR-0412)** — 5th+ occurrence 2026-05-25. Mitigation: TURBO_CONCURRENCY=1 + verify RAM ≥ 7Gi before any heavy build. `close-feature.sh` pre-flight `free -h ≥6500Mi` gate codified.

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

## Quick References

- **421 ADRs** on disk (latest: ADR-0427; gap at 0159 + 0368 reserved)
- **361 Learnings** (L-0001 → L-0361)
- Canonical cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Full state: `docs/STATE.md` | Worktrees: `docs/DASHBOARD.md`
- Council log: `docs/council/COUNCIL-LOG.md`
- Audit reports: `docs/audits/2026-05-25-adr-contract-validation-smoke/`
- Sim findings: `docs/test-runs/2026-05-25-restaurant-week-sim/`
