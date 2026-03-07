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

drop policy if exists "jwt_read_workspace_doc_chunk" on workspace_doc_chunk;
create policy "jwt_read_workspace_doc_chunk" on workspace_doc_chunk
for select using (workspace_id in (select get_workspace_ids_for_user(auth.uid())));

drop policy if exists "api_key_read_workspace_doc_chunk" on workspace_doc_chunk;
create policy "api_key_read_workspace_doc_chunk" on workspace_doc_chunk
for select using (workspace_id = get_api_workspace_id());

drop policy if exists "service_manage_workspace_doc_chunk" on workspace_doc_chunk;
create policy "service_manage_workspace_doc_chunk" on workspace_doc_chunk
for all using (auth.role() = 'service_role');

create index if not exists idx_workspace_doc_chunk_embedding
  on workspace_doc_chunk using hnsw (embedding vector_cosine_ops);
create index if not exists idx_workspace_doc_chunk_workspace
  on workspace_doc_chunk (workspace_id, source_type);
create index if not exists idx_workspace_doc_chunk_content_hash
  on workspace_doc_chunk (content_hash);
