---
title: "Min Dag — Dedicated Employee Surface, Not Tab in Kalender"
id: ADR_0316
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
---

# ADR-0316: Min Dag — Dedicated Employee Surface, Not Tab in Kalender

## Status

**proposed** — Council Track A verdict 2026-05-14. Awaiting Pontus approval.

> **ADR-slot note:** Initially reserved ADR-0310 by Track A brief. Slot taken by `0310-§14-6-rule-table-driven-aml-validation.md` (AML capability campaign) plus 0311-0315 also taken. Reserved next free slot **0316** per Phase 8 Step 0 reservation rule. No further collisions detected at acceptance time.

## Context and Problem Statement

ADR-0298 declared the canonical task ontology — five sources, one read RPC (`fn_list_my_tasks`), one capability surface (`task.*`). ADR-0300 shipped the RPC; ADR-0301 shipped the capability; ADR-0302 wired mobile Kalender as the date-anchored mobile execution surface.

Open question after Sortie 4: **where does the union — "Min Dag" = today's view aggregating session_task + schedule_day_task + personal_task + emma_task for THIS day — live in web IA?**

Two competing answers had been circulating in prior input:

- **Option A:** Inject Min Dag inside `/dashboard/calendar` DayView. No new route. Tab-aligned with cascade D6 production view.
- **Option B:** Separate top-level route `/dashboard/my-day`. Dedicated employee surface. Independent of Kalender admin shell.

Phase 2.5 fact-check uncovered a load-bearing third signal: the canonical handoff at `docs/modules/task-manager/taskmanager-handoff/README.md` (already in repo, authored before this council) explicitly declares Min Dag is *"det første en ansatt ser når de åpner Smartout"* — **forsiden, not a sub-view of an admin tool.** This corrects the briefing's framing.

## Decision Drivers

- **Cascade ontology purity (Invariant 2 — surface-role mapping).** Kalender owns D6. Min Dag is a cross-dimension projection (C2 ∪ D6: personal_task + emma_task live in C2; session_task + schedule_day_task live in D6). A cross-cascade-role projection belongs on its own surface, not inside a single-dimension shell.
- **Surface-ownership clarity (ADR-0238 + L-0178).** Kalender's DayControlSheet already owns its own chat (BroadcastFooter, MeldingerTab) and is **manager-oriented**. Min Dag has its own Botsson-nudge contract (handoff §3.4) and is **employee-oriented**. Two ownership models in one shell = the dual-surface UX trap that ADR-0238 was written to prevent.
- **Path stability for agent (ADR-0297 + L-0234).** Botsson navigation works against stable site-map paths. `/dashboard/my-day` gets its own site-map entry, its own tools array. Tab inside Kalender = `?tab=calendar&day=...` query-state — fragile, query-coupled, shares purpose-line with Kalender.
- **`my-*` family precedent.** Six sibling routes already exist: `my-schedule`, `my-training`, `my-contract`, `my-salary`, `my-cv`, `my-profile`. Adding `my-day` is **pattern-consistent** and discoverable.
- **Canonical handoff fidelity.** `docs/modules/task-manager/taskmanager-handoff/README.md` is the canonical spec for Min Dag (Fase 1: Min dag + TaskKortet + filterrad + seksjoner + Botsson-nudge). It explicitly says forsiden. Honoring this prevents AddSheet-style orphan-component graveyards (897 LOC orphan for 9 days).
- **Click-depth for the most-used employee surface.** Option A = home → /dashboard/calendar → click day → see Min Dag = 3 interactions. Option B = home → /dashboard/my-day = 1 interaction (or 0 if default-landing for non-admin profiles).
- **Mobile parity (ADR-0133).** Mobile `(me)` tab default route can render `<MyDayView />` reading the same RPC. Mobile Kalender (`(calendar)` per ADR-0302) stays as the date-anchored execution surface. The two complement, not compete.
- **No schema change, no capability change.** Pure IA placement decision. Read = `fn_list_my_tasks` (already shipped). Write = `task.*` (already 6 tools per ADR-0301). Zero migration weight.

## Considered Options

1. **Option A — Inject Min Dag inside Kalender DayView.** Add a 5th tab to `CalendarPageShell` (or a Min-Dag panel inside `DayControlSheet`). User opens `/dashboard/calendar`, clicks a day → sees union of tasks. No new route.
2. **Option B — Separate top-level route `/dashboard/my-day`.** Dedicated employee surface, sibling of `my-schedule`. Default landing for non-admin profiles. Reads `fn_list_my_tasks` with `today` window.
3. **Option C — Hybrid: keep OppgaverTab in DayControl (narrow, manager-curated `schedule_day_task` only), AND ship `/dashboard/my-day` as employee-cross-source surface.** Both surfaces coexist with clear ownership boundaries.

## Decision Outcome

**Chosen: Option C — Hybrid (functionally Option B + boundary clarification for OppgaverTab).**

Justification:

- All three council reviewers (Steward via cascade ontology, Coordinator via agent surface, Frontend-designer via UX + mobile parity) converged on Option B without dissent. No 2-1 split. No chair reversal.
- The Phase 2.5 fact-check finding (existing canonical handoff already declares Min Dag = forsiden) is load-bearing and supersedes the briefing's framing of Option A as "frontend-designer prior recommendation."
- Hybrid clarification is necessary because `apps/web/src/app/dashboard/schedule/_components/day-control/OppgaverTab.tsx` already exists and shows `schedule_day_task`. Leaving it ambiguous would create drift between Min Dag and DayControl OppgaverTab. The boundary is: **OppgaverTab = manager-curated `schedule_day_task` for ONE day, workspace-shared, read by manager in DayControl context. Min Dag = employee-personal cross-source for today, owner-private + assigned-to-me, read by employee in their own home surface.**
- Mobile parity is clean: web `/dashboard/my-day` ↔ mobile `(me)` tab default route, both reading `fn_list_my_tasks` with window=today.
- No schema change, no capability change, no migration. Pure IA placement.

## Architecture

### Web route

```
/dashboard/my-day
├── page.tsx              → Server Component shell, resolveDashboardContext, withPagePerf wrap
├── _components/
│   ├── MyDayView.tsx     → Client root. Filter chips, dag-meter, three sections.
│   ├── TaskCard.tsx      → SHARED with OppgaverTab via packages/ui or _components/_shared
│   ├── BotssonNudge.tsx  → Single AI suggestion card. Wires to Stage Engine prompt slice.
│   └── DayMeter.tsx      → Progress bar + critical-deadline counter.
├── _hooks/
│   └── use-my-day-tasks.ts → TanStack Query wrapping fn_list_my_tasks (today window).
├── loading.tsx           → SkeletonCard fallback.
└── _tools/
    └── my-day-tools-bridge.tsx → Path-gated mirror tools: set_my_day_filter, focus_my_day_section.
```

### Default landing for non-admin profiles

`apps/web/src/app/dashboard/page.tsx:60-66` currently renders `<EmployeeDashboard />` when admin mode is off. Migration path: either redirect to `/dashboard/my-day` (cleaner) or replace `EmployeeDashboard` body with `<MyDayView />` import (faster). Sortie decides.

### OppgaverTab boundary clarification

`apps/web/src/app/dashboard/schedule/_components/day-control/OppgaverTab.tsx` continues to show **only `schedule_day_task`** for the manager-selected day. It does NOT widen to union 4 sources. A discoverable "Se i Min Dag" link can appear on task rows if relevant, but DayControl-shaped manager context stays narrow.

### Site-map.json entry

```json
{
  "path": "/dashboard/my-day",
  "purpose": "Ansattens dag — alt en ansatt skal gjøre i dag, samlet på ett sted: rutiner fra vakter, ad-hoc oppgaver fra leder, egne todos, og Botsson-påminnelser.",
  "module": "TaskManager",
  "tier": 1,
  "access": ["employee", "manager", "admin", "owner"],
  "owns_chat_surface": false,
  "domain_chat_endpoint": null,
  "tools": [
    { "name": "getMyDay", "description": "Hent alle oppgaver tilordnet meg eller mine for i dag, sortert etter status og prioritet." },
    { "name": "setMyDayFilter", "description": "Sett filter-chip: alle | tildelt meg | kritisk | pågår | ferdig." },
    { "name": "focusMyDaySection", "description": "Scroll til seksjon: ma_loses_naa | i_dag | fullfort." }
  ]
}
```

Mutation tools come from existing `task` capability (ADR-0301): `task.complete`, `task.create_personal`, `task.cancel_personal`. No new write tools.

### Mobile parity

- Web `/dashboard/my-day` ↔ mobile `(me)` tab default route. Both read `fn_list_my_tasks(window=today)`.
- Mobile `(calendar)` tab per ADR-0302 stays as date-anchored execution surface (week + day with task overlay). Min Dag is today-anchored; Kalender is any-day-anchored. Complementary.

## Rules

### R1. Min Dag is a route, not a tab

Min Dag MUST live at `/dashboard/my-day` (web) and `(me)` default (mobile). It MUST NOT be implemented as a tab inside `/dashboard/calendar`, inside `DayControlSheet`, or inside `EmployeeDashboard` legacy shell beyond the migration window.

### R2. OppgaverTab stays narrow

`apps/web/src/app/dashboard/schedule/_components/day-control/OppgaverTab.tsx` MUST continue to show only `schedule_day_task` rows for the manager-selected day. It MUST NOT widen to union 4 sources. If a manager needs the cross-source view, they navigate to `/dashboard/my-day`.

### R3. Surface ownership — Botsson chat ownership

Min Dag MAY render a `BotssonNudge` card (single AI suggestion, single CTA — per handoff §3.4). It MUST NOT declare `owns_chat_surface=true` on its site-map entry (a nudge is not chat — it's a server-rendered hint). The default Orb chat surface remains the default.

### R4. No new schema, no new capability

Min Dag reads via `fn_list_my_tasks` (ADR-0300). Min Dag writes via existing `task.*` tools (ADR-0301). No migration. No new capability tool. If a Min-Dag-specific need surfaces during implementation, it must be amended into this ADR before adding.

### R5. View-mirror tools are path-gated

`set_my_day_filter` and `focus_my_day_section` MUST be path-gated mirror tools per L-0234 — mount-bound to `/dashboard/my-day`, unmount on route leave. They are view-state setters, never mutations.

### R6. Default landing for non-admin profiles

When admin mode is off, the dashboard root MUST resolve to `/dashboard/my-day` (either via redirect or via component-level delegation). Legacy `EmployeeDashboard` component is deprecated; migration is in-scope for the implementation sortie.

## Consequences

### Good

- **Cascade integrity preserved.** Each surface owns one dimension or one explicit cross-dimension projection. Kalender stays D6-aligned, Min Dag is the declared cross-dimension surface.
- **Click-depth minimized for most-used employee surface.** 1 interaction (or 0 with default landing) vs 3 for Option A.
- **Agent surface clean.** New site-map entry, new tool group, clean purpose-line. No path-fragility from query-state mixing.
- **Pattern-consistent IA.** 7th `my-*` route, discoverable by family pattern.
- **Mobile parity clean.** Web ↔ mobile mapping is 1:1, both reading the same RPC.
- **No schema, no capability, no migration.** Cheap to implement; reversible if Pontus dislikes the placement.
- **Honors canonical handoff.** Avoids another AddSheet-style orphan.

### Bad / Trade-offs

- **One new route to maintain.** Total routes goes from 32 to 33. Manageable.
- **Migration step for `EmployeeDashboard` legacy.** Either redirect (low-risk, breaks deep-linked dashboards) or component-delegation (slightly more code). Implementation sortie decides.
- **Drift risk between OppgaverTab and Min Dag visual treatments.** Mitigation: share `TaskCard` component via `packages/ui` or `_components/_shared`.
- **Default-landing change is user-visible.** Existing employees who bookmarked `/dashboard` will land on Min Dag — change-management cost. Mitigation: announce in release notes; root path always serves "the home surface for your role."

### Agent Impact

- **Botsson** gets a new navigation target. Intent-classifier hint: "hva må jeg gjøre i dag" / "vis dagen min" / "hva har jeg" → `/dashboard/my-day`. One-line config in implementation sortie.
- **No new tools for capability surface.** Existing `task.*` capability covers all writes. Two new view-mirror tools (path-gated, read-only) added.
- **BFF context (`/api/botsson/voice/session-context`)** SHOULD extend `context_init` with `my_open_tasks_count` and `my_critical_count` so Botsson can answer "har jeg noe akutt?" without a `task.list_mine` roundtrip — same bootstrap-pipe pattern as ADR-0297 (workforce snapshot) + L-0233 (chat ctx slice).
- **Frontend-designer build sortie** ports the canonical handoff `min-dag.jsx` to real React + Tailwind + Nordic Split tokens. TaskCard, filter chips, dag-meter, three sections. Tokens via `@smartout/design-tokens`, fonts Instrument Serif (Min Dag h1) + Geist Sans (body) + Geist Mono (deadline/counters).

## Implementation Pointers (not in scope for this ADR)

A follow-up sortie `feat/my-day-route` should:

1. Create `apps/web/src/app/dashboard/my-day/` per architecture diagram above.
2. Migrate default landing in `apps/web/src/app/dashboard/page.tsx`.
3. Register site-map entry; run `pnpm --filter web site-map:validate`.
4. Update intent-classifier with Min Dag intent path.
5. Mobile mirror: `(me)` default route renders `<MyDayView />` reading same RPC.
6. Share `TaskCard` component between Min Dag and OppgaverTab (extract to `_shared` or `packages/ui`).
7. Extend `/api/botsson/voice/session-context` with `my_open_tasks_count` + `my_critical_count`.
8. E2E: employee opens app → lands on Min Dag → tap-complete → telemetry verify → manager opens DayControl → sees only `schedule_day_task` in OppgaverTab (boundary holds).

## Cross-references

- ADR-0078 (channel restriction on workspace data)
- ADR-0099 (gate_action before mutation)
- ADR-0132 (mobile thin client — BFF routing)
- ADR-0133 (web composes, mobile executes — Min Dag is execute-leaning)
- ADR-0134 (telemetry emit with non-null identity)
- ADR-0151 (server-derived identity, no body-supplied IDs)
- ADR-0238 (Botsson surface disambiguation — informs R3)
- ADR-0268 (5-tab canonical mobile layout — `(me)` tab pairs with web `my-day`)
- ADR-0297 (workforce snapshot bootstrap pipe — same pattern for my-tasks count)
- ADR-0298 (task ontology — five sources, one read surface, one capability — parent ADR)
- ADR-0300 (`fn_list_my_tasks` RPC — the read source for Min Dag)
- ADR-0301 (`task` capability 6 tools — the write source for Min Dag)
- ADR-0302 (mobile Kalender task wire — Sortie 4; complementary, not competing)

## Related Learnings

- L-0178 (BotssonShell on page hosting embedded chat surface requires explicit ownership declaration — informs R3)
- L-0233 (Two LLM contexts — chat slice and voice slice must both receive Min Dag context if extended)
- L-0234 (Voice view-tools mirror via activity-event — view-state tools naming + path-gating)
- L-0250 (Route-group absorption requires inbound-importer audit — applies when migrating `EmployeeDashboard` callers)
- L-0252 (NEW — Cross-cascade-role projection surfaces belong on their own route; this ADR is the inaugural application)

---

> After acceptance: register in `docs/decisions/0000-decision-log.md`. Update `docs/STATE-SUMMARY.md` if Min Dag implementation becomes active priority. Reserve next-free ADR slot for the implementation sortie ADR (likely ADR-0317+).
