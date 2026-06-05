---
topic: redesign-wiring-lanes-and-copy-law
status: active
updated: 2026-06-01T03:00:00Z
created: 2026-06-01T03:00:00Z
supersedes:
metadata:
  type: reference
---

# Decision lesson — redesign-wiring-lanes-and-copy-law

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

The redesign-wiring campaign runs on **four non-crossing lanes** plus **one law**.

**Lanes (do not cross them):**

| Lane                                                   | Owns                                                                                                    | Must NOT do                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Orchestrator**                                       | Training subagents + issuing domain orders (dispatch). Nominates domain via achievable-friction driver. | —                                                                                                          |
| **Foreman** (the Opus orchestrating builds in-session) | Find + feed + verify. Runs the full-strict gate battery. Stages/commits (under Pontus's authority).     | Does NOT train workers; does NOT pick which domain to build.                                               |
| **UiBuilder** (sxtn-ui-builder, sonnet)                | PORT one dispatched domain: verbatim copy + one thin adapter. Produces evidence.                        | Does NOT self-grade (foreman runs the gate); does NOT choose domain; does NOT redesign; does NOT write DB. |
| **Pontus**                                             | Commits, push, DB approval, domain priority.                                                            | —                                                                                                          |

**The one law: COPY + ADAPTER, never rewrite.** The Nordic Split design is finished and
hand-verified (UX, navigation, interaction final). UiBuilder copies it (JSX verbatim,
CSS 1:1, one thin `to-design-shape` adapter as the only new logic). Output line count
≈ source; **~2× source = a rewrite → reject and redo as copy.** Proven reference:
`apps/web/src/app/dashboard/people-v2/` (ansatte, 4 files, 1607L).

**Hard walls (all lanes):** NO UI/UX redesign · NO DB writes (migration/seed/schema —
DB is review-gated, F0.4 blocked until Pontus approves; a seed need is a FINDING to
surface, not a license) · NO ghost data (real seed or honest empty state) · every write
gated through `gatedMutation`/C4, never a direct `supabase.insert/update/delete` in a hook.

**Goal (definition of done):** every redesign telemetry event is registered in the ONE
authoritative registry `packages/telemetry/src/registry.ts` (runtime-authoritative;
`events.ts` is divergent) AND fires → lands a row in `activity_trail`, proven by a
DB-assert (not a UI 200), with `emit()` awaited in `onSuccess`.

## Why

Two role violations already happened this campaign: (1) the foreman trained ui-builder
and wrote a foreman agent file — Pontus corrected: "Orchestrator agent eier trening og
ordre til agenten." (2) self-grading by a builder would corrupt the gate's integrity.
Writing the lanes down makes the boundary enforceable across sessions and onboarding of
new agents (UiBuilder joined 2026-06-01). The COPY-not-rewrite law is the campaign's
core value: a rewrite silently discards the exact hand-verified UX, which is
unrecoverable. See [[design-source-canonical-location]],
[[commit-early-untracked-is-vulnerable]], and the agent definition
`.claude/agents/sxtn-ui-builder.md` (project override of the generic plugin agent).

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-06-01T03:00:00Z — initial: captured the 4 non-crossing lanes (Orchestrator trains+orders, Foreman finds/feeds/verifies+gates, UiBuilder ports+produces-evidence+never-self-grades, Pontus commits/push/DB-approval/priority) and the one law (COPY+ADAPTER never rewrite; ~2× source = reject). Triggered by UiBuilder onboarding + two prior role violations (foreman over-trained; self-grade would corrupt gate). Reference port = people-v2 (1607L). Goal = every event in registry.ts + fires to activity_trail (DB-assert).
