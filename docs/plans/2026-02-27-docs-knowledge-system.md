---
title: "Documentation Knowledge System Implementation Plan"
id: PLAN_KNOWLEDGE_SYS
version: "1.0"
status: canonical
layer: plan
created: 2026-02-27
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags:
  - plan
  - knowledge-system
  - rag
  - pgvector
  - documentation
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Documentation Knowledge System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-ingest docs into pgvector, provide RAG retrieval tools for AI agents, enforce doc structure/ADR compliance, and harden ingestion with git-aware change detection, duplicate alerts, and concurrency safety.

**Architecture:** File watcher detects changes in `docs/` (or git diff mode) → chunks markdown → embeds via OpenAI `text-embedding-3-small` → stores in Supabase `platform_doc_chunk` table (pgvector). AI agents query via `match_platform_docs()` RPC. Validation CLI enforces ADR consistency and doc structure. Ingestion reports duplicate candidates and uses a lock to prevent concurrent write runs.

**Tech Stack:** Supabase pgvector, `@ai-sdk/openai` + Vercel AI SDK `embed()`/`embedMany()`, `commander` CLI, `chokidar` file watcher, `gray-matter` frontmatter parser, `tsx` runtime.

---

## Phase A: Foundation (Migration + ADRs)

### Task 1: Create ADR-0017 (RAG + pgvector)

**Files:**

- Create: `docs/decisions/0017-doc-rag-pgvector.md`

**Step 1: Write ADR-0017**

```markdown
# ADR-0017: Documentation RAG with pgvector

**Date:** 2026-02-27
**Status:** Accepted

## Context and Problem Statement

The `docs/` folder contains 67+ markdown files (module specs, ADRs, architecture docs, research) that serve as the project's knowledge base. Currently these docs are not programmatically accessible — AI agents must be manually pointed at specific files. We need a way for agents to semantically search and retrieve relevant documentation at runtime.

## Decision Drivers

- AI agents need runtime access to project documentation for accurate responses
- Manual doc references don't scale as the doc count grows
- Embedding-based retrieval gives semantic matching, not just keyword search
- Cost must be negligible for a 67-file corpus

## Considered Options

- Option A: pgvector in Supabase (existing infrastructure)
- Option B: Pinecone or Weaviate (external vector DB)
- Option C: In-memory embedding search (no persistence)

## Decision Outcome

Chosen option: "pgvector in Supabase", because it uses existing infrastructure, has zero additional hosting cost, and PostgreSQL's pgvector extension is production-ready with HNSW indexing.

### Embedding Model

OpenAI `text-embedding-3-small` (1536 dimensions) via `@ai-sdk/openai`. Chosen for cost (~$0.005 for full corpus), multilingual support (Norwegian + English docs), and standard dimensionality. OpenRouter does not offer embedding endpoints, so we use OpenAI directly.

### Table Design

`platform_doc_chunk` — platform-level table (NO `workspace_id`, NO RLS). Documentation is project knowledge, not tenant data. Accessed via service-role client only.

### Chunking Strategy

- ADRs and roadmaps: whole file (atomic, typically <2000 tokens)
- Module specs, architecture, research: split on `## ` headings, sub-split on `### ` if >1200 tokens
- Target chunk size: 800 tokens, max 1200 tokens
- Each chunk gets a context header with source path and doc type

## Rules & Consequences enforced for Agents

- **Good, because** agents can semantically search all project docs at runtime
- **Good, because** zero additional infrastructure cost (Supabase pgvector)
- **Good, because** auto-ingestion keeps embeddings in sync with doc changes
- **Bad, because** requires `OPENAI_API_KEY` as a new secret (managed via 1Password)
- **Agent Impact:** New tools `search_platform_docs` and `get_doc_by_path` available in `@smartout/ai`. Use these to find relevant docs before making architectural decisions. The `platform_doc_chunk` table is platform-level — never apply RLS, always use service-role client.
```

**Step 2: Verify file exists**

Run: `cat docs/decisions/0017-doc-rag-pgvector.md | head -3`
Expected: `# ADR-0017: Documentation RAG with pgvector`

---

### Task 2: Create ADR-0018 (Enforcement Pipeline)

**Files:**

- Create: `docs/decisions/0018-doc-enforcement-pipeline.md`

**Step 1: Write ADR-0018**

```markdown
# ADR-0018: Documentation Enforcement Pipeline

**Date:** 2026-02-27
**Status:** Accepted

## Context and Problem Statement

The project enforces ADR creation for architectural decisions (per CLAUDE.md), but there is no automated validation that ADRs are properly registered, that the decision log matches filesystem state, or that docs follow consistent structure. Manual compliance checking is error-prone and gets skipped.

## Decision Drivers

- ADR log (`0000-decision-log.md`) can drift from filesystem state
- CLAUDE.md ADR table can drift from the decision log
- No enforcement of doc structure conventions
- Agents may create ADRs without registering them

## Considered Options

- Option A: CLI validation tool in `packages/docs-pipeline`
- Option B: Git pre-commit hook with shell script
- Option C: CI-only validation (GitHub Actions)

## Decision Outcome

Chosen option: "CLI validation tool in `packages/docs-pipeline`", because it can run locally during development, in CI, and be invoked by agents. A dedicated package keeps tooling separate from runtime code.

### Validation Rules

| Rule                      | Severity | Description                                                                               |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| ADR log consistency       | FAIL     | Every `NNNN-*.md` in `docs/decisions/` is listed in `0000-decision-log.md` and vice versa |
| ADR required fields       | FAIL     | Each ADR has Status, Date, Context section, Decision section                              |
| Frontmatter (plans)       | FAIL     | All `docs/plans/` files have YAML frontmatter                                             |
| Frontmatter (other)       | WARN     | Other docs missing frontmatter                                                            |
| Cross-reference integrity | WARN     | "See Module N" references point to existing files                                         |
| Module structure          | WARN     | Module specs have a `## ` overview section                                                |

### Package Location

`packages/docs-pipeline` — shared between ingestion (Task ADR-0017) and enforcement. CLI interface via `commander`.

## Rules & Consequences enforced for Agents

- **Good, because** catches ADR registration drift before it causes confusion
- **Good, because** runs locally and in CI
- **Agent Impact:** After creating any ADR, run `pnpm docs:validate` to verify registration. After modifying doc structure, run validation to catch issues. The validate command exits non-zero on FAIL severity rules — use `--strict` to also fail on WARNs.
```

**Step 2: Verify file exists**

Run: `cat docs/decisions/0018-doc-enforcement-pipeline.md | head -3`
Expected: `# ADR-0018: Documentation Enforcement Pipeline`

---

### Task 3: Update Decision Log and CLAUDE.md

**Files:**

- Modify: `docs/decisions/0000-decision-log.md` (append 2 rows)
- Modify: `CLAUDE.md` (ADR table + monorepo structure)

**Step 1: Append ADR-0017 and ADR-0018 to decision log**

Add these two rows to the end of the table in `docs/decisions/0000-decision-log.md`:

```markdown
| ADR-0017 | 27-02-2026 | [Documentation RAG with pgvector](./0017-doc-rag-pgvector.md) | **Accepted** |
| ADR-0018 | 27-02-2026 | [Documentation Enforcement Pipeline](./0018-doc-enforcement-pipeline.md) | **Accepted** |
```

**Step 2: Update CLAUDE.md ADR table**

Add to the ADR table in `CLAUDE.md`:

```markdown
| 0017 | Documentation RAG with pgvector | Database/AI |
| 0018 | Documentation enforcement pipeline | Tooling |
```

**Step 3: Update CLAUDE.md monorepo structure**

Add `docs-pipeline` to the `packages/` section in the monorepo structure diagram:

```
├── packages/
│   ├── ai/               → AI SDK agents, tools, adapters (@smartout/ai)
│   ├── docs-pipeline/    → Doc ingestion, embedding, validation (@smartout/docs-pipeline)
│   ├── types/            → Zod schemas, builds to dist/ (@smartout/types)
```

**Step 4: Verify decision log has 18 entries**

Run: `grep -c "ADR-" docs/decisions/0000-decision-log.md`
Expected: `18`

---

### Task 4: Write Supabase Migration

**Files:**

- Create: `supabase/migrations/20260227200000_platform_doc_embeddings.sql`

**Step 1: Write migration file**

```sql
-- Migration: Platform documentation embeddings for RAG
-- ADR-0017: Documentation RAG with pgvector

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create doc_type enum
CREATE TYPE public.doc_type AS ENUM (
  'adr',
  'module',
  'architecture',
  'cross_cutting',
  'plan',
  'research',
  'roadmap',
  'other'
);

-- 3. Create platform_doc_chunk table
-- Platform-level: NO workspace_id, NO RLS. Service-role access only.
CREATE TABLE public.platform_doc_chunk (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_path TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  doc_type public.doc_type NOT NULL DEFAULT 'other',
  chunk_index INTEGER NOT NULL DEFAULT 0,
  section_title TEXT,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_path, chunk_index)
);

-- 4. Trigger for updated_at (reuses existing set_updated_at function from 00001)
CREATE TRIGGER set_platform_doc_chunk_updated_at
  BEFORE UPDATE ON public.platform_doc_chunk
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. HNSW index for cosine similarity search
CREATE INDEX platform_doc_chunk_embedding_idx
  ON public.platform_doc_chunk
  USING hnsw (embedding vector_cosine_ops);

-- 6. B-tree indexes for filtering
CREATE INDEX platform_doc_chunk_source_path_idx
  ON public.platform_doc_chunk (source_path);

CREATE INDEX platform_doc_chunk_doc_type_idx
  ON public.platform_doc_chunk (doc_type);

-- 7. RPC function for vector similarity search
CREATE OR REPLACE FUNCTION public.match_platform_docs(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.5,
  filter_doc_type public.doc_type DEFAULT NULL,
  filter_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  chunk_id UUID,
  source_path TEXT,
  doc_type public.doc_type,
  chunk_index INTEGER,
  section_title TEXT,
  content TEXT,
  token_count INTEGER,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pdc.chunk_id,
    pdc.source_path,
    pdc.doc_type,
    pdc.chunk_index,
    pdc.section_title,
    pdc.content,
    pdc.token_count,
    pdc.metadata,
    (1 - (pdc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.platform_doc_chunk pdc
  WHERE
    (filter_doc_type IS NULL OR pdc.doc_type = filter_doc_type)
    AND (filter_metadata = '{}'::jsonb OR pdc.metadata @> filter_metadata)
    AND (1 - (pdc.embedding <=> query_embedding)) > match_threshold
  ORDER BY pdc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Step 2: Verify migration file syntax**

Run: `head -5 supabase/migrations/20260227200000_platform_doc_embeddings.sql`
Expected: `-- Migration: Platform documentation embeddings for RAG`

---

### Task 5: Apply Migration and Regenerate Types

**Step 1: Reset local Supabase to apply migration**

Run: `npx supabase db reset`
Expected: All migrations apply successfully, including the new one. Look for `20260227200000_platform_doc_embeddings` in output.

**Step 2: Verify pgvector is enabled**

Run: `npx supabase db query "SELECT extname FROM pg_extension WHERE extname = 'vector'"`
Expected: One row with `vector`

**Step 3: Verify table exists**

Run: `npx supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name = 'platform_doc_chunk' ORDER BY ordinal_position"`
Expected: Columns listed (chunk_id, source_path, source_hash, doc_type, etc.)

**Step 4: Verify RPC function exists**

Run: `npx supabase db query "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'match_platform_docs'"`
Expected: One row with `match_platform_docs`

**Step 5: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File regenerated. Should contain `platform_doc_chunk` table type and `match_platform_docs` function type.

**Step 6: Verify types contain new table**

Run: `grep "platform_doc_chunk" packages/supabase/src/database.types.ts | head -3`
Expected: Type definitions referencing the new table.

---

### Task 6: Commit Phase A

Run:

```bash
git add docs/decisions/0017-doc-rag-pgvector.md docs/decisions/0018-doc-enforcement-pipeline.md docs/decisions/0000-decision-log.md CLAUDE.md supabase/migrations/20260227200000_platform_doc_embeddings.sql packages/supabase/src/database.types.ts
git commit -m "feat: add pgvector migration and ADRs for doc knowledge system

ADR-0017: Documentation RAG with pgvector
ADR-0018: Documentation enforcement pipeline
Migration: platform_doc_chunk table with HNSW index and match_platform_docs RPC"
```

---

## Phase B: Ingestion Pipeline (`packages/docs-pipeline`)

### Task 7: Create Package Scaffold

**Files:**

- Create: `packages/docs-pipeline/package.json`
- Create: `packages/docs-pipeline/tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "@smartout/docs-pipeline",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "ingest": "tsx src/index.ts ingest",
    "ingest:force": "tsx src/index.ts ingest --force",
    "ingest:dry-run": "tsx src/index.ts ingest --dry-run",
    "validate": "tsx src/index.ts validate",
    "validate:strict": "tsx src/index.ts validate --strict",
    "watch": "tsx src/index.ts watch"
  },
  "dependencies": {
    "@ai-sdk/openai": "^1.3.22",
    "@smartout/ai": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "ai": "^6.0.103",
    "chokidar": "^4.0.3",
    "commander": "^13.1.0",
    "gray-matter": "^4.0.3",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

**Step 3: Verify files created**

Run: `ls packages/docs-pipeline/`
Expected: `package.json tsconfig.json`

---

### Task 8: Register Package in Workspace

**Files:**

- Modify: `turbo.json` (add tasks)
- Modify: `package.json` (root — add scripts)

**Step 1: Add tasks to turbo.json**

Add `docs:ingest` and `docs:validate` tasks. The final `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "docs:ingest": {
      "cache": false
    },
    "docs:validate": {
      "cache": false
    }
  }
}
```

**Step 2: Add scripts to root package.json**

Add to `"scripts"` in root `package.json`:

```json
"docs:ingest": "pnpm --filter @smartout/docs-pipeline ingest",
"docs:ingest:force": "pnpm --filter @smartout/docs-pipeline ingest:force",
"docs:ingest:dry-run": "pnpm --filter @smartout/docs-pipeline ingest:dry-run",
"docs:validate": "pnpm --filter @smartout/docs-pipeline validate",
"docs:validate:strict": "pnpm --filter @smartout/docs-pipeline validate:strict",
"docs:watch": "pnpm --filter @smartout/docs-pipeline watch"
```

**Step 3: Verify pnpm-workspace.yaml already includes packages/\***

Run: `cat pnpm-workspace.yaml`
Expected: Contains `- "packages/*"` (already present — no change needed).

---

### Task 9: Install Dependencies

**Step 1: Install all dependencies**

Run: `pnpm install`
Expected: Dependencies installed for `@smartout/docs-pipeline` and any hoisted deps.

**Step 2: Verify docs-pipeline is recognized**

Run: `pnpm --filter @smartout/docs-pipeline exec -- node -e "console.log('ok')"`
Expected: `ok`

---

### Task 10: Write Hash Utility

**Files:**

- Create: `packages/docs-pipeline/src/utils/hash.ts`

**Step 1: Write hash utility**

```typescript
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, "utf-8");
  return createHash("sha256").update(content).digest("hex");
}

export function hashString(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
Expected: No errors (may warn about missing src/index.ts — that's fine for now).

---

### Task 11: Write Token Estimation Utility

**Files:**

- Create: `packages/docs-pipeline/src/utils/tokens.ts`

**Step 1: Write token estimator**

```typescript
/**
 * Rough token count estimation.
 * English text averages ~4 chars/token. Markdown/code is slightly higher.
 * This is for chunking decisions, not billing — precision isn't critical.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

---

### Task 12: Write Metadata Extractor

**Files:**

- Create: `packages/docs-pipeline/src/chunking/metadata-extractor.ts`

**Step 1: Write metadata extractor**

This detects doc type from file path and extracts metadata from markdown content. Existing docs do NOT use YAML frontmatter — they use inline `**Status:**` and `**Date:**` patterns. We handle both.

```typescript
import matter from "gray-matter";
import path from "node:path";

export type DocType =
  | "adr"
  | "module"
  | "architecture"
  | "cross_cutting"
  | "plan"
  | "research"
  | "roadmap"
  | "other";

export type DocMetadata = {
  title: string | null;
  doc_type: DocType;
  status: string | null;
  date: string | null;
  tags: string[];
  frontmatter: Record<string, unknown>;
};

/**
 * Detect doc_type from relative file path.
 * Path is relative to repo root, e.g. "docs/decisions/0010-ai-sdk-openrouter.md"
 */
export function detectDocType(relativePath: string): DocType {
  const normalized = relativePath.replace(/\\/g, "/");

  if (normalized.includes("docs/decisions/") && !normalized.endsWith("template.md")) {
    return "adr";
  }
  if (normalized.includes("docs/modules/")) return "module";
  if (normalized.includes("docs/architecture/")) return "architecture";
  if (normalized.includes("docs/cross-cutting/")) return "cross_cutting";
  if (normalized.includes("docs/plans/")) return "plan";
  if (normalized.includes("docs/research/")) return "research";
  if (normalized.includes("docs/roadmaps/")) return "roadmap";
  return "other";
}

/**
 * Extract metadata from markdown content.
 * Handles both YAML frontmatter and inline metadata (existing ADR format).
 */
export function extractMetadata(content: string, relativePath: string): DocMetadata {
  const doc_type = detectDocType(relativePath);

  // Try YAML frontmatter first
  const { data: frontmatter, content: body } = matter(content);

  // Extract title from first # heading
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = (frontmatter.title as string) || titleMatch?.[1] || null;

  // Extract status — YAML or inline **Status:** pattern
  const status =
    (frontmatter.status as string) || content.match(/\*\*Status:\*\*\s*(.+)/)?.[1]?.trim() || null;

  // Extract date — YAML or inline **Date:** pattern
  const date =
    (frontmatter.date as string) || content.match(/\*\*Date:\*\*\s*(.+)/)?.[1]?.trim() || null;

  // Extract tags from YAML frontmatter only
  const tags = Array.isArray(frontmatter.tags) ? (frontmatter.tags as string[]) : [];

  return { title, doc_type, status, date, tags, frontmatter };
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
Expected: No errors.

---

### Task 13: Write Chunking Engine

**Files:**

- Create: `packages/docs-pipeline/src/chunking/chunker.ts`

**Step 1: Write chunking engine**

```typescript
import { estimateTokens } from "../utils/tokens.js";
import { extractMetadata, type DocMetadata, type DocType } from "./metadata-extractor.js";

export type Chunk = {
  source_path: string;
  source_hash: string;
  doc_type: DocType;
  chunk_index: number;
  section_title: string | null;
  content: string;
  token_count: number;
  metadata: Record<string, unknown>;
};

type ChunkStrategy = {
  splitOnH2: boolean;
  subSplitOnH3: boolean;
  maxTokens: number;
  overlap: number; // sentences of overlap
};

const STRATEGIES: Record<DocType, ChunkStrategy> = {
  adr: { splitOnH2: false, subSplitOnH3: false, maxTokens: Infinity, overlap: 0 },
  roadmap: { splitOnH2: false, subSplitOnH3: false, maxTokens: Infinity, overlap: 0 },
  module: { splitOnH2: true, subSplitOnH3: true, maxTokens: 1200, overlap: 1 },
  architecture: { splitOnH2: true, subSplitOnH3: true, maxTokens: 1200, overlap: 2 },
  cross_cutting: { splitOnH2: true, subSplitOnH3: false, maxTokens: 1200, overlap: 1 },
  plan: { splitOnH2: true, subSplitOnH3: false, maxTokens: 1200, overlap: 0 },
  research: { splitOnH2: true, subSplitOnH3: true, maxTokens: 1200, overlap: 2 },
  other: { splitOnH2: true, subSplitOnH3: false, maxTokens: 1200, overlap: 1 },
};

/**
 * Build a context header prepended to each chunk for embedding clarity.
 */
function contextHeader(sourcePath: string, docType: DocType, meta: DocMetadata): string {
  const parts = [`Source: ${sourcePath}`, `Type: ${docType}`];
  if (meta.status) parts.push(`Status: ${meta.status}`);
  return `[${parts.join(" | ")}]\n\n`;
}

/**
 * Split markdown content on ## headings.
 * Returns array of { title, content } where content includes the heading.
 */
function splitOnH2(content: string): Array<{ title: string | null; content: string }> {
  const sections: Array<{ title: string | null; content: string }> = [];
  const lines = content.split("\n");
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentLines.length > 0) {
        sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
      }
      currentTitle = line.replace(/^##\s+/, "");
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
  }

  return sections;
}

/**
 * Sub-split a section on ### headings if it exceeds maxTokens.
 */
function subSplitOnH3(
  content: string,
  maxTokens: number,
): Array<{ title: string | null; content: string }> {
  if (estimateTokens(content) <= maxTokens) {
    return [{ title: null, content }];
  }

  const sections: Array<{ title: string | null; content: string }> = [];
  const lines = content.split("\n");
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("### ")) {
      if (currentLines.length > 0) {
        sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
      }
      currentTitle = line.replace(/^###\s+/, "");
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
  }

  return sections.length > 1 ? sections : [{ title: null, content }];
}

/**
 * Get the last N sentences from a text for overlap.
 */
function getOverlapSentences(text: string, count: number): string {
  if (count === 0) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(-count).join("").trim();
}

/**
 * Chunk a markdown document into embedding-ready pieces.
 */
export function chunkDocument(content: string, sourcePath: string, sourceHash: string): Chunk[] {
  const meta = extractMetadata(content, sourcePath);
  const strategy = STRATEGIES[meta.doc_type];
  const header = contextHeader(sourcePath, meta.doc_type, meta);
  const baseMeta = {
    title: meta.title,
    status: meta.status,
    date: meta.date,
    tags: meta.tags,
  };

  // Whole-file strategy (ADRs, roadmaps)
  if (!strategy.splitOnH2) {
    const chunkContent = header + content;
    return [
      {
        source_path: sourcePath,
        source_hash: sourceHash,
        doc_type: meta.doc_type,
        chunk_index: 0,
        section_title: meta.title,
        content: chunkContent,
        token_count: estimateTokens(chunkContent),
        metadata: baseMeta,
      },
    ];
  }

  // Split on ## headings
  const h2Sections = splitOnH2(content);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  let previousContent = "";

  for (const section of h2Sections) {
    // Sub-split if needed and enabled
    const subSections = strategy.subSplitOnH3
      ? subSplitOnH3(section.content, strategy.maxTokens)
      : [{ title: null, content: section.content }];

    for (const sub of subSections) {
      const overlap = getOverlapSentences(previousContent, strategy.overlap);
      const rawContent = overlap ? `${overlap}\n\n${sub.content}` : sub.content;
      const chunkContent = header + rawContent;
      const sectionTitle = sub.title || section.title;

      chunks.push({
        source_path: sourcePath,
        source_hash: sourceHash,
        doc_type: meta.doc_type,
        chunk_index: chunkIndex,
        section_title: sectionTitle,
        content: chunkContent,
        token_count: estimateTokens(chunkContent),
        metadata: { ...baseMeta, section: sectionTitle },
      });

      previousContent = sub.content;
      chunkIndex++;
    }
  }

  return chunks;
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
Expected: No errors.

---

### Task 14: Commit utilities and chunking

Run:

```bash
git add packages/docs-pipeline/package.json packages/docs-pipeline/tsconfig.json packages/docs-pipeline/src/utils/ packages/docs-pipeline/src/chunking/ turbo.json package.json
git commit -m "feat: add docs-pipeline package with chunking engine and utilities

Package scaffold, token estimation, SHA-256 hashing, metadata extraction,
and markdown chunking with per-doc-type strategies."
```

---

### Task 15: Write Supabase Service-Role Client

**Files:**

- Create: `packages/docs-pipeline/src/db/client.ts`

**Step 1: Write client**

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Get a service-role Supabase client for platform operations.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
 */
export function getServiceClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable");
  }
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return client;
}
```

---

### Task 16: Write Database Operations

**Files:**

- Create: `packages/docs-pipeline/src/db/operations.ts`

**Step 1: Write CRUD operations**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chunk } from "../chunking/chunker.js";

export type ChunkWithEmbedding = Chunk & {
  embedding: number[];
};

type ExistingDoc = {
  source_path: string;
  source_hash: string;
};

/**
 * Fetch all existing source_path + source_hash pairs for change detection.
 */
export async function getExistingHashes(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("platform_doc_chunk")
    .select("source_path, source_hash")
    .order("source_path");

  if (error) throw new Error(`Failed to fetch existing hashes: ${error.message}`);

  // Deduplicate by source_path (multiple chunks per file)
  const map = new Map<string, string>();
  for (const row of (data as ExistingDoc[]) || []) {
    map.set(row.source_path, row.source_hash);
  }
  return map;
}

/**
 * Delete all chunks for the given source paths.
 */
export async function deleteChunksForPaths(
  supabase: SupabaseClient,
  paths: string[],
): Promise<number> {
  if (paths.length === 0) return 0;

  const { error, count } = await supabase
    .from("platform_doc_chunk")
    .delete({ count: "exact" })
    .in("source_path", paths);

  if (error) throw new Error(`Failed to delete chunks: ${error.message}`);
  return count ?? 0;
}

/**
 * Insert chunks with embeddings in batches.
 */
export async function insertChunks(
  supabase: SupabaseClient,
  chunks: ChunkWithEmbedding[],
): Promise<number> {
  if (chunks.length === 0) return 0;

  // Insert in batches of 50 to avoid payload size limits
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE).map((c) => ({
      source_path: c.source_path,
      source_hash: c.source_hash,
      doc_type: c.doc_type,
      chunk_index: c.chunk_index,
      section_title: c.section_title,
      content: c.content,
      token_count: c.token_count,
      metadata: c.metadata,
      embedding: JSON.stringify(c.embedding),
    }));

    const { error } = await supabase.from("platform_doc_chunk").insert(batch);

    if (error) throw new Error(`Failed to insert chunks (batch ${i}): ${error.message}`);
    inserted += batch.length;
  }

  return inserted;
}
```

---

### Task 17: Write Embedding Client

**Files:**

- Create: `packages/docs-pipeline/src/embedding/client.ts`

**Step 1: Write embedding client**

```typescript
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

/**
 * Generate embeddings for an array of text strings.
 * Automatically batches if input exceeds BATCH_SIZE.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = openai.embedding(EMBEDDING_MODEL);
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({ model, values: batch });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
```

---

### Task 18: Write Ingest Command

**Files:**

- Create: `packages/docs-pipeline/src/commands/ingest.ts`

**Step 1: Write ingest command**

```typescript
import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { glob } from "node:fs/promises";
import { hashString } from "../utils/hash.js";
import { chunkDocument } from "../chunking/chunker.js";
import { generateEmbeddings } from "../embedding/client.js";
import { getServiceClient } from "../db/client.js";
import {
  getExistingHashes,
  deleteChunksForPaths,
  insertChunks,
  type ChunkWithEmbedding,
} from "../db/operations.js";

type IngestOptions = {
  force?: boolean;
  dryRun?: boolean;
};

/**
 * Discover all markdown files in docs/ (excluding templates).
 */
async function discoverDocs(repoRoot: string): Promise<string[]> {
  const docsDir = resolve(repoRoot, "docs");
  const files: string[] = [];

  // Use recursive readdir with glob pattern
  for await (const entry of glob("**/*.md", { cwd: docsDir })) {
    const fileName = typeof entry === "string" ? entry : entry.toString();
    // Skip template files and decision log index
    if (fileName.endsWith("template.md")) continue;
    if (fileName === "decisions/0000-decision-log.md") continue;
    if (fileName === "learnings/0000-learning-log.md") continue;
    files.push(`docs/${fileName.replace(/\\/g, "/")}`);
  }

  return files.sort();
}

export async function runIngest(options: IngestOptions = {}): Promise<void> {
  const repoRoot = resolve(process.cwd(), "../..");
  const supabase = getServiceClient();

  console.log("Discovering docs...");
  const docPaths = await discoverDocs(repoRoot);
  console.log(`Found ${docPaths.length} documents.`);

  // Hash all files
  console.log("Hashing files...");
  const fileHashes = new Map<string, string>();
  for (const docPath of docPaths) {
    const fullPath = resolve(repoRoot, docPath);
    const content = await readFile(fullPath, "utf-8");
    fileHashes.set(docPath, hashString(content));
  }

  // Get existing hashes from DB
  const existingHashes = options.force
    ? new Map<string, string>()
    : await getExistingHashes(supabase);

  // Determine changes
  const newFiles: string[] = [];
  const changedFiles: string[] = [];
  const unchangedFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const [path, hash] of fileHashes) {
    const existing = existingHashes.get(path);
    if (!existing) {
      newFiles.push(path);
    } else if (existing !== hash) {
      changedFiles.push(path);
    } else {
      unchangedFiles.push(path);
    }
  }

  for (const path of existingHashes.keys()) {
    if (!fileHashes.has(path)) {
      deletedFiles.push(path);
    }
  }

  // Report
  console.log(`\nChange summary:`);
  console.log(`  New:       ${newFiles.length}`);
  console.log(`  Changed:   ${changedFiles.length}`);
  console.log(`  Deleted:   ${deletedFiles.length}`);
  console.log(`  Unchanged: ${unchangedFiles.length}`);

  if (options.dryRun) {
    if (newFiles.length > 0) {
      console.log(`\nNew files:`);
      newFiles.forEach((f) => console.log(`  + ${f}`));
    }
    if (changedFiles.length > 0) {
      console.log(`\nChanged files:`);
      changedFiles.forEach((f) => console.log(`  ~ ${f}`));
    }
    if (deletedFiles.length > 0) {
      console.log(`\nDeleted files:`);
      deletedFiles.forEach((f) => console.log(`  - ${f}`));
    }
    console.log("\nDry run complete. No changes made.");
    return;
  }

  const filesToProcess = [...newFiles, ...changedFiles];
  const filesToDelete = [...deletedFiles, ...changedFiles]; // Changed files: delete old, insert new

  if (filesToProcess.length === 0 && filesToDelete.length === 0) {
    console.log("\nNothing to do. All docs are up to date.");
    return;
  }

  // Delete old chunks
  if (filesToDelete.length > 0) {
    console.log(`\nDeleting old chunks for ${filesToDelete.length} files...`);
    const deleted = await deleteChunksForPaths(supabase, filesToDelete);
    console.log(`  Deleted ${deleted} chunks.`);
  }

  // Chunk new/changed files
  if (filesToProcess.length > 0) {
    console.log(`\nChunking ${filesToProcess.length} files...`);
    const allChunks: ReturnType<typeof chunkDocument> = [];

    for (const docPath of filesToProcess) {
      const fullPath = resolve(repoRoot, docPath);
      const content = await readFile(fullPath, "utf-8");
      const hash = fileHashes.get(docPath)!;
      const chunks = chunkDocument(content, docPath, hash);
      allChunks.push(...chunks);
    }

    console.log(`  Generated ${allChunks.length} chunks.`);

    // Generate embeddings
    console.log(`\nGenerating embeddings...`);
    const texts = allChunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts);

    // Combine chunks with embeddings
    const chunksWithEmbeddings: ChunkWithEmbedding[] = allChunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));

    // Insert into DB
    console.log(`Inserting ${chunksWithEmbeddings.length} chunks...`);
    const inserted = await insertChunks(supabase, chunksWithEmbeddings);
    console.log(`  Inserted ${inserted} chunks.`);
  }

  console.log("\nIngestion complete.");
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
Expected: No errors. Note: `node:fs/promises` `glob` is available in Node 22+. If the project uses Node 18-20, we may need `fast-glob` instead — check Node version.

---

### Task 19: Write Watch Command

**Files:**

- Create: `packages/docs-pipeline/src/commands/watch.ts`

**Step 1: Write watch command**

```typescript
import { watch as chokidarWatch } from "chokidar";
import { resolve } from "node:path";
import { runIngest } from "./ingest.js";

export function runWatch(): void {
  const repoRoot = resolve(process.cwd(), "../..");
  const docsDir = resolve(repoRoot, "docs");

  console.log(`Watching ${docsDir} for changes...`);
  console.log("Press Ctrl+C to stop.\n");

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = chokidarWatch("**/*.md", {
    cwd: docsDir,
    ignoreInitial: true,
    ignored: ["**/template.md"],
  });

  function scheduleIngest(event: string, path: string): void {
    console.log(`[${event}] ${path}`);

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      console.log("\nRe-ingesting changed docs...\n");
      try {
        await runIngest();
      } catch (err) {
        console.error("Ingestion failed:", err);
      }
      console.log("\nWatching for changes...\n");
    }, 3000);
  }

  watcher
    .on("add", (path) => scheduleIngest("add", path))
    .on("change", (path) => scheduleIngest("change", path))
    .on("unlink", (path) => scheduleIngest("delete", path));

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\nStopping watcher...");
    watcher.close();
    process.exit(0);
  });
}
```

---

### Task 20: Write CLI Entry Point

**Files:**

- Create: `packages/docs-pipeline/src/index.ts`

**Step 1: Write CLI with commander**

```typescript
import { Command } from "commander";
import { runIngest } from "./commands/ingest.js";
import { runWatch } from "./commands/watch.js";

const program = new Command();

program
  .name("docs-pipeline")
  .description("Documentation ingestion, embedding, and validation pipeline")
  .version("1.0.0");

program
  .command("ingest")
  .description("Ingest docs into vector database")
  .option("--force", "Re-embed all files regardless of hash")
  .option("--dry-run", "Show what would change without making changes")
  .action(async (options) => {
    try {
      await runIngest({
        force: options.force ?? false,
        dryRun: options.dryRun ?? false,
      });
    } catch (err) {
      console.error("Ingestion failed:", err);
      process.exit(1);
    }
  });

program
  .command("watch")
  .description("Watch docs/ for changes and auto-ingest")
  .action(() => {
    runWatch();
  });

program
  .command("validate")
  .description("Validate documentation structure and ADR compliance")
  .option("--strict", "Treat warnings as failures")
  .option("--rule <rule>", "Run a specific rule group (adr, frontmatter, structure)")
  .action(async (options) => {
    // Placeholder — implemented in Phase D
    console.log("Validate command not yet implemented.");
    console.log("Options:", options);
  });

program.parse();
```

**Step 2: Verify full TypeScript compilation**

Run: `pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
Expected: No errors.

---

### Task 21: Handle Node.js Glob Compatibility

The `node:fs/promises` `glob` function requires Node.js 22+. The project requires Node >= 18. We need to handle this.

**Files:**

- Modify: `packages/docs-pipeline/package.json` (add `fast-glob`)
- Modify: `packages/docs-pipeline/src/commands/ingest.ts` (use fast-glob)

**Step 1: Add fast-glob dependency**

Add to `dependencies` in `packages/docs-pipeline/package.json`:

```json
"fast-glob": "^3.3.3"
```

Run: `pnpm install`

**Step 2: Update ingest.ts to use fast-glob**

Replace the `discoverDocs` function and imports at the top of `packages/docs-pipeline/src/commands/ingest.ts`:

```typescript
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fg from "fast-glob";
import { hashString } from "../utils/hash.js";
import { chunkDocument } from "../chunking/chunker.js";
import { generateEmbeddings } from "../embedding/client.js";
import { getServiceClient } from "../db/client.js";
import {
  getExistingHashes,
  deleteChunksForPaths,
  insertChunks,
  type ChunkWithEmbedding,
} from "../db/operations.js";

// ... (IngestOptions type stays the same)

async function discoverDocs(repoRoot: string): Promise<string[]> {
  const entries = await fg("docs/**/*.md", {
    cwd: repoRoot,
    ignore: [
      "**/template.md",
      "docs/decisions/0000-decision-log.md",
      "docs/learnings/0000-learning-log.md",
    ],
  });

  return entries.sort();
}
```

The rest of `runIngest` stays the same. Just remove the `import { glob } from "node:fs/promises"` line.

---

### Task 22: Commit Phase B (Ingestion Pipeline)

Run:

```bash
git add packages/docs-pipeline/
git commit -m "feat: add docs-pipeline ingestion with embedding and file watcher

CLI tool for ingesting docs/ markdown files into Supabase pgvector.
Supports: ingest, ingest --force, ingest --dry-run, watch mode.
Uses OpenAI text-embedding-3-small via Vercel AI SDK."
```

---

## Phase C: RAG Retrieval (in `@smartout/ai`)

### Task 23: Create Embedding Helper in @smartout/ai

**Files:**

- Create: `packages/ai/src/embedding.ts`
- Modify: `packages/ai/package.json` (add `@ai-sdk/openai` dep + exports)

**Step 1: Add @ai-sdk/openai dependency to packages/ai/package.json**

Add to `"dependencies"`:

```json
"@ai-sdk/openai": "^1.3.22"
```

Add to `"exports"`:

```json
"./embedding": "./src/embedding.ts",
"./tools/docs": "./src/tools/docs.ts"
```

**Step 2: Write embedding helper**

```typescript
// packages/ai/src/embedding.ts

import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Generate a single embedding for a search query.
 * Used by RAG tools at runtime to embed user queries.
 */
export async function getQueryEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}
```

**Step 3: Install new dependency**

Run: `pnpm install`

---

### Task 24: Create Doc Retrieval Tools

**Files:**

- Create: `packages/ai/src/tools/docs.ts`

**Step 1: Write RAG tools following the defineTool pattern**

```typescript
// packages/ai/src/tools/docs.ts

import { z } from "zod";
import { defineTool } from "../types.js";
import { getQueryEmbedding } from "../embedding.js";
import type { SupabaseClient } from "@supabase/supabase-js";

type DocsToolCtx = {
  supabase: SupabaseClient<any, any, any>;
};

const searchSchema = z.object({
  query: z.string().describe("Natural language search query"),
  doc_type: z
    .enum([
      "adr",
      "module",
      "architecture",
      "cross_cutting",
      "plan",
      "research",
      "roadmap",
      "other",
    ])
    .optional()
    .describe("Filter by document type"),
  match_count: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Number of results to return (default 5)"),
});

const getDocSchema = z.object({
  source_path: z
    .string()
    .describe('Relative file path, e.g. "docs/decisions/0010-ai-sdk-openrouter.md"'),
});

export const searchPlatformDocs = defineTool<DocsToolCtx, typeof searchSchema>({
  name: "search_platform_docs",
  description:
    "Search platform documentation by semantic similarity. Returns relevant chunks from ADRs, module specs, architecture docs, and other project documentation.",
  schema: searchSchema,
  execute: async ({ query, doc_type, match_count }, { supabase }) => {
    const embedding = await getQueryEmbedding(query);

    const { data, error } = await supabase.rpc("match_platform_docs", {
      query_embedding: JSON.stringify(embedding),
      match_count: match_count ?? 5,
      match_threshold: 0.5,
      filter_doc_type: doc_type ?? null,
      filter_metadata: {},
    });

    if (error) return `Error searching docs: ${error.message}`;
    if (!data?.length) return "No matching documents found.";

    return (data as any[])
      .map(
        (chunk) =>
          `[${chunk.source_path}] (${chunk.doc_type}, similarity: ${chunk.similarity.toFixed(3)})\n${chunk.section_title ? `## ${chunk.section_title}\n` : ""}${chunk.content}`,
      )
      .join("\n\n---\n\n");
  },
});

export const getDocByPath = defineTool<DocsToolCtx, typeof getDocSchema>({
  name: "get_doc_by_path",
  description:
    "Fetch all chunks for a specific document by its file path. Returns the full document content reconstructed from chunks.",
  schema: getDocSchema,
  execute: async ({ source_path }, { supabase }) => {
    const { data, error } = await supabase
      .from("platform_doc_chunk")
      .select("chunk_index, section_title, content")
      .eq("source_path", source_path)
      .order("chunk_index");

    if (error) return `Error fetching doc: ${error.message}`;
    if (!data?.length) return `No document found at path: ${source_path}`;

    return (data as any[]).map((c) => c.content).join("\n\n");
  },
});

export const DOC_TOOLS = [searchPlatformDocs, getDocByPath] as const;
```

---

### Task 25: Update @smartout/ai Barrel Exports

**Files:**

- Modify: `packages/ai/src/index.ts`

**Step 1: Add doc tools and embedding exports**

Add to the end of `packages/ai/src/index.ts`:

```typescript
// Embedding
export { getQueryEmbedding } from "./embedding";

// Documentation tools
export { DOC_TOOLS, searchPlatformDocs, getDocByPath } from "./tools/docs";
```

**Step 2: Verify TypeScript compiles**

Run: `cd packages/ai && npx tsc --noEmit`
Expected: No errors.

---

### Task 26: Add OPENAI_API_KEY to Env Validation

**Files:**

- Modify: `apps/web/src/env.ts`

**Step 1: Add OPENAI_API_KEY**

Add to the `server` section in `apps/web/src/env.ts`, after `OPENROUTER_API_KEY`:

```typescript
OPENAI_API_KEY: z.string().startsWith("sk-").optional(),
```

---

### Task 27: Commit Phase C (RAG Retrieval)

Run:

```bash
git add packages/ai/src/embedding.ts packages/ai/src/tools/docs.ts packages/ai/src/index.ts packages/ai/package.json apps/web/src/env.ts
git commit -m "feat: add RAG retrieval tools to @smartout/ai

search_platform_docs: semantic search over embedded documentation
get_doc_by_path: fetch full document by file path
Uses OpenAI text-embedding-3-small via @ai-sdk/openai."
```

---

## Phase D: Enforcement Scripts

### Task 28: Write Frontmatter Validation

**Files:**

- Create: `packages/docs-pipeline/src/validation/frontmatter.ts`

**Step 1: Write frontmatter validation rules**

```typescript
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";

export type Severity = "FAIL" | "WARN" | "PASS";

export type ValidationResult = {
  rule: string;
  severity: Severity;
  message: string;
  file?: string;
};

/**
 * Check that plan files have YAML frontmatter.
 * Other doc types get a WARN if missing (not enforced yet).
 */
export async function validateFrontmatter(repoRoot: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Plans MUST have frontmatter
  const planFiles = await fg("docs/plans/**/*.md", {
    cwd: repoRoot,
    ignore: ["docs/plans/completed/**"],
  });

  for (const file of planFiles) {
    const content = await readFile(resolve(repoRoot, file), "utf-8");
    const { data } = matter(content);

    if (Object.keys(data).length === 0) {
      results.push({
        rule: "frontmatter-plans",
        severity: "FAIL",
        message: `Plan file missing YAML frontmatter`,
        file,
      });
    }
  }

  // Other docs: WARN if missing
  const otherFiles = await fg("docs/**/*.md", {
    cwd: repoRoot,
    ignore: ["docs/plans/**", "docs/decisions/**", "**/template.md", "docs/**/0000-*.md"],
  });

  let missingCount = 0;
  for (const file of otherFiles) {
    const content = await readFile(resolve(repoRoot, file), "utf-8");
    const { data } = matter(content);
    if (Object.keys(data).length === 0) missingCount++;
  }

  if (missingCount > 0) {
    results.push({
      rule: "frontmatter-other",
      severity: "WARN",
      message: `${missingCount} non-ADR/non-plan docs missing YAML frontmatter`,
    });
  }

  if (results.length === 0) {
    results.push({
      rule: "frontmatter",
      severity: "PASS",
      message: "All frontmatter checks passed",
    });
  }

  return results;
}
```

---

### Task 29: Write ADR Compliance Validation

**Files:**

- Create: `packages/docs-pipeline/src/validation/adr-compliance.ts`

**Step 1: Write ADR validation rules**

```typescript
import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import fg from "fast-glob";
import type { ValidationResult } from "./frontmatter.js";

/**
 * Extract ADR IDs from the decision log markdown table.
 * Matches rows like: | ADR-0001 | ... | [Title](./0001-file.md) | ... |
 */
function parseDecisionLog(content: string): Map<string, string> {
  const entries = new Map<string, string>();
  const rows = content.split("\n").filter((line) => line.startsWith("| ADR-"));

  for (const row of rows) {
    const idMatch = row.match(/ADR-(\d{4})/);
    const linkMatch = row.match(/\(\.\/(\d{4}-.+?\.md)\)/);
    if (idMatch && linkMatch) {
      entries.set(idMatch[1], linkMatch[1]);
    }
  }

  return entries;
}

/**
 * Validate ADR log consistency and ADR structure.
 */
export async function validateAdrCompliance(repoRoot: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const decisionsDir = resolve(repoRoot, "docs/decisions");

  // 1. Read decision log
  const logContent = await readFile(resolve(decisionsDir, "0000-decision-log.md"), "utf-8");
  const logEntries = parseDecisionLog(logContent);

  // 2. Find ADR files on disk (exclude template and log)
  const adrFiles = await fg("docs/decisions/[0-9][0-9][0-9][0-9]-*.md", {
    cwd: repoRoot,
  });
  const diskFiles = new Map<string, string>();
  for (const file of adrFiles) {
    const name = basename(file);
    const idMatch = name.match(/^(\d{4})-/);
    if (idMatch) diskFiles.set(idMatch[1], name);
  }

  // 3. Check: every file on disk is in the log
  for (const [id, fileName] of diskFiles) {
    if (!logEntries.has(id)) {
      results.push({
        rule: "adr-log-consistency",
        severity: "FAIL",
        message: `ADR-${id} (${fileName}) exists on disk but is NOT in decision log`,
        file: `docs/decisions/${fileName}`,
      });
    }
  }

  // 4. Check: every log entry has a file on disk
  for (const [id, fileName] of logEntries) {
    if (!diskFiles.has(id)) {
      results.push({
        rule: "adr-log-consistency",
        severity: "FAIL",
        message: `ADR-${id} (${fileName}) is in decision log but file NOT found on disk`,
        file: `docs/decisions/${fileName}`,
      });
    }
  }

  // 5. Check ADR required fields
  for (const [id, fileName] of diskFiles) {
    const content = await readFile(resolve(repoRoot, `docs/decisions/${fileName}`), "utf-8");

    // Must have Status
    if (!/\*\*Status:\*\*/i.test(content)) {
      results.push({
        rule: "adr-required-fields",
        severity: "FAIL",
        message: `ADR-${id} missing **Status:** field`,
        file: `docs/decisions/${fileName}`,
      });
    }

    // Must have Date
    if (!/\*\*Date:\*\*/i.test(content)) {
      results.push({
        rule: "adr-required-fields",
        severity: "FAIL",
        message: `ADR-${id} missing **Date:** field`,
        file: `docs/decisions/${fileName}`,
      });
    }

    // Must have Context section (## Context or ## Context and Problem Statement)
    if (!/^##\s+Context/m.test(content)) {
      results.push({
        rule: "adr-required-fields",
        severity: "FAIL",
        message: `ADR-${id} missing ## Context section`,
        file: `docs/decisions/${fileName}`,
      });
    }

    // Must have Decision section (## Decision or ## Decision Outcome)
    if (!/^##\s+Decision/m.test(content)) {
      results.push({
        rule: "adr-required-fields",
        severity: "FAIL",
        message: `ADR-${id} missing ## Decision section`,
        file: `docs/decisions/${fileName}`,
      });
    }
  }

  if (results.length === 0) {
    results.push({
      rule: "adr-compliance",
      severity: "PASS",
      message: "All ADR compliance checks passed",
    });
  }

  return results;
}
```

---

### Task 30: Write Structure Validation

**Files:**

- Create: `packages/docs-pipeline/src/validation/structure.ts`

**Step 1: Write structure validation rules**

```typescript
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fg from "fast-glob";
import type { ValidationResult } from "./frontmatter.js";

/**
 * Validate doc structure conventions.
 */
export async function validateStructure(repoRoot: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // 1. Module specs should have an overview section
  const moduleFiles = await fg("docs/modules/SMARTOUT_MODULE_*.md", {
    cwd: repoRoot,
  });

  for (const file of moduleFiles) {
    const content = await readFile(resolve(repoRoot, file), "utf-8");

    // Check for overview section (## Overview, ## 1. Module Overview, ## Module Overview)
    if (!/^##\s+.*[Oo]verview/m.test(content)) {
      results.push({
        rule: "module-structure",
        severity: "WARN",
        message: `Module spec missing overview section`,
        file,
      });
    }
  }

  // 2. Cross-reference integrity: "See Module N" or "MODULE_N" references
  const allDocs = await fg("docs/**/*.md", {
    cwd: repoRoot,
    ignore: ["**/template.md"],
  });

  for (const file of allDocs) {
    const content = await readFile(resolve(repoRoot, file), "utf-8");

    // Find references like "Module 18" or "MODULE_18" (modules only go up to 17)
    const moduleRefs = content.matchAll(/(?:Module|MODULE)[_\s](\d+)/g);
    for (const match of moduleRefs) {
      const num = parseInt(match[1], 10);
      if (num > 17 || num === 16) {
        // Module 16 doesn't exist (gap in numbering)
        results.push({
          rule: "cross-reference",
          severity: "WARN",
          message: `Reference to non-existent Module ${num}`,
          file,
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({
      rule: "structure",
      severity: "PASS",
      message: "All structure checks passed",
    });
  }

  return results;
}
```

---

### Task 31: Write Validate Command

**Files:**

- Create: `packages/docs-pipeline/src/commands/validate.ts`

**Step 1: Write validate command**

```typescript
import { resolve } from "node:path";
import { validateFrontmatter, type ValidationResult } from "../validation/frontmatter.js";
import { validateAdrCompliance } from "../validation/adr-compliance.js";
import { validateStructure } from "../validation/structure.js";

type ValidateOptions = {
  strict?: boolean;
  rule?: string;
};

function printResults(results: ValidationResult[]): void {
  for (const r of results) {
    const icon = r.severity === "PASS" ? "OK" : r.severity === "WARN" ? "WARN" : "FAIL";
    const prefix = `[${icon}]`;
    const filePart = r.file ? ` (${r.file})` : "";
    console.log(`  ${prefix} ${r.rule}: ${r.message}${filePart}`);
  }
}

export async function runValidate(options: ValidateOptions = {}): Promise<void> {
  const repoRoot = resolve(process.cwd(), "../..");

  console.log("Running documentation validation...\n");

  const allResults: ValidationResult[] = [];

  // ADR compliance
  if (!options.rule || options.rule === "adr") {
    console.log("ADR Compliance:");
    const adrResults = await validateAdrCompliance(repoRoot);
    printResults(adrResults);
    allResults.push(...adrResults);
    console.log();
  }

  // Frontmatter
  if (!options.rule || options.rule === "frontmatter") {
    console.log("Frontmatter:");
    const fmResults = await validateFrontmatter(repoRoot);
    printResults(fmResults);
    allResults.push(...fmResults);
    console.log();
  }

  // Structure
  if (!options.rule || options.rule === "structure") {
    console.log("Structure:");
    const structResults = await validateStructure(repoRoot);
    printResults(structResults);
    allResults.push(...structResults);
    console.log();
  }

  // Summary
  const fails = allResults.filter((r) => r.severity === "FAIL");
  const warns = allResults.filter((r) => r.severity === "WARN");
  const passes = allResults.filter((r) => r.severity === "PASS");

  console.log("---");
  console.log(
    `Summary: ${passes.length} passed, ${warns.length} warnings, ${fails.length} failures`,
  );

  if (fails.length > 0) {
    process.exit(1);
  }

  if (options.strict && warns.length > 0) {
    console.log("Strict mode: treating warnings as failures.");
    process.exit(1);
  }
}
```

---

### Task 32: Wire Validate Command into CLI

**Files:**

- Modify: `packages/docs-pipeline/src/index.ts`

**Step 1: Replace the validate placeholder**

Replace the `validate` command block in `packages/docs-pipeline/src/index.ts`:

```typescript
import { Command } from "commander";
import { runIngest } from "./commands/ingest.js";
import { runWatch } from "./commands/watch.js";
import { runValidate } from "./commands/validate.js";

const program = new Command();

program
  .name("docs-pipeline")
  .description("Documentation ingestion, embedding, and validation pipeline")
  .version("1.0.0");

program
  .command("ingest")
  .description("Ingest docs into vector database")
  .option("--force", "Re-embed all files regardless of hash")
  .option("--dry-run", "Show what would change without making changes")
  .action(async (options) => {
    try {
      await runIngest({
        force: options.force ?? false,
        dryRun: options.dryRun ?? false,
      });
    } catch (err) {
      console.error("Ingestion failed:", err);
      process.exit(1);
    }
  });

program
  .command("watch")
  .description("Watch docs/ for changes and auto-ingest")
  .action(() => {
    runWatch();
  });

program
  .command("validate")
  .description("Validate documentation structure and ADR compliance")
  .option("--strict", "Treat warnings as failures")
  .option("--rule <rule>", "Run a specific rule group (adr, frontmatter, structure)")
  .action(async (options) => {
    try {
      await runValidate({
        strict: options.strict ?? false,
        rule: options.rule,
      });
    } catch (err) {
      console.error("Validation failed:", err);
      process.exit(1);
    }
  });

program.parse();
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
Expected: No errors.

---

### Task 33: Verify Enforcement

**Step 1: Run validation**

Run: `pnpm docs:validate`
Expected: Should report current state — likely some WARN results for missing frontmatter, PASS for ADR compliance (if all ADRs are registered).

**Step 2: Run with --strict**

Run: `pnpm docs:validate --strict`
Expected: If there are WARNs, exits non-zero.

**Step 3: Run specific rule**

Run: `pnpm docs:validate --rule adr`
Expected: Only ADR compliance results shown.

---

### Task 34: Commit Phase D (Enforcement)

Run:

```bash
git add packages/docs-pipeline/src/validation/ packages/docs-pipeline/src/commands/validate.ts packages/docs-pipeline/src/index.ts
git commit -m "feat: add doc validation with ADR compliance and structure checks

Validates: ADR log consistency, required ADR fields, plan frontmatter,
module structure, cross-reference integrity. Supports --strict and --rule flags."
```

---

## Phase E: Hardening (Git-Aware Ingest + Duplicate Alerts + Concurrency Safety)

### Task 35: Add Git-Aware Change Detection Mode

**Files:**

- Modify: `packages/docs-pipeline/src/commands/ingest.ts`
- Modify: `packages/docs-pipeline/src/index.ts`
- Modify: `packages/docs-pipeline/package.json`

**Step 1: Extend ingest options**

Add to ingest options:

```typescript
type IngestMode = "filesystem" | "git";

type IngestOptions = {
  force?: boolean;
  dryRun?: boolean;
  mode?: IngestMode;
  gitRef?: string;
};
```

Default to `"filesystem"` for local watch/manual workflows. Support `"git"` mode to process only changed files from `git diff --name-only <gitRef> -- docs/`.

**Step 2: Add CLI flags**

Add flags to `ingest` command:

```typescript
.option("--mode <mode>", "filesystem or git", "filesystem")
.option("--git-ref <ref>", "Git ref for diff mode (default HEAD)")
```

**Step 3: Wire root scripts**

Add scripts:

```json
"docs:ingest:git": "pnpm --filter @smartout/docs-pipeline ingest --mode git",
"docs:ingest:git:main": "pnpm --filter @smartout/docs-pipeline ingest --mode git --git-ref origin/main"
```

---

### Task 36: Add Duplicate Detection and Alerts

**Files:**

- Modify: `supabase/migrations/20260227200000_platform_doc_embeddings.sql` (or new follow-up migration)
- Modify: `packages/docs-pipeline/src/db/operations.ts`
- Modify: `packages/docs-pipeline/src/commands/ingest.ts`

**Step 1: Persist content digest**

Add `content_hash TEXT NOT NULL` to `platform_doc_chunk` and index it:

```sql
CREATE INDEX platform_doc_chunk_content_hash_idx
  ON public.platform_doc_chunk (content_hash);
```

Set `content_hash` to SHA-256 of normalized chunk content (without unstable whitespace differences).

**Step 2: Add duplicate query helper**

Create DB operation that finds hash-colliding chunks on different paths:

- same `content_hash`
- different `source_path`

Emit warnings in ingest output:

- `[DUPLICATE][EXACT] docs/a.md <-> docs/b.md`

**Step 3: Add semantic duplicate alert (optional threshold)**

Use vector similarity over newly inserted chunks to flag near-duplicates:

- default threshold `>= 0.96`
- alert only (do not fail ingestion)

CLI flag:

```typescript
.option("--duplicate-threshold <n>", "Semantic duplicate threshold", "0.96")
```

---

### Task 37: Add Concurrency Locking for Write Commands

**Files:**

- Create: `packages/docs-pipeline/src/locking/ingest-lock.ts`
- Modify: `packages/docs-pipeline/src/commands/ingest.ts`
- Modify: `packages/docs-pipeline/src/commands/watch.ts`

**Step 1: Implement lock strategy**

Use a lock file under repo root (for example `.cache/docs-pipeline.ingest.lock`) containing:

- `pid`
- `started_at`
- `command`

Behavior:

- if lock exists and process alive: exit with clear message
- if lock exists and process dead: clean stale lock and continue
- always release lock in `finally`

**Step 2: Apply lock scope**

Wrap only write runs (`dryRun === false`) in lock. Keep dry-run lock-free.

---

### Task 38: Fix ADR Validation False Positives

**Files:**

- Modify: `packages/docs-pipeline/src/validation/adr-compliance.ts`

**Step 1: Exclude index files from ADR file scan**

Replace ADR file glob with:

```typescript
const adrFiles = await fg("docs/decisions/[0-9][0-9][0-9][1-9]-*.md", {
  cwd: repoRoot,
  ignore: ["docs/decisions/0000-decision-log.md", "docs/decisions/template.md"],
});
```

This prevents treating decision log/index files as ADRs.

---

### Task 39: Frontmatter Rollout Mode (Warn Before Fail)

**Files:**

- Modify: `packages/docs-pipeline/src/validation/frontmatter.ts`
- Modify: `packages/docs-pipeline/src/commands/validate.ts`
- Modify: `packages/docs-pipeline/src/index.ts`

**Step 1: Add enforce flag**

Use warning mode by default for `docs/plans/**` and allow explicit enforcement:

```typescript
type ValidateOptions = {
  strict?: boolean;
  rule?: string;
  enforcePlanFrontmatter?: boolean;
};
```

CLI flag:

```typescript
.option("--enforce-plan-frontmatter", "Fail when plans lack YAML frontmatter")
```

**Step 2: Backfill task before enforcement**

Add migration subtask:

- add YAML frontmatter to all active plan files
- then enable `--enforce-plan-frontmatter` in CI

---

### Task 40: Integrate Docs Tools into Runtime Agent Flow

**Files:**

- Modify: Agent wiring file(s) where tools are assembled for runtime

**Step 1: Register docs tools**

`DOC_TOOLS` must be included in the runtime toolset for at least:

- architecture/planning assistant flows
- repo QA flows

**Step 2: Add usage guardrails**

System prompt guidance:

- before architectural/schema decisions, call `search_platform_docs`
- if a specific ADR/path is referenced, call `get_doc_by_path`

---

## Verification Checklist

After all phases complete, run these in order:

1. **Types compile:** `pnpm --filter @smartout/ai exec -- npx tsc --noEmit && pnpm --filter @smartout/docs-pipeline exec -- npx tsc --noEmit`
2. **Validation works:** `pnpm docs:validate`
3. **Dry run works:** `pnpm docs:ingest --dry-run` (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
4. **Full ingest works:** `pnpm docs:ingest` (requires OPENAI_API_KEY + Supabase env)
5. **Idempotency:** `pnpm docs:ingest` again — should show "0 changed"
6. **Git mode works:** `pnpm docs:ingest:git` (or `pnpm docs:ingest:git:main`) — only changed docs processed
7. **Duplicate alerts work:** intentionally clone one section into another doc; run ingest; expect duplicate warnings
8. **Lock works:** run two ingest commands concurrently; second should exit with lock message
9. **Force re-index:** `pnpm docs:ingest --force`
10. **Watch mode:** `pnpm docs:watch` — edit a doc, verify auto re-embed
11. **RPC works:** `npx supabase db query "SELECT count(*) FROM platform_doc_chunk"` — should have chunks

---

## Secret Management

| Secret           | Action Required                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY` | Add to 1Password Development vault. Add `OPENAI_API_KEY=op://Development/OpenAI/api-key` to `.env.template`. |

The ingestion CLI reads `OPENAI_API_KEY` from env (auto-detected by `@ai-sdk/openai`).
The web app reads it via `env.ts` validation.
Both can use `op run --env-file=.env.template` to inject.
