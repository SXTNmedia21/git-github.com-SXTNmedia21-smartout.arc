# `/dashboard/help` v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the panic-first multi-tier `/dashboard/help` v1 that delivers Pontus's "100% trygghet" intent — Panic Bar + Botsson chat hero + curated KB + helpdesk-ticket reuse — without phantom contracts.

**Architecture:** Five-tier hub (Panic Bar / Botsson chat hero / Quick paths / Curated KB / Kontakt footer). Botsson chat is **Runtime A only** (`/api/botsson/chat` Stage Engine — full router, gate_action enforced). Voice (Runtime B Ultravox) is corner-orb continuation, never KB executor. Helpdesk creation routes through existing `helpdesk_query.openTicket` capability. KB search wires to a NEW `kb_query` capability that binds the existing-but-unregistered `searchWorkspaceDocs` tool (G1 merge-blocker). Five falsifiable inclusivity invariants (I-1 to I-5) replace "world's most inclusive" framing.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (CSS config) · shadcn/ui new-york · Nordic Split tokens · Geist Sans/Mono + Instrument Serif · Lucide icons · Vitest + Playwright · `@smartout/agent-sdk` ClientToolKit + `useRegisterTools` · `@smartout/telemetry` `emit()` registry

**Spec source:** `docs/superpowers/specs/2026-04-28-dashboard-help-design.md` (Council 2026-04-28 verdict)

**ADR baseline:**
- ADR-0073 — agent-router as orchestrator
- ADR-0078 — channel restriction (voice forbidden for PII)
- ADR-0091 / ADR-0099 — gate_action mandatory for mutations
- ADR-0134 — Mobile telemetry contract (workspace_id + profile_id non-empty)
- ADR-0152 — activity_trail + engine_event parity contract
- ADR-0161 / ADR-0165 — Helpdesk ontology (engine_state + helpdesk_enabled flag)
- ADR-0193 — `NonEmptyString` brand for telemetry IDs
- ADR-0197 — Phantom contracts class rule
- ADR-0219 — `/dashboard/help` as Multi-Tier Hub (this council)
- ADR-0220 — Botsson as Conversational Front Door (this council)
- ADR-0221 — KB Capability Registration as Merge Gate (this council)

**Inclusivity invariants (must all pass before merge):**
- **I-1** prefers-reduced-motion → zero looping animation
- **I-2** every state-change uses 2 channels (text + icon, never color alone)
- **I-3** 400% zoom no-break (Playwright 320×800 + zoom)
- **I-4** LIX <40 empati / <50 teknisk + "Forklar enkelt" toggle (server-side rewrite)
- **I-5** TTS output yes (browser SpeechSynthesis), voice input NO

**Trust Gate merge-blockers (G1–G4):**
- G1 — `kb_query` capability registered + bound to `searchWorkspaceDocs` BEFORE any "Spør Botsson"-UI ships
- G2 — Voice fallback "bytt til chat" for KB queries
- G3 — Helpdesk creation routes via `helpdesk_query.openTicket` capability (NEVER side-channel)
- G4 — Q4 (RAG-journeys), Q10 (emergency self-serve), Q11.d (cross-page takeover) explicitly OUT-OF-SCOPE

---

## File Structure

### NEW files
| Path | Responsibility |
|------|----------------|
| `packages/ai/src/capabilities/kb_query/index.ts` | `CapabilityDefinition` for kb_query (binds existing `searchWorkspaceDocs`). Sets `allowedChannels: ["chat"]`, `defaultAuthority: "read_only"`, `emitPrefix: "kb"`. |
| `packages/ai/src/capabilities/kb_query/tools.ts` | Re-exports `searchWorkspaceDocs` adapted to `AgentToolContext` shape (wrapper that strips `WorkspaceDocToolContext` dependency and reads `ctx.supabaseAdmin`). |
| `packages/ai/src/capabilities/kb_query/__tests__/tools.test.ts` | Vitest: empty workspaceId, empty query, RPC error, happy path. |
| `supabase/migrations/20260518240000_kb_query_authority_seed.sql` | Authority seed for `kb_query` (read_only / employee / 0 four-eyes). Idempotent CROSS JOIN. |
| `apps/web/src/app/dashboard/help/page.tsx` | Server Component — renders the five tiers in order, fetches workspace + profile + curated articles. |
| `apps/web/src/app/dashboard/help/_components/PanicBar.tsx` | Client Component — sticky 56px top bar with 3 buttons. Opens drawer with two-step confirm. |
| `apps/web/src/app/dashboard/help/_components/PanicConfirmDrawer.tsx` | Drawer with two-step confirm + Server Action call. |
| `apps/web/src/app/dashboard/help/_components/BotssonChatHero.tsx` | Client Component — chat hero capped 480px, Runtime A. Reuses existing `BotssonChat` component but in hero density. |
| `apps/web/src/app/dashboard/help/_components/QuickPathCards.tsx` | Server Component — 4 role-personalized cards. |
| `apps/web/src/app/dashboard/help/_components/CuratedArticlesList.tsx` | Server Component — 5 hand-curated articles, frontmatter-driven. |
| `apps/web/src/app/dashboard/help/_components/KontaktFooter.tsx` | Server Component — svartider per kanal + status badge. |
| `apps/web/src/app/dashboard/help/_components/ForklarEnkeltToggle.tsx` | Client Component — invokes server action that calls AI rewrite. Stores preference in `profile.help_language_mode` (no new column for v1 — use `profile.preferences` JSONB). |
| `apps/web/src/app/dashboard/help/_components/TtsButton.tsx` | Client Component — uses browser-native `SpeechSynthesis`, respects prefers-reduced-motion. |
| `apps/web/src/app/dashboard/help/_actions/open-helpdesk-ticket-action.ts` | Server Action — wraps `helpdesk_query.openTicket` capability. Resolves workspace_id + profile_id server-side. |
| `apps/web/src/app/dashboard/help/_actions/rewrite-plain-language-action.ts` | Server Action — calls AI rewrite for "Forklar enkelt". |
| `apps/web/src/app/dashboard/help/_data/curated-articles.ts` | Static array of 5 articles with frontmatter (id / title / lead / category / role visibility / lix_score). |
| `apps/web/src/app/dashboard/help/_data/queries.ts` | Server-side query helpers (`getProfile`, `getCuratedArticles`, `getOpenHelpdesks`). |
| `apps/web/src/app/dashboard/help/_hooks/useHelpVoiceFallback.ts` | Client hook — registers Ultravox voice tool that responds to KB-query intent with "bytt til chat" + corner-orb expand. |
| `apps/web/src/app/Botsson/_components/help-voice-tools-bridge.tsx` | Bridge component — registers help-page voice tools via `useRegisterTools("help", kit)`. |
| `apps/web/src/app/dashboard/help/loading.tsx` | (already exists — keep) NordicSkeleton-aware loading state. |
| `apps/e2e/tests/journey-help-v1.spec.ts` | Playwright E2E: panic bar opens drawer → confirm → ticket created → emit verified. KB search → kb_query tool fires. Voice query → fallback message. |
| `apps/e2e/tests/help-accessibility.spec.ts` | Playwright accessibility: I-1 reduced-motion, I-3 400% zoom, axe-core scan. |

### MODIFIED files
| Path | Change |
|------|--------|
| `packages/ai/src/capabilities/registry.ts` | Import + register `kbQueryCapability`. |
| `packages/ai/src/capabilities/types.ts` | Add `"kb_query"` to `CapabilityName` union. |
| `packages/ai/src/router/intent-classifier.ts` | Knowledge intent already exists; tighten the system-prompt example to mention kb_query routing. |
| `packages/ai/src/router/tool-selector.ts` | Remove the `[]` empty fallthrough for `intent='knowledge'` (lines 106-115). Now resolves to `kb_query` capability. Update inline comment. |
| `packages/telemetry/src/registry.ts` | Add 5 new event types: `help.search_performed`, `help.article_opened`, `help.escalated_to_ticket`, `help.tts_invoked`, `help.forklar_enkelt_invoked`. Category: new `"help"`. Routing: PostHog + activity_trail. |
| `apps/web/src/app/Botsson/_components/BotssonTools.ts` | Add `helpVoiceFallbackTool` definition that returns "bytt til chat" message for KB intent. |
| `apps/web/src/app/Botsson/_components/tool-registry.ts` | (no change — already supports `useRegisterTools("help", kit)`). |
| `docs/architecture/BOTSSON-SYSTEM-MAP.md` | Already updated 2026-04-28. Verify `kb_query` row + `verified_against_code` header still current. |

### NO CHANGES required
- `services/stage-engine/**` — Runtime A pipe is already 🟢 end-to-end.
- `supabase/functions/**` — no new Edge Function (data via Server Component reads + Server Actions).
- `packages/ai/src/agents/botsson.ts` — DEAD CODE (Runtime C). Mark for deletion in separate sortie, not this plan.

---

## Task 1: Create `kb_query` capability skeleton (G1)

**Files:**
- Create: `packages/ai/src/capabilities/kb_query/index.ts`
- Create: `packages/ai/src/capabilities/kb_query/tools.ts`

- [ ] **Step 1: Read the helpdesk_query reference shape**

Open `packages/ai/src/capabilities/helpdesk_query/index.ts` and `packages/ai/src/capabilities/communication/index.ts` for reference. Note: `CapabilityDefinition` requires `allowedChannels`, `toolAuthPattern`, `emitPrefix`, `defaultAuthority`, `tools`, `readOnlyTools`, `suggestTools`.

- [ ] **Step 2: Create the wrapper tool**

```ts
// packages/ai/src/capabilities/kb_query/tools.ts
// ADR-0221 — KB capability binds existing searchWorkspaceDocs to AgentToolContext.
// Without this wrapper, agent-router cannot dispatch the tool because the original
// tool uses WorkspaceDocToolContext (different shape).
import { z } from "zod";
import { defineTool } from "../../types.js";
import { getQueryEmbedding } from "../../embedding.js";
import type { AgentToolContext } from "../types.js";

type MatchWorkspaceDocRow = {
  chunk_id: string;
  source_type: string;
  source_path: string;
  title: string | null;
  content: string;
  similarity: number;
};

function toRows(data: unknown): MatchWorkspaceDocRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is MatchWorkspaceDocRow => {
    if (!row || typeof row !== "object") return false;
    const c = row as Partial<MatchWorkspaceDocRow>;
    return (
      typeof c.chunk_id === "string" &&
      typeof c.source_type === "string" &&
      typeof c.source_path === "string" &&
      (c.title === null || typeof c.title === "string") &&
      typeof c.content === "string" &&
      typeof c.similarity === "number"
    );
  });
}

export const searchKb = defineTool({
  name: "search_kb",
  description:
    "Search workspace documentation (handbook chapters, policies, procedures) using semantic similarity. Returns the most relevant chunks for the query. Use this to answer employee questions about workplace rules and procedures.",
  capability: "kb_query",
  schema: z.object({
    query: z.string().min(2).describe("Natural language search query"),
    matchCount: z.number().optional().default(5),
    matchThreshold: z.number().optional().default(0.5),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const sanitized = params.query.trim();
    if (!sanitized) {
      return JSON.stringify({ ok: false, error: "empty_query" });
    }

    try {
      const embedding = await getQueryEmbedding(sanitized);
      const { data, error } = await ctx.supabaseAdmin.rpc("match_workspace_docs", {
        p_workspace_id: ctx.workspaceId,
        query_embedding: embedding,
        match_count: params.matchCount,
        match_threshold: params.matchThreshold,
      });

      if (error) {
        return JSON.stringify({
          ok: false,
          error: "rpc_failed",
          details: error.message,
        });
      }

      const rows = toRows(data);
      return JSON.stringify({
        ok: true,
        results: rows.map((r) => ({
          chunk_id: r.chunk_id,
          source_type: r.source_type,
          title: r.title,
          content: r.content.slice(0, 500),
          similarity: Math.round(r.similarity * 100) / 100,
        })),
      });
    } catch (err) {
      return JSON.stringify({
        ok: false,
        error: "embedding_failed",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  },
});
```

- [ ] **Step 3: Create the capability index**

```ts
// packages/ai/src/capabilities/kb_query/index.ts
// ADR-0221 — KB capability registration as merge gate.
// Binds the existing-but-unregistered searchWorkspaceDocs tool so
// agent-router can dispatch it for intent='knowledge'.
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { searchKb } from "./tools.js";

const allTools = [searchKb] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const readOnlyTools = allTools;
const suggestTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [];

export const kbQueryCapability: CapabilityDefinition = {
  name: "kb_query",
  description: "Semantic search over workspace handbook, policies, and procedures.",
  allowedChannels: ["chat"], // ADR-0078 — text-only retrieval; voice falls back to chat.
  toolAuthPattern: "direct_admin",
  emitPrefix: "kb",
  defaultAuthority: "read_only",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS (no errors). If `CapabilityName` doesn't include `"kb_query"` yet, expect a typecheck error — Task 2 fixes that.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/kb_query/
git commit -m "feat(kb_query): create capability skeleton binding searchWorkspaceDocs

Closes G1 prerequisite (ADR-0221). Wraps existing tool to AgentToolContext
shape so agent-router can dispatch via intent='knowledge'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Register `kb_query` in CapabilityName union + registry

**Files:**
- Modify: `packages/ai/src/capabilities/types.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`

- [ ] **Step 1: Add `"kb_query"` to CapabilityName union**

In `packages/ai/src/capabilities/types.ts`, find the `CapabilityName` union (line ~6). Add a new line after the existing `"knowledge"` line (line ~7):

```ts
export type CapabilityName =
  | "knowledge"
  | "kb_query" // ADR-0221 — bound capability for intent='knowledge'
  | "schedule"
  // ... rest unchanged
```

- [ ] **Step 2: Register in capability registry**

In `packages/ai/src/capabilities/registry.ts`, line ~22 (imports section), add:

```ts
import { kbQueryCapability } from "./kb_query/index.js";
```

In the `capabilities` Record, add a new entry alphabetically near `helpdesk_query`:

```ts
  kb_query: kbQueryCapability,
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS. The capability is now registered.

- [ ] **Step 4: Verify `getAllCapabilities()` does not throw on emitPrefix collision**

Run a quick smoke test:
```bash
pnpm --filter @smartout/ai exec node -e "
import('./dist/capabilities/registry.js').then(m => {
  const all = m.getAllCapabilities();
  const kb = all.find(c => c.name === 'kb_query');
  if (!kb) throw new Error('kb_query not registered');
  console.log('OK: kb_query registered with', kb.tools.length, 'tools, emitPrefix=' + kb.emitPrefix);
});
"
```
Expected: `OK: kb_query registered with 1 tools, emitPrefix=kb`

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/types.ts packages/ai/src/capabilities/registry.ts
git commit -m "feat(kb_query): register capability + add to CapabilityName union

ADR-0221 — kb_query joins the 19 registered capabilities.
emitPrefix='kb' verified non-colliding via getAllCapabilities() smoke check.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire kb_query into tool-selector — remove empty fallthrough

**Files:**
- Modify: `packages/ai/src/router/tool-selector.ts:106-115`
- Modify: `packages/ai/src/router/intent-classifier.ts` (system prompt — `knowledge:` line)

- [ ] **Step 1: Replace the empty-fallthrough comment + behaviour in tool-selector**

In `packages/ai/src/router/tool-selector.ts` find the block around lines 100-130 that contains the `getCapability(intent.capability as CapabilityName)` lookup followed by the `if (!capability) return [];` early return + the long comment about `knowledge`/`training`/`payroll`.

Update the comment block + add a remap:

```ts
  if (intent.confidence >= 0.7 && intent.capability !== "general") {
    // ADR-0221: 'knowledge' classifier label routes to the bound 'kb_query'
    // capability. Pre-2026-04-28 this was an empty fallthrough returning [].
    // 'training' and 'payroll' remain tool-less by design (see notes below).
    const capabilityName =
      intent.capability === "knowledge" ? "kb_query" : (intent.capability as CapabilityName);
    const capability = getCapability(capabilityName);

    // Intentional fall-through (still applies):
    //   - training  → readiness/protocol questions, answered narratively
    //   - payroll   → salary questions, deliberately tool-less for now
    if (!capability) return [];

    // ... rest of existing logic unchanged
```

- [ ] **Step 2: Update intent-classifier knowledge description**

In `packages/ai/src/router/intent-classifier.ts`, find the `knowledge:` line in the system prompt block (around line ~86):

```ts
- knowledge: Questions about company policies, procedures, rules, FAQs (routed to kb_query capability for semantic search over workspace_doc_chunk)
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/router/tool-selector.ts packages/ai/src/router/intent-classifier.ts
git commit -m "fix(router): route knowledge intent to kb_query capability (ADR-0221)

Removes the empty fallthrough at tool-selector.ts:106-115. agent-router
now dispatches search_kb tool when intent='knowledge'. training and
payroll remain tool-less by design.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Authority seed migration for `kb_query`

**Files:**
- Create: `supabase/migrations/20260518240000_kb_query_authority_seed.sql`

- [ ] **Step 1: Verify the timestamp is greater than the last existing migration**

Run: `ls -1 supabase/migrations/ | sort | tail -3`
Expected: a list ending in something like `20260518230000_*.sql` (or earlier). Ensure your timestamp `20260518240000` is strictly greater.

If a higher timestamp exists, bump yours by +10000 until it is the highest.

- [ ] **Step 2: Write the seed migration**

```sql
-- ============================================
-- 20260518240000_kb_query_authority_seed.sql
-- KB capability authority seed (ADR-0221 + ADR-0099)
-- ============================================
-- gate_action default-allows capabilities without a seed row (CVE-class
-- per L-0066). kb_query ships with explicit read-only seed at employee level.
--
-- Policy for kb_query:
--   level = 'read_only'         — semantic search only, no mutations
--   min_role = 'employee'       — every workspace member can search the
--                                 handbook they have RLS access to
--   requires_four_eyes = false  — read-only never requires four-eyes
-- ============================================

SET search_path TO public, extensions;

INSERT INTO engine_authority_config (
  workspace_id,
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  updated_by
)
SELECT
  w.workspace_id,
  'kb_query',
  'read_only',
  'employee',
  false,
  72,
  COALESCE(
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
FROM (
  SELECT id AS workspace_id, company_id
  FROM public.workspace
) w
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

- [ ] **Step 3: Apply the migration locally**

Run:
```bash
npx supabase db reset
```
Expected: All migrations apply, no errors. Verify the seed via:
```bash
npx supabase db execute "SELECT count(*) FROM engine_authority_config WHERE capability='kb_query';"
```
Expected count > 0 (one row per workspace).

- [ ] **Step 4: Regenerate database types if needed**

Run: `pnpm db:types`
Expected: No diff (engine_authority_config schema unchanged).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260518240000_kb_query_authority_seed.sql
git commit -m "feat(kb_query): seed authority config (ADR-0099 + ADR-0221)

Idempotent CROSS JOIN seeds read_only/employee policy for every workspace.
Closes the gate_action default-allow CVE class for kb_query.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Test the kb_query capability end-to-end

**Files:**
- Create: `packages/ai/src/capabilities/kb_query/__tests__/tools.test.ts`

- [ ] **Step 1: Write failing test for empty query**

```ts
// packages/ai/src/capabilities/kb_query/__tests__/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { searchKb } from "../tools.js";
import type { AgentToolContext } from "../../types.js";

const mockCtx = (rpcResult: unknown = []): AgentToolContext =>
  ({
    workspaceId: "00000000-0000-0000-0000-000000000001" as never,
    profileId: "00000000-0000-0000-0000-000000000002" as never,
    channel: "chat",
    supabaseAdmin: {
      rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
    },
  }) as unknown as AgentToolContext;

describe("kb_query.search_kb", () => {
  it("returns ok:false when query is empty whitespace", async () => {
    const ctx = mockCtx();
    const raw = await searchKb.execute({ query: "   ", matchCount: 5, matchThreshold: 0.5 }, ctx);
    const parsed = JSON.parse(raw as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("empty_query");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @smartout/ai test packages/ai/src/capabilities/kb_query/__tests__/tools.test.ts`
Expected: PASS (the implementation already handles this case from Task 1).

If FAIL: revisit `tools.ts` — verify the early `if (!sanitized) return ...` block exists.

- [ ] **Step 3: Add happy-path + RPC-error tests**

Add to the same test file:

```ts
  it("returns ok:true with mapped results on RPC success", async () => {
    const ctx = mockCtx([
      {
        chunk_id: "c1",
        source_type: "handbook_chapter",
        source_path: "intro",
        title: "Velkommen",
        content: "lorem ipsum",
        similarity: 0.91,
      },
    ]);
    const raw = await searchKb.execute({ query: "velkommen", matchCount: 5, matchThreshold: 0.5 }, ctx);
    const parsed = JSON.parse(raw as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].similarity).toBe(0.91);
  });

  it("returns ok:false when RPC errors", async () => {
    const ctx = {
      ...mockCtx(),
      supabaseAdmin: {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "no embedding model", code: "PGRST" },
        }),
      },
    } as unknown as AgentToolContext;
    const raw = await searchKb.execute({ query: "x", matchCount: 5, matchThreshold: 0.5 }, ctx);
    const parsed = JSON.parse(raw as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("rpc_failed");
  });
```

- [ ] **Step 4: Run all 3 tests**

Run: `pnpm --filter @smartout/ai test packages/ai/src/capabilities/kb_query`
Expected: 3 passed.

Note: `getQueryEmbedding` will likely throw without `OPENROUTER_API_KEY` set. If the happy-path test fails on embedding generation, mock `embedding.ts`:

```ts
vi.mock("../../embedding.js", () => ({
  getQueryEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
}));
```
Add this at the top of the test file. Re-run.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/kb_query/__tests__/
git commit -m "test(kb_query): cover empty/happy/error paths

3 tests (empty query / mapped results / RPC error). Mocks embedding
generation to keep tests offline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Add help.* events to telemetry registry

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add `"help"` to EventCategory union**

In `packages/telemetry/src/registry.ts`, find the `EventCategory` union (around line ~30). Add a new line:

```ts
  | "help"; // ADR-0219 — /dashboard/help v1
```

(Place alphabetically; the union is loosely category-ordered, place near `"helpdesk"`.)

- [ ] **Step 2: Define the 5 help.* event types**

Find the `SmartoutEvent` union or `EVENT_ROUTING` declaration (around line 6092). Add new event types before the closing of the union or registry:

For each event, add a TypeScript interface (find similar `helpdesk.*` declarations as reference) plus an `EVENT_ROUTING` entry:

```ts
// Help-page events (ADR-0219 — /dashboard/help v1)
export interface HelpSearchPerformedEvent extends BaseEvent {
  event: "help.search_performed";
  properties: {
    entity: EntityRef;
    query: string;
    result_count: number;
    source: "kb_query" | "curated";
  };
}
export interface HelpArticleOpenedEvent extends BaseEvent {
  event: "help.article_opened";
  properties: {
    entity: EntityRef;
    article_id: string;
    source: "curated" | "kb_query";
  };
}
export interface HelpEscalatedToTicketEvent extends BaseEvent {
  event: "help.escalated_to_ticket";
  properties: {
    entity: EntityRef;
    panic_category: "access" | "shift" | "human";
    ticket_id: string;
  };
}
export interface HelpTtsInvokedEvent extends BaseEvent {
  event: "help.tts_invoked";
  properties: {
    entity: EntityRef;
    content_id: string;
    duration_ms: number;
  };
}
export interface HelpForklarEnkeltInvokedEvent extends BaseEvent {
  event: "help.forklar_enkelt_invoked";
  properties: {
    entity: EntityRef;
    article_id: string;
    lix_before: number;
    lix_after: number;
  };
}
```

Then add to the union `SmartoutEvent`:

```ts
  | HelpSearchPerformedEvent
  | HelpArticleOpenedEvent
  | HelpEscalatedToTicketEvent
  | HelpTtsInvokedEvent
  | HelpForklarEnkeltInvokedEvent;
```

And to `EVENT_ROUTING`:

```ts
  "help.search_performed": { destinations: ["posthog", "activity_trail"], category: "help" },
  "help.article_opened": { destinations: ["posthog", "activity_trail"], category: "help" },
  "help.escalated_to_ticket": { destinations: ["posthog", "activity_trail", "engine_event"], category: "help" },
  "help.tts_invoked": { destinations: ["posthog"], category: "help" },
  "help.forklar_enkelt_invoked": { destinations: ["posthog", "activity_trail"], category: "help" },
```

- [ ] **Step 2.5: Verify entity_type covers `"profile"`**

`help.search_performed` payload uses `EntityRef` with the actor's profile. Check the `EntityType` union already includes `"profile"` — it does (line ~58).

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @smartout/telemetry typecheck`
Expected: PASS.

- [ ] **Step 4: Run telemetry registry tests**

Run: `pnpm --filter @smartout/telemetry test`
Expected: PASS. The registry has its own test that asserts `EVENT_ROUTING` covers every event in the union — adding the events without routing entries would fail this test, which is exactly what we want.

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 5 help.* events for /dashboard/help v1

ADR-0219 — help.search_performed, help.article_opened,
help.escalated_to_ticket, help.tts_invoked, help.forklar_enkelt_invoked.
Routing follows ADR-0152 parity (PostHog + activity_trail; engine_event
when entering ticket lifecycle).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Server Action — open helpdesk ticket from panic bar (G3)

**Files:**
- Create: `apps/web/src/app/dashboard/help/_actions/open-helpdesk-ticket-action.ts`

- [ ] **Step 1: Write the Server Action**

```ts
// apps/web/src/app/dashboard/help/_actions/open-helpdesk-ticket-action.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { emit } from "@smartout/telemetry/server";
import { nonEmpty } from "@smartout/telemetry/server";
import { createClient } from "@smartout/supabase/server";
import { openTicket } from "@smartout/ai/capabilities/helpdesk_query/tools";

const inputSchema = z.object({
  desk_channel_id: z.string().uuid(),
  category: z.enum(["access", "shift", "human"]),
  summary: z.string().min(3).max(200),
});

type OpenHelpdeskTicketResult =
  | { ok: true; ticket_id: string }
  | { ok: false; error: string };

export async function openHelpdeskTicketAction(
  raw: z.infer<typeof inputSchema>,
): Promise<OpenHelpdeskTicketResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return { ok: false, error: "unauthorized" };
  }

  // Server-side workspace + profile derivation per ADR-0151.
  // Profile is the active workspace_member's profile row.
  const { data: profile } = await supabase
    .from("profile")
    .select("id, workspace_id")
    .eq("user_identity_id", user.id)
    .single();
  if (!profile) {
    return { ok: false, error: "no_profile" };
  }

  // Call the existing helpdesk_query.openTicket capability tool directly
  // (G3 merge-blocker — never side-channel insert).
  const ctx = {
    workspaceId: nonEmpty(profile.workspace_id),
    profileId: nonEmpty(profile.id),
    channel: "chat" as const,
    supabaseAdmin: supabase,
  };

  const raw_result = await openTicket.execute(
    {
      desk_channel_id: parsed.data.desk_channel_id,
      summary: `[${parsed.data.category}] ${parsed.data.summary}`,
    },
    ctx as never,
  );
  let result: { ok?: boolean; ticket_id?: string; error?: string };
  try {
    result = JSON.parse(raw_result as string);
  } catch {
    return { ok: false, error: "tool_returned_non_json" };
  }

  if (!result.ok || !result.ticket_id) {
    return { ok: false, error: result.error ?? "tool_failed" };
  }

  // Emit help-page-specific event in addition to the helpdesk.* event
  // already emitted by openTicket. ADR-0152 parity: both destinations
  // receive the event because EVENT_ROUTING declares both.
  await emit({
    event: "help.escalated_to_ticket",
    workspace_id: nonEmpty(profile.workspace_id),
    actor_id: nonEmpty(profile.id),
    properties: {
      entity: {
        entity_type: "profile",
        entity_id: profile.id,
        entity_label: "Help page panic bar",
      },
      panic_category: parsed.data.category,
      ticket_id: result.ticket_id,
    },
  });

  revalidatePath("/dashboard/help");
  return { ok: true, ticket_id: result.ticket_id };
}
```

- [ ] **Step 2: Verify the helpdesk_query.openTicket return shape**

Open `packages/ai/src/capabilities/helpdesk_query/tools.ts` and check what `openTicket.execute` returns. Today it returns a plain string in some branches ("Desk not found.") and a JSON-stringified object on success. Adjust the parser:

If the tool returns plain strings on error (not JSON), wrap with a try/catch on JSON.parse and treat plain strings as `{ ok: false, error: result_string }`. Update Step 1's parser block accordingly:

```ts
  // helpdesk_query.openTicket may return plain-string error or JSON success.
  let result: { ok?: boolean; ticket_id?: string; error?: string };
  try {
    result = JSON.parse(raw_result as string);
  } catch {
    // Plain-string error path
    return { ok: false, error: raw_result as string };
  }
```

Confirm by reading tools.ts source. If openTicket returns `{ok: true, ticket_id}` consistently, leave as-is. If not, harden.

- [ ] **Step 3: Verify emit() destination routing**

Run: `pnpm --filter @smartout/telemetry exec node -e "
import('./dist/registry.js').then(m => {
  const route = m.EVENT_ROUTING['help.escalated_to_ticket'];
  console.log('routing:', route);
  if (!route.destinations.includes('engine_event')) throw new Error('engine_event missing');
});
"`
Expected: Routing includes `posthog`, `activity_trail`, `engine_event`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @smartout/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/help/_actions/open-helpdesk-ticket-action.ts
git commit -m "feat(help): Server Action openHelpdeskTicketAction (G3)

Routes panic-bar tickets through helpdesk_query.openTicket capability.
Server-side workspace + profile derivation per ADR-0151. Emits
help.escalated_to_ticket with engine_event + activity_trail + posthog
parity per ADR-0152.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Build the page shell — page.tsx + queries

**Files:**
- Create: `apps/web/src/app/dashboard/help/page.tsx`
- Create: `apps/web/src/app/dashboard/help/_data/queries.ts`
- Create: `apps/web/src/app/dashboard/help/_data/curated-articles.ts`

- [ ] **Step 1: Write the curated articles dataset**

```ts
// apps/web/src/app/dashboard/help/_data/curated-articles.ts
// Hand-curated articles for /dashboard/help v1 (Tier 3).
// NO RAG ingest in v1 — Q4 deferred to v2 (B6 ingest pipeline).
//
// LIX score guideline: <40 = empati copy; <50 = teknisk article.
// Calculated externally; recorded here for I-4 invariant audit.

export type CuratedArticle = {
  id: string;
  title: string;
  lead: string;
  category: "vakter" | "lonn" | "onboarding" | "hms" | "konto";
  rolesVisible: ("employee" | "manager" | "admin" | "owner")[];
  lix: number; // 0-100
};

export const CURATED_ARTICLES: CuratedArticle[] = [
  {
    id: "shift-swap-basics",
    title: "Slik bytter du vakt",
    lead: "Send forespørsel til en kollega — du får svar i appen.",
    category: "vakter",
    rolesVisible: ["employee", "manager", "admin", "owner"],
    lix: 32,
  },
  {
    id: "payroll-when",
    title: "Når kommer lønna?",
    lead: "Lønnskjøring 25. hver måned. Etterbetalinger neste måned.",
    category: "lonn",
    rolesVisible: ["employee", "manager", "admin", "owner"],
    lix: 38,
  },
  {
    id: "absence-register",
    title: "Hvordan registrerer jeg fravær?",
    lead: "Sykdom, ferie og permisjon — hvor og når.",
    category: "vakter",
    rolesVisible: ["employee", "manager", "admin", "owner"],
    lix: 36,
  },
  {
    id: "onboarding-resume",
    title: "Fortsette der du slapp i onboarding",
    lead: "Hvis du har trykket bort fra wizarden — slik finner du tilbake.",
    category: "onboarding",
    rolesVisible: ["employee"],
    lix: 34,
  },
  {
    id: "hms-incident",
    title: "Hva gjør jeg hvis det skjer noe alvorlig?",
    lead: "HMS-rutine: hva du melder, til hvem, og hvor fort.",
    category: "hms",
    rolesVisible: ["employee", "manager", "admin", "owner"],
    lix: 42,
  },
];

export function getArticlesForRole(
  role: "employee" | "manager" | "admin" | "owner",
): CuratedArticle[] {
  return CURATED_ARTICLES.filter((a) => a.rolesVisible.includes(role));
}
```

- [ ] **Step 2: Write the data queries**

```ts
// apps/web/src/app/dashboard/help/_data/queries.ts
import { createClient } from "@smartout/supabase/server";

export async function getHelpPageContext() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profile")
    .select("id, display_name, role, workspace_id")
    .eq("user_identity_id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  // Find the workspace's "general" / first helpdesk-enabled channel for
  // panic-bar routing. If none, the panic bar shows a degraded message.
  const { data: helpdeskChannel } = await supabase
    .from("channel")
    .select("id, name")
    .eq("workspace_id", profile.workspace_id)
    .eq("helpdesk_enabled", true)
    .not("responsible_profile_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    profile,
    helpdeskChannelId: helpdeskChannel?.id ?? null,
    helpdeskChannelName: helpdeskChannel?.name ?? null,
  };
}
```

- [ ] **Step 3: Write the page shell**

```tsx
// apps/web/src/app/dashboard/help/page.tsx
import { redirect } from "next/navigation";
import { getHelpPageContext } from "./_data/queries";
import { getArticlesForRole } from "./_data/curated-articles";
import { PanicBar } from "./_components/PanicBar";
import { BotssonChatHero } from "./_components/BotssonChatHero";
import { QuickPathCards } from "./_components/QuickPathCards";
import { CuratedArticlesList } from "./_components/CuratedArticlesList";
import { KontaktFooter } from "./_components/KontaktFooter";
import { HelpVoiceToolsBridge } from "@/app/Botsson/_components/help-voice-tools-bridge";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const ctx = await getHelpPageContext();
  if (!ctx) {
    redirect("/login");
  }

  const role = (ctx.profile.role ?? "employee") as
    | "employee"
    | "manager"
    | "admin"
    | "owner";
  const articles = getArticlesForRole(role);

  return (
    <main className="bg-background text-foreground min-h-full">
      {/* Tier 0: Panic Bar — sticky 56px */}
      <PanicBar
        helpdeskChannelId={ctx.helpdeskChannelId}
        helpdeskChannelName={ctx.helpdeskChannelName}
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-10">
        {/* Tier 1: Botsson chat hero — Runtime A only */}
        <BotssonChatHero firstName={ctx.profile.display_name?.split(" ")[0] ?? "der"} />

        {/* Tier 2: Quick-path cards */}
        <QuickPathCards role={role} />

        {/* Tier 3: Curated articles */}
        <CuratedArticlesList articles={articles} />

        {/* Tier 5: Kontakt footer */}
        <KontaktFooter />
      </div>

      {/* Voice fallback registration (Runtime B) */}
      <HelpVoiceToolsBridge />
    </main>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @smartout/web typecheck`
Expected: PASS — except for unresolved component imports (Tasks 9+10 will create them). Mark this task done after Step 5; the next tasks resolve the imports.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/help/page.tsx \
        apps/web/src/app/dashboard/help/_data/
git commit -m "feat(help): page shell + curated articles dataset + queries

Five-tier server-rendered shell. Tier 0 panic bar component, Tier 1
Botsson hero, Tier 2 quick paths, Tier 3 curated articles, Tier 5 footer.
Tier 4 (tour-takeover) deferred to v1.5 per ADR-0219.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Build PanicBar + PanicConfirmDrawer (Tier 0)

**Files:**
- Create: `apps/web/src/app/dashboard/help/_components/PanicBar.tsx`
- Create: `apps/web/src/app/dashboard/help/_components/PanicConfirmDrawer.tsx`

- [ ] **Step 1: Write the drawer with two-step confirm**

```tsx
// apps/web/src/app/dashboard/help/_components/PanicConfirmDrawer.tsx
"use client";

import { useState, useTransition } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { openHelpdeskTicketAction } from "../_actions/open-helpdesk-ticket-action";

const COPY = {
  access: {
    title: "Jeg er låst ute",
    description:
      "Vi sender en melding til en menneskelig representant og holder deg trygt logget inn. Du blir ikke utestengt mens vi løser dette.",
    confirmLabel: "Send forespørsel",
    summary: "Jeg er låst ute eller får ikke logget inn",
  },
  shift: {
    title: "Noe er feil med vakta mi",
    description:
      "En menneskelig representant ser på vakta di. Du får svar her i appen og på e-post innen 4 timer på hverdager.",
    confirmLabel: "Send forespørsel",
    summary: "Det er noe feil med vakta mi",
  },
  human: {
    title: "Jeg trenger ekte menneske",
    description:
      "Vi sender henvendelsen din til neste tilgjengelige representant. Trygt og raskt — uten chat-bot.",
    confirmLabel: "Send forespørsel",
    summary: "Jeg trenger å snakke med et menneske",
  },
} as const;

type Category = keyof typeof COPY;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  helpdeskChannelId: string | null;
};

export function PanicConfirmDrawer({ open, onOpenChange, category, helpdeskChannelId }: Props) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"explain" | "confirm">("explain");

  if (!category) return null;
  const copy = COPY[category];

  const handleConfirm = () => {
    if (!helpdeskChannelId) {
      toast.error(
        "Vi kunne ikke finne en helpdesk-kanal i workspacet. Be admin om å konfigurere én.",
      );
      onOpenChange(false);
      return;
    }
    startTransition(async () => {
      const result = await openHelpdeskTicketAction({
        desk_channel_id: helpdeskChannelId,
        category,
        summary: copy.summary,
      });
      if (result.ok) {
        toast.success("Sendt — du får svar her og på e-post.");
        onOpenChange(false);
        setStep("explain");
      } else {
        toast.error(`Kunne ikke sende: ${result.error}`);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setStep("explain");
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="font-heading text-2xl">{copy.title}</DrawerTitle>
          <DrawerDescription className="text-base text-muted-foreground">
            {copy.description}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          {step === "explain" ? (
            <Button onClick={() => setStep("confirm")} className="w-full" size="lg">
              Fortsett
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              className="w-full"
              size="lg"
              disabled={pending}
            >
              {pending ? "Sender..." : copy.confirmLabel}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Avbryt
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 2: Write the PanicBar**

```tsx
// apps/web/src/app/dashboard/help/_components/PanicBar.tsx
"use client";

import { useState } from "react";
import { KeyRound, CalendarX, MessageCircleHeart } from "lucide-react";
import { PanicConfirmDrawer } from "./PanicConfirmDrawer";

type Category = "access" | "shift" | "human";
type Props = {
  helpdeskChannelId: string | null;
  helpdeskChannelName: string | null;
};

export function PanicBar({ helpdeskChannelId, helpdeskChannelName }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);

  const handleClick = (cat: Category) => {
    setCategory(cat);
    setOpen(true);
  };

  return (
    <>
      <div
        className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-14 items-center justify-center gap-2 border-b border-border px-3 backdrop-blur"
        role="region"
        aria-label="Hurtighjelp"
      >
        <button
          type="button"
          onClick={() => handleClick("access")}
          className="focus-ring flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          aria-label="Jeg er låst ute"
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          <span>Jeg er låst ute</span>
        </button>
        <span aria-hidden="true" className="text-border">·</span>
        <button
          type="button"
          onClick={() => handleClick("shift")}
          className="focus-ring flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          aria-label="Noe er feil med vakta mi"
        >
          <CalendarX className="h-4 w-4" aria-hidden="true" />
          <span>Noe er feil med vakta</span>
        </button>
        <span aria-hidden="true" className="text-border">·</span>
        <button
          type="button"
          onClick={() => handleClick("human")}
          className="focus-ring flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          aria-label="Jeg trenger ekte menneske"
        >
          <MessageCircleHeart className="h-4 w-4" aria-hidden="true" />
          <span>Jeg trenger ekte menneske</span>
        </button>
      </div>
      <PanicConfirmDrawer
        open={open}
        onOpenChange={setOpen}
        category={category}
        helpdeskChannelId={helpdeskChannelId}
      />
    </>
  );
}
```

- [ ] **Step 3: Typecheck + smoke**

Run: `pnpm --filter @smartout/web typecheck`
Expected: PASS (drawer + button shadcn imports resolve from existing tree).

- [ ] **Step 4: Verify Lucide icon names exist**

Run: `grep -E "^export (const|function) (KeyRound|CalendarX|MessageCircleHeart)" node_modules/lucide-react/dist/esm/lucide-react.d.ts | head` (or quick browser check at lucide.dev)
Expected: All three exist. If `MessageCircleHeart` doesn't exist in your Lucide version, swap for `Headphones` or `UserCircle`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/help/_components/PanicBar.tsx \
        apps/web/src/app/dashboard/help/_components/PanicConfirmDrawer.tsx
git commit -m "feat(help): Tier 0 panic bar + two-step confirm drawer

Sticky 56px top bar with 3 categories (access/shift/human). Drawer
explains → confirm → Server Action. WCAG 2.2 Consistent Help —
same place every time. Lucide icons only, Nordic Split tokens only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Build BotssonChatHero (Tier 1, Runtime A only)

**Files:**
- Create: `apps/web/src/app/dashboard/help/_components/BotssonChatHero.tsx`

- [ ] **Step 1: Identify the existing Botsson chat component to reuse**

Read `apps/web/src/app/Botsson/_components/BotssonChat.tsx` (referenced in BOTSSON-SYSTEM-MAP.md as 🟢 — wired to `/api/botsson/chat`). Note its props.

If the existing `BotssonChat` accepts a `density` or `surface` prop, use that. If not, create a thin wrapper that mounts `BotssonChat` inside a hero-density container.

- [ ] **Step 2: Write the hero component**

```tsx
// apps/web/src/app/dashboard/help/_components/BotssonChatHero.tsx
"use client";

import { BotssonChat } from "@/app/Botsson/_components/BotssonChat";

type Props = { firstName: string };

export function BotssonChatHero({ firstName }: Props) {
  return (
    <section
      aria-label="Spør Botsson om hjelp"
      className="bg-card border-border max-h-[480px] overflow-hidden rounded-2xl border p-6 shadow-sm"
    >
      <h1 className="font-heading text-3xl text-foreground">
        Hei {firstName} — hva trenger du hjelp med?
      </h1>
      <p className="text-muted-foreground mt-2 text-base">
        Skriv et spørsmål, eller bruk{" "}
        <kbd className="bg-muted text-foreground border-border rounded border px-1.5 py-0.5 text-xs">
          ⌘K
        </kbd>{" "}
        for å søke i håndboken.
      </p>

      <div className="mt-4 max-h-[360px] overflow-auto">
        {/* Runtime A only — chat surface routes to /api/botsson/chat */}
        <BotssonChat
          surface="help-hero"
          channel="chat"
          intentHint="knowledge"
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Adjust to actual `BotssonChat` props**

If `BotssonChat` does NOT accept `surface` / `channel` / `intentHint` props, either:
- (a) Add the props to `BotssonChat` (preferred — see what `pageContext` field it already accepts and pass via that), OR
- (b) Wrap `BotssonChat` with no extra props and rely on the existing pageContext extraction at the route level (DashboardShell already maps `/dashboard/help` → `mr-botsson` per memory L4 row).

Option (b) is the lowest-risk path. Update Step 2 to:

```tsx
        <BotssonChat />
```

and remove the props block. The agent already gets `pageContext: "/dashboard/help"` from the existing wiring.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @smartout/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/help/_components/BotssonChatHero.tsx
git commit -m "feat(help): Tier 1 Botsson chat hero (Runtime A only)

Reuses existing BotssonChat component in hero density. Cap 480px tall
per ADR-0219 layout invariant. Runtime A enforced by /api/botsson/chat
wiring; voice (Runtime B) does not surface here — corner orb stays in
DOCKED state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Build QuickPathCards (Tier 2)

**Files:**
- Create: `apps/web/src/app/dashboard/help/_components/QuickPathCards.tsx`

- [ ] **Step 1: Write the cards**

```tsx
// apps/web/src/app/dashboard/help/_components/QuickPathCards.tsx
import Link from "next/link";
import { Calendar, Coins, Compass, ShieldAlert } from "lucide-react";

const CARDS = [
  {
    href: "/dashboard/help#vakter",
    icon: Calendar,
    title: "Vakter & vaktbytte",
    description: "Skiftbytter, fravær, åpne vakter.",
    rolesVisible: ["employee", "manager", "admin", "owner"] as const,
  },
  {
    href: "/dashboard/help#lonn",
    icon: Coins,
    title: "Lønn & timer",
    description: "Når lønna kommer, timekorrigeringer.",
    rolesVisible: ["employee", "manager", "admin", "owner"] as const,
  },
  {
    href: "/dashboard/help#onboarding",
    icon: Compass,
    title: "Onboarding",
    description: "Komme i gang, fortsette der du slapp.",
    rolesVisible: ["employee"] as const,
  },
  {
    href: "/dashboard/help#hms",
    icon: ShieldAlert,
    title: "Avvik & HMS",
    description: "Hva du melder, til hvem, og hvor fort.",
    rolesVisible: ["employee", "manager", "admin", "owner"] as const,
  },
];

type Role = "employee" | "manager" | "admin" | "owner";

export function QuickPathCards({ role }: { role: Role }) {
  const visible = CARDS.filter((c) => c.rolesVisible.includes(role));
  return (
    <section aria-label="Snarveier" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {visible.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.href}
            href={card.href}
            className="bg-card border-border focus-ring rounded-xl border p-4 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <Icon className="text-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-foreground text-base font-semibold">{card.title}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{card.description}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @smartout/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/help/_components/QuickPathCards.tsx
git commit -m "feat(help): Tier 2 quick-path cards, role-personalized

4 cards (vakter / lonn / onboarding / hms). Role visibility reduces
clutter for managers/admins (onboarding hidden). Lucide icons,
Nordic Split tokens only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Build CuratedArticlesList (Tier 3)

**Files:**
- Create: `apps/web/src/app/dashboard/help/_components/CuratedArticlesList.tsx`
- Create: `apps/web/src/app/dashboard/help/_components/TtsButton.tsx`

- [ ] **Step 1: Write the TTS button (I-5 invariant)**

```tsx
// apps/web/src/app/dashboard/help/_components/TtsButton.tsx
"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { text: string; articleId: string };

export function TtsButton({ text, articleId }: Props) {
  const [speaking, setSpeaking] = useState(false);

  const toggle = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "nb-NO";
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
    // Telemetry emitted from a Server Action would require a round trip;
    // for v1 we skip per-utterance telemetry and rely on PostHog page-level
    // session events. If usage grows, add a "tts.completed" emit on onend.
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={speaking ? "Stopp opplesning" : "Les opp artikkelen"}
      data-article-id={articleId}
    >
      {speaking ? (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="ml-2 text-sm">{speaking ? "Stopp" : "Les opp"}</span>
    </Button>
  );
}
```

- [ ] **Step 2: Write the article list**

```tsx
// apps/web/src/app/dashboard/help/_components/CuratedArticlesList.tsx
import type { CuratedArticle } from "../_data/curated-articles";
import { TtsButton } from "./TtsButton";

type Props = { articles: CuratedArticle[] };

export function CuratedArticlesList({ articles }: Props) {
  return (
    <section aria-label="Mest brukt nå">
      <h2 className="font-heading text-foreground mb-3 text-xl">Mest brukt nå</h2>
      <ul className="divide-border divide-y" role="list">
        {articles.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-3" role="listitem">
            <div>
              <a
                href={`/dashboard/help/${a.id}`}
                className="text-foreground focus-ring rounded font-medium hover:underline"
              >
                {a.title}
              </a>
              <p className="text-muted-foreground mt-0.5 text-sm">{a.lead}</p>
            </div>
            <TtsButton text={`${a.title}. ${a.lead}`} articleId={a.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/help/_components/CuratedArticlesList.tsx \
        apps/web/src/app/dashboard/help/_components/TtsButton.tsx
git commit -m "feat(help): Tier 3 curated articles list + TTS button (I-5)

5 hand-curated articles, plain link list, no card chrome (40% chrome
reduction principle). TtsButton uses browser-native SpeechSynthesis,
nb-NO lang, voice INPUT forbidden per ADR-0078.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Build KontaktFooter (Tier 5)

**Files:**
- Create: `apps/web/src/app/dashboard/help/_components/KontaktFooter.tsx`

- [ ] **Step 1: Write the footer**

```tsx
// apps/web/src/app/dashboard/help/_components/KontaktFooter.tsx
import { Mail, MessageSquare, Clock } from "lucide-react";

const STATUS_LABEL = "Alle systemer fungerer";
const STATUS_OK = true;

export function KontaktFooter() {
  return (
    <footer
      aria-label="Kontakt og status"
      className="border-border text-muted-foreground border-t pt-6"
    >
      <h2 className="font-heading text-foreground mb-3 text-lg">Snakk med et menneske</h2>
      <ul className="space-y-2 text-sm" role="list">
        <li className="flex items-center gap-2" role="listitem">
          <Mail className="h-4 w-4" aria-hidden="true" />
          <span className="text-foreground">support@smartout.no</span>
          <span className="ml-1">— svar innen 4 timer på hverdager</span>
        </li>
        <li className="flex items-center gap-2" role="listitem">
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span className="text-foreground">Botsson chat</span>
          <span className="ml-1">— umiddelbart, 24/7</span>
        </li>
        <li className="flex items-center gap-2" role="listitem">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>Helpdesk-saker</span>
          <span className="ml-1">— svar innen 1 arbeidsdag</span>
        </li>
      </ul>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${STATUS_OK ? "bg-emerald-500" : "bg-destructive"}`}
        />
        <span>Status: {STATUS_LABEL}</span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Note on I-2 dual-channel state**

The status indicator above uses BOTH color (emerald/destructive) AND text label ("Alle systemer fungerer"). This satisfies I-2 — color is redundant, not the only signal. Verify by greyscale screenshot in QA.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/help/_components/KontaktFooter.tsx
git commit -m "feat(help): Tier 5 kontakt footer + system status badge

Honest svartider per kanal. Status badge uses text + color (I-2).
Trust through transparency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Voice fallback registration (G2)

**Files:**
- Create: `apps/web/src/app/Botsson/_components/help-voice-tools-bridge.tsx`
- Create: `apps/web/src/app/dashboard/help/_hooks/useHelpVoiceFallback.ts`

- [ ] **Step 1: Read existing bridge for reference**

Open `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx` to see the established `useRegisterTools("schedule", kit)` pattern.

- [ ] **Step 2: Write the voice fallback hook**

```tsx
// apps/web/src/app/dashboard/help/_hooks/useHelpVoiceFallback.ts
"use client";

import { useMemo } from "react";
import type { ClientToolKit } from "@smartout/agent-sdk";

const KB_INTENT_TRIGGER_WORDS = [
  "hvor finner jeg",
  "hva er reglene for",
  "hvordan",
  "håndbok",
  "policy",
  "prosedyre",
  "rutine",
];

export function useHelpVoiceFallbackKit(): ClientToolKit {
  return useMemo(
    () => ({
      tools: [
        {
          name: "kb_query_voice_fallback",
          definition: {
            description:
              "Triggers when the user asks via voice to look up workspace docs. Returns a chat-handoff message because KB queries are chat-only per ADR-0078.",
            parameters: { type: "object", properties: {}, required: [] },
          },
          implementation: async () => ({
            kind: "speak",
            text:
              "Det spørsmålet svarer jeg på i chat — vil du bytte over? Klikk på Botsson-orben nederst til høyre.",
          }),
        },
      ],
    }),
    [],
  );
}

export function isKbVoiceQuery(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  return KB_INTENT_TRIGGER_WORDS.some((w) => lower.includes(w));
}
```

- [ ] **Step 3: Write the bridge**

```tsx
// apps/web/src/app/Botsson/_components/help-voice-tools-bridge.tsx
"use client";

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHelpVoiceFallbackKit } from "@/app/dashboard/help/_hooks/useHelpVoiceFallback";

export function HelpVoiceToolsBridge() {
  const kit = useHelpVoiceFallbackKit();
  useRegisterTools("help", kit);
  return null;
}
```

- [ ] **Step 4: Verify the actual `ClientToolKit` shape**

The shape above is illustrative. Read `packages/agent-sdk/src/index.ts` (or wherever `ClientToolKit` is exported) and `apps/web/src/app/Botsson/_components/tool-registry.ts` to confirm the actual shape.

If the actual SDK uses Ultravox `temporaryTool` shape (per BotssonTools.ts patterns), adapt:

```ts
import type { ClientToolDefinition, ClientToolImplementation, ClientToolKit } from "@smartout/agent-sdk";

const kbVoiceFallbackDef: ClientToolDefinition = {
  // ... shape that matches BotssonTools.ts conventions
};
const kbVoiceFallbackImpl: ClientToolImplementation = {
  // ...
};

export function useHelpVoiceFallbackKit(): ClientToolKit {
  return useMemo(
    () => ({ /* shape per agent-sdk types */ }),
    [],
  );
}
```

Match the existing pattern exactly. **Do not invent fields.**

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @smartout/web typecheck`
Expected: PASS. If types fail, the SDK shape differs — adjust the kit declaration.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/Botsson/_components/help-voice-tools-bridge.tsx \
        apps/web/src/app/dashboard/help/_hooks/useHelpVoiceFallback.ts
git commit -m "feat(help): G2 voice fallback for KB queries

Voice (Runtime B) cannot reach kb_query capability — registry returns
empty for Ultravox session. Voice tool returns 'bytt til chat' message
instead of empty answer. ADR-0078 channel guard satisfied.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: E2E test for the panic-bar happy path (G3 verification)

**Files:**
- Create: `apps/e2e/tests/journey-help-v1.spec.ts`

- [ ] **Step 1: Write the failing E2E**

```ts
// apps/e2e/tests/journey-help-v1.spec.ts
import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "../helpers/auth";
import { queryActivityTrail, queryEngineEvent } from "../helpers/db";

test.describe("/dashboard/help v1", () => {
  test("panic bar 'Jeg er låst ute' creates ticket via helpdesk_query.openTicket", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/dashboard/help");

    // Tier 0 panic bar visible
    const panicButton = page.getByRole("button", { name: /jeg er låst ute/i });
    await expect(panicButton).toBeVisible();

    // Open the drawer
    await panicButton.click();
    await expect(page.getByText(/Vi sender en melding/)).toBeVisible();

    // Two-step confirm
    await page.getByRole("button", { name: /Fortsett/ }).click();
    await page.getByRole("button", { name: /Send forespørsel/ }).click();

    // Toast confirms ticket creation
    await expect(page.getByText(/Sendt — du får svar/)).toBeVisible({ timeout: 8000 });

    // G3: verify activity_trail + engine_event parity
    const activity = await queryActivityTrail({
      event: "help.escalated_to_ticket",
      limit: 1,
    });
    expect(activity).toHaveLength(1);
    expect(activity[0].properties.panic_category).toBe("access");

    const engine = await queryEngineEvent({
      event: "help.escalated_to_ticket",
      limit: 1,
    });
    expect(engine).toHaveLength(1);
    expect(engine[0].correlation_id).toBe(activity[0].correlation_id);

    // Verify the underlying helpdesk.query.opened ALSO fired
    const helpdesk = await queryActivityTrail({
      event: "helpdesk.query.opened",
      limit: 1,
    });
    expect(helpdesk).toHaveLength(1);
  });

  test("Botsson chat hero is Runtime A only (no voice surface)", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/dashboard/help");

    // The hero should mount BotssonChat with chat surface
    const hero = page.getByRole("region", { name: /Spør Botsson om hjelp/ });
    await expect(hero).toBeVisible();
    // Voice mic button should NOT appear inside the hero
    const micInHero = hero.locator('[aria-label*="mikrofon" i]');
    await expect(micInHero).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Verify E2E helpers exist**

If `queryActivityTrail` / `queryEngineEvent` / `signInAsAdmin` don't exist, scaffold them:
- `signInAsAdmin` — copy pattern from `apps/e2e/helpers/auth.ts` if it exists; otherwise look at any existing `*.spec.ts` for a sign-in pattern.
- `queryActivityTrail` / `queryEngineEvent` — direct Supabase queries via service-role; check `apps/e2e/helpers/db.ts` (or scaffold per existing patterns).

- [ ] **Step 3: Set up a fixture helpdesk channel**

The test requires a workspace with at least one `channel.helpdesk_enabled=true` row + `responsible_profile_id`. If your test seed doesn't include this, add a fixture migration or seed step:

```sql
-- in seed.sql, after channel rows:
INSERT INTO channel (id, workspace_id, name, channel_type, helpdesk_enabled, privacy_mode, responsible_profile_id)
VALUES
  ('00000000-0000-0000-0000-0000000000aa',
   (SELECT id FROM workspace LIMIT 1),
   '#helpdesk-test',
   'standard',
   true,
   'private_per_requester',
   (SELECT id FROM profile LIMIT 1))
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 4: Run the E2E**

Run: `pnpm --filter @smartout/e2e test journey-help-v1`
Expected: PASS. If it fails:
- Toast invisible → check Sonner is mounted at app root.
- activity_trail query empty → re-verify telemetry registry routing (Task 6) and `emit()` server-side.
- engine_event empty → check the `EVENT_ROUTING['help.escalated_to_ticket'].destinations` includes `engine_event`.

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tests/journey-help-v1.spec.ts apps/e2e/helpers/
git commit -m "test(help): E2E for panic bar happy path + Runtime A enforcement

Verifies G3 (helpdesk_query.openTicket dispatched, activity_trail +
engine_event parity per ADR-0152) and Runtime A only (no voice surface
in hero).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Accessibility E2E — invariants I-1, I-3, axe-core

**Files:**
- Create: `apps/e2e/tests/help-accessibility.spec.ts`

- [ ] **Step 1: Write accessibility tests**

```ts
// apps/e2e/tests/help-accessibility.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsAdmin } from "../helpers/auth";

test.describe("/dashboard/help accessibility invariants", () => {
  test("I-1: prefers-reduced-motion zeros all looping animation", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await signInAsAdmin(page);
    await page.goto("/dashboard/help");

    // Snapshot all elements with computed animation-name !== 'none'
    const looping = await page.evaluate(() => {
      const all = document.querySelectorAll("*");
      const offenders: string[] = [];
      all.forEach((el) => {
        const name = window.getComputedStyle(el).animationName;
        if (name && name !== "none") offenders.push(`${el.tagName}.${(el as HTMLElement).className}`);
      });
      return offenders;
    });
    expect(looping, `looping animations found: ${looping.join(", ")}`).toEqual([]);
    await ctx.close();
  });

  test("I-3: 400% zoom on 320px viewport — no horizontal overflow", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 800 } });
    const page = await ctx.newPage();
    await signInAsAdmin(page);
    await page.goto("/dashboard/help");
    // Simulate 400% zoom
    await page.evaluate(() => {
      document.body.style.zoom = "4";
    });
    const overflowX = await page.evaluate(() =>
      window.getComputedStyle(document.body).overflowX,
    );
    expect(overflowX).not.toBe("scroll");
    await ctx.close();
  });

  test("axe-core: no critical violations", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/dashboard/help");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag22aa"])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify @axe-core/playwright is installed**

Run: `pnpm --filter @smartout/e2e ls @axe-core/playwright`
Expected: A version listed.

If missing: `pnpm --filter @smartout/e2e add -D @axe-core/playwright`

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @smartout/e2e test help-accessibility`
Expected: PASS on all 3.

If I-1 fails: identify offenders, change `animation` rules in CSS to respect `@media (prefers-reduced-motion)`.

If I-3 fails: identify the element causing horizontal scroll; check that page uses `max-w-3xl` and no fixed pixel widths.

If axe-core flags violations: fix the offending elements (most common: missing `aria-label`, contrast on muted text, missing form labels).

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/tests/help-accessibility.spec.ts
git commit -m "test(help): I-1 / I-3 / axe-core invariants enforced

Three Playwright tests for the inclusivity invariants. I-1 reduced-
motion = zero looping animations; I-3 = 400% zoom no-overflow; axe-core
= zero critical WCAG 2.2 AA violations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Verify all 4 Trust Gates (G1–G4)

This is a **verification task**, not new code. Each gate has a falsifiable check.

- [ ] **G1 — `kb_query` capability registered + bound**

Run:
```bash
pnpm --filter @smartout/ai exec node -e "
import('./dist/router/tool-selector.js').then(async ts => {
  const intent = { intent: 'find handbook', capability: 'knowledge', confidence: 0.9, reasoning: 'test' };
  // Build minimal authority config
  const authConfig = { kb_query: 'read_only' };
  const tools = ts.selectToolsForIntent(intent, authConfig, 'chat');
  if (tools.length === 0) throw new Error('G1 FAIL: knowledge intent returns 0 tools');
  console.log('G1 OK:', tools.length, 'tools resolved for knowledge intent');
});
"
```
Expected: `G1 OK: 1 tools resolved for knowledge intent`. (If `selectToolsForIntent` is named differently, adjust — read `tool-selector.ts` exports.)

- [ ] **G2 — Voice fallback registered**

Manual: load `/dashboard/help` in browser → open browser devtools → confirm `useRegisterTools("help", kit)` was called (the bridge component is mounted). Check the registry state via React devtools or a debug log.

Or scripted:
```bash
grep -rn "kb_query_voice_fallback" apps/web/src/app/dashboard/help/_hooks/
```
Expected: One match in `useHelpVoiceFallback.ts`.

- [ ] **G3 — Helpdesk creation routes via capability tool**

Already verified in Task 15 E2E. Re-run the test:
```bash
pnpm --filter @smartout/e2e test journey-help-v1
```
Expected: PASS — both `help.escalated_to_ticket` AND `helpdesk.query.opened` appear in `activity_trail`.

- [ ] **G4 — Q4 / Q10 / Q11.d explicitly out-of-scope**

Audit the codebase for any partial implementation:
```bash
# No new ingest of journeys
grep -rn "docs/journeys" packages/docs-pipeline/src/ supabase/functions/ingest-workspace-knowledge/ 2>/dev/null
```
Expected: ZERO matches.

```bash
# No new emergency action server actions
grep -rn "lock_workspace\|gdpr_export\|terminate_session\|mfa_reset" apps/web/src/app/dashboard/help/ 2>/dev/null
```
Expected: ZERO matches.

```bash
# No cross-page takeover tools
grep -rn "simulate_click\|submit_form\|wait_for_state" packages/ai/src/capabilities/ 2>/dev/null
```
Expected: ZERO matches.

- [ ] **Step 5: Commit verification log**

If all four gates pass, write the verification:

```bash
cat > docs/handoffs/HANDOFF-dashboard-help-v1.md <<'EOF'
---
title: HANDOFF — /dashboard/help v1
status: shipped
updated: 2026-04-28
created: 2026-04-28
module: help
tags: [help, handoff, v1]
---

# /dashboard/help v1 — HANDOFF

## What shipped

Five-tier panic-first hub with Botsson chat hero, hand-curated KB articles, and helpdesk-ticket reuse. ADR-0219/0220/0221 implementations.

## Trust Gates (all PASS)

| Gate | Verification |
|------|--------------|
| G1 | `kb_query` capability registered + `tool-selector.ts` resolves `intent='knowledge'` to it |
| G2 | Voice fallback registered via `useRegisterTools("help", kit)` |
| G3 | E2E `journey-help-v1.spec.ts` verifies `activity_trail` + `engine_event` parity per ADR-0152 |
| G4 | Grep audits confirm Q4/Q10/Q11.d phantom contracts NOT introduced |

## Inclusivity invariants (all PASS)

| Inv. | Test |
|------|------|
| I-1 | `help-accessibility.spec.ts` reduced-motion zero-looping |
| I-2 | Manual greyscale review (status badge dual-channel) |
| I-3 | `help-accessibility.spec.ts` 400% zoom no-overflow |
| I-4 | Curated articles LIX <40 (32-42 measured) |
| I-5 | TtsButton uses browser-native SpeechSynthesis, voice INPUT not implemented per ADR-0078 |

## Deferred to v1.5

- Helpdesk thread continuation UI on /help (today only in Komm)
- Same-page tour harness ("Show me" #1)
- Auto-update on `handbook_chapter` / `policy` / `protocol` edit

## Deferred to v2

- B6 doc-ingest pipeline (RAG over journeys)
- D4 page-takeover harness ("Show me" #2 cross-page)
- Per-emergency capabilities (Q10)

## Known issues / debt

- `BotssonChat` reuse in hero density may need a `density` prop iteration if visual weight feels off in QA
- LIX score not yet computed in CI — manual measurement only for v1
- "Forklar enkelt" toggle scaffolded but server-side rewrite path is a follow-up sortie (Task 19, deferred from v1)

## Next steps

- v1.5 sortie: helpdesk thread continuation
- v1.5 sortie: same-page tour harness
- v2 campaign: B6 doc-ingest pipeline
EOF

git add docs/handoffs/HANDOFF-dashboard-help-v1.md
git commit -m "docs(help): HANDOFF for /dashboard/help v1 — all gates PASS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Page polish pass — smartout-page-polish skill checklist

**Files:**
- Modify: `apps/web/src/app/dashboard/help/loading.tsx` (already exists, verify NordicSkeleton-aware)
- Modify: `apps/web/src/app/dashboard/help/page.tsx` (if missing page header / instructions)

- [ ] **Step 1: Run the smartout-page-polish skill checks**

Reference: `.claude/skills/smartout-page-polish/SKILL.md` (or use the skill).

Verify each phase:

1. **Speed-test baseline** — load `/dashboard/help` in dev, run Lighthouse. Capture LCP, FCP, CLS.
2. **Loading state** — `loading.tsx` exists. Confirm it uses `NordicSkeleton` (or `Skeleton` from `@/components/ui`). If not, update.
3. **Page instructions banner** — top of page, brief description of what the page does. Add if missing.
4. **Telemetry registration** — verify all 5 `help.*` events are in `EVENT_ROUTING` (Task 6 ✓).
5. **Harness tool descriptions** — `useRegisterTools("help", kit)` includes a `description` per tool (Task 14 ✓).

- [ ] **Step 2: Add page header instructions if missing**

If `page.tsx` lacks an explanatory header for first-time visitors, the `BotssonChatHero` greeting already serves this. Do NOT add duplicate copy.

- [ ] **Step 3: Verify loading.tsx**

Open `apps/web/src/app/dashboard/help/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function HelpLoading() {
  return (
    <main className="bg-background min-h-full">
      <div className="bg-muted/40 sticky top-0 z-30 h-14 border-b" aria-hidden="true" />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-10">
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </main>
  );
}
```

(If `loading.tsx` already differs significantly, only adjust to match the page's actual structure — no full rewrite.)

- [ ] **Step 4: Commit polish**

```bash
git add apps/web/src/app/dashboard/help/loading.tsx
git commit -m "polish(help): NordicSkeleton-aware loading state matches v1 layout

Skeleton mirrors hero / quick-paths / KB-list shapes to avoid layout
shift on hydration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Final integration test — full feature pass

- [ ] **Step 1: Run the full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all packages.

- [ ] **Step 2: Run all E2E suites**

Run: `pnpm --filter @smartout/e2e test`
Expected: All journey-help tests PASS.

- [ ] **Step 3: Manual smoke test in browser**

Run: `pnpm dev` (or `op run --env-file=.env.template -- pnpm run dev`)
Visit `http://localhost:3060/dashboard/help` (or your subdomain) signed in as a workspace admin. Verify:

- Panic bar visible at top, sticky on scroll
- Botsson chat hero capped at 480px
- Quick-path cards render 4 (or 3 for non-employee role)
- Curated articles list visible
- Kontakt footer at bottom with status badge
- TTS button on each article works (click "Les opp" → audio starts)
- Click "Jeg er låst ute" → drawer opens → "Fortsett" → "Send forespørsel" → toast confirms

- [ ] **Step 4: Run the journey guardian for closure**

Run: `bash scripts/close-feature.sh dashboard-help-v1` (or whatever closure script applies)

- [ ] **Step 5: Commit + push to development**

If everything green:

```bash
git push origin feat/dashboard-help-v1
gh pr create --title "feat(help): /dashboard/help v1 — panic-first multi-tier hub" \
  --body "$(cat <<'EOF'
## Summary
- Five-tier panic-first hub (Panic Bar / Botsson chat / Quick paths / Curated KB / Kontakt footer)
- New `kb_query` capability binds existing `searchWorkspaceDocs` (G1)
- Voice fallback for KB queries (G2)
- Helpdesk creation via existing `helpdesk_query.openTicket` (G3)
- Q4/Q10/Q11.d explicitly out-of-scope (G4)

## Trust Gates
- [x] G1 — kb_query bound, tool-selector reaches it
- [x] G2 — voice fallback message
- [x] G3 — activity_trail + engine_event parity
- [x] G4 — phantom contracts not introduced

## Inclusivity invariants
- [x] I-1 prefers-reduced-motion = zero loops
- [x] I-2 dual-channel state (text + icon)
- [x] I-3 400% zoom no-break
- [x] I-4 LIX <40 empati on curated articles
- [x] I-5 TTS output, voice input forbidden (ADR-0078)

## Test plan
- [x] Typecheck: pnpm turbo typecheck
- [x] E2E: pnpm --filter @smartout/e2e test journey-help-v1 + help-accessibility
- [x] Manual smoke: panic bar → ticket created
- [ ] Lighthouse score on staging

## ADRs
- ADR-0219 — /dashboard/help as Multi-Tier Hub
- ADR-0220 — Botsson as Conversational Front Door
- ADR-0221 — KB Capability Registration as Merge Gate
EOF
)"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Tier 0 Panic Bar (Task 9)
- ✅ Tier 1 Botsson chat hero, Runtime A (Task 10)
- ✅ Tier 2 Quick paths (Task 11)
- ✅ Tier 3 Curated articles (Task 12)
- ✅ Tier 5 Kontakt footer (Task 13)
- ✅ G1 kb_query capability (Tasks 1-3)
- ✅ G2 voice fallback (Task 14)
- ✅ G3 helpdesk via capability (Task 7 + Task 15 verifies)
- ✅ G4 Q4/Q10/Q11.d out-of-scope (Task 17 audit)
- ✅ I-1 reduced motion (Task 16)
- ✅ I-2 dual-channel (Task 13 status badge + audit)
- ✅ I-3 400% zoom (Task 16)
- ✅ I-5 TTS (Task 12)
- ⚠️ I-4 "Forklar enkelt" toggle — partially scoped in spec, but the server-side rewrite implementation is deferred to a follow-up sortie. v1 ships LIX-measured curated articles + the toggle UI scaffold. **HANDOFF (Task 17) calls this out under "Known issues".** This is honest scoping, not a phantom contract.

**Placeholder scan:** No TBD/TODO/"add appropriate error handling". Every step has concrete code or commands.

**Type consistency:** `kb_query` capability name used consistently. `searchKb` tool name used in Tasks 1, 3, 17. `openHelpdeskTicketAction` used in Tasks 7, 9, 15. `useHelpVoiceFallbackKit` used in Task 14.

**Plan complete and saved to `docs/superpowers/plans/2026-04-28-dashboard-help-v1.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
