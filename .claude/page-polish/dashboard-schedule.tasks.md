# Page Polish Tasks — dashboard/schedule

| # | Step | Status | Output | Verified by |
|---|------|--------|--------|-------------|
| 1 | Locate (pwd / branch / url / component count) | ✅ | locate.* in run.yml (50 components) | shell |
| 2 | Walkthrough (no skills loaded) | ✅ | walkthrough notes — page is largest in tree (2014 lines) | static read |
| 3 | Load skills | ✅ | smartout-page-polish, cascade, db, edge-fn | conversation log |
| 4 | Speed test cold + warm | ⏳ | DEFERRED | requires Lighthouse + dev server |
| 5 | Bottleneck hunt | 🔄 | Static findings: page size, loading.tsx skeleton dims | grep + read |
| 6 | Datapoint mapping | ✅ | 15 datapoints captured | grep useQuery |
| 7 | API routing | ✅ | All routes via supabase-js to /rest/v1/* | grep + ROUTES.md |
| 8 | Page Knowledge copy | 🔄 | Header/desc/empty/error written in run.yml; DB sync deferred | manual |
| 9 | Harness tools registration | ✅ | useRegisterTools("schedule", ...) — 6+ tools w/ LLM-grade descriptions | tool-definitions.ts read |
| 10 | Design pass (motion + color audit) | ✅ | 0 zinc/gray/slate, 0 raw spring/damping, 0 emoji | grep counts |
| 11 | Re-test | ⏳ | DEFERRED | requires Lighthouse |
| 12 | Verification | 🔄 | 4/8 checklist items pass | self-audit |

Status legend: ⏳ pending · 🔄 in progress · ✅ done · ❌ failed

## Findings

**Pass:**
- Color tokens clean (0 hardcoded zinc/gray/slate)
- Motion tokens enforced (0 raw `stiffness:`/`damping:`)
- Telemetry: every mutation hook file contains `emit()`
- Harness tools well-described for LLM (when/why semantic)
- Page header `<h1>Vaktplan</h1>` exists in planner-command-bar.tsx:53

**Gaps:**
- Page header is compact command-bar style, no descriptive sentence
  (acceptable for chrome density — addressed via page_knowledge entry instead)
- `loading.tsx` skeleton renders 7 cells; not measured against real content for CLS
- Lighthouse run pending — Phases 1, 3, 11 deferred to next sortie

**Open follow-ups:**
- Consider extracting ScheduleProvider context from page.tsx (2014 lines)
- Insert `page_knowledge` row when migration lands
- Run Lighthouse + capture LCP/CLS baseline

## Notes

- Polling reduction sortie 2026-04-29 (commit c300e7d5) touched no schedule hooks.
  use-shift-swap.ts kept its 60_000 refetch — no change required for schedule polish.
- This run.yml is partial (`verified: false`) — Phase 1/3/11 require browser session.
- Pre-commit hook will accept run.yml file existence; `verified: true` requires full pass.
