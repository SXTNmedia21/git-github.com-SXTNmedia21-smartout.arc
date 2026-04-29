-- M2.3 — Governance Content Ingest Engine Process + Trigger
-- Wires governance.content_updated event -> source-targeted ingest of
-- workspace_doc_chunk via existing ingest-workspace-knowledge edge function.
-- Spec: docs/superpowers/specs/2026-04-28-doc-chunk-auto-update.md
-- Plan: docs/plans/PLAN-m2-doc-chunk-auto-update.md (Option C — full proper fix)

-- 1. Process definition
INSERT INTO engine_process (id, name, description, is_active)
VALUES (
  'governance_content_ingest',
  'Governance Content Ingest',
  'Re-embeds workspace_doc_chunk for a single governance source (handbook_chapter / policy / protocol) when its content changes. Triggered by governance.content_updated events emitted from update Server Actions.',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Single-step process: invoke ingest_workspace_knowledge action.
--    Engine-dispatch action handler reads source_type + source_id + trigger
--    from state.context (populated from event.payload) and forwards them to
--    ingest-workspace-knowledge so re-embed runs source-targeted, not workspace-wide.
INSERT INTO engine_step (process_id, step_order, action_type, action_payload)
VALUES (
  'governance_content_ingest', 1, 'ingest_workspace_knowledge',
  '{"description": "Source-targeted re-ingest of workspace_doc_chunk after governance edit"}'::jsonb
)
ON CONFLICT ON CONSTRAINT uq_process_step_order DO NOTHING;

-- 3. Trigger: governance.content_updated -> governance_content_ingest
INSERT INTO engine_trigger (event_type, process_id, is_active, condition)
SELECT 'governance.content_updated', 'governance_content_ingest', true, null
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'governance.content_updated' AND process_id = 'governance_content_ingest'
);
