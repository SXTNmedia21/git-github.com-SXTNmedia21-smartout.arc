-- Seed initial services into service_config
-- Run after migration 20260407100000_service_config.sql

INSERT INTO service_config (name, slug, type, status, description, host_url, health_endpoint, docker_service_name, port, tags, is_critical, env_schema, vault_secrets) VALUES

-- Docker services
('Stage Engine', 'stage-engine', 'docker', 'active',
 'AI orchestration engine — manages missions, stages, tools, and voice calls via Ultravox',
 'http://localhost:5010', '/health', 'stage-engine', 5010,
 ARRAY['ai', 'voice', 'core'],
 true,
 '[
   {"key": "PORT", "required": true, "change_type": "restart", "description": "Service port"},
   {"key": "ENGINE_URL", "required": true, "change_type": "restart", "description": "Public URL for callbacks"},
   {"key": "SUPABASE_URL", "required": true, "change_type": "restart", "description": "Supabase instance URL"},
   {"key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "change_type": "restart", "description": "Supabase admin key"}
 ]'::jsonb,
 ARRAY['ultravox', 'openrouter']),

('Contract Service', 'contract-service', 'docker', 'active',
 'E-signature orchestration via DocuSeal — manages employment contracts lifecycle',
 'http://localhost:5012', '/health', 'contract-service', 5012,
 ARRAY['contracts', 'core'],
 false,
 '[
   {"key": "PORT", "required": true, "change_type": "restart", "description": "Service port"},
   {"key": "SUPABASE_URL", "required": true, "change_type": "restart", "description": "Supabase instance URL"},
   {"key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "change_type": "restart", "description": "Supabase admin key"}
 ]'::jsonb,
 ARRAY['docuseal', 'docuseal_webhook']),

('Shift MCP', 'shift-mcp', 'docker', 'active',
 'MCP server for schedule management — provides AI tools for shift operations',
 'http://localhost:5011', '/health', 'shift-mcp', 5011,
 ARRAY['scheduling', 'ai'],
 false,
 '[
   {"key": "PORT", "required": true, "change_type": "restart", "description": "Service port"},
   {"key": "SUPABASE_URL", "required": true, "change_type": "restart", "description": "Supabase instance URL"},
   {"key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "change_type": "restart", "description": "Supabase admin key"}
 ]'::jsonb,
 ARRAY[]::text[]),

('Scrapling', 'scrapling', 'docker', 'active',
 'Python web scraping service for data collection',
 'http://localhost:8000', '/health', 'scrapling', 8000,
 ARRAY['data', 'infra'],
 false,
 '[]'::jsonb,
 ARRAY[]::text[]),

-- Vercel services
('Web Dashboard', 'web-dashboard', 'vercel', 'active',
 'Main admin dashboard — Next.js app deployed to Vercel',
 NULL, NULL, NULL, 3060,
 ARRAY['core', 'frontend'],
 true,
 '[
   {"key": "NEXT_PUBLIC_SUPABASE_URL", "required": true, "change_type": "restart", "description": "Supabase URL (public)"},
   {"key": "NEXT_PUBLIC_SUPABASE_ANON_KEY", "required": true, "change_type": "restart", "description": "Supabase anon key (public)"},
   {"key": "SUPABASE_SERVICE_ROLE_KEY", "required": true, "change_type": "restart", "description": "Supabase admin key"},
   {"key": "STAGE_ENGINE_URL", "required": true, "change_type": "runtime", "description": "Stage Engine base URL"},
   {"key": "STAGE_ENGINE_API_KEY", "required": true, "change_type": "runtime", "description": "Stage Engine API key"},
   {"key": "ULTRAVOX_API_KEY", "required": false, "change_type": "runtime", "description": "Ultravox voice API (legacy direct)"},
   {"key": "OPENROUTER_API_KEY", "required": false, "change_type": "runtime", "description": "OpenRouter LLM key"}
 ]'::jsonb,
 ARRAY[]::text[]),

('Landing Page', 'landing-page', 'vercel', 'active',
 'Public landing site — Next.js app deployed to Vercel',
 NULL, NULL, NULL, 3055,
 ARRAY['frontend', 'marketing'],
 false,
 '[]'::jsonb,
 ARRAY[]::text[]),

-- Edge Functions (grouped as one service)
('Edge Functions', 'edge-functions', 'edge-function', 'active',
 'Supabase Edge Functions — auth, webhooks, cron jobs, and API gateway',
 NULL, '/health-check', NULL, NULL,
 ARRAY['core', 'auth', 'api'],
 true,
 '[]'::jsonb,
 ARRAY[]::text[]),

-- External services
('Stripe', 'stripe', 'external', 'active',
 'Payment processing and subscription billing',
 'https://api.stripe.com', NULL, NULL, NULL,
 ARRAY['billing'],
 true,
 '[]'::jsonb,
 ARRAY['stripe_secret', 'stripe_webhook']),

('SendGrid', 'sendgrid', 'external', 'active',
 'Transactional and marketing email delivery',
 'https://api.sendgrid.com', NULL, NULL, NULL,
 ARRAY['notifications'],
 false,
 '[]'::jsonb,
 ARRAY['sendgrid']),

('Twilio', 'twilio', 'external', 'active',
 'SMS notifications and voice calls',
 'https://api.twilio.com', NULL, NULL, NULL,
 ARRAY['notifications'],
 false,
 '[]'::jsonb,
 ARRAY['twilio_sid', 'twilio_token']),

('DocuSeal', 'docuseal', 'external', 'active',
 'E-signature service for employment contracts',
 NULL, NULL, NULL, NULL,
 ARRAY['contracts'],
 false,
 '[]'::jsonb,
 ARRAY['docuseal', 'docuseal_webhook']),

('Upstash Redis', 'upstash-redis', 'external', 'active',
 'Serverless Redis for caching and rate limiting',
 NULL, NULL, NULL, NULL,
 ARRAY['infra', 'cache'],
 true,
 '[
   {"key": "UPSTASH_REDIS_REST_URL", "required": true, "change_type": "restart", "description": "Redis REST endpoint"},
   {"key": "UPSTASH_REDIS_REST_TOKEN", "required": true, "change_type": "restart", "description": "Redis auth token"}
 ]'::jsonb,
 ARRAY['upstash_redis_url', 'upstash_redis_token'])

ON CONFLICT (slug) DO NOTHING;
