SET search_path TO public, extensions;

-- ============================================
-- 20260301200000_platform_doc_embeddings.sql
-- Creates the platform_doc_chunk table for documentation RAG.
-- Stores chunked documentation with pgvector embeddings for
-- semantic similarity search by AI agents.
-- Connected to: ADR-0031 (Documentation RAG with pgvector)
-- ============================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Document type enum for classifying chunks by source
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_type') THEN
    CREATE TYPE doc_type AS ENUM (
  'adr',
  'module',
  'architecture',
  'cross_cutting',
  'plan',
  'research',
  'roadmap',
  'other'
);
  END IF;
END $$;;

-- Platform-level table: no workspace_id, no RLS
-- Accessed only via service role (ingestion pipeline)
CREATE TABLE IF NOT EXISTS platform_doc_chunk (
  chunk_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_path    TEXT NOT NULL,
  source_hash    TEXT NOT NULL,
  content_hash   TEXT NOT NULL,
  doc_type       doc_type NOT NULL DEFAULT 'other',
  chunk_index    INT NOT NULL DEFAULT 0,
  section_title  TEXT,
  content        TEXT NOT NULL,
  token_count    INT NOT NULL DEFAULT 0,
  metadata       JSONB DEFAULT '{}',
  embedding      vector(1536),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each source file + chunk index pair must be unique
  CONSTRAINT uq_source_chunk UNIQUE (source_path, chunk_index)
);

-- Auto-update updated_at using existing trigger function
DROP TRIGGER IF EXISTS set_platform_doc_chunk_updated_at ON platform_doc_chunk;
CREATE TRIGGER set_platform_doc_chunk_updated_at
  BEFORE UPDATE ON platform_doc_chunk
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- HNSW index for fast approximate nearest neighbor search
-- cosine distance is best for normalized text embeddings
CREATE INDEX IF NOT EXISTS idx_platform_doc_chunk_embedding
  ON platform_doc_chunk
  USING hnsw (embedding vector_cosine_ops);

-- B-tree indexes for filtering and lookup
CREATE INDEX IF NOT EXISTS idx_platform_doc_chunk_source_path
  ON platform_doc_chunk (source_path);

CREATE INDEX IF NOT EXISTS idx_platform_doc_chunk_doc_type
  ON platform_doc_chunk (doc_type);

CREATE INDEX IF NOT EXISTS idx_platform_doc_chunk_content_hash
  ON platform_doc_chunk (content_hash);

/**
 * match_platform_docs — Semantic similarity search over documentation chunks.
 * Returns the top N chunks closest to the query embedding, optionally
 * filtered by document type.
 *
 * Why: AI agents call this RPC to find relevant documentation before
 * answering questions or making architectural decisions.
 *
 * @param query_embedding - The embedding vector of the search query (1536 dims)
 * @param match_count - Maximum number of results to return (default 5)
 * @param match_threshold - Minimum similarity score (0-1, default 0.5)
 * @param filter_doc_type - Optional document type filter
 * @returns Matching chunks with similarity score, ordered by relevance
 */
CREATE OR REPLACE FUNCTION match_platform_docs(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.5,
  filter_doc_type doc_type DEFAULT NULL
)
RETURNS TABLE (
  chunk_id       UUID,
  source_path    TEXT,
  doc_type       doc_type,
  section_title  TEXT,
  content        TEXT,
  token_count    INT,
  metadata       JSONB,
  similarity     FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pdc.chunk_id,
    pdc.source_path,
    pdc.doc_type,
    pdc.section_title,
    pdc.content,
    pdc.token_count,
    pdc.metadata,
    -- cosine similarity = 1 - cosine distance
    1 - (pdc.embedding <=> query_embedding) AS similarity
  FROM platform_doc_chunk pdc
  WHERE
    pdc.embedding IS NOT NULL
    AND 1 - (pdc.embedding <=> query_embedding) >= match_threshold
    AND (filter_doc_type IS NULL OR pdc.doc_type = filter_doc_type)
  ORDER BY pdc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
