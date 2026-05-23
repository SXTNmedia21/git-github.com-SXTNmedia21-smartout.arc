---
title: "Procedure Engine 2B — Botsson Bilde→Rutine — Implementation Plan"
status: draft
updated: 2026-05-22
created: 2026-05-22
module: procedure-engine
tags: [procedure-engine, botsson, multimodal, vision, brownfield, routine, mobile, plan]
---

# Procedure Engine 2B — Botsson Bilde→Rutine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A manager photographs an existing checklist on mobile; Botsson vision-extracts a structured routine draft, the human reviews/edits it, and an atomic RPC commits it — born ungoverned (no protocol required).

**Architecture:** Dedicated mobile BFF routes (Arch B), not the chat agent loop. Mobile uploads image → `routine-source` Storage bucket → `POST /api/mobile/routine/extract` (BFF, identity from JWT) → signed URL → stage-engine `POST /routine/extract` (`generateObject` vision, owns OpenRouter) → `DraftSchema` JSON → mobile review card → `POST /api/mobile/routine/commit` → `gate_action` (C4) → atomic `fn_create_routine_from_draft` RPC writes procedure + routine + steps + session_hooks + routine_team in one transaction.

**Tech Stack:** Postgres 17 (RPC, SECURITY DEFINER), Hono (stage-engine), Next.js route handlers (BFF), Vercel AI SDK `generateObject` + OpenRouter (`anthropic/claude-sonnet-4.6`), Zod, React Native + Expo (expo-image-picker, expo-camera, Gorhom bottom sheet), Vitest, Supabase Storage.

**Spec:** `docs/superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md`

---

## Pre-flight (do once before Task 1)

- [ ] **Confirm current schema reality** — these inform the migration guards:

```bash
cd /home/sxtnl/dev/smartout.ai
# Does procedure already have workspace_id? (createRoutineTool selects it → likely yes)
grep -rn "ALTER TABLE.*procedure.*workspace_id\|workspace_id" supabase/migrations/*.sql | grep -i procedure | head
# Phase-1 routine additions (location_id, workspace_id, executor_type, routine_team)
grep -rn "routine" supabase/migrations/20260622100000_routine_location_team_scope.sql | head -40
# Exact location table columns (for new_location insert)
grep -rn "CREATE TABLE public.location" supabase/migrations/*.sql
# session_hook shape + hook_type enum values
grep -rn "session_hook\|session_hook_type" supabase/migrations/20260412100300_session_infrastructure.sql | head
```

Record: whether `procedure.workspace_id` exists, the exact `location` columns, and the `session_hook_type` enum members. The migrations below use `ADD COLUMN IF NOT EXISTS` so they are safe either way, but the `location` insert in Task 3 must match real columns.

---

## File Structure

**Backend (surface-independent):**
- `supabase/migrations/20260623100000_routine_brownfield_governance.sql` — nullable protocol_id, `governance_status`, `created_via` + `source_reference`, procedure.workspace_id guard.
- `supabase/migrations/20260623100500_routine_source_storage_bucket.sql` — `routine-source` private bucket + RLS.
- `supabase/migrations/20260623101000_fn_create_routine_from_draft.sql` — atomic commit RPC.
- `packages/ai/src/capabilities/routine/draft-schema.ts` — shared `DraftSchema` (Zod).
- `packages/ai/src/capabilities/routine/__tests__/draft-schema.test.ts` — schema unit tests.

**Vision (stage-engine):**
- `services/stage-engine/src/routes/routine-extract.ts` — `POST /routine/extract` (generateObject vision).
- `services/stage-engine/src/routes/__tests__/routine-extract.test.ts` — route shape test.

**BFF (web):**
- `apps/web/src/app/api/mobile/routine/extract/route.ts` — proxy + identity + signed URL.
- `apps/web/src/app/api/mobile/routine/commit/route.ts` — identity + gate + RPC + emit.
- `apps/web/src/app/api/mobile/routine/__tests__/extract.test.ts` + `commit.test.ts`.
- `packages/telemetry/src/registry.ts` — `routine.created_from_image`, `routine.governance_unassigned`.

**Mobile (`apps/mobile`):**
- `src/lib/upload-routine-source.ts` — Storage upload helper (copied pattern).
- `src/hooks/use-routine-extract.ts` — calls extract + commit BFF routes.
- `src/components/ai/BotssonSheet.tsx` — image button + draft summary card (modify).
- `src/providers/botsson-provider.tsx` — draft state (modify).
- `app/(app)/routine-review.tsx` — full review screen.
- `src/components/routine/RoutineReviewForm.tsx` — editable draft form.

**Docs:**
- `docs/decisions/0393-…`, `0394-…`, `0395-…` + `0000-decision-log.md`.
- `docs/journeys/JOURNEY-procedure-engine-2b.md`, `docs/journeys/MANUAL-TEST-procedure-engine-2b.md`.
- `docs/HANDOFF-procedure-engine-2b.md`.

---

# PHASE A — Schema + Atomic RPC

### Task 1: Brownfield governance migration

**Files:**
- Create: `supabase/migrations/20260623100000_routine_brownfield_governance.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 2B brownfield: routines/procedures may be born ungoverned (no protocol).
-- Adds governance_status + image-provenance columns. Idempotent guards so it
-- is safe regardless of which Phase-1 columns already exist.

-- 1. Relax the governance chain.
ALTER TABLE public.procedure ALTER COLUMN protocol_id DROP NOT NULL;
ALTER TABLE public.routine   ALTER COLUMN protocol_id DROP NOT NULL;

-- 2. procedure.workspace_id must exist for bare (protocol-less) procedures,
--    since workspace can no longer be derived through protocol.
ALTER TABLE public.procedure ADD COLUMN IF NOT EXISTS workspace_id uuid;
-- Backfill any nulls from the parent protocol (existing rows all have protocol).
UPDATE public.procedure pc
SET workspace_id = pr.workspace_id
FROM public.protocol pr
WHERE pc.protocol_id = pr.protocol_id AND pc.workspace_id IS NULL;

-- 3. governance_status on routine.
DO $$ BEGIN
  CREATE TYPE public.governance_status AS ENUM ('unassigned', 'attached');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.routine
  ADD COLUMN IF NOT EXISTS governance_status public.governance_status
  NOT NULL DEFAULT 'attached';
-- Every existing routine has a protocol → attached (default already covers it).
UPDATE public.routine SET governance_status = 'attached' WHERE protocol_id IS NOT NULL;

-- 4. Image-provenance on the routine (template-level; session_task instances
--    trace back via routine_id, then to source_reference here).
ALTER TABLE public.routine ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'manual';
ALTER TABLE public.routine ADD COLUMN IF NOT EXISTS source_reference text;
COMMENT ON COLUMN public.routine.created_via IS
  '''manual'' | ''image'' | ''import'' — how this routine template was authored.';
COMMENT ON COLUMN public.routine.source_reference IS
  'Provenance artifact (e.g. routine-source storage_path) when created_via != manual.';
```

- [ ] **Step 2: Apply locally + verify**

Run:
```bash
npx supabase migration up
# verify
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2-)" -c \
  "SELECT column_name, is_nullable FROM information_schema.columns
   WHERE table_name='routine' AND column_name IN ('protocol_id','governance_status','created_via','source_reference')
   ORDER BY column_name;"
```
Expected: `protocol_id | YES`, `governance_status | NO`, `created_via | NO`, `source_reference | YES`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260623100000_routine_brownfield_governance.sql
git commit -m "feat(procedure-engine): brownfield governance — nullable protocol_id + governance_status

Routines/procedures may be born ungoverned (no protocol). Adds governance_status
enum, created_via + source_reference provenance on routine, procedure.workspace_id
guard. 2B.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: routine-source Storage bucket

**Files:**
- Create: `supabase/migrations/20260623100500_routine_source_storage_bucket.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Private bucket for routine-source images (provenance separation from chat-media).
INSERT INTO storage.buckets (id, name, public)
VALUES ('routine-source', 'routine-source', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: members of the workspace (path prefix = workspace_id) may read/write.
-- Path convention: <workspace_id>/<profile_id>/<uuid>.<ext>
CREATE POLICY "routine_source_member_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'routine-source'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_workspace_ids_for_user())
  )
  WITH CHECK (
    bucket_id = 'routine-source'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_workspace_ids_for_user())
  );
```

- [ ] **Step 2: Apply + verify**

Run:
```bash
npx supabase migration up
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2-)" -c \
  "SELECT id, public FROM storage.buckets WHERE id='routine-source';"
```
Expected: one row, `public = f`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260623100500_routine_source_storage_bucket.sql
git commit -m "feat(procedure-engine): routine-source private storage bucket + RLS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Atomic commit RPC `fn_create_routine_from_draft`

**Files:**
- Create: `supabase/migrations/20260623101000_fn_create_routine_from_draft.sql`

- [ ] **Step 0: Confirm `location` columns** (so the in-txn insert matches reality)

Run: `grep -n "CREATE TABLE public.location" -A 20 supabase/migrations/*.sql | head -30`
Adjust the `INSERT INTO public.location (...)` column list in Step 1 to match. The code below assumes `(location_id, workspace_id, name, address, city, country_code, is_active)`.

- [ ] **Step 1: Write the RPC**

```sql
-- Atomic commit for 2B: procedure + routine + steps + session_hooks + routine_team.
-- SECURITY DEFINER: called by the commit BFF route (service role) AFTER it has
-- derived identity from JWT and passed gate_action. The RPC trusts p_workspace_id
-- / p_actor_profile_id (server-derived) and enforces referential workspace
-- integrity on every supplied id (fail-fast — no silent cross-workspace writes).

CREATE OR REPLACE FUNCTION public.fn_create_routine_from_draft(
  p_workspace_id      uuid,
  p_actor_profile_id  uuid,
  p_routine_name      text,
  p_trigger_type      public.trigger_type,
  p_trigger_config    jsonb,
  p_steps             jsonb,            -- [{title,description,is_required,estimated_minutes}]
  p_source_reference  text,
  p_location_id       uuid    DEFAULT NULL,
  p_new_location      jsonb   DEFAULT NULL,  -- {name,address,city,country_code}
  p_team_ids          uuid[]  DEFAULT '{}',
  p_protocol_id       uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_location_id   uuid := p_location_id;
  v_procedure_id  uuid;
  v_routine_id    uuid;
  v_gov           public.governance_status;
  v_hook_type     public.session_hook_type;
  v_step          jsonb;
  v_order         int := 0;
  v_team          uuid;
  v_dept          uuid;
BEGIN
  -- Guard: protocol (if supplied) belongs to the workspace.
  IF p_protocol_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.protocol
                   WHERE protocol_id = p_protocol_id AND workspace_id = p_workspace_id) THEN
      RAISE EXCEPTION 'protocol_wrong_workspace';
    END IF;
    v_gov := 'attached';
  ELSE
    v_gov := 'unassigned';
  END IF;

  -- Resolve location: existing (verify ws) OR create in-txn OR error.
  IF v_location_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.location
                   WHERE location_id = v_location_id AND workspace_id = p_workspace_id) THEN
      RAISE EXCEPTION 'location_wrong_workspace';
    END IF;
  ELSIF p_new_location IS NOT NULL THEN
    INSERT INTO public.location (workspace_id, name, address, city, country_code, is_active)
    VALUES (
      p_workspace_id,
      p_new_location->>'name',
      p_new_location->>'address',
      p_new_location->>'city',
      COALESCE(p_new_location->>'country_code', 'NO'),
      true
    )
    RETURNING location_id INTO v_location_id;
  ELSE
    RAISE EXCEPTION 'location_required';
  END IF;

  -- Map trigger_type → session_hook_type (Phase-1 convention: scheduled→scheduled, event→open).
  v_hook_type := CASE WHEN p_trigger_type = 'scheduled' THEN 'scheduled'::public.session_hook_type
                      ELSE 'open'::public.session_hook_type END;

  -- 1. Bare procedure (protocol_id may be NULL).
  INSERT INTO public.procedure (protocol_id, workspace_id, name, description, procedure_type)
  VALUES (p_protocol_id, p_workspace_id, p_routine_name, 'Opprettet fra bilde (Botsson).', 'standard')
  RETURNING procedure_id INTO v_procedure_id;

  -- 2. Routine.
  INSERT INTO public.routine (
    protocol_id, procedure_id, workspace_id, name,
    trigger_type, trigger_config, executor_type,
    location_id, assigned_to_type, assigned_to_ref,
    control_frequency, governance_status, created_via, source_reference
  )
  VALUES (
    p_protocol_id, v_procedure_id, p_workspace_id, p_routine_name,
    p_trigger_type, p_trigger_config, 'human',
    v_location_id, 'profile', p_actor_profile_id,
    'never', v_gov, 'image', p_source_reference
  )
  RETURNING routine_id INTO v_routine_id;

  -- 3. Steps (ordered).
  FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps) LOOP
    v_order := v_order + 1;
    INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes)
    VALUES (
      v_procedure_id,
      v_step->>'title',
      v_step->>'description',
      v_order,
      COALESCE((v_step->>'is_required')::boolean, true),
      NULLIF(v_step->>'estimated_minutes','')::int
    );
  END LOOP;

  -- 4. routine_team (verify each team belongs to workspace).
  FOREACH v_team IN ARRAY p_team_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.team WHERE team_id = v_team AND workspace_id = p_workspace_id) THEN
      RAISE EXCEPTION 'team_wrong_workspace';
    END IF;
    INSERT INTO public.routine_team (routine_id, team_id)
    VALUES (v_routine_id, v_team) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 5. session_hook per department linked to the location (so cron materialises it).
  FOR v_dept IN
    SELECT department_id FROM public.department_location WHERE location_id = v_location_id
  LOOP
    INSERT INTO public.session_hook (workspace_id, department_id, hook_type, linked_routine_id)
    VALUES (p_workspace_id, v_dept, v_hook_type, v_routine_id)
    ON CONFLICT (workspace_id, department_id, hook_type)
    DO UPDATE SET linked_routine_id = EXCLUDED.linked_routine_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'routine_id', v_routine_id,
    'procedure_id', v_procedure_id,
    'location_id', v_location_id,
    'governance_status', v_gov
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_routine_from_draft(
  uuid,uuid,text,public.trigger_type,jsonb,jsonb,text,uuid,jsonb,uuid[],uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_routine_from_draft(
  uuid,uuid,text,public.trigger_type,jsonb,jsonb,text,uuid,jsonb,uuid[],uuid) TO service_role;
```

- [ ] **Step 2: Apply + happy-path smoke**

Run (use the seed identity from memory: workspace `b0000000-0000-0000-0000-000000000000`, profile `f0000000-0000-0000-0000-000000000000`; pick a real `location_id` from that workspace):
```bash
npx supabase migration up
psql "$DB_URL" -c "
SELECT public.fn_create_routine_from_draft(
  'b0000000-0000-0000-0000-000000000000','f0000000-0000-0000-0000-000000000000',
  'Test Åpningsrutine','scheduled'::trigger_type,'{\"times\":[\"07:00\"]}'::jsonb,
  '[{\"title\":\"Lås opp\",\"description\":\"Åpne dør\",\"is_required\":true}]'::jsonb,
  'routine-source/test.jpg',
  (SELECT location_id FROM location WHERE workspace_id='b0000000-0000-0000-0000-000000000000' LIMIT 1),
  NULL,'{}'::uuid[],NULL);"
```
Expected: JSON with `ok:true`, a `routine_id`, `governance_status:"unassigned"`.

- [ ] **Step 3: Atomicity test (force mid-failure → assert rollback)**

Run:
```bash
psql "$DB_URL" -c "
SELECT public.fn_create_routine_from_draft(
  'b0000000-0000-0000-0000-000000000000','f0000000-0000-0000-0000-000000000000',
  'Should Rollback','scheduled'::trigger_type,'{}'::jsonb,
  '[{\"title\":\"x\",\"description\":\"y\"}]'::jsonb,'ref',
  NULL, '{\"name\":\"NewLoc\"}'::jsonb,
  ARRAY['00000000-0000-0000-0000-0000000000ff']::uuid[], NULL);" 2>&1 | grep -i "team_wrong_workspace"
# then assert the bad-run created NO leftover location:
psql "$DB_URL" -c "SELECT count(*) FROM location WHERE name='NewLoc';"
```
Expected: error `team_wrong_workspace`, and count `0` (the in-txn location insert rolled back with the failed team check).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623101000_fn_create_routine_from_draft.sql
git commit -m "feat(procedure-engine): fn_create_routine_from_draft atomic commit RPC

Single-txn procedure+routine+steps+session_hooks+routine_team. Optional in-txn
location create. Workspace fail-fast on every supplied id. service_role only. 2B.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Regenerate database types

**Files:**
- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Reset + regenerate** (NEVER under `op run` — see memory)

```bash
npx supabase db reset
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 2: Verify new shapes landed**

Run: `grep -n "governance_status\|create_routine_from_draft\|created_via" packages/supabase/src/database.types.ts | head`
Expected: matches for the enum, the function, and the column.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @smartout/supabase typecheck
git add packages/supabase/src/database.types.ts
git commit -m "chore(types): regenerate after 2B brownfield + RPC migrations

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# PHASE B — Shared draft schema + Vision route

### Task 5: `DraftSchema` (shared contract)

**Files:**
- Create: `packages/ai/src/capabilities/routine/draft-schema.ts`
- Test: `packages/ai/src/capabilities/routine/__tests__/draft-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { DraftSchema } from "../draft-schema.js";

const GOOD = {
  routine_name: "Åpningsrutine",
  trigger_guess: { trigger_type: "scheduled", trigger_config: { times: ["07:00"] } },
  location_hint: "Restaurant",
  steps: [{ title: "Lås opp", description: "Åpne hovedinngangen", is_required: true, estimated_minutes: 5 }],
};

describe("DraftSchema", () => {
  it("accepts a well-formed draft and applies is_required default", () => {
    const parsed = DraftSchema.parse({ ...GOOD, steps: [{ title: "x", description: "y" }] });
    expect(parsed.steps[0]!.is_required).toBe(true);
    expect(parsed.location_hint).toBe("Restaurant");
  });

  it("rejects empty step list", () => {
    expect(() => DraftSchema.parse({ ...GOOD, steps: [] })).toThrow();
  });

  it("rejects bad trigger_type", () => {
    expect(() =>
      DraftSchema.parse({ ...GOOD, trigger_guess: { trigger_type: "nope", trigger_config: {} } }),
    ).toThrow();
  });

  it("allows null location_hint", () => {
    expect(DraftSchema.parse({ ...GOOD, location_hint: null }).location_hint).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `pnpm --filter @smartout/ai test draft-schema`
Expected: FAIL — cannot find `../draft-schema.js`.

- [ ] **Step 3: Implement**

```ts
// packages/ai/src/capabilities/routine/draft-schema.ts
// Shared routine-draft contract for 2B (bilde→rutine). Imported by the
// stage-engine extract route, the commit BFF route, and tests.
import { z } from "zod";

export const DraftStepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  is_required: z.boolean().default(true),
  estimated_minutes: z.number().int().min(1).nullable().default(null),
});

export const DraftSchema = z.object({
  routine_name: z.string().min(1).max(200),
  trigger_guess: z.object({
    trigger_type: z.enum(["scheduled", "event"]),
    trigger_config: z.record(z.unknown()).default({}),
  }),
  location_hint: z.string().max(200).nullable().default(null),
  steps: z.array(DraftStepSchema).min(1).max(50),
});

export type RoutineDraft = z.infer<typeof DraftSchema>;
export type RoutineDraftStep = z.infer<typeof DraftStepSchema>;
```

- [ ] **Step 4: Run — verify pass + add package export**

Run: `pnpm --filter @smartout/ai test draft-schema` → Expected: PASS.

Add to `packages/ai/package.json` `exports`:
```json
"./capabilities/routine/draft-schema": {
  "types": "./dist/capabilities/routine/draft-schema.d.ts",
  "default": "./dist/capabilities/routine/draft-schema.js"
}
```

- [ ] **Step 5: Build + commit**

```bash
pnpm --filter @smartout/ai build
git add packages/ai/src/capabilities/routine/draft-schema.ts \
        packages/ai/src/capabilities/routine/__tests__/draft-schema.test.ts \
        packages/ai/package.json
git commit -m "feat(routine): shared DraftSchema for 2B bilde→rutine

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Stage-engine `POST /routine/extract` (vision)

**Files:**
- Create: `services/stage-engine/src/routes/routine-extract.ts`
- Modify: `services/stage-engine/src/index.ts` (register route)
- Test: `services/stage-engine/src/routes/__tests__/routine-extract.test.ts`

- [ ] **Step 1: Write the failing test** (mocks `generateObject` — no real LLM call)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const generateObjectMock = vi.fn();
vi.mock("ai", () => ({ generateObject: (...a: unknown[]) => generateObjectMock(...a) }));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => (model: string) => ({ model }),
}));

import { extractRoutineFromImage } from "../routine-extract.js";

describe("extractRoutineFromImage", () => {
  beforeEach(() => generateObjectMock.mockReset());

  it("returns the validated draft from the vision model", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        routine_name: "Åpningsrutine",
        trigger_guess: { trigger_type: "scheduled", trigger_config: { times: ["07:00"] } },
        location_hint: "Bar",
        steps: [{ title: "Lås opp", description: "Åpne dør", is_required: true, estimated_minutes: null }],
      },
    });
    const draft = await extractRoutineFromImage("https://signed.example/img.jpg");
    expect(draft.routine_name).toBe("Åpningsrutine");
    expect(draft.steps).toHaveLength(1);
    // model invoked with an image content block
    const arg = generateObjectMock.mock.calls[0]![0] as { messages: { content: unknown[] }[] };
    const hasImage = arg.messages[0]!.content.some((c) => (c as { type: string }).type === "image");
    expect(hasImage).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `pnpm --filter @smartout/stage-engine test routine-extract`
Expected: FAIL — cannot find `../routine-extract.js`.

- [ ] **Step 3: Implement the extractor + Hono route**

```ts
// services/stage-engine/src/routes/routine-extract.ts
import { Hono } from "hono";
import { z } from "zod";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { DraftSchema, type RoutineDraft } from "@smartout/ai/capabilities/routine/draft-schema";
import { getSecrets } from "../core/secrets.js";

const VISION_MODEL = "anthropic/claude-sonnet-4.6";

const EXTRACT_PROMPT =
  "Du er en operativ assistent. Bildet viser en sjekkliste eller rutine fra en " +
  "arbeidsplass (f.eks. åpnings- eller stengeoppgaver). Trekk ut en strukturert " +
  "rutine: et beskrivende navn, et trigger-gjett (scheduled for tidsbaserte " +
  "åpning/stenging, event ellers), et valgfritt lokasjonshint hvis bildet nevner " +
  "et sted, og hvert punkt som et steg med tittel + kort beskrivelse. Norsk.";

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
function getOpenRouter() {
  if (!_openrouter) {
    const apiKey = getSecrets().openrouterApiKey;
    if (!apiKey) throw new Error("OpenRouter API key not available");
    _openrouter = createOpenRouter({ apiKey });
  }
  return _openrouter;
}

/** Pure-ish extractor: signed image URL → validated RoutineDraft. No DB writes. */
export async function extractRoutineFromImage(imageUrl: string): Promise<RoutineDraft> {
  const { object } = await generateObject({
    model: getOpenRouter()(VISION_MODEL),
    schema: DraftSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACT_PROMPT },
          { type: "image", image: new URL(imageUrl) },
        ],
      },
    ],
  });
  // generateObject already validates against DraftSchema; re-parse to apply defaults.
  return DraftSchema.parse(object);
}

const BodySchema = z.object({ image_url: z.string().url() }).strict();

export const routineExtractRoute = new Hono();

routineExtractRoute.post("/routine/extract", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ ok: false, error: "invalid_body" }, 422);
  }
  try {
    const draft = await extractRoutineFromImage(parsed.data.image_url);
    return c.json({ ok: true, draft }, 200);
  } catch (err) {
    return c.json({ ok: false, error: `extract_failed: ${(err as Error).message}` }, 500);
  }
});
```

> Note: confirm `getSecrets` import path + `openrouterApiKey` field name against `services/stage-engine/src/core/` (the same source `agent-router.ts:163` uses). Adjust import if the secrets module path differs.

- [ ] **Step 4: Register the route**

In `services/stage-engine/src/index.ts`, add near the other `app.route(...)` calls:
```ts
import { routineExtractRoute } from "./routes/routine-extract.js";
// ...
app.route("/", routineExtractRoute);
```

- [ ] **Step 5: Run — verify pass + typecheck**

Run: `pnpm --filter @smartout/stage-engine test routine-extract` → PASS.
Run: `pnpm --filter @smartout/stage-engine typecheck` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add services/stage-engine/src/routes/routine-extract.ts \
        services/stage-engine/src/routes/__tests__/routine-extract.test.ts \
        services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): POST /routine/extract — vision draft via generateObject

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# PHASE C — Telemetry + BFF routes

### Task 7: Telemetry events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add the event interfaces** (match the existing `RoutineCreated` shape near line 11181)

```ts
export interface RoutineCreatedFromImage extends BaseEvent {
  event: "routine.created_from_image";
  properties: {
    entity: { entity_type: "routine"; entity_id: string };
    data: {
      routine_id: string;
      procedure_id: string;
      location_id: string;
      governance_status: "unassigned" | "attached";
      step_count: number;
      source_reference: string;
    };
  };
}

export interface RoutineGovernanceUnassigned extends BaseEvent {
  event: "routine.governance_unassigned";
  properties: {
    entity: { entity_type: "routine"; entity_id: string };
    data: { routine_id: string; source_reference: string };
  };
}
```

- [ ] **Step 2: Add to the event union + EVENT_ROUTING**

Add both interfaces to the exported event union type (wherever `RoutineCreated` is unioned), then near the `"routine.created"` routing entry (~line 14968):
```ts
  "routine.created_from_image": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "routine.governance_unassigned": {
    destinations: ["logger", "activity_trail"],
    category: "scheduling",
  },
```

- [ ] **Step 3: Build + verify the registry typechecks**

Run:
```bash
pnpm --filter @smartout/telemetry build
pnpm --filter @smartout/telemetry typecheck
```
Expected: 0 errors (the union and EVENT_ROUTING are exhaustive-checked).

- [ ] **Step 4: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): routine.created_from_image + routine.governance_unassigned

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: BFF `POST /api/mobile/routine/extract`

**Files:**
- Create: `apps/web/src/app/api/mobile/routine/extract/route.ts`
- Test: `apps/web/src/app/api/mobile/routine/__tests__/extract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveMobileActor = vi.fn();
const createSignedUrl = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/lib/mobile-auth", () => ({ resolveMobileActor }));
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ createSignedUrl }) } }),
}));
vi.stubGlobal("fetch", fetchMock);

import { POST } from "../extract/route";

function req(body: unknown, auth = "Bearer t") {
  return new Request("http://x/api/mobile/routine/extract", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mobile/routine/extract", () => {
  beforeEach(() => { resolveMobileActor.mockReset(); createSignedUrl.mockReset(); fetchMock.mockReset(); });

  it("401 when no bearer", async () => {
    const res = await POST(req({ storage_path: "w/p/x.jpg" }, ""));
    expect(res.status).toBe(401);
  });

  it("forwards a signed URL and returns the engine draft", async () => {
    resolveMobileActor.mockResolvedValue({ workspaceId: "w", profileId: "p", userId: "u" });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/x.jpg" }, error: null });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, draft: { routine_name: "R" } }), { status: 200 }));

    const res = await POST(req({ storage_path: "w/p/x.jpg" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draft.routine_name).toBe("R");
    // signed URL was forwarded to stage-engine
    const sent = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(sent.image_url).toBe("https://signed/x.jpg");
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm --filter @smartout/web test extract` → FAIL (no `../extract/route`).

- [ ] **Step 3: Implement**

```ts
// apps/web/src/app/api/mobile/routine/extract/route.ts
// 2B step 1: mobile sends a storage_path; we mint a service-role signed URL and
// forward it to the stage-engine vision route. Identity from JWT (ADR-0151).
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveMobileActor } from "@/lib/mobile-auth";
import { createAdminClient } from "@smartout/supabase/admin";

const STAGE_ENGINE_URL = process.env.STAGE_ENGINE_URL ?? "http://localhost:5010";
const BodySchema = z.object({ storage_path: z.string().min(1) }).strict();

export async function POST(request: NextRequest | Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const actor = await resolveMobileActor(token);
  if (!actor || !actor.workspaceId || !actor.profileId) {
    return NextResponse.json({ ok: false, error: "Ugyldig aktørkontekst" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Ugyldig forespørsel" }, { status: 422 });
  }

  // Fail-fast: the path must be scoped to the actor's workspace (no cross-ws fetch).
  if (!body.storage_path.startsWith(`${actor.workspaceId}/`)) {
    return NextResponse.json({ ok: false, error: "path_wrong_workspace" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from("routine-source")
    .createSignedUrl(body.storage_path, 300); // 5 min — only needs to survive the LLM call
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ ok: false, error: "signed_url_failed" }, { status: 500 });
  }

  const res = await fetch(`${STAGE_ENGINE_URL}/routine/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_url: signed.signedUrl }),
  });
  const payload = (await res.json().catch(() => ({ ok: false, error: "bad_engine_response" }))) as {
    ok?: boolean; draft?: unknown; error?: string;
  };
  if (!res.ok || payload.ok === false) {
    return NextResponse.json({ ok: false, error: payload.error ?? "extract_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, draft: payload.draft }, { status: 200 });
}
```

> Note: confirm `resolveMobileActor` lives at `@/lib/mobile-auth` (the tasks route uses it — grep `resolveMobileActor` import in `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` and copy the exact path). Confirm `createAdminClient` import path the same way.

- [ ] **Step 4: Run — verify pass**

Run: `pnpm --filter @smartout/web test extract` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/mobile/routine/extract/route.ts \
        apps/web/src/app/api/mobile/routine/__tests__/extract.test.ts
git commit -m "feat(bff): POST /api/mobile/routine/extract — signed URL → vision proxy

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: BFF `POST /api/mobile/routine/commit`

**Files:**
- Create: `apps/web/src/app/api/mobile/routine/commit/route.ts`
- Test: `apps/web/src/app/api/mobile/routine/__tests__/commit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveMobileActor = vi.fn();
const rpc = vi.fn();
const emit = vi.fn();

vi.mock("@/lib/mobile-auth", () => ({ resolveMobileActor }));
vi.mock("@smartout/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@smartout/telemetry", () => ({ emit, nonEmpty: (v: string) => v }));

import { POST } from "../commit/route";

const DRAFT = {
  routine_name: "Åpningsrutine",
  trigger_type: "scheduled",
  trigger_config: { times: ["07:00"] },
  location_id: "loc-1",
  team_ids: [],
  protocol_id: null,
  steps: [{ title: "Lås opp", description: "dør", is_required: true, estimated_minutes: null }],
  source_reference: "w/p/x.jpg",
};
function req(body: unknown, auth = "Bearer t") {
  return new Request("http://x/api/mobile/routine/commit", {
    method: "POST", headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mobile/routine/commit", () => {
  beforeEach(() => { resolveMobileActor.mockReset(); rpc.mockReset(); emit.mockReset(); });

  it("403 when gate denies", async () => {
    resolveMobileActor.mockResolvedValue({ workspaceId: "w", profileId: "p" });
    rpc.mockResolvedValueOnce({ data: { allow: false, reason: "ikke_tillatt" }, error: null }); // gate_action
    const res = await POST(req(DRAFT));
    expect(res.status).toBe(403);
    expect(rpc).toHaveBeenCalledTimes(1); // never reached fn_create_routine_from_draft
  });

  it("commits + emits created_from_image + governance_unassigned (null protocol)", async () => {
    resolveMobileActor.mockResolvedValue({ workspaceId: "w", profileId: "p" });
    rpc
      .mockResolvedValueOnce({ data: { allow: true }, error: null }) // gate_action
      .mockResolvedValueOnce({ data: { ok: true, routine_id: "r-1", procedure_id: "pc-1", location_id: "loc-1", governance_status: "unassigned" }, error: null });
    const res = await POST(req(DRAFT));
    expect(res.status).toBe(200);
    expect((await res.json()).routine_id).toBe("r-1");
    const events = emit.mock.calls.map((c) => (c[0] as { event: string }).event);
    expect(events).toContain("routine.created_from_image");
    expect(events).toContain("routine.governance_unassigned");
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm --filter @smartout/web test commit` → FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/app/api/mobile/routine/commit/route.ts
// 2B step 2: commit the reviewed draft. Identity from JWT (ADR-0151), gate_action
// (C4), then the atomic fn_create_routine_from_draft RPC. Route emits (server-side).
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveMobileActor } from "@/lib/mobile-auth";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

const NewLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().length(2).optional(),
});
const StepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  is_required: z.boolean().default(true),
  estimated_minutes: z.number().int().min(1).nullable().default(null),
});
const BodySchema = z
  .object({
    routine_name: z.string().min(1).max(200),
    trigger_type: z.enum(["scheduled", "event"]),
    trigger_config: z.record(z.unknown()).default({}),
    location_id: z.string().uuid().nullable().default(null),
    new_location: NewLocationSchema.nullable().default(null),
    team_ids: z.array(z.string().uuid()).default([]),
    protocol_id: z.string().uuid().nullable().default(null),
    steps: z.array(StepSchema).min(1).max(50),
    source_reference: z.string().min(1),
  })
  .strict()
  .refine((b) => b.location_id !== null || b.new_location !== null, {
    message: "location_required",
  });

export async function POST(request: NextRequest | Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const actor = await resolveMobileActor(token);
  if (!actor || !actor.workspaceId || !actor.profileId) {
    return NextResponse.json({ ok: false, error: "Ugyldig aktørkontekst" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? (err.errors[0]?.message ?? "Ugyldig forespørsel") : "Ugyldig JSON";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }

  const admin = createAdminClient();

  // C4 gate.
  const { data: gate, error: gateErr } = await admin.rpc("gate_action", {
    p_workspace_id: actor.workspaceId,
    p_capability: "routine",
    p_channel: "system",
    p_actor_profile_id: actor.profileId,
    p_action_type: "routine.create_from_image",
    p_approvers_present: [actor.profileId],
  });
  if (gateErr || (gate as { allow?: boolean })?.allow !== true) {
    return NextResponse.json(
      { ok: false, error: (gate as { reason?: string })?.reason ?? "ikke_tillatt" },
      { status: 403 },
    );
  }

  // Atomic commit.
  const { data: result, error: rpcErr } = await admin.rpc("fn_create_routine_from_draft", {
    p_workspace_id: actor.workspaceId,
    p_actor_profile_id: actor.profileId,
    p_routine_name: body.routine_name,
    p_trigger_type: body.trigger_type,
    p_trigger_config: body.trigger_config,
    p_steps: body.steps,
    p_source_reference: body.source_reference,
    p_location_id: body.location_id,
    p_new_location: body.new_location,
    p_team_ids: body.team_ids,
    p_protocol_id: body.protocol_id,
  });
  const res = result as
    | { ok: true; routine_id: string; procedure_id: string; location_id: string; governance_status: "unassigned" | "attached" }
    | null;
  if (rpcErr || !res?.ok) {
    return NextResponse.json({ ok: false, error: rpcErr?.message ?? "commit_failed" }, { status: 422 });
  }

  await emit({
    event: "routine.created_from_image",
    workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
    actor_id: nonEmpty(actor.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "routine", entity_id: res.routine_id },
      data: {
        routine_id: res.routine_id,
        procedure_id: res.procedure_id,
        location_id: res.location_id,
        governance_status: res.governance_status,
        step_count: body.steps.length,
        source_reference: body.source_reference,
      },
    },
  });

  if (res.governance_status === "unassigned") {
    await emit({
      event: "routine.governance_unassigned",
      workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
      actor_id: nonEmpty(actor.profileId, "actor_id"),
      properties: {
        entity: { entity_type: "routine", entity_id: res.routine_id },
        data: { routine_id: res.routine_id, source_reference: body.source_reference },
      },
    });
  }

  return NextResponse.json({ ok: true, routine_id: res.routine_id }, { status: 200 });
}
```

- [ ] **Step 4: Run — verify pass + register intent (gate_action needs the action_type)**

Run: `pnpm --filter @smartout/web test commit` → PASS.

`routine.create_from_image` is a new `p_action_type`. Seed its authority default so `gate_action` does not deny by default. Add a seed migration entry mirroring the Phase-1 routine authority seed (find it: `grep -rn "routine.create" supabase/migrations/*authority*`). Append a row for `routine.create_from_image` with the same `min_role='admin'`, `confirm` authority, channels `{system,chat}`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/mobile/routine/commit/route.ts \
        apps/web/src/app/api/mobile/routine/__tests__/commit.test.ts \
        supabase/migrations/*authority*
git commit -m "feat(bff): POST /api/mobile/routine/commit — gate + atomic RPC + emit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# PHASE D — Mobile UI

### Task 10: routine-source upload helper

**Files:**
- Create: `apps/mobile/src/lib/upload-routine-source.ts`

- [ ] **Step 1: Implement** (mirrors `useSendMessage.uploadAttachment`, own bucket)

```ts
// apps/mobile/src/lib/upload-routine-source.ts
// Upload a captured/picked image to the routine-source bucket. Returns the
// storage_path the BFF extract route expects. Path: <workspace>/<profile>/<uuid>.<ext>
import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";

export async function uploadRoutineSource(
  workspaceId: string,
  profileId: string,
  localUri: string,
): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const storagePath = `${workspaceId}/${profileId}/${randomUUID()}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from("routine-source")
    .upload(storagePath, blob, { contentType: mimeType, upsert: false });
  if (error) throw error;

  return storagePath;
}
```

> Confirm the supabase client import path (`@/lib/supabase`) and `randomUUID` source against `apps/mobile/src/hooks/mutations/use-send-message.ts` (it imports `randomUUID`). Match exactly.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @smartout/mobile typecheck
git add apps/mobile/src/lib/upload-routine-source.ts
git commit -m "feat(mobile): uploadRoutineSource helper (routine-source bucket)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: `useRoutineExtract` hook (extract + commit transport)

**Files:**
- Create: `apps/mobile/src/hooks/use-routine-extract.ts`

- [ ] **Step 1: Implement** (mirrors `useEmmaChat` bearer-fetch pattern)

```ts
// apps/mobile/src/hooks/use-routine-extract.ts
import { useState, useCallback } from "react";
import { getWebApiUrl } from "@/lib/web-api";
import { supabase } from "@/lib/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

export type RoutineDraft = {
  routine_name: string;
  trigger_guess: { trigger_type: "scheduled" | "event"; trigger_config: Record<string, unknown> };
  location_hint: string | null;
  steps: { title: string; description: string; is_required: boolean; estimated_minutes: number | null }[];
};

export type CommitInput = {
  routine_name: string;
  trigger_type: "scheduled" | "event";
  trigger_config: Record<string, unknown>;
  location_id: string | null;
  new_location: { name: string; address?: string; city?: string } | null;
  team_ids: string[];
  protocol_id: string | null;
  steps: RoutineDraft["steps"];
  source_reference: string;
};

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export function useRoutineExtract() {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = useCallback(async (storagePath: string): Promise<RoutineDraft | null> => {
    setIsWorking(true); setError(null);
    try {
      const res = await fetch(`${getWebApiUrl()}/api/mobile/routine/extract`, {
        method: "POST",
        headers: { authorization: `Bearer ${await bearer()}`, "content-type": "application/json" },
        body: JSON.stringify({ storage_path: storagePath }),
      });
      const json = (await res.json()) as { ok: boolean; draft?: RoutineDraft; error?: string };
      if (!res.ok || !json.ok || !json.draft) { setError(json.error ?? "extract_failed"); return null; }
      try {
        const { workspaceId, profileId } = await getProfileContext();
        await emit({
          event: "mobile.routine.photo_extracted",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: { entity: { entity_type: "routine", entity_id: storagePath },
            data: { step_count: json.draft.steps.length } },
        });
      } catch { /* telemetry best-effort */ }
      return json.draft;
    } catch (e) { setError((e as Error).message); return null; }
    finally { setIsWorking(false); }
  }, []);

  const commit = useCallback(async (input: CommitInput): Promise<string | null> => {
    setIsWorking(true); setError(null);
    try {
      const res = await fetch(`${getWebApiUrl()}/api/mobile/routine/commit`, {
        method: "POST",
        headers: { authorization: `Bearer ${await bearer()}`, "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json()) as { ok: boolean; routine_id?: string; error?: string };
      if (!res.ok || !json.ok || !json.routine_id) { setError(json.error ?? "commit_failed"); return null; }
      return json.routine_id;
    } catch (e) { setError((e as Error).message); return null; }
    finally { setIsWorking(false); }
  }, []);

  return { extract, commit, isWorking, error };
}
```

> Add the telemetry event `mobile.routine.photo_extracted` to `packages/telemetry/src/registry.ts` (mobile-prefixed, `destinations: ["posthog","logger"]`) the same way as Task 7 if the registry rejects an unknown event. Confirm `getWebApiUrl` export in `apps/mobile/src/lib/web-api.ts` (the scout confirmed `getEmmaChatUrl` lives there).

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @smartout/mobile typecheck
git add apps/mobile/src/hooks/use-routine-extract.ts packages/telemetry/src/registry.ts
git commit -m "feat(mobile): useRoutineExtract — extract + commit transport

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Image button + draft state in BotssonSheet/provider

**Files:**
- Modify: `apps/mobile/src/providers/botsson-provider.tsx` (draft state)
- Modify: `apps/mobile/src/components/ai/BotssonSheet.tsx` (image button + summary card)

- [ ] **Step 1: Add draft state to the provider**

In `botsson-provider.tsx`, extend the context value with:
```tsx
// 2B: holds the extracted routine draft awaiting review.
const [routineDraft, setRoutineDraft] = useState<{ draft: RoutineDraft; storagePath: string } | null>(null);
```
Expose `routineDraft`, `setRoutineDraft` on the context object and the `useBotsson()` return. Import `RoutineDraft` from `@/hooks/use-routine-extract`.

- [ ] **Step 2: Add the image button to the text input row**

In `BotssonSheet.tsx`, inside the `textRow` `View` (before the send `Pressable`, lines ~415), add:
```tsx
<Pressable
  onPress={handlePickImage}
  disabled={isSendingText}
  style={({ pressed }) => [styles.attachButton, pressed && styles.sendButtonPressed]}
  accessibilityLabel="Legg ved bilde av sjekkliste"
  accessibilityRole="button"
>
  <Text style={styles.sendIcon}>📷</Text>
</Pressable>
```
(Use a Lucide RN icon `Camera` instead of the emoji if the project's RN icon set is available — check `apps/mobile/src/components` for an existing icon import; emojis are banned in UI per Nordic Split. Replace with `<Camera size={20} color={theme.colors.foreground} />`.)

- [ ] **Step 3: Implement `handlePickImage`** (inside the `BotssonSheet` component)

```tsx
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useRoutineExtract } from "@/hooks/use-routine-extract";
import { uploadRoutineSource } from "@/lib/upload-routine-source";
import { getProfileContext } from "@/lib/profile-context";

const router = useRouter();
const { extract } = useRoutineExtract();
const { setRoutineDraft } = useBotsson();

const handlePickImage = useCallback(async () => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return;
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
  });
  if (picked.canceled || !picked.assets[0]) return;

  const { workspaceId, profileId } = await getProfileContext();
  const storagePath = await uploadRoutineSource(workspaceId, profileId, picked.assets[0].uri);
  const draft = await extract(storagePath);
  if (draft) setRoutineDraft({ draft, storagePath });
}, [extract, setRoutineDraft]);
```

- [ ] **Step 4: Render the draft summary card in the transcript**

In the transcript render area, when `routineDraft` is set, show a card:
```tsx
{routineDraft ? (
  <Pressable
    style={styles.draftCard}
    onPress={() => router.push("/routine-review")}
    accessibilityRole="button"
    accessibilityLabel="Gjennomgå rutineutkast"
  >
    <Text style={styles.draftTitle}>{routineDraft.draft.routine_name}</Text>
    <Text style={styles.draftSub}>
      {`Fant ${routineDraft.draft.steps.length} oppgaver`}
    </Text>
    <Text style={styles.draftCta}>Gjennomgå og opprett →</Text>
  </Pressable>
) : null}
```

Add styles `attachButton`, `draftCard`, `draftTitle`, `draftSub`, `draftCta` to the `createStyles` block using Nordic Split tokens (`theme.colors.card`, `theme.colors.border`, `theme.colors.primary`).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @smartout/mobile typecheck
git add apps/mobile/src/providers/botsson-provider.tsx apps/mobile/src/components/ai/BotssonSheet.tsx
git commit -m "feat(mobile): image button + draft summary card in BotssonSheet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Review screen + form

**Files:**
- Create: `apps/mobile/app/(app)/routine-review.tsx`
- Create: `apps/mobile/src/components/routine/RoutineReviewForm.tsx`

- [ ] **Step 1: Implement the form component**

```tsx
// apps/mobile/src/components/routine/RoutineReviewForm.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { createStyles } from "@/theme";
import type { RoutineDraft, CommitInput } from "@/hooks/use-routine-extract";

type LocationOption = { location_id: string; name: string };

export function RoutineReviewForm(props: {
  draft: RoutineDraft;
  storagePath: string;
  locations: LocationOption[];
  isWorking: boolean;
  onSubmit: (input: CommitInput) => void;
}) {
  const styles = useStyles();
  const { draft, storagePath, locations } = props;

  const [name, setName] = useState(draft.routine_name);
  const [steps, setSteps] = useState(draft.steps);
  // AI prefill: fuzzy-match location_hint against existing names.
  const prefill = locations.find((l) =>
    draft.location_hint ? l.name.toLowerCase().includes(draft.location_hint.toLowerCase()) : false,
  );
  const [locationId, setLocationId] = useState<string | null>(prefill?.location_id ?? null);
  const [newLocationName, setNewLocationName] = useState("");

  const updateStep = (i: number, patch: Partial<RoutineDraft["steps"][number]>) =>
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, ...patch } : step)));
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  const submit = () => {
    props.onSubmit({
      routine_name: name,
      trigger_type: draft.trigger_guess.trigger_type,
      trigger_config: draft.trigger_guess.trigger_config,
      location_id: locationId,
      new_location: !locationId && newLocationName ? { name: newLocationName } : null,
      team_ids: [],
      protocol_id: null, // V1: born ungoverned
      steps,
      source_reference: storagePath,
    });
  };

  const canSubmit = name.trim().length > 0 && steps.length > 0 && (locationId !== null || newLocationName.trim().length > 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Navn</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} accessibilityLabel="Rutinenavn" />

      <Text style={styles.label}>Lokasjon</Text>
      {locations.map((l) => (
        <Pressable key={l.location_id} onPress={() => { setLocationId(l.location_id); setNewLocationName(""); }}
          style={[styles.option, locationId === l.location_id && styles.optionActive]}>
          <Text style={styles.optionText}>{l.name}</Text>
        </Pressable>
      ))}
      <TextInput style={styles.input} value={newLocationName}
        onChangeText={(t) => { setNewLocationName(t); setLocationId(null); }}
        placeholder="+ Ny lokasjon" accessibilityLabel="Ny lokasjon" />

      <Text style={styles.label}>{`Steg (${steps.length})`}</Text>
      {steps.map((s, i) => (
        <View key={i} style={styles.stepRow}>
          <TextInput style={styles.stepInput} value={s.title}
            onChangeText={(t) => updateStep(i, { title: t })} accessibilityLabel={`Steg ${i + 1} tittel`} />
          <Pressable onPress={() => removeStep(i)} accessibilityLabel={`Fjern steg ${i + 1}`}>
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
        </View>
      ))}

      <Pressable disabled={!canSubmit || props.isWorking} onPress={submit}
        style={[styles.submit, (!canSubmit || props.isWorking) && styles.submitDisabled]}
        accessibilityRole="button" accessibilityLabel="Opprett rutine">
        <Text style={styles.submitText}>{props.isWorking ? "Oppretter…" : "Opprett rutine"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 8 },
  label: { fontSize: 13, color: theme.colors.mutedForeground, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, color: theme.colors.foreground },
  option: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  optionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.muted },
  optionText: { color: theme.colors.foreground },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 10, color: theme.colors.foreground },
  removeText: { color: theme.colors.destructive, fontSize: 18, paddingHorizontal: 8 },
  submit: { marginTop: 24, backgroundColor: theme.colors.primary, borderRadius: 10, padding: 16, alignItems: "center" },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: theme.colors.primaryForeground, fontWeight: "600" },
}));
```

> Replace the `✕` text with a Lucide `X` icon if available (no emojis/glyphs as controls per Nordic Split). Confirm `createStyles` + `theme.colors.*` token names against an existing screen (e.g. `RoutineReviewForm` mirrors token usage in `(calendar)/index.tsx`).

- [ ] **Step 2: Implement the screen route**

```tsx
// apps/mobile/app/(app)/routine-review.tsx
import React, { useEffect, useState } from "react";
import { View, Text, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { RoutineReviewForm } from "@/components/routine/RoutineReviewForm";
import { useBotsson } from "@/providers/botsson-provider";
import { useRoutineExtract, type CommitInput } from "@/hooks/use-routine-extract";
import { supabase } from "@/lib/supabase";

export default function RoutineReviewScreen() {
  const router = useRouter();
  const { routineDraft, setRoutineDraft } = useBotsson();
  const { commit, isWorking } = useRoutineExtract();
  const [locations, setLocations] = useState<{ location_id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("location").select("location_id, name").eq("is_active", true)
      .then(({ data }) => setLocations(data ?? []));
  }, []);

  if (!routineDraft) {
    return (
      <SafeAreaView><View style={{ padding: 24 }}><Text>Ingen utkast.</Text></View></SafeAreaView>
    );
  }

  const onSubmit = async (input: CommitInput) => {
    const routineId = await commit(input);
    if (routineId) {
      setRoutineDraft(null);
      router.back();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <RoutineReviewForm
        draft={routineDraft.draft}
        storagePath={routineDraft.storagePath}
        locations={locations}
        isWorking={isWorking}
        onSubmit={onSubmit}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Register the screen** (if the `(app)` layout needs an explicit Stack/Tabs.Screen entry for non-tab routes — check how `journey/[id]/guided` is registered in `app/(app)/_layout.tsx` and mirror it as a hidden screen `routine-review`).

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @smartout/mobile typecheck
git add apps/mobile/app/\(app\)/routine-review.tsx apps/mobile/src/components/routine/RoutineReviewForm.tsx apps/mobile/app/\(app\)/_layout.tsx
git commit -m "feat(mobile): routine review screen + editable draft form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Mobile telemetry events for the flow

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add mobile events** (mirror existing `mobile.*` entries)

```ts
export interface MobileRoutinePhotoExtracted extends BaseEvent {
  event: "mobile.routine.photo_extracted";
  properties: { entity: { entity_type: "routine"; entity_id: string }; data: { step_count: number } };
}
```
Add to the union + EVENT_ROUTING:
```ts
  "mobile.routine.photo_extracted": { destinations: ["posthog", "logger"], category: "scheduling" },
```
(If Task 11 already added this, skip — keep it in one place. DRY.)

- [ ] **Step 2: Build + commit**

```bash
pnpm --filter @smartout/telemetry build && pnpm --filter @smartout/telemetry typecheck
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): mobile.routine.photo_extracted

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# PHASE E — ADRs, journeys, handoff

### Task 15: ADRs 0405 / 0406 / 0395

**Files:**
- Create: `docs/decisions/0405-brownfield-first-ungoverned-routines.md`
- Create: `docs/decisions/0406-mobile-camera-capture-to-author-carve-out.md`
- Create: `docs/decisions/0395-multimodal-image-storage-contract.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Re-confirm the slots are free** (ADR-id squatting guard — memory L-0252)

Run: `grep -E "ADR-039[345]" docs/decisions/0000-decision-log.md`
Expected: no matches. If any are taken, bump to the next free trio and update all references in this plan + spec.

- [ ] **Step 2: Write each ADR** using `docs/templates/decision.md`. Required content:
  - **0393:** Decision = routine/procedure may have `protocol_id NULL`; `governance_status` enum; rationale = brownfield-first (compliance is a byproduct, not a precondition); consequences = RLS must tolerate null protocol, nudge-to-govern is future work.
  - **0394:** Amends ADR-0133. Decision = AI-mediated capture-to-author from camera evidence + explicit C4 confirm is a sanctioned mobile cascade extension; scope-bound to Botsson-mediated authoring with human confirm (not freehand mobile authoring). Reference ADR-0136 (camera evidence) + ADR-0132 (mobile thin client).
  - **0395:** Decision = images travel as Storage paths (`routine-source` bucket) + service-role signed URLs; vision runs in stage-engine via `generateObject` (single multimodal touch point); BFF routes are thin proxies. Rationale = no base64 bloat, durable provenance artifact, agent loop stays text-only.

- [ ] **Step 3: Register all three in `0000-decision-log.md`** (append rows in the index table).

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0405-*.md docs/decisions/0406-*.md docs/decisions/0395-*.md docs/decisions/0000-decision-log.md
git commit -m "docs(decisions): ADR-0405 brownfield routines, 0406 mobile carve-out, 0395 image contract

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Journeys + manual test + handoff

**Files:**
- Create: `docs/journeys/JOURNEY-procedure-engine-2b.md` (frontmatter `feature: procedure-engine-2b`, `status: draft` per journey until verified)
- Create: `docs/journeys/MANUAL-TEST-procedure-engine-2b.md`
- Create: `docs/HANDOFF-procedure-engine-2b.md`

- [ ] **Step 1: Write the 5 journeys** (J1–J5 from spec §12), each with precondition → steps (user does X → system does Y → user sees Z) → postcondition → error paths. Mark `status: draft` until verified at closure.

- [ ] **Step 2: Write manual test cases** for the on-device walk: long-press FAB → pick photo of a real checklist → draft card appears → review screen → edit a step → pick/create location → confirm → routine appears (verify in DB: `SELECT created_via, governance_status, source_reference FROM routine ORDER BY created_at DESC LIMIT 1;` → `image | unassigned | <path>`).

- [ ] **Step 3: Write the handoff** (summary, journeys table, decisions, learnings, known issues: Detox deferred + web V1.1 deferred + nudge-to-govern out, next steps).

- [ ] **Step 4: Commit**

```bash
git add docs/journeys/JOURNEY-procedure-engine-2b.md docs/journeys/MANUAL-TEST-procedure-engine-2b.md docs/HANDOFF-procedure-engine-2b.md
git commit -m "docs(procedure-engine): 2B journeys + manual tests + handoff

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final Verification (before closure)

- [ ] `pnpm turbo typecheck` — 0 errors across web, mobile, ai, telemetry, stage-engine.
- [ ] `pnpm --filter @smartout/ai test draft-schema && pnpm --filter @smartout/stage-engine test routine-extract && pnpm --filter @smartout/web test extract && pnpm --filter @smartout/web test commit` — all green.
- [ ] SQL atomicity + happy-path (Task 3 Steps 2-3) re-run green after `db reset`.
- [ ] Manual on-device walk (Task 16 Step 2) completes; DB shows `created_via='image'`, `governance_status='unassigned'`.
- [ ] All three ADRs registered in the decision log.
- [ ] Journeys flipped to `status: verified` only after each is actually checked.

## Known Deferrals (carry into handoff)

- **Web cut (V1.1)** — backend is surface-agnostic; web is pure L1 composition.
- **Detox** — happy-path device test is a fast-follow; manual cases cover V1.
- **Nudge-to-govern** — V1 emits `routine.governance_unassigned`; the surface that nudges attaching a protocol later is a separate phase.
- **Team-aware assignment** — `routine.assigned_to_ref` is the actor placeholder (Phase-1 convention); team subset rides `routine_team`. Refining `assigned_to_type='team'` is future.
