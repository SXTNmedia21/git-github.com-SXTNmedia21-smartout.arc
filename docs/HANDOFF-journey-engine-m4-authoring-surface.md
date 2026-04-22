---
title: "Journey Engine M4 — Authoring Surface Handoff"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey-engine, authoring, platform-admin, milestone-m4, adr-0172, adr-0173, adr-0176, adr-0177]
---

# HANDOFF — Journey Engine M4: Authoring Surface + `JourneyStoreListingCard`

> Milestone M4 of the Journey Engine campaign. Built on top of M3
> (generator unification) at campaign/journey-engine @ 8f2defc9. Lands
> the web-only authoring UI for `journey_version` rows and the
> `JourneyStoreListingCard` schema per ADR-0177.

---

## Summary

The platform-admin surface now has a dedicated route tree for authoring
journey versions that feed the four journey capabilities
(`run_dev`, `publish_mission`, `publish_guide`, `run_guided`).
Everything is web-only (ADR-0133) and reads/writes the new
`journey_version` table with the `journey_version_status` enum
introduced in M1 (ADR-0172).

### Routes added

| Route | Purpose |
|---|---|
| `/platform-admin/journeys/versions` | List of all journey versions with status filter + text search |
| `/platform-admin/journeys/versions/new` | Create a new `journey_version` in `draft` with a scaffold IR |
| `/platform-admin/journeys/versions/[journeyVersionId]` | Detail/edit view — metadata, steps, lifecycle transitions, publish actions |

### Files created (14)

**Shared helpers + components**

- `apps/web/src/app/platform-admin/journeys/versions/_lib/version-status.ts` — enum order, allowed transitions, labels/descriptions
- `apps/web/src/app/platform-admin/journeys/versions/_components/StatusBadge.tsx` — token-only status badge
- `apps/web/src/app/platform-admin/journeys/versions/_components/JourneyStoreListingCard.tsx` — ADR-0177 schema (`JourneyStoreListingCard` TS interface) + presentational card
- `apps/web/src/app/platform-admin/journeys/versions/_components/JourneyVersionList.tsx` — filterable list table

**Server Actions** (all `"use server"`, all emit registered telemetry)

- `actions/_shared.ts` — `resolveAdminProfile()` + `assertPlatformAdmin()`
- `actions/create-journey-version.ts` — insert + emit `journey_version created`
- `actions/save-draft.ts` — update `ir_json` + emit `journey_version saved`
- `actions/transition-status.ts` — status transition + emit `journey_version transitioned` (and `archived` for terminal)
- `actions/publish-mission.ts` — invokes `publishMissionTool` + post-transition to `published`
- `actions/publish-guide.ts` — invokes `publishGuideTool` (does not auto-transition; `publish_mission` owns the terminal move)

**Pages**

- `versions/page.tsx` — list server component
- `versions/new/page.tsx` — creation server component
- `versions/new/_components/NewJourneyVersionForm.tsx` — form client
- `versions/[journeyVersionId]/page.tsx` — detail server component
- `versions/[journeyVersionId]/_components/JourneyVersionEditor.tsx` — main editor client
- `versions/[journeyVersionId]/_components/JourneyStepsEditor.tsx` — step list editor
- `versions/[journeyVersionId]/_components/StepActionEditor.tsx` — **the single isolation boundary**

---

## StepActionEditor isolation — confirmed

The M3.5 upgrade to IR v2 (`action: string → actions: Action[]`) is a
one-file swap. Verification:

```
$ grep -rc "step\.action" apps/web/src/app/platform-admin/journeys/versions
apps/web/src/app/platform-admin/journeys/versions/[journeyVersionId]/_components/StepActionEditor.tsx:5
```

Only `StepActionEditor.tsx` contains the literal `step.action`. The 5
hits break down as:
- 4 comment/doc-string mentions of the field name
- 1 code read: `const currentAction = step.action;` at line 62 (the
  internal useState source).

`JourneyStepsEditor.tsx` never reads or writes the action slot — it
passes the whole step object into `<StepActionEditor step={step} … />`
and merges back whatever patch the editor returns via `update(i, patch)`.

### M3.5 swap checklist (for the next sub-sortie)

1. Update `StepActionPatch` / `StepActionEditorProps` to use IR v2
   `actions: Action[]` instead of `action: string`.
2. Replace the `<Textarea>` with an `<Action[]>` repeater component.
3. No changes needed in `JourneyStepsEditor.tsx` (spread-based draft
   converter carries the shape through) — but add an RN-style smoke
   test to confirm the patch merge still works.
4. No changes needed in Server Actions — `save-draft.ts` calls
   `JourneyIRSchema.safeParse(parsed.data.ir)` which will pick up the
   new shape automatically once `packages/journey-ir/src/schema.ts`
   ships IR v2.

---

## Telemetry additions

Four new authoring events in `packages/telemetry/src/registry.ts`. All
fire from Server Actions; none fire from the capability tools.

| Event | Emitted by | Destinations |
|---|---|---|
| `journey_version created` | `create-journey-version.ts` | posthog, logger, activity_trail |
| `journey_version saved` | `save-draft.ts` | posthog, logger, activity_trail |
| `journey_version transitioned` | `transition-status.ts` | posthog, logger, activity_trail |
| `journey_version archived` | `transition-status.ts` (when to=`archived`) | posthog, logger, activity_trail |

**Why no `engine_event` destination:** authoring does not drive the
mission state machine (that is run-time's job — see
`journey run_started / step_reached / completed`). Writing authoring
events into `engine_event` would create false "runtime" state rows.

Phase 2.5 grep for every `emit()` name in the new code is satisfied —
all four event literals have matching registry entries.

---

## Decisions + invariants upheld

- **ADR-0171** — canonical package path. `@smartout/journey-ir` used
  throughout; zero `@smartout/ai/journey` imports (invariant preserved).
- **ADR-0172** — `journey_version_status` enum lifecycle. The 6-state
  enum is read from `database.types.ts`; allowed transitions enforced
  both client-side (UI hides disallowed buttons) and server-side (action
  rejects disallowed transitions as defense-in-depth).
- **ADR-0173** — four journey capabilities. Server Actions invoke
  `publishMissionTool` and `publishGuideTool` directly from
  `@smartout/ai/capabilities/journey` (new package export added).
- **ADR-0176** — C4 authority + actor_id resolution. `resolveAdminProfile()`
  re-derives `{profileId, workspaceId}` from the session cookie on every
  action call, per appendix §Dev + Publish. The capability body already
  has ADR-0134 defense-in-depth guards.
- **ADR-0177** — UI contract. `JourneyStoreListingCard` TS interface
  mirrors the ADR's schema exactly. Nordic Split tokens throughout
  (zero hardcoded colors). Spring physics `{stiffness: 35, damping: 22,
  mass: 2.2}` on all motion. `useReducedMotion()` guards wrap every
  animated element. 44pt touch target minimum on all interactive
  controls. ARIA live region on status transitions.

### Grep gates

```
$ grep -R "from ['\"]@smartout/ai/journey" apps packages
(no output)

$ grep -RE "zinc-|gray-|#[0-9a-fA-F]{3,}" apps/web/src/app/platform-admin/journeys/versions
(no output)

$ grep -rc "step\.action" apps/web/src/app/platform-admin/journeys/versions | grep -v :0
apps/web/src/app/platform-admin/journeys/versions/[journeyVersionId]/_components/StepActionEditor.tsx:5
```

---

## Deviation: routing layout

The user spec said pages go at `/platform-admin/journeys/page.tsx`,
`/platform-admin/journeys/new/page.tsx`, etc. A legacy tracking
portal (on the old `journey` + `journey_step` tables) already owned
those paths and was not safe to overwrite mid-campaign. M4 landed
under `versions/` instead:

- List → `/platform-admin/journeys/versions`
- Create → `/platform-admin/journeys/versions/new`
- Detail → `/platform-admin/journeys/versions/[journeyVersionId]`

The existing `/platform-admin/journeys` tracking portal is untouched.
A follow-up sub-sortie can decide whether to (a) migrate the tracking
portal into M4 and unify, or (b) keep them separate as two lenses on
"journey intent" vs "journey authoring IR".

---

## Known issues / debt

1. **Capability dist rebuild.** `packages/ai/package.json` now exports
   `./capabilities/journey`. Because turbo typecheck depends on
   `^build`, a fresh checkout must `pnpm turbo build --filter @smartout/ai`
   at least once before a plain `tsc --noEmit` in `apps/web` resolves.
   CI already does this; noted for local dev.

2. **Step reorder UX.** M4 ships with up/down buttons only (no full
   drag-and-drop). Good enough for 10-step journeys; consider
   `@dnd-kit/core` in a follow-up if step counts scale.

3. **Cross-workspace edit guard.** Every Server Action refuses to
   touch rows from another workspace (checks `row.workspace_id ===
   profile.workspaceId`). BUT: the platform-admin sidebar hides
   workspace scoping — a godmode admin acting on their own profile's
   workspace can only edit rows in that workspace. If we want
   platform-admins to hop workspaces from the version editor, a
   `?workspace=…` query param + a workspace-switch helper is needed.
   Defer to M5 when multi-workspace flows become concrete.

4. **`publish_guide` does not transition.** Only `publish_mission`
   advances the row to `published` (since the mission publish is the
   terminal artefact). Running guide alone at `ready_publish` leaves
   the row at `ready_publish` so a subsequent mission publish still
   fires. The spec is ambiguous here — flagged for M5 review.

5. **Store-listing card surface.** `JourneyStoreListingCardView` is
   implemented but not yet rendered anywhere (the list uses a
   narrower table row). M5's `close-feature.sh` gate can read the
   interface directly.

6. **No DnD for steps, no rich-text for action.** IR v1 `step.action`
   is free-form imperative text — M3.5's IR v2 `actions[]` will upgrade
   it. Deliberately minimal here.

---

## Next steps → M5 (runtime + mobile)

1. Fjernkontroll state machine (`idle / running / paused / stuck /
   completed / failed` — ADR-0177 §Fjernkontroll state machine).
2. Mobile BFF proxy for `journey.run_guided` (ADR-0132 + ADR-0176
   Appendix §Runtime mobile).
3. Stuck-detector Edge Function cutover (dual-write → flip → delete,
   per L-0098).
4. `close-feature.sh` gate that reads the `JourneyStoreListingCard`
   schema to validate `status === 'ready_publish'` + all 4 artefacts.

IR v2 (M3.5) runs in parallel — M4 deliberately stays on IR v1 so the
two sortie streams don't collide. The StepActionEditor isolation
ensures the IR v2 merge is a one-file PR.
