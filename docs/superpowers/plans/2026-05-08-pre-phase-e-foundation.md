---
title: "Pre-Phase-E Foundation — KRIT-1/2/4/6 Resolution"
status: ready
created: 2026-05-08
updated: 2026-05-08
module: MODULE_BOTSSON
campaign: botsson-arena
phase: pre-E
adr: [ADR-0282, ADR-0078, ADR-0151]
sortie: feat/pre-phase-e-foundation
gates: []
unblocks: feat/botsson-arena-phase-e-cutover
council_review: 2026-05-08
council_verdict: REQUIRED — 4/4 reviewers confirmed Phase E REJECT until KRIT-1/2/4/6 resolved
po_decisions_2026_05_08:
  track_a: A2  # query-rewrite, no migration
  track_b: B1  # extend existing livekit-token EF with purpose:'wizard'
  track_c: always  # canonical helper, no choice
  track_d: D1  # add new lise-interview mission
  lise_voice: coral  # OpenAI Realtime voice ID
tags: [foundation, livekit, edge-function, migration, mission-registry, auth-helper]
---

# Pre-Phase-E Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Resolve 4 critical foundation gaps (KRIT-1/2/4/6) that block Phase E cutover. Without this work, Phase E Tasks 1, 5, 6 cannot execute as written — they reference fictional schema columns, fictional Edge Function shape, fictional import paths, and fictional mission ID.

**Architecture:** Four parallel tracks. Each independent. Each unblocks one Phase E task.

**Tech Stack:** Supabase migration (`engine_sessions` ALTER TABLE + new EF), Next.js Route Handlers (auth helper), TypeScript types, Mission registry edits.

**Estimated time:** 1-2 days (10-12h work with PO-decisions A2/B1/D1/coral locked 2026-05-08).

## PO-Decisions (locked 2026-05-08)

| Track | Decision | Effort | Rationale |
|---|---|---|---|
| A | **A2 query-rewrite** | 1h | No migration. Phase E Task 1 query rewritten to `mission_id='onboarding-interview' AND mode='agent'` |
| B | **B1 extend existing EF** | 3-4h | One EF, mirrors `purpose:'ai_voice'` pattern |
| C | always (no choice) | 2-3h | Canonical helper at `apps/web/src/lib/auth/get-server-context.ts` |
| D | **D1 add new mission** | 3h | New `lise-interview` mission in registry, voice=`coral` |

Total: 9-11h work. Track A2 → minimal Phase E plan patch (no migration). Track D1 → mission registry add.

Sub-agents executing this plan: skip Option A1 + Option B2 + Option D2 sections. Follow only chosen-path steps.

---

## Files

### Created
- `supabase/migrations/<TIMESTAMP>_engine_sessions_process_id.sql` (Track A — KRIT-1)
- `supabase/functions/livekit-token/index.ts` MODIFIED with wizard-mode branch (Track B — KRIT-2) OR new `supabase/functions/livekit-wizard-token/index.ts`
- `apps/web/src/lib/auth/get-server-context.ts` (Track C — KRIT-4)
- `apps/web/src/lib/auth/__tests__/get-server-context.test.ts`

### Modified
- `packages/ai/src/missions/registry.ts` — add `lise-interview` mission OR rename `landing-demo` (Track D — KRIT-6)

---

## Track A — KRIT-1: engine_sessions.process_id

**Problem:** Phase E Task 1 queries `engine_sessions` on `mode='agent' process_id='onboarding_v1'`. `process_id` column does not exist.

**Decision required (PO):** 
- Option A1: Add `process_id` column via migration. Reads as plan describes.
- Option A2: Rewrite Phase E Task 1 to use `mission_id = 'onboarding-interview'` AND `mode = 'agent'` as discriminator. No migration needed.

**Recommendation:** Option A2. Existing `mission_id` column already discriminates. Adding `process_id` is duplicative.

If PO chooses A1:

- [ ] **Step 1: Reserve migration timestamp**

```bash
ls supabase/migrations/ | tail -1
# Pick HHMM strictly greater than tip (per L-0042)
```

- [ ] **Step 2: Write migration**

```sql
-- supabase/migrations/<TS>_engine_sessions_process_id.sql
ALTER TABLE engine_sessions ADD COLUMN process_id TEXT;
CREATE INDEX engine_sessions_process_id_idx ON engine_sessions(process_id);
COMMENT ON COLUMN engine_sessions.process_id IS
  'Process discriminator for engine_sessions. Onboarding mode uses onboarding_v1.';
```

- [ ] **Step 3: Apply locally**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<TS>_engine_sessions_process_id.sql
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Commit**

If PO chooses A2: skip Track A. Phase E Task 1 patch documented in ORCHESTRATION.

---

## Track B — KRIT-2: livekit-token wizard-mode

**Problem:** Phase E Task 5 invokes `supabase.functions.invoke("livekit-token", { body: { room_name, mission_id, ... } })`. Real EF requires `channelId` + channel-membership, returns `{serverUrl, roomName}` not `{room_url, room_name}`. Wizard has no channelId.

**Decision required (PO):**
- Option B1: Extend existing `livekit-token` EF with `purpose: "wizard"` branch (bypasses channelId requirement, mints `{workspaceId|"anon"}:wizard:{userId|"anon"}` room name). One EF.
- Option B2: Create new `livekit-wizard-token` EF dedicated to onboarding flow. Two EFs.

**Recommendation:** Option B1. One EF, less surface, follows existing `purpose: "ai_voice"` pattern.

Track B implementation (B1):

- [ ] **Step 1: Read existing EF**

```bash
cat supabase/functions/livekit-token/index.ts
```

- [ ] **Step 2: Add wizard branch**

After existing channel-membership check (around line 70-90), add:

```typescript
// Wizard mode — onboarding flow has no channelId yet
if (body.purpose === "wizard") {
  // Bypass channel-membership; allow anonymous (no auth) for onboarding-interview
  const userId = user?.id ?? "anon";
  const wsId = body.workspaceId ?? "anon";
  roomName = `${wsId}:wizard:${userId}`;
  voiceParticipation = "interactive";
  // skip channel.audio_policy — wizard has no channel binding
}
```

Update body schema to allow `purpose: "wizard"` AND make `channelId` optional when `purpose === "wizard"`.

- [ ] **Step 3: Test EF locally**

```bash
op run --env-file=.env.template -- npx supabase functions serve livekit-token
# Probe with wizard-mode body
```

- [ ] **Step 4: Update Phase E Task 5 plan to consume wizard-mode**

Phase E Task 5 plan body must change `body: { room_name, mission_id, ... }` to `body: { purpose: "wizard", workspaceId, mission_id }` and consume `{serverUrl, roomName}` (camelCase) not `{room_url, room_name}` (snake_case).

This patch lands as part of THIS sortie (pre-Phase-E foundation), not Phase E itself.

---

## Track C — KRIT-4: apps/web/src/lib/auth/get-server-context.ts

**Problem:** Phase E Task 1 + Task 5 import from `@/lib/auth/get-server-context`. Directory does not exist. Plan-author assumed B2's `resolveAuth` helper had a profile-context wrapper. It doesn't — `resolveAuth` returns `{user, accessToken, authMethod}`, no profile.

**Solution:** Build the helper.

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/src/lib/auth/__tests__/get-server-context.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockResolveAuth = vi.fn();
const mockAdminFromProfile = vi.fn();

vi.mock("@/lib/auth/resolve-auth", () => ({ resolveAuth: mockResolveAuth }));
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: () => mockAdminFromProfile() })),
}));

beforeEach(() => vi.resetAllMocks());

describe("getServerContext — auth + profile bundle", () => {
  it("returns user + profile when authenticated and profile exists", async () => {
    mockResolveAuth.mockResolvedValue({
      user: { id: "u1" }, accessToken: "t", authMethod: "cookie",
    });
    const profileChain = {
      select: () => profileChain, eq: () => profileChain,
      maybeSingle: async () => ({
        data: { profile_id: "p1", workspace_id: "w1", role: "owner" },
        error: null,
      }),
    };
    mockAdminFromProfile.mockReturnValue(profileChain);

    const { getServerContext } = await import("../get-server-context");
    const req = new NextRequest("http://localhost/x");
    const ctx = await getServerContext(req);
    expect(ctx).toMatchObject({
      user: { id: "u1" },
      profile: { profile_id: "p1", workspace_id: "w1", role: "owner" },
    });
  });

  it("returns null when auth fails", async () => {
    mockResolveAuth.mockResolvedValue(null);
    const { getServerContext } = await import("../get-server-context");
    expect(await getServerContext(new NextRequest("http://localhost/x"))).toBeNull();
  });

  it("returns user + null profile when authed but no profile row", async () => {
    mockResolveAuth.mockResolvedValue({
      user: { id: "u1" }, accessToken: "t", authMethod: "cookie",
    });
    const chain = {
      select: () => chain, eq: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    mockAdminFromProfile.mockReturnValue(chain);

    const { getServerContext } = await import("../get-server-context");
    const ctx = await getServerContext(new NextRequest("http://localhost/x"));
    expect(ctx).toMatchObject({ user: { id: "u1" }, profile: null });
  });
});
```

- [ ] **Step 2: Implement helper**

```typescript
// apps/web/src/lib/auth/get-server-context.ts
import type { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/auth/resolve-auth";
import { createAdminClient } from "@smartout/supabase/admin";

export type ServerContext = {
  user: { id: string };
  accessToken: string | undefined;
  authMethod: "bearer" | "cookie";
  profile: {
    profile_id: string;
    workspace_id: string;
    role: string;
  } | null;
};

/**
 * Resolves auth + profile in one shot. Used by BFF routes that need
 * both user identity and workspace context (e.g., /api/emma/session).
 *
 * Returns null on auth failure. Profile is null when user has no
 * profile row in any workspace yet (onboarding state).
 *
 * Built per ADR-0151 — workspace_id is server-derived from profile,
 * never from request body.
 */
export async function getServerContext(request: NextRequest): Promise<ServerContext | null> {
  const auth = await resolveAuth(request);
  if (!auth) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();

  return {
    user: auth.user,
    accessToken: auth.accessToken,
    authMethod: auth.authMethod,
    profile: profile ?? null,
  };
}
```

- [ ] **Step 3: Run tests, expect pass.**

```bash
pnpm --filter web vitest run apps/web/src/lib/auth/__tests__/get-server-context.test.ts
```

- [ ] **Step 4: Commit + update Phase E Task 1+5 plan to import correctly**

Phase E plan currently imports `@/lib/auth/get-server-context` — after Track C lands, this resolves correctly. No further patch needed if plan body matches.

**Note:** Track C depends on B2 having merged `resolveAuth` (B2 Task 1+2). Sequencing: B2 first → Track C.

---

## Track D — KRIT-6: lise-interview mission ID

**Problem:** Phase E Task 6 sets `missionId = "lise-interview"` in InterviewSurface skeleton. Mission does not exist in registry. Lise persona currently uses `landing-demo` mission.

**Decision required (PO):**
- Option D1: Add new `lise-interview` mission to registry (Lise persona but interview-flow-driven, not landing-demo).
- Option D2: Change Phase E Task 6 default to `missionId = "landing-demo"` (use existing Lise persona/mission).

**Recommendation:** Option D2 unless PO has specific reason for new mission. Saves a mission-spec round.

If D1:

- [ ] **Step 1: Add mission to registry**

In `packages/ai/src/missions/registry.ts`, after `landing-demo` (line ~158-197), add:

```typescript
"lise-interview": {
  id: "lise-interview",
  name: "Lise — Interview / Onboarding-flow demo",
  description: "Lise persona in InterviewSurface — wizard-style onboarding demo flow",
  agentDisplayName: "Lise",
  greeting: "Hei! Jeg er Lise. La meg hjelpe deg gjennom dette.",
  uiDescription: "Lise — onboarding interview",
  language: "no",
  voice: "coral", // OR "shimmer" — pinned per Lise persona spec (warm/founder energy)
  temperature: 0.5,
  maxDurationSeconds: 1200,
  firstSpeaker: "agent",
  initialOutputMedium: "voice",
  systemPrompt: `Du er "Lise"... [based on landing-demo systemPrompt with interview-flow modifications]`,
},
```

- [ ] **Step 2: Update intent-classifier z.enum (if needed)**

Mission IDs typically aren't in classifier enum (channel-discriminator level), but verify.

- [ ] **Step 3: Lise voice mapping**

Pin LiveKit Agents-compatible voice. Council 2026-05-08 R1 frontend designer recommendation: `coral` (warm, measured) or `shimmer` (clear, slightly warm) align with Lise persona. PO must approve voice choice.

If D2: skip Track D. Phase E Task 6 patch documented in ORCHESTRATION.

---

## Acceptance Criteria

- [ ] Track A done — `engine_sessions` schema accepts Phase E Task 1 query (either column added OR Phase E rewritten to use mission_id)
- [ ] Track B done — `livekit-token` EF accepts wizard-mode payload (either extended OR new EF), Phase E Task 5 patched to consume correct shape
- [ ] Track C done — `get-server-context.ts` exists, 3 vitest cases PASS, Phase E imports resolve
- [ ] Track D done — Lise mission in registry OR Phase E Task 6 patched to use existing `landing-demo`
- [ ] **Scope guard:** No commit touches files outside `supabase/migrations/`, `supabase/functions/livekit-token/` OR `supabase/functions/livekit-wizard-token/`, `apps/web/src/lib/auth/`, `packages/ai/src/missions/registry.ts`, `packages/supabase/src/database.types.ts` (regenerated)
- [ ] After all 4 tracks: re-run council on Phase E plan to confirm KRIT-1/2/4/6 closed before opening Phase E sortie

## Estimated Time

- Track A: 1h (with A2 recommendation) or 3h (with A1 migration)
- Track B: 3-4h (EF extension + testing)
- Track C: 2h (helper + 3 vitest cases + integration smoke)
- Track D: 1h (with D2) or 3h (with D1 mission spec)

Total: 7-12h depending on PO decisions on options.

## Rollback

Track A: revert migration + regenerate types
Track B: revert EF, restore Ultravox path in wizard
Track C: revert helper file, no consumers yet
Track D: revert mission registry edit

All independent and reversible.
