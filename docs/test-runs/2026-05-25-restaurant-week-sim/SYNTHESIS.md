---
title: "Restaurant Week Sim — Synthesis"
status: complete
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [synthesis, sim, restaurant-week, hotel, festival, strategy, wfm-positioning]
---

# Restaurant Week Sim — Synthesis

> 11 specialist agents traced three operational scenarios through code, end-to-end.
> Phase 1: Bistro week (Bella Vista, 18 staff). Phase 2: Hotel wedding (Grand Hotel Sjølyst, 80 guests, 3 days, 5 depts). Phase 3: Festival (Sjølyst Sommerfest, 1200 guests, 60 staff, 1 day, multi-vendor).
> **Output:** 28 NEW code-level bugs, 47 NEW feature/UX gaps. All deduplicated against the 22-bug 2026-05-23 baseline.

---

## Executive Summary

The sim found ~75 NEW issues that the mechanical 47-run Playwright sweep did not exercise — most of them not bugs but **structural gaps surfaced by simulating real operational journeys**. The bistro week (Phase 1) confirmed Smartout's cascade core (I1+6D+4C) is fundamentally sound for restaurants, but gated by three CRITICAL silent-compliance gaps (no period-approve route, no feriepenger check, no OTP check) and a recurring pattern of "built but disconnected" (GPS guard, tips skeletons, AnnouncementKindPicker, HelpDesk-deprecated-table) that adds up to a system that *appears* world-class in the registry but degrades to "WhatsApp with extra steps" at the user surface. The hotel wedding (Phase 2) surfaced the architectural absence of an `event` first-class entity, multi-day cross-department orchestration, room-level operations, and the explicit ADR-0131 boundary that makes Smartout unable to invoice a wedding payer — three CRITICAL gaps converging on the same ADR-grade decision. The festival (Phase 3) ran into multi-vendor sub-workspace, casual labor, vendor revenue-split, and real-time capacity gaps that go beyond the existing hospitality industry package — likely requiring a separate `event-operations` domain. Cross-cutting, the single deepest signal is the **C2 intelligence pipeline gap**: the auto-shift-briefing surface that would obviously differentiate Smartout from Slack/WhatsApp is designed (compile-day-brief.ts + briefing.ts exist), partially built, and unwired — closing it is the highest-leverage move available.

---

## Cross-cutting patterns (root causes hitting multiple agents)

### Pattern 1 — "Built but disconnected" — engineering shipped to registry without binding to the user surface

**Agents:** A1, A2, A3, A4, A5
**Examples:**
- GPS guard exists fully (`useGPSGuard.ts:75`) — never invoked by `usePunch` (A3 / NEW-BUG-A)
- Tips capabilities registered + DB schema complete — all 4 tools return `not_implemented` (A3 / NEW-BUG-C)
- AnnouncementKindPicker.tsx exists — not mounted in NyheterClient (A4 / GAP-A4-04)
- compile-day-brief + briefing.ts capability tools exist — no Event Engine process invokes them (A4 / GAP-A4-12)
- `payroll.period_status='approved'` enum + `approved_by` column — no BFF route, no UI button (A5 / GAP-A5-01)
- `useLockPeriod` mutation — no `emit()` in onSuccess despite ADR-0193 mandate (A5 / GAP-A5-09)
- `HelpDesk.tsx` UI — writes deprecated `help_request` table, never reaches `engine_state` (A4 / BUG-A4-08)

**Root cause:** capability registry + DB schema get shipped ahead of UI surface. The intent-classifier accepts the route, gates pass, but the body returns `not_implemented` OR writes to the old table. Operator sees no error.

**Why it matters:** every disconnected surface erodes trust + creates silent compliance gaps. The 4-hour fix (mount picker / wire body / add error string) is 100x cheaper than the trust cost of "system said done, but nothing happened."

**Defense:** docstring-claim audit (L-0176 pattern) PLUS a "body matches registry" pre-merge gate. ADR-grade decision: capabilities cannot register without a wired surface.

### Pattern 2 — `tip_pool` UNIQUE on single department session blocks any event-level distribution

**Agents:** A6, A7, A8, A10, A11 — **five independent agents flag the same constraint**
**Files:** `supabase/migrations/20260428220003_tips_pool_table.sql:25` + `tip_policy.department_id NOT NULL`

The 50/30/20 wedding split, festival cross-dept share, and any banquet event tip distribution all break against this constraint. NHO Reiseliv collective agreement explicitly governs cross-dept tip distribution. This is not a bistro-gap — it's an entire commercial-layer dimension missing.

**Root cause:** schema designed for single-dept restaurant; never re-evaluated for event ops.
**Fix family:** introduce `event_tip_pool` parent + drop UNIQUE in favor of `(event_pool_id, department_session_id)`. **Same ADR as event-entity** — see Pattern 4.

### Pattern 3 — `employment_form_enum` lacks 3 categories Norwegian ops use daily

**Agents:** A6, A8, A9, A10, A11
**Missing:** volunteer (with NULL-conflict CRITICAL data-integrity bug per BUG-SIM-01), tilkalling (on-call), event-only / casual / dagarbeid (one-day temp).

Each agent independently flagged this. Volunteer NULL pattern from `20260515100100` conflicts with NOT NULL added in `20260519150000` — latent data-integrity bug, not just festival gap. NHO Reiseliv tilkallingsvakt has separate OT thresholds — currently shoehorned into `temporary` and miscalculated. Festival dagarbeid (Aml. §14-9) currently impossible without contract template misuse.

**Root cause:** enum designed for permanent + temporary + freelance B2C contract patterns; never extended for hospitality casual + volunteer + on-call.
**Fix:** ADR-grade extension. Coordinate with DocuSeal templates + Tripletex categories + payroll-engine rules.

### Pattern 4 — No `event` first-class entity — single architectural decision blocks 12+ gaps

**Agents:** A6, A7, A8 (hotel) + A10, A11 (festival) — converging from both directions
**Closest existing:** `planning_event` (D4 demand signal); `schedule_day_booking` (1D calendar annotation, no department_id FK).

The wedding spans 3 days × 5 departments × tip pool × P&L roll-up × invoice payer ≠ workspace. The festival spans 6 temporary departments × 7 POS streams × vendor settlement × pop-up lifecycle. **All resolve under one architectural move: introduce `event` as a first-class D4/D6 entity.**

The cascade spec (§2.2) explicitly allows niche-parameterization through D5. A6's verdict (confirmed by A8 + A10): hotel can be a `hospitality.no.hotel.v1` sub-package; festival likely requires a separate `event-operations` domain.

**Strategic note:** none of Planday / Quinyx / Tamigo handles event operations well. This is a white-space competitive opportunity.

### Pattern 5 — Compliance silence at period close — Norwegian law gaps the system claims to catch

**Agent:** A5 — sole agent but with 3 independent gaps
**Gaps:** W-feriepenger (Ferieloven §10), W-OTP (OTP-loven §2), period-approved sign-off (Bokf. §13).

Period lock currently masks compliance the operator believes the system catches. Workspaces with `vacation_pay_pct=5%` pass lock silently. Employer OTP obligation invisible at the natural audit point. `approved_by` never populated → no provenance on locked lønnsgrunnlag.

**Root cause:** deviation engine has 14 W-checks but is incomplete for legally-mandated rates + sign-off provenance. A-melding is explicitly out of scope per ADR-0250 — but the absence of compensating gates means Smartout signals "compliance check passed" when it didn't.

**Defense:** these three gaps are a single ADR-grade decision about Smartout's compliance promise. Either ship all three (recommended) OR remove the implicit promise from UI labels (BUG-SIM-20 manual-supplement "A-melding" hint).

### Pattern 6 — Cross-workspace data bleed via service-role + missing workspace_id filter

**Agent:** A4 — BUG-A4-07 (`on_duty` resolver)
**Class:** same as ADR-0151 (forgeable IDs) + L-0177 (silent fallback).

`audience-resolver.ts:59-73` + `use-audience-resolver.ts:46-61` query `timesheet.time_entry WHERE punch_out IS NULL LIMIT 500` with NO workspace_id filter. Service-role (used at the capability tool layer) bypasses RLS. Comment explicitly says "tool layer is responsible" — but the tool doesn't filter.

**Defense:** ADR-grade extension to ADR-0151. Any service-role read MUST grep-prove a `.eq('workspace_id', ctx.workspaceId)` filter; pre-merge lint rule. This is the same defense Pontus already wins on writes (L-0177); reads need parity.

### Pattern 7 — Schedule temporal lock + audience resolver + reconciliation all assume "same calendar date"

**Agents:** A3 (Friday late-night), A6 (HOTEL-3 midnight-spanning), A7 (GAP-4 02:30 lock)
**Files:** `schedule_shift_temporal_lock.sql:43`, `department_session UNIQUE on session_date`, `tip_pool UNIQUE on department_session_id`.

Every shift / session / tip pool assumes the operation is bounded by one calendar date. Bistros routinely run to 02:00 Saturday morning; hotel events to 03:00 Sunday; festival load-out from 22:00 to 06:00. Tariff supplements correctly bridge midnight (kveldstillegg + hotell-natt) — but the session boundary model fights the tariff model.

**Root cause:** schema designed for canteen-style 07:00-15:00 / 15:00-23:00 shifts.
**Fix:** shift-end-anchored grace window on temporal lock; `service_window` discriminator on department_session.

### Pattern 8 — Cascade engine reads only single-day inputs (planning_event.end_date ignored)

**Agent:** A8 — BUG-A8-03
**File:** `cascade_a1_domain_tables.sql:145` adds `end_date DATE` (nullable); grep confirms no `end_date` reference outside this file.

Multi-day events get demand uplift only on day 1. Day 2 + 3 cascade scheduler under-staffs. Hotel + festival both affected.

**Fix:** cascade scheduling engine must expand `event_date..end_date` when computing day_factor. Connects to Pattern 4.

### Pattern 9 — Mobile cannot complete the in-shift loop

**Agent:** A3 — multiple gaps
**Examples:**
- Session-hook forms are PlaceholderForm (B12) → cannot sign off C4 confirmations
- Tips capability not_implemented (B13)
- `hms.resolve_deviation` web-only (B11)
- `settle_shift` system-only (B22)

ADR-0133 mandate: "mobile executes." Currently mobile-execute verbs are partly stubbed. Floor manager hits 4 stop-points where they must switch to web.

**Defense:** ADR-0133 audit slice — every "execute" verb must have a mobile path or document explicit deferral.

### Pattern 10 — Workspace and department lifecycle has no end-state

**Agents:** A9, A11
**Examples:** `department.is_active BOOLEAN` only (no `valid_until` / `dissolve_at`); no `workspace.status` (active / archived / dissolved); pop-up event scenarios accumulate zombie entities.

**Root cause:** schema designed for permanent operations.
**Fix:** Sortie-sized. Add temporal columns; cascade dissolve event.

---

## Verdict on three phases

### Phase 1 — Bistro week (Bella Vista)

**How production-ready: 70%.** Cascade core works. The Monday→Sunday path is followable end-to-end. The bugs found are mostly mechanical (wrong PK column, missing emit, hardcoded fallback) and the gaps are decision-support polish (replacement suggestion, tariff floor, hook forms, tip bodies). **No architectural blockers.**

**Three CRITICAL gates before production:**
1. Fix BUG-1 family — communication authority seed + capability_default_registry. Without it, every NEW workspace cannot publish announcements (BUG-A4-02).
2. Close the three Norwegian compliance gates — period-approved route (B02), W-feriepenger (B03), W-OTP (B04). Without these, period close is silent on three legal obligations.
3. Wire the HelpDesk.tsx UI to `open_ticket` capability (BUG-SIM-05). Until then, baseline BUG-20 (helpdesk SLA 0/4) cannot be fixed by any backend change.

**Time to production-ready bistro: ~4-6 weeks of focused work** (one campaign).

### Phase 2 — Hotel wedding (Grand Hotel Sjølyst)

**Cascade bends — but the hotel-vertical sub-package does not exist.** 14 NEW gaps, 3 CRITICAL. The architectural decisions are clear (A6's verdict confirms): a `hospitality.no.hotel.v1` niche-parameterization adds:
- `event` entity (D4/D6 boundary)
- `room` sub-entity in D1
- `event_session` sibling to `department_session`
- `event_settlement` (C3 commercial)
- Hotel roleCapabilityProfiles (resepsjonist / bankett_captain / nattevakt / husholderske)
- Midnight-shift boundary fix

**Out-of-scope for now:** event invoice payer ≠ workspace (H03) — ADR-0131 boundary. This is structural; needs an ADR amendment OR a separate `hospitality-ops` invoice domain.

**Time to hotel-ready: ~3-4 months campaign**, gated on the event-entity ADR. Hotel verticalization is a real product expansion, not a polish pass.

### Phase 3 — Festival (Sjølyst Sommerfest)

**Far outside current scope.** Cascade barely bends. 16 NEW gaps, 1 CRITICAL (multi-vendor sub-workspace). The festival operational layer requires architectural moves beyond hospitality:
- Multi-vendor sub-workspace with vendor-scoped RLS (F01)
- Casual / volunteer / on-call employment_form (F02 + cross-cutting X02)
- Vendor revenue split schema (F03)
- Real-time capacity / `entry_event` integration (F07)
- Production-block / stage-cue model (F11)
- Subcontractor / agency-labor identity model (F15)
- Emergency-broadcast fast path bypassing HITL (F12)

**Verdict:** Smartout can run a festival TODAY with significant manual workarounds (3 hours of spreadsheet aggregation per event). It cannot run a festival WELL. The competitive opportunity is real (no general WFM handles event ops) but it's a separate product, not a feature.

**Time to festival-ready: ~6-9 months campaign** + integrations (external ticketing, agency-labor identity). Possibly: position festival as a separate Smartout product line ("Smartout Events") rather than extending the hospitality core.

---

## Strategic recommendations

### This week — top 3 actions

1. **Land the BUG-1 family root cause** — Add `'communication'` to `capability_default_registry` (BUG-SIM via A4 / BUG-A4-02). Without this, every fresh workspace replays the baseline-CRITICAL. 15 minutes of migration work + audit other capabilities for the same registry gap.
2. **Wire HelpDesk.tsx → `open_ticket` capability** — BUG-SIM-05. Closes baseline BUG-20 entirely (helpdesk SLA 0/4 → green). 2-3 hours.
3. **Ship the 5 mechanical fast-wins** — BUG-SIM-08 / 09 / 12 / 13 / 21 (schedule tool PK columns + workspace_id + emit timestamp + manager onboarding). ~3 hours total. Each closes a journey blocker.

### This month — top 5 ADR-grade decisions

1. **ADR: Event entity (D4/D6 boundary)** — resolves GAP-SIM-X03 family. Single decision unlocks hotel + festival event ops + cross-dept tip pool + event P&L + event invoice (separate from billing).
2. **ADR: `employment_form_enum` extension** — volunteer + tilkalling + casual / dagarbeid. Coordinates DocuSeal + Tripletex + payroll rules. Closes BUG-SIM-01 (volunteer NULL conflict).
3. **ADR: Compliance gates at period close** — W-feriepenger + W-OTP + period-approved sign-off. Single decision establishes Smartout's compliance promise (ADR-0250 boundary + what we DO catch).
4. **ADR: ADR-0151 read-side parity** — service-role reads MUST filter workspace_id; pre-merge lint rule. Closes BUG-SIM-11 + future class.
5. **ADR amendment: ADR-0398 emergency-broadcast fast path** — Festival safety surfaced this. Crowd-surge alert cannot wait 5-15 s HITL roundtrip.

### This quarter — major campaigns / sub-packages

1. **Campaign: C2 intelligence pipeline** — auto-shift-briefing in session channel + auto-member + briefing process. THE differentiator vs Slack/WhatsApp. ~6-8 weeks. (A4 / GAP-A4-12)
2. **Campaign: `hospitality.no.hotel.v1` niche-parameterization** — event entity + room ops + hotel roles + midnight-shift fix + event settlement. Opens hotel vertical. ~10-12 weeks.
3. **Campaign: Mobile execute parity** — close GAP-SIM-X07 family (hook forms + deviation resolve + tips bodies + manual settlement). Closes ADR-0133 audit. ~6 weeks.
4. **Campaign: Replacement & decision support** — B01 (replacement suggestion) + B05 (tariff floor in shift modal) + B09 (cover-request flow) — the three highest-leverage scheduling UX moves. ~4-6 weeks.

---

## Cross-vertical applicability — does I1+6D+4C bend?

**Yes — but with conditions.** A6's verdict (confirmed by A8 + A10): the cascade architecture's dimensional structure is well-suited for hotels if the right entities are added. The cascade spec §2.2 explicitly enables niche-parameterization through D5. The hospitality package already acknowledges hotel (`hotelloverenskomsten` tariff exists, NACE 55.101 presets, `overnight` filter flag) but stops short of the operational layer.

**Confirmed bends:**
- D1 envelope: `location_type='event'` exists; room sub-entity is additive
- D2 resource: profile + contract model fits front-desk + housekeeping
- D3 rules: hotelloverenskomsten supplements present
- D6 production: `event_session` sibling to `department_session` is additive
- K1a industry: hotel sub-package via D5 niche parameters

**Does NOT bend (festival requires architectural moves):**
- Multi-vendor sub-workspace (workspace identity model is single-tenant)
- Pop-up entity lifecycle (no temporal bounds on workspace + department)
- Real-time capacity (no integration spine)
- Subcontractor / agency labor (identity model is `user_identity → company → workspace → profile`, doesn't accommodate external contractor)

**Recommendation:** Hotel = sub-package on existing cascade. Festival = separate domain (likely `event-operations`) with its own ADR family, possibly its own product line. The cascade-spec carries the load for hotel; festival is a strategic decision about scope expansion.

---

## Audit-skill alignment — patterns adr-contract-audit should auto-detect

| Pattern | Audit rule |
|---|---|
| 1 — Built but disconnected | "Capability registered → grep `Tool.execute` body → must not return `not_implemented` OR must have user-facing error string." |
| 6 — Cross-workspace bleed via service-role | "Service-role read on workspace-scoped table → must filter `.eq('workspace_id', ctx.workspaceId)` OR document explicit cross-workspace intent." |
| 1 + 9 — Mobile execute parity (ADR-0133) | "Capability with `confirm` authority + `execute` verb → must have BFF route under `/api/mobile/` OR document deferral." |
| 5 — Compliance gates at period close | "Deviation engine (`deviation-checks.ts`) → must have W-check for each `workspace_settings` rate column → orphan rate columns flagged." |
| 2 + 4 — Single-session UNIQUE that blocks events | "Tables with `UNIQUE` on `department_session_id` → flag for event-ops review when event-entity ADR lands." |
| 3 — Enum coverage for Norwegian ops | "Enum values for employment_form / deviation_domain / channel_message_visibility audited against NHO Reiseliv + Aml. + relevant Vaktvirksomhetsloven categories." |

The current `adr-contract-audit` already catches Pattern 1 partially (docstring claims vs body — L-0176). Patterns 5 + 6 + 9 should join the next audit slice. Pattern 2 + 4 await the event-entity ADR.

---

## Bottom line — three sentences

1. **Bistro is 70% production-ready** — close BUG-1 family root cause + 3 compliance gates + HelpDesk rewire + 5 mechanical fast-wins (~4 weeks) and Phase 1 ships.
2. **Hotel needs a sub-package** — event entity + room ops + hotel roles + midnight fix = ADR-grade move + 10-12 week campaign, unlocking a real vertical.
3. **Festival is a separate product** — multi-vendor + casual labor + real-time capacity + production blocks go beyond hospitality cascade — possibly position as Smartout Events rather than extend the core.

The **single highest-leverage move available** is closing the C2 intelligence pipeline (auto-shift-briefing in session channel). It is designed, partially built, unwired — and would make the difference between "Smartout = WhatsApp with extra steps" and "Smartout = the WFM operating system."

---

## Evidence

Findings: `findings/agent-{1..11}-*.md` (11 specialist reports, ~2700 lines)
Plans: `INDEX.md`, `SIMULATION-PLAN.md`, `HOTEL-WEDDING-PLAN.md`, `CONCERT-FESTIVAL-PLAN.md`
Bugs (NEW): `BUGS.md` (28 code-level defects)
Gaps (NEW): `GAPS.md` (47 feature/UX/journey holes)
Baseline: `docs/test-runs/2026-05-23-journey-sweep/BUGS.md` (22 mechanical bugs)
