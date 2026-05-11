---
title: "Journey — botsson-harness-e2e-test"
feature: botsson-harness-e2e-test
branch: feat/botsson-harness-e2e-test
created: 2026-05-11
updated: 2026-05-11
module: ai
status: ready_for_merge
tags: [botsson, e2e, harness, memory, save_memory, stage-engine, pipe-verification]
---

# Journey — Botsson Harness E2E Test

> This feature ships developer infrastructure (E2E spec + helpers), not end-user UI.
> "Journey" here means the developer/operator's workflow: how to run the spec, how to
> read the output, how to diagnose failures, and what each assertion actually verifies.
> There are no admin/manager/employee product paths — all 16 tests exercise the AI pipe
> from outside via BFF calls and DB assertions.

---

## Journey: Developer runs the full harness spec (happy path)

**Precondition:**
- Supabase Local running (`npx supabase start`)
- stage-engine container built from current code (`docker compose build --no-cache stage-engine`)
- stage-engine container running with real JWTs (`infra/.env.local` present — see setup below)
- Next.js web app running on port 3060
- `apps/e2e/.env.local` present with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- Seed data present: `SEED_WORKSPACE_ID` + `SEED_PROFILE_ID` from `apps/e2e/.env.local`
- `engine_authority_config` has `memory` capability seeded at level `suggest` for seed workspace
- `assert_gate_caller` function in local DB patched for PostgREST 14 compatibility

1. Developer runs:
   ```
   SKIP_WEB_SERVER=1 SKIP_FRESHNESS_CHECK=1 pnpm --filter e2e test botsson-harness-e2e
   ```
   from `apps/e2e/` directory
2. Playwright launches Chromium, navigates to `http://localhost:3060/Botsson`
3. Suite executes 16 tests in serial mode (not parallel — shared SEED_PROFILE_ID)
4. Developer sees:
   - A1–A13: 13 passing (positive path: UI mount, laziness check, memory save, gate audit, recordings, memory read-back)
   - N1: 1 skipped (authority denial — needs second workspace without memory authority)
   - N2: 1 passing (PII block — personnummer not persisted)
   - N3: 1 skipped (voice channel guard — LiveKit not available in E2E environment)
5. Exit: `14 passed, 2 skipped (1.4m)` — developer continues work

**Postcondition:** `engine_memory` has a row with `content ILIKE '%kaffe%'` for SEED_PROFILE_ID.

**Error paths:**
- `403 Workspace context is required` → `DEV_API_KEY` missing or blank in stage-engine container; add `STAGE_ENGINE_API_KEY=e2e-local-dev-key-not-a-secret-1234` to `infra/.env.local`
- `500 Missing Authentication header` → `OPENROUTER_API_KEY` missing; add real key to `infra/.env.local`
- `save_memory = blocked` / LLM apologizes in Norwegian → `assert_gate_caller` has PostgREST 14 incompatibility; apply hotfix from HANDOFF §8
- A2 fails (session exists before laziness window) → tests not running in serial mode; add `test.describe.configure({ mode: "serial" })` at top of spec
- A3 fails with "stale container" log → container is ≥5 minutes behind latest commit; rebuild with `docker compose build --no-cache stage-engine`

---

## Journey: Developer diagnoses "save_memory blocked" (stale-container bug class)

**Precondition:** spec runs, A3 fails with `save_memory` returning blocked/apologetic text.

1. Developer checks container freshness:
   ```
   docker inspect smartout-stage-engine --format '{{.Created}}'
   ```
   vs current `git log --oneline -1`
2. If container is stale → rebuild:
   ```
   cd infra && docker compose build --no-cache stage-engine && docker compose up -d stage-engine
   ```
3. Re-run spec: A3 should pass
4. If A3 still fails after rebuild → diagnose gate path:
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
     -c "SELECT public.debug_jwt_settings();"
   ```
   If `claim_role = null` and `claims contains role:service_role` → PostgREST 14 incompatibility
5. Apply `assert_gate_caller` hotfix from `docs/HANDOFF-botsson-harness-e2e-test.md` §8
6. Verify gate path works end-to-end:
   ```bash
   psql ... -c "SELECT public.cascade_gate_write('agent_memory', gen_random_uuid(), 'memory.save', '<ws_id>'::uuid, '{}'::jsonb, '{}'::jsonb, '<profile_id>'::uuid, 'memory');"
   ```
   Expected: `{ "allowed": true, "outcome": "applied" }`

**Postcondition:** A3 passes; root cause identified and documented.

---

## Journey: Developer adds coverage for a new capability assertion

**Precondition:** new capability tool ships, developer wants E2E coverage in the harness spec.

1. Developer reads `apps/e2e/helpers/botsson-harness.ts` — understand available helpers:
   - `buildSupabaseAdminClient()` — service-role Supabase client
   - `assertStageEngineContainerFresh()` — container staleness check
   - `SEED_PROFILE_ID`, `SEED_WORKSPACE_ID` — from `.env.local`
2. Developer adds a new `test()` block inside the appropriate `describe` in `botsson-harness-e2e.spec.ts`
3. Pattern for a capability assertion:
   ```typescript
   test("Axx - [capability] tool [action]", async ({ page }) => {
     const supabase = buildSupabaseAdminClient();
     const res = await page.request.post("/api/botsson/chat", {
       data: {
         workspaceId: SEED_WORKSPACE_ID,
         userMessage: "...",
       },
       headers: { "content-type": "application/json" },
     });
     expect(res.status()).toBe(200);
     const body = await res.json() as { text?: string; sessionId?: string };
     // assert LLM response
     expect(body.text).toBeTruthy();
     // assert DB side-effect
     const { data } = await supabase.from("...").select("*").eq("...", "...").single();
     expect(data).not.toBeNull();
   });
   ```
4. Developer runs new test in isolation:
   ```
   SKIP_WEB_SERVER=1 SKIP_FRESHNESS_CHECK=1 pnpm --filter e2e test botsson-harness-e2e --grep "Axx"
   ```
5. Test passes → commit

**Postcondition:** new test in harness spec, green in serial run.

---

## Journey: Developer adds N1 (authority denial) coverage

**Precondition:** currently N1 is always skipped — seed admin belongs only to HQ workspace.

1. Developer creates a second test workspace without `memory` authority in `engine_authority_config`:
   ```sql
   INSERT INTO workspace (workspace_id, name, slug) VALUES (gen_random_uuid(), 'E2E No-Memory WS', 'e2e-no-memory');
   -- do NOT insert into engine_authority_config for this workspace
   ```
2. Developer creates a profile in that workspace with a known auth user
3. Developer adds the workspace ID + profile ID to `apps/e2e/.env.local`:
   ```
   E2E_NO_MEMORY_WORKSPACE_ID=...
   E2E_NO_MEMORY_PROFILE_ID=...
   ```
4. Developer removes the `test.skip` from N1 block
5. N1 calls `/api/botsson/chat` with the no-memory workspace credentials
6. Asserts that LLM response indicates memory unavailable (no memory tool in toolset for this workspace)

**Postcondition:** N1 passes; authority denial path verified.

---

## Journey: CI runs the harness spec (future)

**Precondition:** all infrastructure gaps resolved:
- `assert_gate_caller` PostgREST 14 fix in a proper migration
- stage-engine container available in CI environment
- Seed data seeded via migration or test fixture

1. CI pipeline runs `pnpm --filter e2e test botsson-harness-e2e` in GitHub Actions
2. All 14 passing tests pass; 2 skipped tests remain skipped
3. If any test fails → CI annotates the failure with container build hash + container age
4. Failure alert: developer must verify container was rebuilt from the same commit as the code

**Postcondition:** harness spec in CI prevents stale-container regressions from reaching staging.

---

## Infrastructure Setup Reference

### Required `infra/.env.local`

```
# Real Supabase Local JWTs (164 chars each — run: npx supabase status)
SUPABASE_ANON_KEY=<anon JWT from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service role JWT from supabase status>

# Non-blank disables stage-engine dev-bypass (auth middleware checks hasRealDevKey)
STAGE_ENGINE_API_KEY=e2e-local-dev-key-not-a-secret-1234

# Real OpenRouter key for LLM calls
OPENROUTER_API_KEY=<op://smartout_ai/OpenRouter/api_key>
```

### Required `apps/e2e/.env.local`

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service role JWT>
SUPABASE_ANON_KEY=<anon JWT>
SEED_PROFILE_ID=<UUID of seeded profile in HQ workspace>
SEED_WORKSPACE_ID=<UUID of HQ workspace>
```

### Start containers

```bash
cd /home/sxtnl/dev/smartout.ai-wt-5/infra
op run --env-file ../.env.template --env-file .env.local -- docker compose up -d stage-engine
```

### Apply PostgREST 14 compat hotfix (until migration ships)

See `docs/HANDOFF-botsson-harness-e2e-test.md` §8 for the full `CREATE OR REPLACE FUNCTION public.assert_gate_caller` body.
