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
  select 'people', p.profile_id::text, coalesce(p.display_name,''), coalesce(p.role::text,''), '/dashboard/people/' || p.profile_id::text, 0.9
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
