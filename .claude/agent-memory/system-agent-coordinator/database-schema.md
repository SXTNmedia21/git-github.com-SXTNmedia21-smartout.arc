# Engine Database Schema

## AI Conversation Tables (Stage Engine)

### engine_missions

- `id` TEXT PK (human-readable: "onboarding-interview")
- `mode` TEXT: sequential | free | hybrid
- `workspace_id` UUID nullable (NULL = global)
- `is_active` BOOLEAN
- RLS: global missions readable by all, workspace missions by members

### engine_stages

- `id` UUID PK
- `mission_id` TEXT FK -> engine_missions
- `stage_id` TEXT (human-readable within mission)
- `stage_order` INTEGER
- `goal`, `instructions`, `success_criteria` TEXT
- `personality_override`, `emotion_hint` TEXT nullable
- `creative_freedom` REAL 0-1
- `next_stage` TEXT nullable (for sequential navigation)
- `is_required` BOOLEAN
- `deferred_templates`, `inline_instructions` JSONB
- UNIQUE(mission_id, stage_id), UNIQUE(mission_id, stage_order)

### engine_sessions

- `id` UUID PK
- `mode` TEXT: mission | agent (added in 20260302000200)
- `mission_id` TEXT FK nullable (NULL for agent mode, constraint enforced)
- `workspace_id` UUID FK NOT NULL
- `user_id` UUID nullable
- `profile_id` UUID nullable
- `channel` TEXT: voice | sms | chat | email | autonomous
- `current_stage_id` TEXT nullable
- `stage_index` INTEGER
- `status` TEXT: active | complete | expired | abandoned
- `context` JSONB
- `collected_data` JSONB (agent mode: {conversation: ConversationTurn[]})
- `callback_url` TEXT nullable
- `expires_at` TIMESTAMPTZ (default 24h)
- Indexes: workspace+status, expiry, mission+workspace+status, agent profile index

### engine_inbox

- `id` UUID PK
- `session_id` UUID FK -> engine_sessions (CASCADE)
- `stage_id` TEXT
- `workspace_id` UUID FK
- `entity_type` TEXT
- `data` JSONB
- `validated`, `processed` BOOLEAN

### engine_memory

- `id` UUID PK
- `profile_id` UUID FK -> profile
- `workspace_id` UUID FK -> workspace
- `memory_type` TEXT: preference | fact | summary
- `content` TEXT
- `embedding` vector(1536) — pgvector, HNSW index
- `scope` TEXT: personal | team | workspace (added 20260307)
- `importance` DECIMAL 0-1 (added 20260307)
- `agent_profile_id` UUID FK nullable (added 20260307)
- `source_session_id` UUID FK nullable
- `expires_at` TIMESTAMPTZ nullable
- RLS: JWT read by workspace, API key read, service role manage

### engine_authority_config

- `id` UUID PK
- `workspace_id` UUID FK
- `capability` TEXT
- `level` TEXT: autonomous | confirm | suggest | read_only | disabled
- `updated_by` UUID FK -> user_identity
- UNIQUE(workspace_id, capability)
- RLS: admin manage, API key read, service role manage

## Agent Identity Tables (20260307)

### agent_profile (1 per workspace)

- `id` UUID PK
- `workspace_id` UUID FK UNIQUE
- `display_name` TEXT default 'Mr. Botsson'
- `greeting`, `language` TEXT
- Voice DNA: `default_voice`, `voice_speed`, `voice_temperature`, `voice_stability`
- Personality sliders: `formality`, `assertiveness`, `warmth`, `humor`, `verbosity` (0-1)
- Adapt flags: `adapt_to_role`, `adapt_to_situation`, `adapt_to_authority` BOOLEAN

### agent_relationship (1 per agent x employee)

- `id` UUID PK
- `workspace_id`, `agent_profile_id`, `profile_id` UUID FKs
- Familiarity: `total_conversations`, `total_minutes`, `familiarity_score`
- Trust: `protocols_completed`, `protocols_assigned`, `readiness_score`, `accuracy_score`, `trust_score`
- Sentiment: `positive_count`, `neutral_count`, `negative_count`, `sentiment_trend`, `sentiment_score`
- Composite: `relationship_score`
- UNIQUE(agent_profile_id, profile_id)

## Domain Process Tables (NOT AI conversations)

### engine_process, engine_step, engine_trigger, engine_event, engine_state, engine_delayed_trigger

- These are for domain workflows (daily_close, onboarding_14d)
- Different system from engine_missions/engine_sessions
- Trigger-based: events fire triggers which start process instances
- Has condition evaluator for step guards
