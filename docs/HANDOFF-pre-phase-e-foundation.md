---
title: "Handoff — Pre-Phase-E Foundation (S5)"
status: done
created: 2026-05-09
updated: 2026-05-09
module: MODULE_BOTSSON
campaign: botsson-arena
sortie: feat/pre-phase-e-foundation
tags: [handoff, phase-e, livekit, auth, missions, foundation]
---

# Handoff — Pre-Phase-E Foundation (S5)

## What Was Built

Four independent foundation tracks, each closing one Phase E KRIT blocker.

### Track A — KRIT-1 closed (query-rewrite, no migration)

**Decision: A2.** Phase E Task 1 plan rewritten. `engine_sessions` query now uses
`mission_id = 'onboarding-interview' AND mode = 'agent'` as discriminator.
`process_id` column does not exist and will not be added — existing `mission_id`
column is sufficient.

**Files modified:**
- `docs/superpowers/plans/2026-05-08-phase-e-cutover-tracks-2-3-4-6.md` — 6 occurrences of
  `process_id` replaced with `mission_id`, test fixtures updated, route code-block updated.

### Track B — KRIT-2 closed (livekit-token wizard-mode)

**Decision: B1.** Existing `livekit-token` EF extended with `purpose: 'wizard'` branch.

**Behaviour:**
- Wizard branch requires no `channelId` (onboarding has no channel binding).
- Room name: `{server-derived-wsId}:wizard:{userId}` — matches ADR-0282 § room naming.
- `workspace_id` server-derived from authenticated user's profile (ADR-0151). Wizard
  allows anonymous callers (no JWT) for landing-page demo flows — `wsId` falls back to
  `"anon"`, `userId` falls back to `"anon"`.
- Auth check moved AFTER purpose dispatch — wizard branch short-circuits before the
  `authError || !user` gate.
- TTL 2h (vs 6h for channel calls). `voiceParticipation: "interactive"` always for wizard.
- Existing `human_call` and `ai_voice` paths structurally unchanged.

**Files modified:**
- `supabase/functions/livekit-token/index.ts`

**Tests created:**
- `apps/web/src/app/api/botsson/livekit-token/__tests__/wizard-token.test.ts`
  — 3 vitest cases: wizard mints + correct room shape, ai_voice regression, invalid purpose
  rejects 400. All 3 pass.

### Track C — KRIT-4 closed (get-server-context canonical helper)

**Files created:**
- `apps/web/src/lib/auth/get-server-context.ts` — resolves auth (Bearer/cookie) via
  `resolveAuth`, then fetches profile row from DB to derive `profile_id` + `workspace_id`.
  Returns `ServerContext | null`. Never trusts workspace_id from request body (ADR-0151).
- `apps/web/src/lib/auth/__tests__/get-server-context.test.ts` — 3 vitest cases:
  authenticated + profile, unauthenticated (null), authenticated + no profile row. 3/3 pass.

**Usage pattern for Phase E Task 1+5:**
```typescript
const ctx = await getServerContext(request);
if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
if (!ctx.profile) return NextResponse.json({ error: "no_profile" }, { status: 403 });
// ctx.profile.workspace_id is server-derived — safe to trust.
```

**Note:** `createAdminClient()` is used for the profile lookup only (bypasses RLS for
cross-workspace lookup). The user identity was already validated by `resolveAuth`.

### Track D — KRIT-6 closed (lise-interview mission)

**Decision: D1.** New `lise-interview` mission added to registry and MissionIdSchema enum.

**Mission spec:**
- `voice: "coral"` — PO-locked 2026-05-08.
- `temperature: 0.5`, `maxDurationSeconds: 1200`.
- `firstSpeaker: "agent"`, `initialOutputMedium: "voice"`.
- System prompt: Lise persona with interview-flow structure (describe → propose → confirm).
- Norwegian default; comprehends Swedish + Danish.

**Files modified:**
- `packages/ai/src/missions/types.ts` — added `"lise-interview"` to `MissionIdSchema` enum.
- `packages/ai/src/missions/registry.ts` — added `"lise-interview"` entry after `landing-demo`.

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Track A | A2 query-rewrite | `mission_id` column already exists, discriminates correctly. No migration. |
| Track B | B1 extend existing EF | One EF surface, less maintenance. Mirrors `ai_voice` pattern. |
| Track D | D1 new mission | Lise interview flow is distinct from landing-demo (different maxDuration, system prompt). |
| Lise voice | `coral` | PO-locked 2026-05-08: warm, measured — matches Lise persona. |
| Wizard workspaceId | server-derive via profile lookup | ADR-0151 compliance. Anonymous fallback `"anon"` for pre-auth demos. |

## Known Limitations / Next Steps

1. **Phase E sortie can now proceed.** All 4 KRIT gates are closed. Re-run council on
   Phase E plan to confirm before opening `feat/botsson-arena-phase-e-cutover`.

2. **lise-interview system prompt is functional but minimal.** The interview flow covers
   the 5 key topics (identity, departments, season, avdelinger, avslutning). Phase E Task 6
   may refine the prompt after UX testing.

3. **Wizard EF anonymous path.** When the caller has no JWT (pure landing-page demo),
   the service role client skips the profile lookup and uses `wsId="anon"`. This is
   intentional — anonymous wizard sessions are valid for the demo flow. Authenticated
   wizard sessions (post-signup, pre-workspace-creation) correctly derive `wsId` from profile.

4. **vad-bench gate (E9) still pending** before Phase E Task 8 (deletions). This sortie
   does not touch the vad-bench plan.

5. **Phase E plan updated field:** `processId` → `missionId` in route.ts response shape
   and test fixtures within the plan doc. Phase E implementer must use `missionId` in the
   actual route implementation.

## Typecheck Status

- `pnpm --filter web typecheck`: 0 errors
- `pnpm --filter @smartout/ai typecheck`: 0 errors

## Test Counts

- Track B: 3/3 vitest cases pass
- Track C: 3/3 vitest cases pass
- Total new tests: 6 across 2 test files
