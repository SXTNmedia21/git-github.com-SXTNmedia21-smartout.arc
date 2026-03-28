---
title: "Openrouter Embedding Fix"
status: done
updated: 2026-04-10
created: 2026-03-01
module: meta
tags: []
---

# OpenRouter Embedding Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all `@ai-sdk/openai` usage with OpenRouter's embedding API, remove the unnecessary OPENAI_API_KEY dependency, and update ADR-0031 to reflect the correct provider.

**Architecture:** The project uses OpenRouter as its sole AI provider. OpenRouter's `@openrouter/ai-sdk-provider@2.2.3` already supports `textEmbeddingModel()` (confirmed in `dist/index.d.ts`). The `@ai-sdk/openai` package was added in error — OpenRouter can route to `openai/text-embedding-3-small` natively. This plan removes the incorrect dependency and unifies all AI calls through one provider and one API key (`OPENROUTER_API_KEY`).

**Tech Stack:** `@openrouter/ai-sdk-provider@^2.2.3`, Vercel AI SDK (`ai`), TypeScript

---

## Summary of Changes

| File                                                | Action        | Why                                                               |
| --------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| `packages/ai/src/embedding.ts`                      | Rewrite       | Replace `@ai-sdk/openai` import with OpenRouter                   |
| `packages/ai/package.json`                          | Remove dep    | Drop `@ai-sdk/openai`                                             |
| `packages/docs-pipeline/src/embedding/client.ts`    | Rewrite       | Replace `@ai-sdk/openai` import with OpenRouter                   |
| `packages/docs-pipeline/package.json`               | Swap dep      | Drop `@ai-sdk/openai`, add `@openrouter/ai-sdk-provider`          |
| `apps/web/src/env.ts`                               | Remove line   | Drop `OPENAI_API_KEY`                                             |
| `docs/decisions/0031-documentation-rag-pgvector.md` | Update        | Reflect OpenRouter, remove "Bad" consequence about OPENAI_API_KEY |
| `packages/docs-pipeline/src/commands/ingest.ts`     | Update header | Fix "OpenAI embeddings" comment                                   |

---

### Task 1: Fix embedding client in @smartout/ai

**Files:**

- Modify: `packages/ai/src/embedding.ts`
- Modify: `packages/ai/package.json`

**Step 1: Rewrite embedding.ts to use OpenRouter**

Replace the full file content of `packages/ai/src/embedding.ts` with:

```typescript
// ============================================
// embedding.ts
// Query embedding helper for RAG retrieval.
// Generates a single embedding vector for a search query,
// used by doc retrieval tools to find relevant documentation.
// Connected to: src/tools/docs.ts (uses this for search queries)
// Connected to: ADR-0031 (embedding model decision)
// ============================================

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed } from "ai";

/**
 * Embedding model routed through OpenRouter.
 * Must match the model used in the ingestion pipeline
 * (packages/docs-pipeline/src/embedding/client.ts).
 */
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Generates a single embedding vector for a search query.
 *
 * Why: The RAG pipeline needs to convert natural language queries
 * into the same vector space as the stored document chunks.
 * Uses the same model as ingestion to ensure compatibility.
 *
 * @param text - The search query text
 * @returns 1536-dimensional embedding vector
 * @throws Error if OPENROUTER_API_KEY is missing or API call fails
 */
export async function getQueryEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }

  const openrouter = createOpenRouter({ apiKey });

  const { embedding } = await embed({
    model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });

  return embedding;
}
```

**Step 2: Remove @ai-sdk/openai from packages/ai/package.json**

In `packages/ai/package.json`, remove this line from `dependencies`:

```
"@ai-sdk/openai": "^3.0.37",
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm --filter @smartout/ai exec -- npx tsc --noEmit`
Expected: Clean compilation, no errors.

**Step 4: Commit**

```bash
git add packages/ai/src/embedding.ts packages/ai/package.json
git commit -m "fix(ai): replace @ai-sdk/openai with OpenRouter for embeddings

OpenRouter supports embeddings via textEmbeddingModel(). No separate
OPENAI_API_KEY needed — uses existing OPENROUTER_API_KEY."
```

---

### Task 2: Fix embedding client in docs-pipeline

**Files:**

- Modify: `packages/docs-pipeline/src/embedding/client.ts`
- Modify: `packages/docs-pipeline/package.json`

**Step 1: Rewrite embedding client to use OpenRouter**

Replace the full file content of `packages/docs-pipeline/src/embedding/client.ts` with:

```typescript
// ============================================
// client.ts
// OpenRouter embedding client for generating document embeddings.
// Uses text-embedding-3-small (1536 dims) via OpenRouter.
// Connected to: src/commands/ingest.ts (called during ingestion)
// Connected to: ADR-0031 (embedding model decision)
// ============================================

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embedMany } from "ai";

/** Maximum texts per embedding API call to stay within limits */
const EMBEDDING_BATCH_SIZE = 100;

/**
 * The embedding model routed through OpenRouter.
 * Must match the model used in the query embedding helper
 * (packages/ai/src/embedding.ts).
 */
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Generates embeddings for an array of text strings.
 *
 * Why: Each document chunk needs a vector embedding for similarity search.
 * We use OpenAI's text-embedding-3-small model (1536 dimensions) routed
 * through OpenRouter for good quality at low cost.
 *
 * Auto-batches at 100 texts per API call to stay within API limits.
 *
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors (same order as input)
 * @throws Error if OPENROUTER_API_KEY is missing or API call fails
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }

  const openrouter = createOpenRouter({ apiKey });
  const allEmbeddings: number[][] = [];

  // Process in batches to stay within API limits
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    const { embeddings } = await embedMany({
      model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
      values: batch,
    });

    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
```

**Step 2: Update docs-pipeline package.json dependencies**

In `packages/docs-pipeline/package.json`:

1. Remove: `"@ai-sdk/openai": "^1.3.22"`
2. Add: `"@openrouter/ai-sdk-provider": "^2.2.3"`
3. Upgrade: `"ai": "^4.3.16"` → `"ai": "^6.0.103"` (must match @smartout/ai to avoid duplicate `ai` installs and type conflicts)

**Step 3: Run pnpm install**

Run: `pnpm install`
Expected: Lockfile updated, `@ai-sdk/openai` removed from docs-pipeline.

**Step 4: Verify TypeScript compiles**

Run: `pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
Expected: Clean compilation, no errors.

**Step 5: Commit**

```bash
git add packages/docs-pipeline/src/embedding/client.ts packages/docs-pipeline/package.json pnpm-lock.yaml
git commit -m "fix(docs-pipeline): replace @ai-sdk/openai with OpenRouter for embeddings

Aligns embedding provider with rest of codebase. Uses OPENROUTER_API_KEY
instead of separate OPENAI_API_KEY. Upgrades ai SDK to ^6.0.103."
```

---

### Task 3: Remove OPENAI_API_KEY from env validation

**Files:**

- Modify: `apps/web/src/env.ts`

**Step 1: Remove the OPENAI_API_KEY line**

In `apps/web/src/env.ts`, remove line 21:

```typescript
    OPENAI_API_KEY: z.string().startsWith("sk-").optional(),
```

**Step 2: Verify the app builds**

Run: `pnpm --filter web exec -- npx tsc --noEmit`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add apps/web/src/env.ts
git commit -m "fix(env): remove OPENAI_API_KEY — embeddings use OPENROUTER_API_KEY"
```

---

### Task 4: Update ADR-0031 to reflect OpenRouter

**Files:**

- Modify: `docs/decisions/0031-documentation-rag-pgvector.md`

**Step 1: Update the ADR content**

Make these changes in `docs/decisions/0031-documentation-rag-pgvector.md`:

1. In **Decision Drivers** (line 23), change:

   ```
   - OpenRouter (current AI provider) does not offer embedding endpoints
   ```

   to:

   ```
   - OpenRouter (current AI provider) supports embedding endpoints via `textEmbeddingModel()`
   ```

2. In **Embedding Model** section (lines 37-39), change:

   ```
   - **Model:** OpenAI `text-embedding-3-small` (1536 dimensions)
   - **Provider:** `@ai-sdk/openai` (direct, not through OpenRouter — OpenRouter lacks embedding support)
   - **Cost:** ~$0.02 per million tokens — negligible for 150 docs
   ```

   to:

   ```
   - **Model:** `openai/text-embedding-3-small` (1536 dimensions)
   - **Provider:** `@openrouter/ai-sdk-provider` — same provider as LLM calls, uses `OPENROUTER_API_KEY`
   - **Cost:** ~$0.02 per million tokens — negligible for 150 docs
   ```

3. In **Rules & Consequences** (line 71), change:
   ```
   - **Bad, because** requires `OPENAI_API_KEY` as a new secret (separate from OpenRouter)
   ```
   to:
   ```
   - **Good, because** uses existing `OPENROUTER_API_KEY` — no new secrets needed
   ```

**Step 2: Commit**

```bash
git add docs/decisions/0031-documentation-rag-pgvector.md
git commit -m "docs(adr-0031): update to reflect OpenRouter for embeddings

OpenRouter now supports embeddings. No separate OPENAI_API_KEY needed."
```

---

### Task 5: Fix ingest.ts header comment

**Files:**

- Modify: `packages/docs-pipeline/src/commands/ingest.ts`

**Step 1: Update file header**

In `packages/docs-pipeline/src/commands/ingest.ts`, change line 8:

```
// Connected to: src/embedding/client.ts (OpenAI embeddings)
```

to:

```
// Connected to: src/embedding/client.ts (OpenRouter embeddings)
```

**Step 2: Commit**

```bash
git add packages/docs-pipeline/src/commands/ingest.ts
git commit -m "fix(docs-pipeline): correct comment — OpenRouter not OpenAI"
```

---

### Task 6: Verify full build and run dry-run

**Step 1: Typecheck both packages**

Run: `pnpm --filter @smartout/ai exec -- npx tsc --noEmit && pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
Expected: Both compile cleanly.

**Step 2: Verify no OPENAI_API_KEY references remain in source**

Run: `grep -r "OPENAI_API_KEY" --include="*.ts" --include="*.json" packages/ apps/web/src/env.ts`
Expected: Zero matches.

**Step 3: Verify no @ai-sdk/openai imports remain**

Run: `grep -r "@ai-sdk/openai" --include="*.ts" --include="*.json" packages/`
Expected: Zero matches.

**Step 4: Run validation to make sure it still works**

Run: `pnpm docs:validate`
Expected: Runs successfully (same results as before).

**Step 5: Run dry-run ingest**

Run: `pnpm docs:ingest:dry-run`
Expected: Discovers files, reports what would happen, no API calls made.

---

## Verification Checklist

After all tasks:

- [ ] `pnpm --filter @smartout/ai exec -- npx tsc --noEmit` passes
- [ ] `pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit` passes
- [ ] Zero `OPENAI_API_KEY` references in source code
- [ ] Zero `@ai-sdk/openai` imports in source code
- [ ] `pnpm docs:validate` runs successfully
- [ ] `pnpm docs:ingest:dry-run` runs successfully
- [ ] ADR-0031 reflects OpenRouter as the embedding provider
- [ ] Only `OPENROUTER_API_KEY` is needed for the full pipeline

## Secret Management

| Secret               | Action                                                     |
| -------------------- | ---------------------------------------------------------- |
| `OPENAI_API_KEY`     | **NOT NEEDED.** Remove from .env.template if it was added. |
| `OPENROUTER_API_KEY` | Already exists. Used for both LLM and embeddings.          |
