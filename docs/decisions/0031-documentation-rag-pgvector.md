---
title: "ADR-0031: Documentation RAG with pgvector"
id: ADR_0031
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0031: Documentation RAG with pgvector

## Context and Problem Statement

Smartout has 150+ internal documentation files (module specs, ADRs, architecture docs, research, plans) that serve as the project knowledge base. The existing docs agent (`packages/ai/src/agents/docs.ts`) requires manual knowledge injection — there is no semantic search. AI agents cannot autonomously find relevant documentation when answering questions or making decisions. This limits the effectiveness of AI-assisted development and onboarding.

## Decision Drivers

- AI agents need fast, accurate retrieval over the full docs corpus
- Supabase already provides PostgreSQL — pgvector is a natural fit
- OpenRouter (current AI provider) does not offer embedding endpoints
- Embeddings must be high quality but cost-efficient for 150+ docs
- Platform-level data — not workspace-scoped, no RLS needed

## Considered Options

1. **pgvector in Supabase** — store embeddings alongside other data, use RPC for similarity search
2. **Pinecone** — dedicated vector database, separate infrastructure
3. **ChromaDB** — open-source, self-hosted vector database
4. **Full-text search only** — PostgreSQL tsvector without semantic understanding

## Decision Outcome

Chosen option: **"Option 1 — pgvector in Supabase"**, because it keeps all data in one place, requires no additional infrastructure, and leverages existing Supabase tooling (migrations, RPC, service role auth).

### Embedding Model

- **Model:** OpenAI `text-embedding-3-small` (1536 dimensions)
- **Provider:** `@ai-sdk/openai` (direct, not through OpenRouter — OpenRouter lacks embedding support)
- **Cost:** ~$0.02 per million tokens — negligible for 150 docs

### Table Design

- **Table:** `platform_doc_chunk` — platform-level, NO `workspace_id`, NO RLS
- **Access:** Service role only (ingestion pipeline runs server-side)
- **Index:** HNSW on embedding column for approximate nearest neighbor search

### Chunking Strategy

| Doc Type | Strategy |
|----------|----------|
| ADRs, roadmaps | Whole-file (typically <1200 tokens) |
| Modules, architecture | Split on `##` headings, sub-split on `###` if >1200 tokens |
| Plans, research | Split on `##` headings |
| Other | Split on `##` headings |

- Context header prepended to each chunk (doc title, type, path)
- Overlap sentences for continuity between chunks
- Target: 800-1200 tokens per chunk

### Retrieval

- `match_platform_docs()` RPC function for cosine similarity search
- Returns top-N results with similarity score, filtered by optional doc_type
- Query embedding generated at search time using same model

## Rules & Consequences

- **Good, because** zero additional infrastructure — pgvector runs inside existing Supabase
- **Good, because** RPC function enables retrieval from Edge Functions and server components
- **Good, because** HNSW index provides sub-10ms similarity search at this scale
- **Bad, because** requires `OPENAI_API_KEY` as a new secret (separate from OpenRouter)
- **Bad, because** re-indexing all docs requires ~150 API calls (one-time, <$0.01)
- **Agent Impact:** Use `searchPlatformDocs` tool for semantic doc search. Use `getDocByPath` for fetching specific files. Never query `platform_doc_chunk` directly from client code.
