---
title: "Worklog — stage-engine-local"
status: in_progress
updated: 2026-03-02
created: 2026-03-02
module: ai
tags: [stage-engine, voice, ultravox, agent, local-dev]
---

# Worklog — stage-engine-local

## Status: 🟡 In Progress

## Done

- [x] Fixed migration timestamp collisions (4x `20260301600000`, 3x `20260302000000`)
- [x] Applied all migrations via `supabase db reset` — engine_memory, engine_authority_config, engine_sessions.mode confirmed
- [x] Built @smartout/ai and all dependencies
- [x] Created .env and .env.local for stage engine (port 3060, local Supabase keys)
- [x] Made secrets.ts graceful — missing Vault keys warn but don't crash
- [x] Added env var fallback: OPENROUTER_API_KEY, ULTRAVOX_API_KEY from .env.local
- [x] Fixed intent-classifier.ts — lazy-init OpenRouter, accept optional apiKey param
- [x] Fixed agent-router.ts — pass apiKey from secrets to classifyIntent
- [x] Fixed ultravox.ts — handle nullable API key type
- [x] Stage engine starts cleanly on port 3060
- [x] Health endpoint: `GET /health` returns 200 OK
- [x] Auth middleware: rejects unauthenticated requests (401), accepts valid JWT
- [x] Chat pipeline: auth → session creation → profile context → BLOCKED at LLM call (no API key)
- [x] Ultravox adapter: routes registered, responds with 401 on unauthenticated requests
- [x] Typecheck: both @smartout/ai and @smartout/stage-engine pass (0 errors)

## Remaining

- [ ] Add OpenRouter API key to Vault or .env.local — then /agent/chat will work end-to-end
- [ ] Add Ultravox API key to Vault or .env.local — then voice calls will work
- [ ] Seed a test mission for Ultravox voice testing
- [ ] Run full e2e test (test/agent-chat.e2e.ts) with valid keys
- [ ] Test voice call creation with Ultravox create-call endpoint

## Decisions

| Date       | Decision                                            | Reason                                                                   |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-03-02 | Use port 3060 for stage engine                      | Port 3000 occupied by Twenty CRM locally                                 |
| 2026-03-02 | Graceful secrets loading (warn, don't crash)        | Local dev may not have Vault secrets, features should degrade gracefully |
| 2026-03-02 | Env var fallback for API keys                       | Vault-only approach blocks local testing without Vault setup             |
| 2026-03-02 | Lazy-init OpenRouter in intent-classifier           | Avoid module-level crash when env var not set                            |
| 2026-03-02 | Renamed colliding migrations with +1/+2/+3 suffixes | Supabase requires unique migration timestamps                            |

## Log

| Date       | Time  | Event                                                                      |
| ---------- | ----- | -------------------------------------------------------------------------- |
| 2026-03-02 | 08:20 | Started — supabase running, migrations not applied                         |
| 2026-03-02 | 08:20 | Fixed 7 migration timestamp collisions                                     |
| 2026-03-02 | 08:22 | All migrations applied, engine tables confirmed via REST                   |
| 2026-03-02 | 08:23 | Created .env, .env.local for stage engine                                  |
| 2026-03-02 | 08:24 | Stage engine running on port 3060, health OK                               |
| 2026-03-02 | 08:25 | Chat endpoint tested — auth works, blocked at LLM call (no OpenRouter key) |
| 2026-03-02 | 08:28 | Fixed intent-classifier and agent-router for key passing                   |
| 2026-03-02 | 08:30 | Typecheck clean for both packages                                          |
