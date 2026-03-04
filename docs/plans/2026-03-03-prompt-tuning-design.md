---
title: "Design — Prompt Tuning System"
status: draft
updated: 2026-03-03
created: 2026-03-03
module: ai
tags: [design, guardian, stage-engine, prompt-tuning]
---

# Design — Prompt Tuning System

> Iterative prompt improvement for AI agents without code deployments.

## Problem

Lise's onboarding prompt had five issues discovered during a live call:

1. **Confirmation loops** — "Stemmer det?" after every statement
2. **No date awareness** — couldn't answer "what day is it?"
3. **Questions instead of action** — asked permission instead of acting
4. **Permission-seeking navigation** — "Skal vi gå videre?" instead of just advancing
5. **Prompt not in code** — 7000-char prompt only existed in Ultravox API records, no version control

Changing prompts required code deployment. No one could iterate on agent personality without a developer.

## Solution

Three-part system:

### 1. Stage Engine Routing (implemented)

Route `/api/wizard/start` through the stage engine instead of calling Ultravox directly.

**Before:** `voice-assistant.tsx` → `/api/wizard/start` → `startMissionCall()` → Ultravox API
**After:** `voice-assistant.tsx` → `/api/wizard/start` → Stage Engine `/adapters/ultravox/create-call` → Ultravox API

Benefits:

- Prompts loaded from DB (engine_missions + engine_stages), not hardcoded
- Guardian event bus monitors every session
- Stage transitions managed server-side
- Template variables (e.g. `{{current_date}}`) substituted at build time

**Files changed:**

- `apps/web/src/app/api/wizard/start/route.ts` — rewrote to call stage engine
- `apps/web/src/env.ts` — added `STAGE_ENGINE_API_KEY`
- `services/stage-engine/src/core/prompt-builder.ts` — added `{{current_date}}` substitution

### 2. Prompt Tuning Notes (not yet implemented)

Workspace-scoped text notes that append to base prompts at build time.

**Table: `prompt_tuning_note`**

| Column       | Type                              | Description                    |
| ------------ | --------------------------------- | ------------------------------ |
| id           | uuid PK                           |                                |
| workspace_id | uuid FK → workspace               | Workspace scope                |
| mission_id   | text FK → engine_missions         | Which mission                  |
| stage_id     | text FK → engine_stages, nullable | Specific stage or mission-wide |
| note         | text                              | The tuning instruction         |
| author_id    | uuid FK → user_identity           | Who wrote it                   |
| created_at   | timestamptz                       | When                           |

**Injection point:** `buildStagePrompt()` in `prompt-builder.ts`

After building the base prompt from the stage definition, append all matching tuning notes:

```
## Tuning Notes (workspace-specific)
- [2026-03-03] Don't ask "Stemmer det?" — just proceed
- [2026-03-03] Be more driving, less permission-seeking
```

**Scope:** Mission-wide notes apply to all stages. Stage-specific notes only apply to that stage. Both are appended.

**Layering:** Append-only. Notes accumulate. To undo, add a counter-note. No editing or deleting of existing notes (audit trail).

**Who can tune:** Workspace admins (role = 'admin' or 'owner'). Platform admin (is_godmode). Profile-scoped later (v2).

### 3. Lise Prompt Rewrite (seeded in DB)

Rewrote the onboarding prompt with key personality changes:

- "Du er drivkraften" (not "ydmyk og forsiktig")
- "Du spør ikke om lov — du foreslår og gjør"
- "Du bekrefter IKKE det brukeren nettopp sa"
- "Du spør aldri 'Stemmer det?'"
- "Du spør aldri 'Skal vi gå videre?' — du GÅR videre"
- `{{current_date}}` for date awareness
- `personality_override`: "Driving, warm, confident. Never passive or permission-seeking."
- `emotion_hint`: "energetic and forward-moving"
- `creative_freedom`: 0.6

Seeded into `engine_missions` (id: `onboarding-interview`) and `engine_stages` (7 stages).

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Voice Assistant │────▶│  /api/wizard/   │────▶│ Stage Engine  │
│  (browser)       │     │  start          │     │  :5022        │
└─────────────────┘     └─────────────────┘     └──────┬───────┘
                                                        │
                                          ┌─────────────┼─────────────┐
                                          ▼             ▼             ▼
                                    loadMission()  buildStagePrompt()  createUltravoxCall()
                                    (from DB)      + tuning notes      (Ultravox API)
                                                   + {{current_date}}
```

## Decisions

| Decision     | Choice                     | Reason                                                |
| ------------ | -------------------------- | ----------------------------------------------------- |
| Tuning scope | Mission-wide               | Simplest useful granularity. Stage-specific optional. |
| Note format  | Simple text                | No structured format needed. Text is flexible.        |
| Layering     | Append-only                | Audit trail. Counter-notes to undo.                   |
| Who tunes    | Workspace admins + godmode | Profile-scoped later in v2.                           |
| Storage      | Separate table             | Clean separation. JSONB on missions mixes concerns.   |

## Implementation Status

| Component                           | Status      | Notes                                  |
| ----------------------------------- | ----------- | -------------------------------------- |
| Stage engine routing                | Done        | Committed on feat/stage-engine-routing |
| `STAGE_ENGINE_API_KEY` in env.ts    | Done        |                                        |
| `{{current_date}}` substitution     | Done        | In prompt-builder.ts                   |
| Lise prompt in DB                   | Done        | Seeded via REST API                    |
| platform_api_key for auth           | Done        | Service key in DB                      |
| Local dev HTTPS bypass              | Done        | Tools skipped on http:// ENGINE_URL    |
| `prompt_tuning_note` table          | Not started | Needs migration                        |
| `buildStagePrompt` tuning injection | Not started | Needs code change                      |
| Tuning UI                           | Not started | Dashboard page for admins              |

## Open Issues

1. **Ultravox tools require HTTPS** — Local dev skips tools (no store/fetch/advance during calls). Production needs `ENGINE_URL=https://...`.
2. **Voice selection** — User wants to test stock voices with more energy. Current custom `Lise_Botsson` voice is "rolig og trygg" (calm). Needs testing with different voices.
3. **Onboarding without workspace** — During onboarding, the user may not have a workspace yet. The route needs to handle this (was fixed on development).
