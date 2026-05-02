# Page Polish Tasks — dashboard/oversikt + 4 variants

| # | Step | Status | Output |
|---|------|--------|--------|
| 1 | Locate (paths, sizes, variants) | ✅ | 7 variant views, 6 tabs, 60+ components |
| 2 | Architecture map (state machine + tabs) | ✅ | locked in run.yml |
| 3 | Skills loaded | ✅ | page-polish, cascade, db, edge-fn |
| 4 | Datapoint inventory (read hooks) | ✅ | 14 datapoints captured |
| 5 | Server Action inventory | ✅ | 12 actions captured |
| 6 | Create-funksjoner inventory (UI → action) | ✅ | per-tab table in run.yml |
| 7 | Telemetry audit | 🔄 | _actions/*.ts emit() audit pending |
| 8 | Page Knowledge copy | ✅ | 5 variants populated |
| 9 | Harness tools — current state | ✅ | 0 registrations across all variants — biggest gap |
| 10 | Harness tools — proposed registry | ✅ | 7 read + 8 write + 3 nav tools mapped |
| 11 | Design pass (color/motion/emoji) | ✅ | 0/0/0 — clean (WebDayControl is reference impl) |
| 12 | Speed test cold/warm | ⏳ | DEFERRED — requires browser/Lighthouse |
| 13 | Verification | 🔄 | 4/8 checklist items pass |

Status legend: ⏳ pending · 🔄 in progress · ✅ done · ❌ failed

## Critical Findings

**🔴 BIGGEST GAP — Harness coverage zero**

Botsson has zero operational tools on /dashboard:
- WebDayControl + 6 tabs: 0 useRegisterTools
- StrategicView, ActivityView, ReconciliationView, TodoTaskView, InteractiveDashboard: 0
- Total registered tools on most-used surface: **0**

Botsson can answer "what is this page?" via engine_memory pin (pinDayControlContextAction)
but cannot fetch roster, list deviations, send broadcast, open session, etc.

**🟡 Telemetry audit needed**

7 UI files (tabs + WebDayControl + SessionActionsBar) have 0 emit() calls. Server Actions
likely emit server-side, but audit of all 12 *-action.ts files needed to confirm.

**✅ Design + skeleton already production-grade**

- 0 hardcoded zinc/gray/slate
- Motion tokens used everywhere (spring physics from @smartout/design-tokens)
- WebDayControl is the page-polish reference implementation (cited in skill file)
- 0 emojis

## Proposed Harness Tool Registry (next sortie)

7 read tools, 8 write tools, 3 navigation tools. Full schema in run.yml step 10.

Implementation order:
1. Audit + patch emit() in 12 *-action.ts files
2. Create `_components/oversikt-tools-bridge.tsx` with useRegisterTools("oversikt", ...)
3. Wire read tools (wrap existing queries)
4. Wire write tools (thin wrappers + C4 authority gate per call)
5. Wire 3 navigation tools (client setState only)
6. Mount bridge inside WebDayControl ready-state only (no session → no write tools)
7. Repeat for strategic / activity / reconciliation / todo variants
8. Smoke test — Botsson on /dashboard answers "kor mange er på vakt?"

## Deferred

- Phase 12 (Lighthouse cold/warm + re-test) — requires browser session
- page_knowledge DB sync — table not yet migrated
