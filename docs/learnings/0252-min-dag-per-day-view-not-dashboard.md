---
title: "Cross-cascade-role projection surfaces belong on their own route, not as tabs of single-dimension shells"
id: LEARNING_0252
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
tags: [cascade, ia, surface-ownership, council, min-dag, framing]
---

# Learning-0252: Cross-cascade-role projection surfaces belong on their own route, not as tabs of single-dimension shells

## Context

Council Track A (2026-05-14) reviewed where Min Dag — the employee's daily plan view aggregating `session_task` + `schedule_day_task` + `personal_task` + `emma_task` for today — should live in web IA. Two options were on the table: inject as a tab inside `/dashboard/calendar` DayView (Option A), or ship as separate top-level route `/dashboard/my-day` (Option B).

The briefing framed Min Dag as a question of "tab vs route." Phase 2.5 fact-check found that the canonical handoff at `docs/modules/task-manager/taskmanager-handoff/README.md` had already declared Min Dag as *"det første en ansatt ser når de åpner Smartout"* — forsiden, not a tab. All three reviewers converged on Option B without dissent.

While synthesizing, a meta-pattern emerged: the question had been framed at the wrong level. The real question is not "tab vs route" but **"does this surface project across cascade dimensions, and if so, who owns the shell?"**

## Discovery

**Surfaces that project across cascade dimensions belong on their own route.** They cannot live as tabs of single-dimension shells without breaking ownership clarity.

Smartout's surface-IA has carried cleanly so far because each dashboard route maps to one cascade dimension or one control plane:

| Surface | Cascade alignment |
|---|---|
| `/dashboard/schedule` | D6 production (manager-authoring) |
| `/dashboard/calendar` | D6 production (date-anchored read + manager day-control) |
| `/dashboard/people` | D2 resource |
| `/dashboard/organization` | D1 envelope |
| `/dashboard/cost`, `/dashboard/close` | C3 commercial / C1 reconciliation |
| `/dashboard/governance` | content layer / C4 governance |
| `/dashboard/ai` | agent surface |
| `my-schedule`, `my-training`, `my-contract`, `my-salary`, `my-cv`, `my-profile` | employee-personal slices, one dimension each |

Min Dag is fundamentally different. It is **a deliberate UNION across C2 (personal_task, emma_task) and D6 (session_task, schedule_day_task)**. Per ADR-0298, this is a declared cross-source projection — `fn_list_my_tasks` UNIONs four sources. There is no single cascade home for this datum; the union IS the surface.

When a cross-cascade-role projection is placed inside a single-dimension shell:

1. **Surface ownership blurs.** Kalender DayControlSheet is a manager-admin tool (BroadcastFooter, MeldingerTab, OkonomiTab, StaffingTab). Injecting employee-personal `personal_task` there places C2 owner-private data inside a workspace-shared admin context. RLS still works, but the implied ownership reads wrong.
2. **Surface ownership for the agent breaks.** Site-map entries are 1:1 with routes. A tab inside Kalender shares its purpose-line with Kalender. Botsson's site-map context for `/dashboard/calendar` becomes a UNION ("manager admin OR employee home"). Surface ownership ambiguity → L-0178 / ADR-0238 territory.
3. **Click-depth penalty for the most-used employee surface.** Tab-inside-shell = 3 interactions to reach the home surface ("home → calendar → click day → see tasks"). Dedicated route = 1 interaction (or 0 with default landing).
4. **Mobile parity becomes contorted.** Mobile already has ADR-0302 (Kalender as date-anchored task surface). Mobile cannot have "Min Dag = tab inside Kalender" because mobile Kalender is the date-anchored execution surface — putting today's union there means tab-state and date-state collide.

The clean rule: **one cascade role per shell; cross-role projections get their own shell.**

This pattern was observable in retrospect:

- Min Dag UNIONs C2 + D6 → own route (this ADR).
- Reconciliation UNIONs D6 actuals + C1 reconciliation + C3 commercial → own route (`/dashboard/reconciliation`).
- Reports UNIONs C1 + C3 + D4 + governance → own route (`/dashboard/reports`).
- Year-wheel UNIONs D4 demand + D1 envelope events → own route (`/dashboard/year-wheel`, lazy-mounted as tab inside `/dashboard/calendar` for navigation, but rendering its own canvas).

The exception (year-wheel as tab inside calendar) is instructive: year-wheel lives as a tab only because it shares the same time-axis as calendar; it does not blur ownership. Min Dag would blur ownership (manager admin shell ≠ employee home), so the exception does not apply.

## Impact

**For Steward / IA design:** When evaluating where a new surface lives, ask first:

1. Which cascade dimension or control plane does this datum naturally belong to?
2. If "more than one," is this a deliberate cross-role projection?
3. If yes, the surface gets its own route. It does not become a tab of a single-dimension shell. Exception only when (a) the shell is itself cross-role, or (b) the only shared property is a time-axis with no ownership conflict.

**For council briefings:** When framing IA questions as "where does X live," include the cascade-role analysis up front. The briefing for Track A framed Min Dag as "tab vs route" — a UX-level framing that hid the architectural question. Phase 2.5 fact-check caught it via the canonical handoff; the meta-pattern surfaced via Phase 5 synthesis.

**For agent surface (site-map.json):** Each route gets one purpose-line. If two purposes are needed, the surface needs two routes. The agent's mental model of the dashboard is route-keyed; conflated routes produce conflated context slices.

**For documentation/handoff fidelity:** When a canonical handoff document already exists (as `docs/modules/task-manager/taskmanager-handoff/` did for Min Dag), council Phase 1 INTAKE must surface it. The handoff was written with intent ("Min dag = forsiden") that the briefing's "tab vs route" framing obscured. Phase 2.5 fact-check rescued it; future councils should make handoff-discovery part of Phase 1, not Phase 2.5.

**Promotion candidate:** Single observation today. Will revisit on 2nd occurrence (any future council reframing a surface placement question as "tab vs route" without a cascade-role analysis). If a 3rd occurrence appears, promote to a `run-council` SKILL.md rule: "Phase 1 INTAKE for IA questions MUST include a cascade-role classification of the surface."

## References

- ADR-0316 (Min Dag — Dedicated Employee Surface, Not Tab in Kalender) — inaugural application
- ADR-0298 (Task Ontology — Five Sources, One Read Surface, One Capability) — declares the cross-source projection
- ADR-0300 (`fn_list_my_tasks` RPC) — the projection mechanism
- ADR-0238 (Botsson surface disambiguation) — surface-ownership-ambiguity prior art
- L-0178 (BotssonShell on page with embedded chat surface requires ownership declaration) — surface-ownership prior art
- `docs/modules/task-manager/taskmanager-handoff/README.md` — canonical Min Dag spec, declared "forsiden" before this council
- Council Track A (2026-05-14) in `docs/council/COUNCIL-LOG.md`

---

> After writing: register in `docs/learnings/0000-learning-log.md` if such an index is being maintained; otherwise this file is the canonical record.
