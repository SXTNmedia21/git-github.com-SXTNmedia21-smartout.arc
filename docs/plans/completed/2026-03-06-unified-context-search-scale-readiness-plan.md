---
title: "Unified Context Search Scale Readiness Implementation Plan"
status: done
updated: 2026-03-10
created: 2026-03-06
module: platform
tags: [context-search, scale-readiness, plan]
---

# Unified Context Search Scale Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a fast, compliant, multi-source context + search system that supports Smartout dashboard and upcoming React apps through one shared bootstrap/search contract.

**Architecture:** Add a workspace-scoped vector layer (`workspace_doc_chunk`) next to existing `platform_doc_chunk`, keep deterministic bootstrap context server-side, and expose one orchestrated search API with instance + semantic + dependency modes. Use strict workspace/scope filtering on every mode and ship with SLO telemetry from day one.

**Tech Stack:** Supabase (PostgreSQL 17 + pgvector), Supabase Edge Functions (`workspace-api`), Next.js App Router, React Query, cmdk, TypeScript strict, Vitest.

---

## Agent Team Parallelization

| Agent   | Track                  | Primary Scope                               | Can Run In Parallel With |
| ------- | ---------------------- | ------------------------------------------- | ------------------------ |
| Agent A | Database + RPC         | Migrations, indexes, search RPCs            | Agent C                  |
| Agent B | Ingestion + AI Tooling | docs-pipeline + `@smartout/ai` tools        | Agent C                  |
| Agent C | Web API + UI           | bootstrap/search endpoints + cmdk UI        | Agent A                  |
| Agent D | Telemetry + Load       | latency metrics + load scripts + SLO checks | starts after Task 6      |

**Execution waves**

1. **Wave 1 (parallel):** Task 1 (A), Task 4 (C), Task 7 (C)
2. **Wave 2 (parallel):** Task 2 (A), Task 3 (B), Task 5 (C)
3. **Wave 3 (parallel):** Task 6 (C), Task 8 (D)
4. **Wave 4 (sequential):** Task 9 (docs + final verification)

---

### Task 1: Workspace Vector Schema (Agent A)

**Files:**

- Create: `supabase/migrations/20260306170000_workspace_doc_chunk.sql`
- Modify: `packages/supabase/src/database.types.ts` (auto-generated)

**Step 1: Write failing DB check**

Run:

```bash
npx supabase db execute --sql "select to_regclass('public.workspace_doc_chunk') as table_name;"
```

Expected: `table_name` is `null`.

**Step 2: Write migration (minimal, scoped, indexed)**

```sql
-- workspace_doc_chunk: workspace-scoped semantic chunks for handbook/policy/protocol/procedure
set search_path to public, extensions;

create table if not exists workspace_doc_chunk (
  chunk_id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(workspace_id) on delete cascade,
  source_type text not null check (source_type in ('handbook_chapter','policy','protocol','procedure','routine','runbook','other')),
  source_id uuid,
  source_path text not null,
  source_hash text not null,
  content_hash text not null,
  chunk_index int not null default 0,
  title text,
  content text not null,
  token_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_path, chunk_index)
);

alter table workspace_doc_chunk enable row level security;

create policy "jwt_read_workspace_doc_chunk" on workspace_doc_chunk
for select using (workspace_id in (select get_workspace_ids_for_user(auth.uid())));

create policy "api_key_read_workspace_doc_chunk" on workspace_doc_chunk
for select using (workspace_id = get_api_workspace_id());

create policy "service_manage_workspace_doc_chunk" on workspace_doc_chunk
for all using (auth.role() = 'service_role');

create index if not exists idx_workspace_doc_chunk_embedding
  on workspace_doc_chunk using hnsw (embedding vector_cosine_ops);
create index if not exists idx_workspace_doc_chunk_workspace
  on workspace_doc_chunk (workspace_id, source_type);
create index if not exists idx_workspace_doc_chunk_content_hash
  on workspace_doc_chunk (content_hash);
```

**Step 3: Apply migration**

Run:

```bash
npx supabase db reset
```

Expected: migration applies successfully.

**Step 4: Re-run table check**

Run:

```bash
npx supabase db execute --sql "select to_regclass('public.workspace_doc_chunk') as table_name;"
```

Expected: `table_name = workspace_doc_chunk`.

**Step 5: Regenerate DB types + commit**

Run:

```bash
pnpm db:gen-types
git add supabase/migrations/20260306170000_workspace_doc_chunk.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add workspace_doc_chunk vector table with scoped RLS"
```

---

### Task 2: Search RPCs (Agent A)

**Files:**

- Create: `supabase/migrations/20260306171000_context_search_rpcs.sql`

**Step 1: Write failing RPC check**

Run:

```bash
npx supabase db execute --sql "select proname from pg_proc where proname in ('search_instance','match_workspace_docs','search_dependency_graph');"
```

Expected: missing one or more functions.

**Step 2: Add three RPCs**

```sql
set search_path to public, extensions;

create or replace function search_instance(
  p_workspace_id uuid,
  p_query text,
  p_limit int default 5
)
returns table (
  group_name text,
  result_id text,
  title text,
  subtitle text,
  deep_link text,
  relevance float
)
language sql
stable
as $$
  -- minimal instance search starter (profiles + policies + protocols)
  select 'people', p.profile_id::text, coalesce(p.display_name,''), coalesce(p.role,''), '/dashboard/people/' || p.profile_id::text, 0.9
  from profile p
  where p.workspace_id = p_workspace_id and p.display_name ilike ('%' || p_query || '%')
  limit p_limit
$$;

create or replace function match_workspace_docs(
  p_workspace_id uuid,
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.5
)
returns table (
  chunk_id uuid,
  source_type text,
  source_path text,
  title text,
  content text,
  similarity float
)
language sql
stable
as $$
  select w.chunk_id, w.source_type, w.source_path, w.title, w.content,
    1 - (w.embedding <=> query_embedding) as similarity
  from workspace_doc_chunk w
  where w.workspace_id = p_workspace_id
    and w.embedding is not null
    and 1 - (w.embedding <=> query_embedding) >= match_threshold
  order by w.embedding <=> query_embedding
  limit match_count
$$;

create or replace function search_dependency_graph(
  p_workspace_id uuid,
  p_query text,
  p_limit int default 5
)
returns table (
  policy_id uuid,
  policy_name text,
  protocol_id uuid,
  protocol_name text,
  procedure_id uuid,
  procedure_name text
)
language sql
stable
as $$
  select pol.policy_id, pol.name, pr.protocol_id, pr.name, pc.procedure_id, pc.name
  from policy pol
  left join protocol pr on pr.policy_id = pol.policy_id
  left join procedure pc on pc.protocol_id = pr.protocol_id
  where pol.workspace_id = p_workspace_id
    and (pol.name ilike ('%' || p_query || '%') or pr.name ilike ('%' || p_query || '%') or pc.name ilike ('%' || p_query || '%'))
  limit p_limit
$$;
```

**Step 3: Apply migration**

Run:

```bash
npx supabase db reset
```

Expected: all functions created successfully.

**Step 4: Verify RPC presence**

Run:

```bash
npx supabase db execute --sql "select proname from pg_proc where proname in ('search_instance','match_workspace_docs','search_dependency_graph') order by proname;"
```

Expected: 3 rows returned.

**Step 5: Commit**

```bash
git add supabase/migrations/20260306171000_context_search_rpcs.sql
git commit -m "feat(db): add context search RPCs for instance semantic and dependency modes"
```

---

### Task 3: Workspace Ingestion Pipeline (Agent B)

**Files:**

- Modify: `packages/docs-pipeline/src/commands/ingest.ts`
- Modify: `packages/docs-pipeline/src/db/operations.ts`
- Modify: `packages/docs-pipeline/src/index.ts`

**Step 1: Write failing command test**

Run:

```bash
pnpm --filter @smartout/docs-pipeline ingest -- --mode workspace
```

Expected: command fails because workspace mode is not implemented.

**Step 2: Implement workspace ingestion mode**

```typescript
// add mode support
type IngestMode = "filesystem" | "git" | "workspace";

if (mode === "workspace") {
  // read handbook_chapter + policy + protocol + procedure by workspace
  // chunk with existing chunker strategy
  // upsert to workspace_doc_chunk via new db operation
}
```

**Step 3: Add DB operations for workspace chunks**

```typescript
export async function upsertWorkspaceChunks(
  supabase: SupabaseClient,
  rows: Array<{
    workspace_id: string;
    source_type: string;
    source_path: string;
    source_hash: string;
    content_hash: string;
    chunk_index: number;
    title: string | null;
    content: string;
    token_count: number;
    metadata: Record<string, unknown>;
    embedding: number[] | null;
  }>,
) {
  // batched insert/upsert into workspace_doc_chunk
}
```

**Step 4: Verify command works**

Run:

```bash
pnpm --filter @smartout/docs-pipeline ingest -- --mode workspace --dry-run
pnpm --filter @smartout/docs-pipeline typecheck
```

Expected: first command logs workspace ingestion plan; second passes.

**Step 5: Commit**

```bash
git add packages/docs-pipeline/src/commands/ingest.ts packages/docs-pipeline/src/db/operations.ts packages/docs-pipeline/src/index.ts
git commit -m "feat(docs-pipeline): add workspace ingestion mode for workspace_doc_chunk"
```

---

### Task 4: Bootstrap Contract + Server Builder (Agent C)

**Files:**

- Create: `apps/web/src/lib/context/bootstrap-contract.ts`
- Create: `apps/web/src/lib/context/build-bootstrap-context.ts`
- Create: `apps/web/src/lib/context/__tests__/build-bootstrap-context.test.ts`

**Step 1: Write failing unit test**

```typescript
import { describe, it, expect } from "vitest";
import { buildBootstrapContext } from "../build-bootstrap-context";

describe("buildBootstrapContext", () => {
  it("returns role-scoped context shape", async () => {
    const result = await buildBootstrapContext({
      workspaceId: "w1",
      profileId: "p1",
      pageId: "schedule",
    });
    expect(result.system.page_id).toBe("schedule");
    expect(Array.isArray(result.system.permissions)).toBe(true);
    expect(result.intelligence.readiness_score).toBeTypeOf("number");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test -- src/lib/context/__tests__/build-bootstrap-context.test.ts
```

Expected: FAIL (`buildBootstrapContext` missing).

**Step 3: Add minimal contract + builder**

```typescript
export type BootstrapResponse = {
  system: {
    page_id: string;
    workspace_id: string;
    role: "employee" | "manager" | "admin" | "owner";
    permissions: string[];
  };
  intelligence: {
    readiness_score: number;
    verification_flags: {
      all_policies_learned: boolean;
      all_protocols_completed: boolean;
      has_overdue_assignments: boolean;
    };
  };
  search_hints: { recent_searches: string[]; suggested_queries: string[] };
};
```

**Step 4: Re-run test**

Run:

```bash
pnpm --filter web test -- src/lib/context/__tests__/build-bootstrap-context.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/lib/context/bootstrap-contract.ts apps/web/src/lib/context/build-bootstrap-context.ts apps/web/src/lib/context/__tests__/build-bootstrap-context.test.ts
git commit -m "feat(web): add bootstrap context contract and builder"
```

---

### Task 5: Bootstrap + Search API Routes (Agent C)

**Files:**

- Create: `apps/web/src/app/api/context/bootstrap/route.ts`
- Create: `apps/web/src/app/api/search/route.ts`
- Create: `apps/web/src/lib/search/orchestrator.ts`
- Create: `apps/web/src/lib/search/__tests__/orchestrator.test.ts`

**Step 1: Write failing orchestrator test**

```typescript
import { describe, it, expect } from "vitest";
import { runSearchOrchestrator } from "../orchestrator";

describe("runSearchOrchestrator", () => {
  it("returns grouped results with hard caps", async () => {
    const out = await runSearchOrchestrator({
      workspaceId: "w1",
      query: "allergen",
      limitPerGroup: 5,
    });
    expect(out.groups.every((g) => g.results.length <= 5)).toBe(true);
  });
});
```

**Step 2: Run failing test**

Run:

```bash
pnpm --filter web test -- src/lib/search/__tests__/orchestrator.test.ts
```

Expected: FAIL (`runSearchOrchestrator` missing).

**Step 3: Implement orchestrator + routes**

```typescript
// run three modes in parallel
const [instance, semantic, dependency] = await Promise.all([
  runInstanceSearch(ctx),
  runSemanticSearch(ctx),
  runDependencySearch(ctx),
]);

return { groups: mergeAndCap([instance, semantic, dependency], limitPerGroup) };
```

**Step 4: Validate tests + typecheck**

Run:

```bash
pnpm --filter web test -- src/lib/search/__tests__/orchestrator.test.ts
pnpm --filter web typecheck
```

Expected: PASS + no type errors.

**Step 5: Commit**

```bash
git add apps/web/src/app/api/context/bootstrap/route.ts apps/web/src/app/api/search/route.ts apps/web/src/lib/search/orchestrator.ts apps/web/src/lib/search/__tests__/orchestrator.test.ts
git commit -m "feat(web): add bootstrap and orchestrated search API routes"
```

---

### Task 6: AI Tooling for Workspace Semantic Search (Agent B)

**Files:**

- Modify: `packages/ai/src/tools/docs.ts`
- Create: `packages/ai/src/tools/workspace-docs.ts`
- Modify: `packages/ai/src/index.ts`

**Step 1: Write failing type-level usage test**

```typescript
import { describe, it, expect } from "vitest";
import { WORKSPACE_DOC_TOOLS } from "../workspace-docs";

describe("workspace doc tools", () => {
  it("exports search tool", () => {
    expect(WORKSPACE_DOC_TOOLS.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run failing test**

Run:

```bash
pnpm --filter @smartout/ai exec vitest run src/tools/workspace-docs.test.ts
```

Expected: FAIL (file/export missing).

**Step 3: Add `search_workspace_docs` tool**

```typescript
export const searchWorkspaceDocs = defineTool({
  name: "search_workspace_docs",
  schema: z.object({
    workspaceId: z.string().uuid(),
    query: z.string(),
    matchCount: z.number().default(5),
  }),
  execute: async ({ workspaceId, query, matchCount }, ctx) => {
    const queryEmbedding = await getQueryEmbedding(query);
    const { data, error } = await ctx.supabase.rpc("match_workspace_docs", {
      p_workspace_id: workspaceId,
      query_embedding: queryEmbedding,
      match_count: matchCount,
      match_threshold: 0.5,
    });
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ results: data ?? [] });
  },
});
```

**Step 4: Verify**

Run:

```bash
pnpm --filter @smartout/ai typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ai/src/tools/workspace-docs.ts packages/ai/src/tools/docs.ts packages/ai/src/index.ts
git commit -m "feat(ai): add workspace semantic retrieval tool using match_workspace_docs"
```

---

### Task 7: Global CmdK Palette in Dashboard Shell (Agent C)

**Files:**

- Create: `apps/web/src/components/dashboard/GlobalSearchPalette.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`
- Create: `apps/web/src/lib/search/query-prefix.ts`
- Create: `apps/web/src/lib/search/__tests__/query-prefix.test.ts`

**Step 1: Write failing query prefix test**

```typescript
import { describe, it, expect } from "vitest";
import { parseSearchPrefix } from "../query-prefix";

describe("parseSearchPrefix", () => {
  it("maps ? prefix to knowledge mode", () => {
    expect(parseSearchPrefix("? allergen").mode).toBe("knowledge");
  });
});
```

**Step 2: Run failing test**

Run:

```bash
pnpm --filter web test -- src/lib/search/__tests__/query-prefix.test.ts
```

Expected: FAIL (`parseSearchPrefix` missing).

**Step 3: Add parser + cmdk palette**

```typescript
export function parseSearchPrefix(query: string) {
  if (query.startsWith("?")) return { mode: "knowledge", query: query.slice(1).trim() };
  if (query.startsWith("@")) return { mode: "people", query: query.slice(1).trim() };
  if (query.startsWith(">")) return { mode: "commands", query: query.slice(1).trim() };
  return { mode: "all", query };
}
```

**Step 4: Verify tests + typecheck**

Run:

```bash
pnpm --filter web test -- src/lib/search/__tests__/query-prefix.test.ts
pnpm --filter web typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/GlobalSearchPalette.tsx apps/web/src/components/dashboard/DashboardShell.tsx apps/web/src/lib/search/query-prefix.ts apps/web/src/lib/search/__tests__/query-prefix.test.ts
git commit -m "feat(web): add global cmdk palette with prefix-based mode parsing"
```

---

### Task 8: Telemetry + Load Readiness (Agent D)

**Files:**

- Create: `apps/web/src/lib/search/metrics.ts`
- Modify: `apps/web/src/app/api/search/route.ts`
- Create: `scripts/perf/search-load.mjs`
- Create: `docs/plans/completed/verification/search-slo-checklist.md`

**Step 1: Write failing metrics unit test**

```typescript
import { describe, it, expect } from "vitest";
import { summarizeLatency } from "../metrics";

describe("summarizeLatency", () => {
  it("computes p95 from sample list", () => {
    const out = summarizeLatency([10, 20, 30, 40, 50]);
    expect(out.p95).toBeGreaterThan(0);
  });
});
```

**Step 2: Run failing test**

Run:

```bash
pnpm --filter web test -- src/lib/search/metrics.test.ts
```

Expected: FAIL.

**Step 3: Implement metrics capture + load script**

```typescript
export function summarizeLatency(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1)))] ?? 0;
  return { p50: pick(50), p95: pick(95), p99: pick(99) };
}
```

**Step 4: Run load check**

Run:

```bash
node scripts/perf/search-load.mjs
```

Expected: report includes p50/p95 and error rate; no crashes.

**Step 5: Commit**

```bash
git add apps/web/src/lib/search/metrics.ts apps/web/src/app/api/search/route.ts scripts/perf/search-load.mjs docs/plans/completed/verification/search-slo-checklist.md
git commit -m "chore(observability): add search latency metrics and load check script"
```

---

### Task 9: Documentation + Final Integration Verification (Lead Agent)

**Files:**

- Modify: `docs/reference/DATABASE.md`
- Modify: `docs/reference/ROUTES.md`
- Modify: `docs/modules/MODULE_BOTSSON.md`
- Modify: `CLAUDE.md` (critical traps if needed)

**Step 1: Write failing doc consistency check**

Run:

```bash
pnpm docs:validate --rule structure
```

Expected: FAIL or WARN until new routes/tables are documented.

**Step 2: Update references**

```markdown
- Add `workspace_doc_chunk` table and `match_workspace_docs` RPC to DB docs
- Add `/api/context/bootstrap` and `/api/search` routes
- Note Botsson now has workspace semantic retrieval tool path
```

**Step 3: Run full verification suite**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm --filter web test
pnpm docs:validate
```

Expected: no new errors introduced by this change set.

**Step 4: Capture rollout proof**

Run:

```bash
git status --short
```

Expected: only intended files changed.

**Step 5: Final commit**

```bash
git add docs/reference/DATABASE.md docs/reference/ROUTES.md docs/modules/MODULE_BOTSSON.md CLAUDE.md
git commit -m "docs(context-search): document unified bootstrap and multi-mode search architecture"
```

---

## Done Criteria

- `workspace_doc_chunk` exists with RLS + vector index.
- RPCs exist: `search_instance`, `match_workspace_docs`, `search_dependency_graph`.
- Bootstrap endpoint returns deterministic server-built context.
- Search endpoint returns grouped, capped results from 3 modes in parallel.
- cmdk palette works globally with `?`, `@`, `>` prefixes.
- Search telemetry reports p50/p95/p99 and load script runs.
- Docs are updated and consistent with implemented schema/routes.

---

## Risk Controls

- Keep all workspace-scoped queries hard-filtered by `workspace_id` and scope guards.
- Never accept `profile_id` from client without server-side identity validation.
- Ship semantic mode as non-blocking branch in orchestrator (instance mode is always fallback).
- Keep ingestion idempotent using `source_hash` and `content_hash`.

---

Plan complete and saved to `docs/plans/2026-03-06-unified-context-search-scale-readiness-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
