---
title: "Manual Test — Procedure Engine 2B (Botsson Bilde→Rutine)"
feature: procedure-engine-2b
status: draft
updated: 2026-05-22
created: 2026-05-22
module: procedure-engine
tags: [manual-test, mobile, procedure-engine]
---

# Manual Test — Procedure Engine 2B

> On-device walk for the mobile photo→routine flow. Detox automation is a fast-follow
> (deferred, like Phase 1 J1); these cases are the V1 verification gate.

## Preconditions

- Mobile app running against local stack (web BFF reachable; stage-engine running with a valid `OPENROUTER` key).
- Authenticated as a manager/admin with a non-empty workspace + profile.
- The `routine-source` Storage bucket exists (migration `20260623100500`).
- At least one active `location` in the workspace (for the existing-location path), or none (to exercise the new-location path).

## MT-1 — Happy path, existing location, ungoverned

1. Long-press the center FAB (hold ≥0.5s) → **BotssonSheet opens**.
2. In text mode, tap the **camera/image button** in the input row → media picker opens.
3. Pick a clear photo of a printed checklist (opening tasks).
4. Wait → a **draft summary card** appears in the transcript: "<navn>" + "Fant N oppgaver".
   - ✅ Expect: card shows a sensible routine name + a task count matching the sheet.
5. Tap **"Gjennomgå og opprett"** → review screen opens with editable name + step list + location options.
6. Confirm name; pick an existing **location**; leave protocol unset.
7. Tap **"Opprett rutine"** → spinner → returns to previous screen.
8. Verify in DB:
   ```sql
   SELECT created_via, governance_status, source_reference, location_id
   FROM routine ORDER BY created_at DESC LIMIT 1;
   ```
   - ✅ Expect: `created_via='image'`, `governance_status='unassigned'`, `source_reference` = the storage path, `location_id` set.
   - ✅ Expect N `procedure_step` rows under the new routine's procedure (matching the reviewed step list).
   - ✅ Expect `session_hook` rows for the location's departments with `linked_routine_id` = the new routine.

## MT-2 — New location created in-txn

1. Repeat MT-1 steps 1–5.
2. On the review screen, instead of picking an existing location, type a **new location name** in the "+ Ny lokasjon" field.
3. Confirm.
4. Verify a new `location` row exists (workspace-scoped) and the routine is tied to it.
   - ✅ Expect: location + routine both present (atomic).

## MT-3 — Edit + remove steps

1. Repeat to the review screen.
2. Edit a step title; remove one step (X control).
3. Confirm.
   - ✅ Expect: committed `procedure_step` rows reflect the edits (renamed step present, removed step absent), `step_order` contiguous.

## MT-4 — Error: unreadable / empty image

1. Pick a photo with no checklist content (e.g. a blank wall).
2. ✅ Expect: no draft card (empty steps), a message in the sheet; no DB writes.

## MT-5 — Error: permission denied

1. Deny media-library permission when prompted.
2. ✅ Expect: no upload attempted; flow aborts cleanly.

## MT-6 — Authority gate

1. As an EMPLOYEE (not manager/admin), attempt the flow through to confirm.
2. ✅ Expect: commit returns 403 ("ikke tillatt"); the draft is preserved; no routine created.

## Telemetry checks (any successful commit)

```sql
SELECT event_name, occurred_at FROM activity_trail
WHERE event_name IN ('routine.created_from_image','routine.governance_unassigned','mobile.routine.photo_extracted')
ORDER BY occurred_at DESC LIMIT 5;
```
- ✅ `routine.created_from_image` present; `routine.governance_unassigned` present when no protocol; `mobile.routine.photo_extracted` present on extract.
