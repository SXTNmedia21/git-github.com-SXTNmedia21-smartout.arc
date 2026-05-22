---
title: "Procedure Engine 2B — Botsson Bilde→Rutine"
status: draft
updated: 2026-05-22
created: 2026-05-22
module: procedure-engine
tags: [procedure-engine, botsson, multimodal, vision, brownfield, routine, mobile]
---

# Procedure Engine 2B — Botsson Bilde→Rutine

> Sub-spec of the Phase 2 umbrella (`docs/superpowers/specs/2026-05-22-procedure-engine-design.md` §6).
> Builds on Phase 1 (`docs/HANDOFF-procedure-engine-phase1.md`, ADR-0391).

## 1. Goal

A manager photographs an existing checklist (a printed A4 of opening tasks, a
whiteboard) and Botsson turns it into a working **routine** — extracted by
vision, reviewed by the human, committed atomically. The routine and its steps
can be born **ungoverned** (no protocol attached); governance is a later nudge,
never a precondition.

One sentence: **photo → vision draft → human review → atomic commit → working,
provenance-stamped routine, governed-later.**

## 2. Core Principle — Brownfield-First

The Phase 1 governance chain is `policy → protocol → procedure → routine →
steps`. That is the *mature* state. Real workspaces start **fragmented** —
every company is a brownfield project. A manager has an opening checklist on
the wall long before they have a written policy.

Forcing them to author a policy + protocol before capturing what they already
do is friction that kills adoption. So:

- A **routine** may exist with `protocol_id = NULL`.
- A **procedure** (the container that holds the photo's steps) may exist with
  `protocol_id = NULL` — a *bare* procedure.
- The routine carries `governance_status = 'unassigned'`. The system *wants* to
  attach it to governance and will nudge later, but creation is never blocked.

This is the product thesis in schema form: **compliance is a byproduct of
competence, not its precondition.**

## 3. Architecture — The Pipe (L1 → L4)

```
L1  Capture
      web:    file-picker + image preview in BotssonChat.tsx
      mobile: camera capture (native), routes through web BFF (ADR-0132)
        │  image bytes
        ▼
L2  BFF  POST /api/emma/chat
        │  upload image → Supabase Storage (private bucket, RLS)
        │  pass { storage_path, intent: photo→routine } to stage-engine
        │  (signed path, NOT base64 bloat through every hop)
        ▼
L3  Stage-engine  agent-router
        │  intent classifier → routine capability → extract_from_image tool
        │  MAIN AGENT LOOP STAYS TEXT-ONLY — only the extract tool touches vision
        ▼
L4  routine.extract_from_image   (READ-ONLY, zero writes)
        │  fetch image from storage_path
        │  vision generateObject (anthropic/claude-sonnet-4.6, vision-capable)
        │  → strict Zod draft:
        │    { routine_name, trigger_guess, location_hint, steps[] }
        ▼
    DRAFT returned to user
        │  rendered as editable review card (web Sheet / mobile native)
        │  user edits: routine_name, trigger, location (dropdown, AI-prefilled
        │  if location_hint matches existing; +create option), teams,
        │  step list, optional attach-to-protocol
        │  confirm → gate_action (C4 authority gate)
        ▼
    fn_create_routine_from_draft  (ATOMIC RPC, SECURITY DEFINER, workspace-gated)
        ├─ [if create-location requested] delegate → onboarding capability
        ├─ create bare procedure   (protocol_id NULL unless protocol chosen)
        ├─ create routine          (governance_status = 'unassigned' | 'attached')
        ├─ insert N procedure_step
        ├─ assign_to_location      (+ optional team subset → routine_team)
        └─ provenance: generated_by='agent', source_reference=storage_path
```

### Why these shapes

- **Vision lives inside one tool, not the main loop.** The agent-router today
  builds `content: string` messages (`agent-router.ts:658`). Rather than make
  every loop step multimodal, the `extract_from_image` tool makes its own
  scoped `generateObject` vision call. The blast radius of multimodal wiring is
  one tool.
- **Image → Storage, not base64 passthrough.** The stored object IS the
  provenance artifact (`source_reference`), avoids payload-size limits on big
  photos, and keeps BFF→engine→LLM payloads small.
- **Atomic commit RPC.** Creating procedure + routine + N steps + hook is one
  transaction. A failure at step 3 of 7 must not leave an orphan
  procedure+routine. SECURITY DEFINER, gated on `is_admin_in_workspace`.

## 4. Schema Migration

```sql
-- Relax governance chain for brownfield routines
ALTER TABLE public.procedure ALTER COLUMN protocol_id DROP NOT NULL;
ALTER TABLE public.routine   ALTER COLUMN protocol_id DROP NOT NULL;

-- Governance status
CREATE TYPE governance_status AS ENUM ('unassigned', 'attached');
ALTER TABLE public.routine
  ADD COLUMN governance_status governance_status NOT NULL DEFAULT 'attached';

-- Backfill: every existing routine has a protocol → attached
UPDATE public.routine SET governance_status = 'attached' WHERE protocol_id IS NOT NULL;
```

- `routine.assigned_to_type` / `assigned_to_ref` remain NOT NULL — the RPC sets
  them from the chosen location (reusing Phase 1's `assign_to_location` logic).
- RLS on `procedure` / `routine` that currently joins through `protocol` for
  `workspace_id` must tolerate `protocol_id IS NULL` — fall back to the
  routine/procedure's own `workspace_id` column (Phase 1 added
  `routine.workspace_id`; verify `procedure` has one or add it).

## 5. New Capability Tool

`packages/ai/src/capabilities/routine/tools.ts`

```
extract_from_image   (name: "extract_from_image")
  schema: { storage_path: string }   // path to the uploaded image in Storage
  authority: read_only                // produces a draft, writes nothing
  execute:
    - fetch image bytes from Storage (service role, workspace-scoped path)
    - generateObject(model: claude-sonnet-4.6, image block, schema: DraftSchema)
    - return JSON draft (no DB writes)

DraftSchema (Zod):
  routine_name:   string (1..200)
  trigger_guess:  { trigger_type: 'scheduled'|'event', trigger_config: record }
  location_hint:  string | null      // free-text from image, for fuzzy match
  steps: array(1..50) of {
    title: string (1..200)
    description: string (max 2000)
    is_required: boolean (default true)
    estimated_minutes: int | null
  }
```

Commit is a separate tool `create_from_draft` — a thin `gatedMutation`
wrapper (ADR-0204) that calls the atomic RPC and returns the new `routine_id`:

```
create_from_draft   (name: "create_from_draft")
  schema: {
    routine_name, trigger_type, trigger_config,
    location_id, team_ids[], protocol_id?: uuid|null,
    steps[]: { title, description, is_required, estimated_minutes? },
    source_reference: string         // storage_path of the source image
  }
  authority: suggest+ (gate_action C4)
  execute: call fn_create_routine_from_draft(...) → returns routine_id
```

Location creation is **not** done by the routine tool — it delegates to the
`onboarding` capability's location/department create tool (ADR-0240 namespace
boundary). The review-card "create location" action calls that path, gets the
new `location_id`, then proceeds to `create_from_draft`.

## 6. Surfaces

### Web (`apps/web`)
- `BotssonChat.tsx`: image file-picker + preview chip next to the textarea.
- Review card: shadcn `Sheet` (Nordic Split tokens, no hardcoded colors). Fields
  per §3. Editable step list (add/remove/reorder text). Location dropdown
  (existing locations; AI-prefilled when `location_hint` fuzzy-matches; "+ Ny
  lokasjon" inline). Optional protocol select (skip = ungoverned).

### Mobile (`apps/mobile`)
- Camera capture → upload via BFF (ADR-0132, thin client).
- Native review card mirrors web fields.
- **Full flow (capture + review + commit) on mobile** — authoring a routine is a
  compose verb, which ADR-0133 reserves for web. This is sanctioned by the
  **ADR-0133 carve-out (ADR-0394):** AI-mediated capture-to-author from camera
  evidence, with explicit C4 human confirmation, is a mobile cascade extension
  (sibling to biometric C4 confirmation, ADR-0136 camera evidence). The human
  confirms; Botsson is the author.
- Telemetry: `getProfileContext()` resolves non-null `workspace_id` + `actor_id`
  before any `emit()` (ADR-0134).

## 7. Provenance & Governance

- `procedure_step` / `session_task` born from this flow:
  `generated_by = 'agent'`, `source_reference = <storage_path>`,
  `origin` per the Phase 1 provenance triple.
- `routine.governance_status = 'unassigned'` when no protocol chosen.
- Telemetry: `routine.created_from_image`, `routine.governance_unassigned`
  (registry `packages/telemetry/src/registry.ts`). The unassigned event is what
  a future **nudge-to-govern** surface reads.
- **Nudge UX is OUT of V1.** V1 emits the flag + event; surfacing the nudge is a
  later phase.

## 8. Human-in-the-Loop & Authority

- `extract_from_image` writes nothing — it returns a draft only.
- No DB write happens until the user confirms the review card.
- `create_from_draft` is `gatedMutation` (ADR-0204) with C4 authority.
- On mobile, the confirm tap is the C4 human-in-the-loop act that the ADR-0394
  carve-out hangs on.

## 9. Error Handling

| Case | Behaviour |
|------|-----------|
| Unreadable image / no tasks found | extract returns empty `steps[]` + message; no review card shown |
| Low-confidence fields | draft returned, fields flagged for user review (never auto-committed) |
| `location_hint` no match | dropdown unfilled; user picks or creates |
| Create-location fails | block commit, fail-fast surface error (L-0177) — no silent fallback |
| RPC mid-failure | atomic transaction rolls back — no orphan procedure/routine |
| Storage fetch fails in tool | extract returns explicit error, no draft |

## 10. Testing

- **Unit:** `DraftSchema` validation (good/malformed vision output); review-card
  field mapping; `create_from_draft` arg → RPC contract.
- **SQL:** `fn_create_routine_from_draft` atomicity (force mid-failure → assert
  zero rows); `governance_status` default + backfill; nullable `protocol_id`
  accepted; provenance columns stamped.
- **E2E (Playwright, web):** upload fixture image → review card renders draft →
  edit → confirm → assert routine + procedure + N steps + hook in DB with
  `generated_by='agent'` + `governance_status='unassigned'`.
- **Mobile:** Detox (deferred, like Phase 1 J1) — camera capture mocked.

## 11. ADRs

| ADR | Title | Type |
|-----|-------|------|
| 0393 | Brownfield-first ungoverned routines (nullable protocol_id + governance_status) | new |
| 0394 | ADR-0133 carve-out — AI-mediated capture-to-author from camera evidence | amendment |
| 0395 | Multimodal image-storage contract (Storage path, tool-scoped vision) | new |

## 12. Journeys

| Journey | Role | Surface |
|---------|------|---------|
| J1 Manager photographs checklist on web → reviews → creates ungoverned routine | manager | web |
| J2 Manager captures checklist on mobile camera → reviews → commits | manager | mobile |
| J3 Vision extract produces draft (no writes) + atomic commit RPC | system | backend |
| J4 Created routine carries agent provenance + governance_status='unassigned' | system | backend |
| J5 Location created inline via onboarding-capability delegation | manager | web/mobile |

## 13. Out of Scope (V1)

- Nudge-to-govern surface (attach ungoverned routine to a protocol later).
- Auto-creating policy/protocol from the photo (governance objects stay
  human-owned).
- Sesjonsplanlegger admin-canvas (the *other* Phase 2 subsystem, 2A — separate
  spec/plan).
- Multi-image / multi-page checklist stitching.

## 14. Dependencies on Existing Code

- Phase 1 routine capability: `create`, `assign_to_location`, `add_step`,
  `routine_team`, provenance triple (`packages/ai/src/capabilities/routine/`).
- `onboarding` capability: location/department create tool (delegation target).
- `agent-router.ts` message builder (text-only — left untouched; vision is
  tool-scoped).
- `/api/emma/chat` route (extend to stash image + forward storage_path).
- `packages/telemetry/src/registry.ts` (new events).
