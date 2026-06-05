---
topic: oppgaver-redesign-surface-and-form-backend-gap
status: active
updated: 2026-06-01T02:30:10Z
created: 2026-06-01T02:30:10Z
supersedes:
metadata:
  type: project
---

# Decision lesson — oppgaver-redesign-surface-and-form-backend-gap

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

The oppgaver redesign is a **NEW surface, not a re-skin of the existing page.** The Nordic-Split
design (`smartout-re-designe/.../pages/oppgaver.jsx`, 1099 l = "Shift Task Board": PROAKTIVT/REAKTIVT,
3 tabs Oversikt·Oppgaver·Rutiner, `<TaskRow/>`) is a fundamentally different UI from what already
ships at `/dashboard/oppgaver` — that route is a **ManagerTimeline (Gantt drag-retiming)**, a distinct
surface. Port the board to **`/dashboard/oppgaver-v2`** (mirrors the oversikt-v2/min-dag-v2 golden-path
structure: `page.tsx` + `_components/` + `_lib/to-design-shape.ts` + co-located css), **coexisting**
with the timeline — do NOT replace it (promotion is a separate Pontus decision). DomainChatOwnership =
`"oppgaver-v2"` (ADR-0238). The `_chart/` Gantt components are NOT reusable for the board (different
visual model).

**Wired-vs-stub reality (decides what is real on day one):**

- ✅ **Board / Oppgaver-tab is real-wired** — reuse `useSessionTasksForDate`, `fn_list_my_tasks`,
  `useAssignTask`, `useCreateQuickTask`, `completeSessionTaskAction` (the oppgaver gap-track already
  wired these). status/priority/origin need normalization in the adapter (`completed→done`,
  `in_progress→inprogress`; `critical`/`low`/`deviation`-origin have NO backend enum value).
- ⚠️ **Rutiner-tab is structure-only** — `routine` table gives `name`/`is_active`/`trigger_config`/
  `procedure_id`/`control_list_id`; ALL operational KPIs (completion, behind, streak, lastRun,
  nextRun, responsible, category, steps) are design-invented → stub.
- 🔴 **The entire control-form half (`oppgaver-form.jsx`, FormViewer + Flow Player) has NO answer
  backend.** `control_list.items` (Json schema) exists, but there is **no fetch RPC and no
  `control_list_attempt` table to write answers to** — foto/QR/signatur/måling responses land nowhere.
  Per the descope-no-backend-up-front rule ([[wiring-campaign-gate-prerequisites]]), the form ports as
  an **honest visual stub** (renders 1:1, submit = noop toast flagged "ikke lagret ennå") until a
  dedicated backend sortie (new `control_list_attempt` table + fetch RPC + answer/evidence write action
  - ADR) lands. The form backend is a larger feature than the whole UI port — it gets its own ADR, never
    inline.
- 🔴 ~16 task fields are NO-BACKEND (audience/group-assign, folder, book/chapter, tags, subtasks,
  activity-feed, requiresApproval, manual-link, TASK_BOARD leaderboard) → display-stub or hidden,
  centralized in `_lib/to-design-shape.ts` with explicit per-field comments.

## Why

Pontus asked to port oppgaver "eksakt som denne … board + form samlet." A pre-build backend trace
([[faithful-design-port-copy-not-rewrite]] + [[live-db-connection-before-db-claims]]) found the form
half has no write path at all — exactly the sub-feature class that must be descoped/flagged up front,
not discovered mid-sortie where an agent invents the missing backend. Recording the surface split
(board ≠ existing timeline) and the precise wired/stub line means the next session ports the real board
immediately and treats the form as a known stub awaiting its own backend ADR — instead of re-tracing or
fabricating. This is application of the golden-path port motion to oppgaver, with one domain-specific
trap (form-no-backend) made explicit.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-06-01T02:30:10Z — initial: oppgaver redesign = new "oppgaver-v2" board surface coexisting with the existing manager-timeline; board real-wired via session_task hooks; Rutiner-KPIs + the whole control-form/Flow-Player half are NO-BACKEND (no control_list_attempt table) → honest stub until a dedicated backend+ADR sortie.
