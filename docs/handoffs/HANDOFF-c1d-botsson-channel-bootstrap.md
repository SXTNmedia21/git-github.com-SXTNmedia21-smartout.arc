---
title: "Handoff — C1.d Botsson Channel Bootstrap"
status: done
updated: 2026-04-28
created: 2026-04-28
module: ai-agent
tags: [handoff, migration, botsson, livekit, voice, channel, profile, c1d]
---

# Handoff — C1.d Botsson Channel Bootstrap

**Branch:** `feat/botsson-arena-c1d-botsson-channel-bootstrap`
**SHA:** `9c611032`
**Based on:** `campaign/botsson-arena` (HEAD `25cfe635`)
**Predecessor:** C1.b — `docs/HANDOFF-c1b-botsson-voice-session.md` (§S1 is the blocker this closes)
**ADRs honoured:** ADR-0135 (LiveKit mobile), ADR-0132 (mobile thin client)
**Status:** migration applied, types regenerated, 7/7 acceptance criteria green.

---

## What was built

One migration, one types regen. No code changes outside scope.

### Migration: `20260519100000_profile_botsson_channel_bootstrap.sql`

| Step | What | Idempotent? |
|------|------|:-----------:|
| 1 | `ALTER TYPE comm_channel_type ADD VALUE IF NOT EXISTS 'ai'` | Yes |
| 2 | `ALTER TABLE profile ADD COLUMN IF NOT EXISTS botsson_channel_id uuid FK → channel(id) ON DELETE SET NULL` | Yes |
| 3 | `CREATE FUNCTION bootstrap_botsson_channel(p_workspace_id)` — inserts 1 channel row + 1 channel_ai_policy row per workspace | Yes |
| 4 | Backfill loop — all 6 existing workspaces bootstrapped | Yes (guard in fn) |
| 5 | `UPDATE profile SET botsson_channel_id = ... WHERE botsson_channel_id IS NULL` | Yes |
| 6 | `CREATE TRIGGER trg_botsson_channel_on_workspace` — auto-bootstraps on new workspace INSERT | Yes (DROP TRIGGER IF EXISTS) |
| 7 | Partial unique index `idx_channel_one_ai_per_workspace` — one non-archived `ai` channel per workspace | Yes (IF NOT EXISTS) |
| 8 | Falsifiable self-test DO block — aborts migration on any data gap | n/a |

### Types regen: `packages/supabase/src/database.types.ts`

Regenerated via `npx supabase gen types typescript --local`. Two additions:

- `profile.Row.botsson_channel_id: string | null` (also Insert/Update as `string | null`)
- `comm_channel_type` union now includes `"ai"`

---

## Acceptance matrix (7/7 green)

| # | Criterion | SQL / check | Result |
|---|-----------|-------------|--------|
| 1 | `profile.botsson_channel_id` column exists | `\d profile` shows `botsson_channel_id uuid` | PASS |
| 2 | FK to `channel(id)` ON DELETE SET NULL | `pg_constraint` shows `profile_botsson_channel_id_fkey` | PASS |
| 3 | Every workspace has 1 Botsson channel | `count(*) FROM workspace w WHERE NOT EXISTS (SELECT 1 FROM channel c WHERE c.workspace_id=w.workspace_id AND c.channel_type='ai' AND NOT c.is_archived)` → **0** | PASS |
| 4 | Every non-system profile has `botsson_channel_id` | `count(*) FROM profile WHERE botsson_channel_id IS NULL AND role != 'system'` → **0** | PASS |
| 5 | `channel_ai_policy.voice_participation='interactive'` | `count(*) FILTER (WHERE cap.voice_participation != 'interactive')` → **0** (6 channels, 6 correct) | PASS |
| 6 | Types regenerated with `botsson_channel_id` | `grep botsson_channel_id packages/supabase/src/database.types.ts` → 5 hits (Row/Insert/Update + FK ref) | PASS |
| 7 | Migration timestamp > tip (`20260519000000`) | Filename `20260519100000_...` → `100000 > 000000` | PASS |

---

## Decisions

### D1 — `comm_channel_type = 'ai'` (new enum value)

The C1.b handoff suggested `channel_type='ai'`. The existing enum did not have this value. We added it rather than repurposing `'custom'` because:

- `'custom'` channels can be created by JWT users; `'ai'` channels are service-role-only bootstrap artefacts. Distinct types prevent RLS over-permissioning.
- Future code can distinguish Botsson channels from generic custom channels without a name-string heuristic.
- The partial unique index `idx_channel_one_ai_per_workspace` is cleanly typed on `channel_type = 'ai'`.

### D2 — `text_participation = 'proactive'` on channel_ai_policy

The scope asked for `voice_participation='interactive'`. We also set `text_participation='proactive'` (not `'disabled'`) because the Botsson channel is the workspace's AI contact surface — if a text mode is ever enabled (Arena chat via this channel), `proactive` is the correct posture and avoids a second migration.

### D3 — System profiles excluded from A4 assertion

Profiles with `role = 'system'` (Mr. Botsson himself) are excluded from the "every profile must have botsson_channel_id" assertion. Mr. Botsson is the AI — he has no need to call himself. This is a deliberate exclusion, not a gap.

### D4 — `ON DELETE SET NULL` on FK

If the Botsson channel is ever archived + deleted, profiles lose voice access gracefully (null short-circuits in `useBotssonVoiceSession`). This is the C4-correct posture: the feature degrades without data corruption.

---

## What this unblocks

`useBotssonVoiceSession.start()` in `apps/mobile/src/hooks/use-botsson-voice-session.ts` reads `profile.botsson_channel_id` via `BotssonProvider`. Before this migration the value was always null → `start()` returned `MISSING_IDS` error → Jarvis demo blocked. After this migration:

- Every workspace has a Botsson channel with `channel_ai_policy.voice_participation='interactive'`.
- Every profile has `botsson_channel_id` set to that channel.
- The `livekit-token` edge function receives a valid `channelId` and mints a token.
- The orb transitions: `idle → connecting → listening`.

---

## Open gaps (not this sortie)

| Gap | What | Phase |
|-----|------|-------|
| `BotssonProvider` type narrowing | Provider still uses `(profile as { botsson_channel_id?: string | null })` cast. Now that `database.types.ts` has the column, the narrowing cast can be removed for clean typing. Low-risk — the cast is safe, just verbose. | C1.c or next cleanup |
| New-profile backfill | When a new profile is created, `botsson_channel_id` is not auto-set. The workspace bootstrap fn returns the channel id — workspace-bootstrap Server Actions should set it at profile-creation time. A DB-side `AFTER INSERT ON profile` trigger is one option; a Server Action call is another (avoids trigger proliferation). | Workspace-bootstrap polish pass |
| RLS on `channel_ai_policy` for `ai` channel rows | Existing `channel_ai_policy` RLS allows workspace members to SELECT. INSERT/UPDATE requires service-role (bootstrap fn runs SECURITY DEFINER). This is the correct posture for a system-owned policy row. No gap. | n/a |

---

## Files changed

```
A  supabase/migrations/20260519100000_profile_botsson_channel_bootstrap.sql  (+187)
M  packages/supabase/src/database.types.ts  (regen — +387 / -16 net diff)
A  docs/HANDOFF-c1d-botsson-channel-bootstrap.md  (this file)
```

---

## Verification commands

```bash
# Re-run acceptance assertions standalone
docker exec -i supabase_db_smartout.ai psql -U postgres <<'SQL'
SELECT count(*) AS workspaces_without_botsson FROM workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM channel c
  WHERE c.workspace_id = w.workspace_id AND c.channel_type = 'ai' AND NOT c.is_archived
);

SELECT count(*) AS profiles_missing_channel FROM profile
WHERE botsson_channel_id IS NULL AND role != 'system';

SELECT count(*) AS policies_wrong_voice FROM channel_ai_policy cap
JOIN channel c ON c.id = cap.channel_id
WHERE c.channel_type = 'ai' AND NOT c.is_archived
  AND cap.voice_participation != 'interactive';
SQL

# Re-run types regen
npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts

# Verify
grep botsson_channel_id packages/supabase/src/database.types.ts | wc -l
# Expected: 5
```

---

## System map update

`docs/architecture/BOTSSON-SYSTEM-MAP.md` — L4 LiveKit adapter + L1 BotssonProvider voice status:

- `profile.botsson_channel_id` column: was missing (🔴 blocker per C1.b §S1). Now **🟢**.
- `channel + channel_ai_policy` bootstrap per workspace: now **🟢**.
- `campaign/botsson-arena` Phase C1 remaining: C1.c Detox E2E (unblocked by this migration + frontend-designer orb pass).

---

The Jarvis demo can now run. The only remaining prerequisite is a physical device with the C1.b dev client and local Supabase + stage-engine running (see C1.b handoff §End-to-end demo checklist).
