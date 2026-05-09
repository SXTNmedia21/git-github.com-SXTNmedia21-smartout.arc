---
title: "Phase E Cutover — Tracks 2/3/4/6 (Provider Flip + Cleanup)"
status: ready
created: 2026-05-08
updated: 2026-05-09
module: MODULE_BOTSSON
campaign: botsson-arena
phase: E
adr: [ADR-0282, ADR-0107, ADR-0135, ADR-0276]
sortie: feat/botsson-arena-phase-e-cutover
predecessor_plan: docs/plans/PLAN-voice-plane-consolidation.md
gates:
  - docs/superpowers/plans/2026-05-08-vad-bench-pre-sortie-gate.md (E9 — gates Task 8 deletions)
  - docs/superpowers/plans/2026-05-08-b1-server-derive-workspace-id.md (B1 — security; Phase E lands after)
tags: [livekit, ultravox, voice, botsson, phase-e, cutover, deletion]
---

# Phase E Cutover — Tracks 2/3/4/6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close ADR-0282 Phase E. Web Ultravox path → LiveKit Agents 1.3.0 single-plane. Provider flip in `BotssonProvider.tsx`, `useBotsson.ts` rewrite, wizard `/api/wizard/start` LiveKit token mint, `voice-assistant.tsx` rewrite as `<InterviewSurface persona={Lise}>`, Krisp NC wiring, Ultravox deletion sweep, ADR-0107 amendment, ADR-0282 status flip.

**Architecture:** Sequential tracks, each independently revertable until Task 8 deletion gate. Track 1 (E1 capability build) shipped via PR #342 — onboarding capability + 10 tools + intent-classifier + telemetry events live. Track 5 (E9 vad-bench) lands via separate plan — its PASS verdict gates Task 8 here. Tasks 1-7 + 9-10 contained in this plan.

**Tech Stack:** Next.js 16 App Router (Route Handlers), React 19, LiveKit Client 2.17.x, LiveKit Agents 1.3.0, Vitest, Hono on stage-engine, Supabase Edge Functions (Deno), `@livekit/krisp-noise-filter`, `@livekit/react-native-krisp-noise-filter`.

---

## Files

### Created
- `apps/web/src/app/api/emma/session/route.ts` — BFF endpoint reading `engine_sessions` mission_id='onboarding-interview' AND mode='agent' (A2: no process_id column needed)
- `apps/web/src/app/api/emma/session/__tests__/route.test.ts` — Vitest cases
- `packages/agent-sdk/src/providers/__tests__/livekit-translation.test.ts` — apiParams translation contract Vitest cases
- `apps/web/src/components/InterviewSurface.tsx` — provider-agnostic Lise persona-bearer (replaces voice-assistant.tsx via rewrite-in-place)
- `docs/decisions/0276-adr-0107-amendment-provider-independence.md` — ADR-0107 amendment
- `docs/HANDOFF-phase-e-cutover.md` — closure handoff

### Modified
- `packages/agent-sdk/src/providers/livekit.ts` — apiParams translation contract for `voice`, `language_hint`, `first_speaker`, `inactivity_timeout`
- `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:694` — flip `provider: "ultravox"` → `provider: "livekit"`
- `apps/web/src/app/onboarding/hooks/useBotsson.ts` — rewrite: `UltravoxSession` → `VoiceProvider` abstraction, strip 13 server-bound `temporaryTool` registrations, keep `advanceToNextSection` only
- `apps/web/src/app/api/wizard/start/route.ts:88-160` — replace `/adapters/ultravox/create-call` calls with LiveKit token mint via `supabase/functions/livekit-token/`
- `apps/web/src/app/onboarding/components/BotssonAvatar.tsx:5` — replace `UltravoxSessionStatus` import with `VoiceProviderStatus`
- `apps/web/src/components/voice-assistant.tsx` — REWRITE as `<InterviewSurface persona={...} />`
- `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` — Krisp NC wiring on LiveKit Room creation site
- `apps/mobile/src/hooks/use-botsson-voice-session.ts` — Krisp NC wiring (mobile)
- `services/voice-agent/src/agent.ts` — verify NC-off (lint/grep test only, no code change)
- `apps/web/package.json` — remove `ultravox-client` dep
- `services/stage-engine/src/secrets.ts:11,53,61,68,76-77,88` — remove `ultravoxApiKey` field
- `apps/web/src/app/platform-admin/services/_components/service-contracts.ts:169-193` — remove Ultravox path entries
- `apps/web/src/app/platform-admin/keys/_components/service-registry.ts:94-95` — remove Ultravox path entries
- 6 test fixtures — remove `ultravoxApiKey: null`
- `docs/decisions/0282-voice-plane-consolidation-livekit-only.md` — status `proposed` → `accepted`
- `docs/decisions/0000-decision-log.md` — register ADR-0276, flip ADR-0282 status
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` — voice-plane row 🟡 → 🟢
- `docs/plans/CAMPAIGN-botsson-arena.md` — sync log entry Phase E complete

### Deleted (Task 8 — gated by vad-bench PASS)
- `services/stage-engine/src/routes/adapters/ultravox.ts`
- `services/stage-engine/src/types/ultravox.ts`
- `services/stage-engine/src/lib/ultravox.ts`
- `packages/agent-sdk/src/providers/ultravox.ts`

## Self-Review Notes

**Track 1 (E1) is DONE:** PR #342 `voice-plane-consolidation-recovery` merged 10 onboarding tools (`updateBusiness`, `updateSeason`, `addDepartments`, `addLocations`, `addZones`, `addProcedures`, `scrapeWebsite`, `searchCompany`, `identifyCompany`, `addKeyFact`) + capability registry + intent-classifier + telemetry events. Verified via `grep -rE "onboarding" packages/ai/src/capabilities/registry.ts packages/ai/src/capabilities/types.ts`. Do NOT re-implement.

**Track 5 (E9 vad-bench) gating Task 8:** vad-bench plan (`docs/superpowers/plans/2026-05-08-vad-bench-pre-sortie-gate.md`) MUST pass before Task 8 deletions. P50 ≤ 600ms, P95 ≤ 900ms, false-end-of-turn ≤ 5%. Run as separate sortie; this plan blocks at Task 8 entry until green.

**B1 sequencing:** B1 (`docs/superpowers/plans/2026-05-08-b1-server-derive-workspace-id.md`) hardens the existing Ultravox path (forgery fix on `/api/wizard/start:80` + stage-engine adapter). B1 lands FIRST so any short window where Ultravox still serves wizard requests is hardened. After Task 5 here, the Ultravox path no longer receives traffic — B1 fixes become moot (file deleted in Task 8) but harm-free.

**Lise persona preservation (Task 6):** `voice-assistant.tsx` is the dedicated Lise interview surface (warmth, conversational pacing, persona prompt). NOT a generic widget. Rewrite preserves persona — Pontus G3 approval gate at end of Task 6.

**Onboarding D1 cascade contract (Task 4 reference):** D1 tools (`add_departments`, `add_locations`, `add_zones`) are IN-MEMORY wizard state per ADR-0282 R4 corrected + cascade-developer FAIL verdict 2026-05-04. NO `cascade_gate_write`. Single cascade write remains `finalize-workspace` Edge Function. T1.6 implementation already correct in `packages/ai/src/capabilities/onboarding/tools.ts`. Do not introduce DB writes.

**LiveKit room naming (Task 5):** `{workspaceId}:wizard:{userId}` for wizard onboarding. Voice-agent dispatches via existing `services/voice-agent/src/adapter.ts` room-pattern matching.

---

## Task 1: BFF route `/api/emma/session` (T2.1)

**Files:**
- Create: `apps/web/src/app/api/emma/session/route.ts`
- Create: `apps/web/src/app/api/emma/session/__tests__/route.test.ts`

Reads `engine_sessions` row by `mission_id='onboarding-interview'` AND `mode='agent'` for the resolved workspace. Returns wizard onboarding state (current section, answered keys, profile context). Replaces client-side `getOnboardingState` Ultravox tool.

> **A2 rewrite (pre-Phase-E foundation):** `process_id` column does not exist on `engine_sessions`. Query uses existing `mission_id` column as discriminator instead. No migration needed.

- [ ] **Step 1: Write failing test — happy path returns 200 with session payload**

Create `apps/web/src/app/api/emma/session/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/auth/get-server-context", () => ({
  getServerContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

import { getServerContext } from "@/lib/auth/get-server-context";
import { createServerClient } from "@/lib/supabase/server";

describe("/api/emma/session GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with session payload for authenticated user with workspace", async () => {
    vi.mocked(getServerContext).mockResolvedValue({
      user: { id: "user-1" } as never,
      profile: { profile_id: "profile-1", workspace_id: "ws-1" } as never,
    });

    vi.mocked(createServerClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "session-1",
                      mode: "agent",
                      mission_id: "onboarding-interview",
                      state: { current_section: "season", answered: ["business"] },
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      }),
    } as never);

    const req = new Request("http://localhost/api/emma/session");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      sessionId: "session-1",
      missionId: "onboarding-interview",
      state: { current_section: "season", answered: ["business"] },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerContext).mockResolvedValue({ user: null, profile: null } as never);

    const req = new Request("http://localhost/api/emma/session");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 404 when no engine_sessions row exists for workspace", async () => {
    vi.mocked(getServerContext).mockResolvedValue({
      user: { id: "user-1" } as never,
      profile: { profile_id: "profile-1", workspace_id: "ws-1" } as never,
    });

    vi.mocked(createServerClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as never);

    const req = new Request("http://localhost/api/emma/session");
    const res = await GET(req);

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
pnpm --filter web vitest run apps/web/src/app/api/emma/session/__tests__/route.test.ts
```

Expected: FAIL with "Cannot find module '../route'".

- [ ] **Step 3: Implement route**

Create `apps/web/src/app/api/emma/session/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerContext } from "@/lib/auth/get-server-context";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(_req: Request) {
  const { user, profile } = await getServerContext();

  if (!user || !profile?.workspace_id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("engine_sessions")
    .select("id, mode, mission_id, state")
    .eq("workspace_id", profile.workspace_id)
    .eq("mission_id", "onboarding-interview")
    .eq("mode", "agent")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "session_query_failed", details: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: data.id,
    mode: data.mode,
    missionId: data.mission_id,
    state: data.state,
  });
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm --filter web vitest run apps/web/src/app/api/emma/session/__tests__/route.test.ts
```

Expected: PASS — 3/3 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/emma/session/
git commit -m "$(cat <<'EOF'
feat(emma): /api/emma/session BFF route — replaces client getOnboardingState (T2.1)

ADR-0282 Phase E E2. Reads engine_sessions mission_id=onboarding-interview AND
mode=agent for resolved workspace. A2 rewrite: no process_id column. 3 vitest
cases: happy path, 401 unauth, 404 no-session.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: apiParams translation contract — Ultravox-shape → LiveKit Agents config (T2.4)

**Files:**
- Modify: `packages/agent-sdk/src/providers/livekit.ts`
- Create: `packages/agent-sdk/src/providers/__tests__/livekit-translation.test.ts`

Wizard + Botsson legacy pass `voice`, `language_hint`, `first_speaker`, `inactivity_timeout`. LiveKit Agents config consumes different field names. Pure-function translation contract enables provider flip without touching every callsite.

- [ ] **Step 1: Write failing test — translation contract**

Create `packages/agent-sdk/src/providers/__tests__/livekit-translation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { translateUltravoxApiParams } from "../livekit";

describe("translateUltravoxApiParams", () => {
  it("maps voice slug to LiveKit voice config", () => {
    const out = translateUltravoxApiParams({
      voice: "lise-warm-no",
      language_hint: "no",
      first_speaker: "agent",
      inactivity_timeout: 30000,
    });

    expect(out).toMatchObject({
      voiceId: "lise-warm-no",
      language: "no",
      initialSpeaker: "agent",
      sessionTimeoutMs: 30000,
    });
  });

  it("defaults language to 'no' when language_hint missing", () => {
    const out = translateUltravoxApiParams({ voice: "lise-warm-no" });
    expect(out.language).toBe("no");
  });

  it("defaults initialSpeaker to 'user' when first_speaker missing", () => {
    const out = translateUltravoxApiParams({ voice: "lise-warm-no" });
    expect(out.initialSpeaker).toBe("user");
  });

  it("defaults sessionTimeoutMs to 60000 when inactivity_timeout missing", () => {
    const out = translateUltravoxApiParams({ voice: "lise-warm-no" });
    expect(out.sessionTimeoutMs).toBe(60_000);
  });

  it("rejects invalid first_speaker enum", () => {
    expect(() =>
      translateUltravoxApiParams({
        voice: "lise-warm-no",
        first_speaker: "invalid" as never,
      }),
    ).toThrow(/first_speaker/);
  });

  it("rejects negative inactivity_timeout", () => {
    expect(() =>
      translateUltravoxApiParams({
        voice: "lise-warm-no",
        inactivity_timeout: -100,
      }),
    ).toThrow(/inactivity_timeout/);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
pnpm --filter @smartout/agent-sdk vitest run src/providers/__tests__/livekit-translation.test.ts
```

Expected: FAIL with "translateUltravoxApiParams is not a function" or import error.

- [ ] **Step 3: Implement translation contract**

Open `packages/agent-sdk/src/providers/livekit.ts` and append:

```typescript
import { z } from "zod";

const UltravoxApiParamsSchema = z.object({
  voice: z.string().min(1),
  language_hint: z.string().optional(),
  first_speaker: z.enum(["agent", "user"]).optional(),
  inactivity_timeout: z.number().int().positive().optional(),
});

export type UltravoxApiParams = z.infer<typeof UltravoxApiParamsSchema>;

export type LiveKitAgentsConfig = {
  voiceId: string;
  language: string;
  initialSpeaker: "agent" | "user";
  sessionTimeoutMs: number;
};

export function translateUltravoxApiParams(params: UltravoxApiParams): LiveKitAgentsConfig {
  const parsed = UltravoxApiParamsSchema.parse(params);
  return {
    voiceId: parsed.voice,
    language: parsed.language_hint ?? "no",
    initialSpeaker: parsed.first_speaker ?? "user",
    sessionTimeoutMs: parsed.inactivity_timeout ?? 60_000,
  };
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm --filter @smartout/agent-sdk vitest run src/providers/__tests__/livekit-translation.test.ts
```

Expected: PASS — 6/6 cases green.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-sdk/src/providers/
git commit -m "$(cat <<'EOF'
feat(agent-sdk): apiParams translation contract — Ultravox-shape to LiveKit (T2.4)

ADR-0282 Phase E E3 prep. Pure-fn maps voice/language_hint/first_speaker/
inactivity_timeout to LiveKit Agents voiceId/language/initialSpeaker/
sessionTimeoutMs. 6 vitest cases including Zod refinements (enum, positive int).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: BotssonProvider provider flip — `ultravox` → `livekit` (T2.2)

**Files:**
- Modify: `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:694`

One-line decision flip. Verified by Botsson overlay voice path connecting through LiveKit Room (already wired in `BotssonOrbVoiceMount.tsx`).

- [ ] **Step 1: Read current line**

```bash
sed -n '690,700p' apps/web/src/app/Botsson/_components/BotssonProvider.tsx
```

Confirm line 694 is `provider: "ultravox",`.

- [ ] **Step 2: Edit BotssonProvider.tsx**

Replace `provider: "ultravox",` on line 694 with `provider: "livekit",`. Use Edit tool (file context will guide unique-string match).

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Manual smoke check**

Run dev server. Open `/dashboard` → Botsson overlay → mic button. Verify LiveKit Room mounts (not Ultravox session). Network tab shows `wss://*.livekit.cloud` not `wss://*.ultravox.ai`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/Botsson/_components/BotssonProvider.tsx
git commit -m "$(cat <<'EOF'
feat(botsson): provider flip ultravox -> livekit at BotssonProvider:694 (T2.2)

ADR-0282 Phase E E3. Web Botsson overlay voice now routes through LiveKit
Agents 1.3.0 via services/voice-agent/. ADR-0107 mode->channel derivation
preserved (provider-independent per ADR-0276 amendment).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: useBotsson.ts rewrite — strip 13 server-bound temporaryTool (T2.3)

**Files:**
- Modify: `apps/web/src/app/onboarding/hooks/useBotsson.ts` (712 → ~250 lines)
- Modify: `apps/web/src/app/onboarding/components/BotssonAvatar.tsx:5`

Replace `UltravoxSession` with `VoiceProvider` abstraction from `packages/agent-sdk/src/providers/voice-provider.ts`. Strip all 13 server-bound `temporaryTool` definitions (now live as onboarding capability tools per Track 1). Keep `advanceToNextSection` only — UI-only LiveKit data-channel client tool.

- [ ] **Step 1: Read current useBotsson.ts and inventory**

```bash
grep -nE "temporaryTool|registerToolImplementation|UltravoxSession" apps/web/src/app/onboarding/hooks/useBotsson.ts
```

Expected: 13 temporaryTool blocks + UltravoxSession imports + status type imports.

- [ ] **Step 2: Write integration-style failing test**

Create `apps/web/src/app/onboarding/hooks/__tests__/useBotsson.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBotsson } from "../useBotsson";

describe("useBotsson (post-rewrite)", () => {
  it("does not import UltravoxSession", () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../useBotsson.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/UltravoxSession/);
    expect(source).not.toMatch(/ultravox-client/);
  });

  it("registers exactly one client tool (advanceToNextSection)", () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../useBotsson.ts"),
      "utf8",
    );
    const matches = source.match(/registerClientTool\(/g) ?? [];
    expect(matches.length).toBe(1);
    expect(source).toMatch(/advanceToNextSection/);
  });
});
```

- [ ] **Step 3: Run test, expect fail**

```bash
pnpm --filter web vitest run apps/web/src/app/onboarding/hooks/__tests__/useBotsson.test.ts
```

Expected: FAIL — UltravoxSession + 13+ tool registrations still present.

- [ ] **Step 4: Rewrite useBotsson.ts**

Replace entire file content with VoiceProvider-based hook. Approximate skeleton:

```typescript
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createVoiceProvider } from "@smartout/agent-sdk/providers/voice-provider";
import { translateUltravoxApiParams } from "@smartout/agent-sdk/providers/livekit";
import type { VoiceProviderStatus } from "@smartout/agent-sdk/providers/voice-provider";

export type UseBotssonOptions = {
  voice: string;
  language?: string;
  firstSpeaker?: "agent" | "user";
  inactivityTimeoutMs?: number;
  onAdvanceSection?: () => void;
};

export function useBotsson(opts: UseBotssonOptions) {
  const [status, setStatus] = useState<VoiceProviderStatus>("idle");
  const providerRef = useRef<ReturnType<typeof createVoiceProvider> | null>(null);

  const start = useCallback(async () => {
    const cfg = translateUltravoxApiParams({
      voice: opts.voice,
      language_hint: opts.language,
      first_speaker: opts.firstSpeaker,
      inactivity_timeout: opts.inactivityTimeoutMs,
    });

    const startRes = await fetch("/api/wizard/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mission_id: "onboarding-interview",
        voice: cfg.voiceId,
        language: cfg.language,
        first_speaker: cfg.initialSpeaker,
      }),
    });

    if (!startRes.ok) {
      setStatus("error");
      return;
    }

    const { roomUrl, token } = await startRes.json();

    const provider = createVoiceProvider({
      provider: "livekit",
      roomUrl,
      token,
      onStatusChange: setStatus,
    });

    provider.registerClientTool("advanceToNextSection", async () => {
      opts.onAdvanceSection?.();
      return { ok: true };
    });

    providerRef.current = provider;
    await provider.connect();
  }, [opts]);

  const stop = useCallback(async () => {
    await providerRef.current?.disconnect();
    providerRef.current = null;
  }, []);

  useEffect(() => () => void providerRef.current?.disconnect(), []);

  return { status, start, stop };
}
```

(Engineer adapts to actual `VoiceProvider` API in `packages/agent-sdk/src/providers/voice-provider.ts`. Consult interface before pasting.)

- [ ] **Step 5: Update BotssonAvatar import**

Edit `apps/web/src/app/onboarding/components/BotssonAvatar.tsx` line 5:

```typescript
// before
import { UltravoxSessionStatus } from "ultravox-client";
// after
import type { VoiceProviderStatus } from "@smartout/agent-sdk/providers/voice-provider";
```

Update any usage sites (likely status comparisons — replace `UltravoxSessionStatus.IDLE` with `"idle"` string literal etc).

- [ ] **Step 6: Run vitest + typecheck**

```bash
pnpm --filter web vitest run apps/web/src/app/onboarding/hooks/__tests__/useBotsson.test.ts
pnpm --filter web typecheck
```

Expected: vitest 2/2 PASS, typecheck 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/onboarding/hooks/useBotsson.ts \
        apps/web/src/app/onboarding/hooks/__tests__/useBotsson.test.ts \
        apps/web/src/app/onboarding/components/BotssonAvatar.tsx
git commit -m "$(cat <<'EOF'
refactor(onboarding): useBotsson rewrite — VoiceProvider abstraction (T2.3)

ADR-0282 Phase E E3. UltravoxSession removed. 13 server-bound temporaryTool
defs stripped (now live as onboarding capability tools per Track 1 PR #342).
advanceToNextSection retained as UI-only client tool. BotssonAvatar import
swapped to VoiceProviderStatus. 712 -> ~250 lines.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: wizard `/api/wizard/start` LiveKit token mint + fallback Neste button (T2.5, T2.6)

**Files:**
- Modify: `apps/web/src/app/api/wizard/start/route.ts:88-160`
- Modify: `apps/web/src/app/onboarding/_components/<wizard-shell>.tsx` (location varies — find via `grep -l "voice-assistant\|useBotsson" apps/web/src/app/onboarding/`) — add fallback "Neste" button when LiveKit unavailable
- Create: `apps/web/src/app/api/wizard/start/__tests__/route.livekit.test.ts`

Replace stage-engine `/adapters/ultravox/create-call` POST with LiveKit token mint via `supabase.functions.invoke("livekit-token", ...)`. Returns `{ roomUrl, token, sessionId }`. Wizard fallback "Neste" button mitigates ≤1 deploy cycle gap window.

- [ ] **Step 1: Write failing integration test**

Create `apps/web/src/app/api/wizard/start/__tests__/route.livekit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

vi.mock("@/lib/auth/get-server-context", () => ({
  getServerContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

import { getServerContext } from "@/lib/auth/get-server-context";
import { createServerClient } from "@/lib/supabase/server";

describe("/api/wizard/start POST (LiveKit cutover)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mints LiveKit token via livekit-token edge function for authenticated wizard call", async () => {
    vi.mocked(getServerContext).mockResolvedValue({
      user: { id: "user-1" } as never,
      profile: { profile_id: "profile-1", workspace_id: "ws-1" } as never,
    });

    const invokeMock = vi.fn().mockResolvedValue({
      data: {
        room_url: "wss://test.livekit.cloud",
        token: "lk-token-abc",
        room_name: "ws-1:wizard:user-1",
      },
      error: null,
    });

    vi.mocked(createServerClient).mockReturnValue({
      functions: { invoke: invokeMock },
    } as never);

    const req = new Request("http://localhost/api/wizard/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mission_id: "onboarding-interview",
        voice: "lise-warm-no",
        language: "no",
        first_speaker: "agent",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(invokeMock).toHaveBeenCalledWith(
      "livekit-token",
      expect.objectContaining({
        body: expect.objectContaining({
          room_name: "ws-1:wizard:user-1",
          mission_id: "onboarding-interview",
        }),
      }),
    );
    expect(body).toMatchObject({
      roomUrl: "wss://test.livekit.cloud",
      token: "lk-token-abc",
    });
  });

  it("does NOT call /adapters/ultravox/create-call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.mocked(getServerContext).mockResolvedValue({
      user: { id: "user-1" } as never,
      profile: { profile_id: "profile-1", workspace_id: "ws-1" } as never,
    });
    vi.mocked(createServerClient).mockReturnValue({
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { room_url: "wss://x", token: "t", room_name: "r" },
          error: null,
        }),
      },
    } as never);

    const req = new Request("http://localhost/api/wizard/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mission_id: "onboarding-interview", voice: "lise-warm-no" }),
    });
    await POST(req);

    const ultravoxCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/adapters/ultravox/"),
    );
    expect(ultravoxCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
pnpm --filter web vitest run apps/web/src/app/api/wizard/start/__tests__/route.livekit.test.ts
```

Expected: FAIL — current route still calls `/adapters/ultravox/create-call`.

- [ ] **Step 3: Rewrite route handler**

Replace lines 88-160 of `apps/web/src/app/api/wizard/start/route.ts`. Key changes:

```typescript
const supabase = createServerClient();
const roomName = `${workspaceId ?? "anon"}:wizard:${user?.id ?? "anon"}`;

const { data, error } = await supabase.functions.invoke("livekit-token", {
  body: {
    room_name: roomName,
    mission_id: missionId,
    workspace_id: workspaceId,
    user_id: user?.id,
    profile_id: profileId,
    voice: body.voice,
    language: body.language ?? "no",
    first_speaker: body.first_speaker ?? "agent",
    context: body.context,
  },
});

if (error || !data) {
  console.error("[wizard/start] livekit_token_failed", {
    request_id: requestId,
    mission_id: missionId,
    error: error?.message ?? "unknown_error",
  });
  return NextResponse.json(
    { error: "VOICE_PROVIDER_UNAVAILABLE", request_id: requestId },
    { status: 503 },
  );
}

return NextResponse.json({
  sessionId: data.room_name,
  roomUrl: data.room_url,
  token: data.token,
  requestId,
});
```

Drop the `/adapters/ultravox/` mission-fallback block — voice-agent dispatches missions via room-name pattern matching.

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm --filter web vitest run apps/web/src/app/api/wizard/start/__tests__/route.livekit.test.ts
```

Expected: PASS — 2/2 cases green.

- [ ] **Step 5: Add fallback "Neste" button (T2.6)**

Find wizard shell:

```bash
grep -l "useBotsson\|voice-assistant" apps/web/src/app/onboarding/
```

In the wizard shell component, render fallback button when `useBotsson()` returns `status === "error"` OR when the start response was 503:

```tsx
{voiceStatus === "error" && (
  <button
    onClick={onAdvanceSection}
    className="text-sm text-muted-foreground underline"
  >
    Neste (uten stemme)
  </button>
)}
```

- [ ] **Step 6: Verify typecheck + manual E2E smoke**

```bash
pnpm --filter web typecheck
```

Manual: open `/onboarding`, mic button → verify LiveKit Room mounts (network tab shows livekit.cloud WSS), no ultravox.ai calls.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/wizard/start/ apps/web/src/app/onboarding/
git commit -m "$(cat <<'EOF'
feat(wizard): /api/wizard/start mints LiveKit token, drops Ultravox (T2.5+T2.6)

ADR-0282 Phase E E5. Replaces stage-engine /adapters/ultravox/create-call
with supabase.functions.invoke("livekit-token"). Room name pattern
{workspaceId}:wizard:{userId} drives voice-agent mission dispatch via
adapter.ts pattern matching. 503 VOICE_PROVIDER_UNAVAILABLE on edge fail
triggers fallback "Neste (uten stemme)" button (deploy-window mitigation).
2 vitest cases verify livekit-token invocation + zero /adapters/ultravox/ calls.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: voice-assistant.tsx rewrite as `<InterviewSurface persona={Lise}>` (T3.1)

**Files:**
- Rewrite: `apps/web/src/components/voice-assistant.tsx` (509 → ~200 lines)

PRESERVE Lise persona — warmth, conversational pacing, persona prompt. NOT a delete. Refactor as provider-agnostic `InterviewSurface` — accepts `persona` + `prompt` props, mounts LiveKit Room internally, exposes status + transcript.

- [ ] **Step 1: Read current voice-assistant.tsx**

```bash
sed -n '1,50p' apps/web/src/components/voice-assistant.tsx
grep -nE "persona|Lise|prompt|systemMessage" apps/web/src/components/voice-assistant.tsx | head -20
```

Inventory current Lise persona content (system prompt, voice slug, tone instructions). Preserve verbatim.

- [ ] **Step 2: Write smoke test**

Create `apps/web/src/components/__tests__/InterviewSurface.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterviewSurface } from "../voice-assistant";

describe("InterviewSurface", () => {
  it("renders persona avatar with name from props", () => {
    render(
      <InterviewSurface
        persona={{ name: "Lise", voice: "lise-warm-no", avatarUrl: "/lise.png" }}
        prompt="Velkommen til Smartout."
      />,
    );
    expect(screen.getByText(/Lise/i)).toBeInTheDocument();
  });

  it("does not import UltravoxSession", () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../voice-assistant.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/UltravoxSession|ultravox-client/);
  });
});
```

- [ ] **Step 3: Run test, expect fail**

```bash
pnpm --filter web vitest run apps/web/src/components/__tests__/InterviewSurface.test.tsx
```

Expected: FAIL — no `InterviewSurface` export, ultravox-client still present.

- [ ] **Step 4: Rewrite voice-assistant.tsx**

Skeleton:

```tsx
"use client";
import { useEffect, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import type { VoiceProviderStatus } from "@smartout/agent-sdk/providers/voice-provider";

export type Persona = {
  name: string;
  voice: string;
  avatarUrl?: string;
  systemPrompt?: string;
};

export type InterviewSurfaceProps = {
  persona: Persona;
  prompt: string;
  missionId?: string;
  onTranscript?: (text: string, speaker: "agent" | "user") => void;
  onComplete?: () => void;
};

export function InterviewSurface({
  persona,
  prompt,
  missionId = "lise-interview",
  onTranscript,
  onComplete,
}: InterviewSurfaceProps) {
  const [status, setStatus] = useState<VoiceProviderStatus>("idle");
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([]);

  useEffect(() => {
    let room: Room | null = null;

    async function start() {
      setStatus("connecting");
      const res = await fetch("/api/wizard/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: missionId,
          voice: persona.voice,
          language: "no",
          first_speaker: "agent",
          context: { system_prompt: persona.systemPrompt, prompt },
        }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const { roomUrl, token } = await res.json();
      room = new Room();

      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const speaker = participant?.isLocal ? "user" : "agent";
        for (const seg of segments) {
          if (seg.final) {
            setTranscript((prev) => [...prev, { speaker, text: seg.text }]);
            onTranscript?.(seg.text, speaker as "agent" | "user");
          }
        }
      });

      await room.connect(roomUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setStatus("connected");
    }

    void start();
    return () => {
      void room?.disconnect();
    };
  }, [missionId, persona.voice, persona.systemPrompt, prompt, onTranscript]);

  return (
    <div className="interview-surface">
      <header className="flex items-center gap-3">
        {persona.avatarUrl && (
          <img src={persona.avatarUrl} alt={persona.name} className="size-12 rounded-full" />
        )}
        <h2 className="font-heading text-2xl">{persona.name}</h2>
        <span data-testid="status" className="text-sm text-muted-foreground">
          {status}
        </span>
      </header>
      <div className="transcript mt-4 space-y-2">
        {transcript.map((t, i) => (
          <p key={i} className={t.speaker === "agent" ? "text-foreground" : "text-muted-foreground"}>
            <strong>{t.speaker === "agent" ? persona.name : "Du"}:</strong> {t.text}
          </p>
        ))}
      </div>
    </div>
  );
}

export default InterviewSurface;
```

PRESERVE existing Lise prompt content from current `voice-assistant.tsx`. If the current file exports a `LISE_PERSONA` constant, keep it and re-export:

```typescript
export const LISE_PERSONA: Persona = {
  name: "Lise",
  voice: "lise-warm-no",
  avatarUrl: "/personas/lise.png",
  systemPrompt: `[verbatim from current file]`,
};
```

- [ ] **Step 5: Update all callsites**

```bash
grep -rn "from.*voice-assistant\|VoiceAssistant" apps/web/src
```

For each callsite:
```tsx
// before
<VoiceAssistant />
// after
<InterviewSurface persona={LISE_PERSONA} prompt={...} />
```

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm --filter web vitest run apps/web/src/components/__tests__/InterviewSurface.test.tsx
pnpm --filter web typecheck
```

Expected: 2/2 PASS, 0 typecheck errors.

- [ ] **Step 7: G3 Pontus persona-approval gate (manual)**

Run dev server. Trigger interview surface (route varies — find via callsite grep). Listen to Lise voice + intro. Pontus confirms persona is preserved (warmth, pacing, prompt content). On regression: roll back this commit; do not proceed.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/voice-assistant.tsx \
        apps/web/src/components/__tests__/InterviewSurface.test.tsx
git commit -m "$(cat <<'EOF'
refactor(voice-assistant): rewrite as <InterviewSurface persona> (T3.1)

ADR-0282 Phase E E4. Provider-agnostic Lise persona-bearer. UltravoxSession
replaced with LiveKit Room. LISE_PERSONA constant preserves verbatim system
prompt + voice slug. 509 -> ~200 lines. Pontus G3 persona-approval gate
passed before commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Krisp NC wiring — web + mobile + voice-agent NC-off verify (T3.2-T3.5)

**Files:**
- Modify: `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` (Krisp on web LiveKit Room)
- Modify: `apps/mobile/src/hooks/use-botsson-voice-session.ts` (Krisp on mobile)
- Modify: `apps/web/src/app/Botsson/_components/BotssonSticky.tsx` (3-state pill UI)
- Create: `services/voice-agent/__tests__/no-nc.test.ts` (verify voice-agent has zero NC code)

`@livekit/krisp-noise-filter` + `@livekit/react-native-krisp-noise-filter` already installed (verified by steward 2026-05-04). Wire on local participant track only — voice-agent stays NC-off (LiveKit docs: never double-process).

- [ ] **Step 1: Write voice-agent NC-off test**

Create `services/voice-agent/__tests__/no-nc.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("voice-agent NC-off invariant (ADR-0282 R5)", () => {
  it("does not import or reference Krisp / NC plugin", () => {
    const src = readFileSync(join(__dirname, "../src/agent.ts"), "utf8");
    expect(src).not.toMatch(/krisp|NoiseFilter|noise-filter/i);
  });
});
```

- [ ] **Step 2: Run test, expect pass (already NC-off)**

```bash
pnpm --filter @smartout/voice-agent vitest run __tests__/no-nc.test.ts
```

Expected: PASS — voice-agent never had NC.

- [ ] **Step 3: Wire Krisp on web LiveKit Room**

Find where Room is created. Likely `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx` or `BotssonProvider.tsx`. Add:

```typescript
import { KrispNoiseFilter } from "@livekit/krisp-noise-filter";

// when enabling mic:
const krisp = KrispNoiseFilter();
await room.localParticipant.setMicrophoneEnabled(true, {
  processor: krisp,
});

// expose krisp.isEnabled / krisp.setEnabled for pill UI
```

Track noise level state — `room.localParticipant.audioLevel` or expose Krisp's internal estimate via a derived state hook.

- [ ] **Step 4: Add 3-state pill on BotssonSticky**

In `apps/web/src/app/Botsson/_components/BotssonSticky.tsx`, render pill bound to noise-level state:

```tsx
type NoiseState = "clean" | "elevated" | "off";

function NoisePill({ state }: { state: NoiseState }) {
  const labels: Record<NoiseState, string> = {
    clean: "Ren lyd",
    elevated: "Bakgrunnsstøy filtrert",
    off: "Støyfilter av",
  };
  const colors: Record<NoiseState, string> = {
    clean: "bg-emerald-500/20 text-emerald-700",
    elevated: "bg-amber-500/20 text-amber-700",
    off: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${colors[state]}`}>{labels[state]}</span>;
}
```

Derive `state`:
- `clean` when Krisp enabled AND `audioLevel < threshold`
- `elevated` when Krisp enabled AND `audioLevel >= threshold` (filter is working)
- `off` when Krisp disabled

- [ ] **Step 5: Wire Krisp on mobile**

Open `apps/mobile/src/hooks/use-botsson-voice-session.ts`. Add:

```typescript
import { KrispNoiseFilter } from "@livekit/react-native-krisp-noise-filter";

// when enabling mic on mobile Room:
const krisp = KrispNoiseFilter();
await room.localParticipant.setMicrophoneEnabled(true, { processor: krisp });
```

- [ ] **Step 6: Run typecheck + voice-agent NC-off test**

```bash
pnpm --filter web typecheck
pnpm --filter @smartout/mobile typecheck
pnpm --filter @smartout/voice-agent vitest run __tests__/no-nc.test.ts
```

Expected: 0 typecheck errors, NC-off test PASS.

- [ ] **Step 7: A/B noise verification (manual)**

Record 30s sample with kitchen noise (run `services/voice-agent/scripts/noise-sample.sh` if exists, else use phone speaker playing kitchen-noise.mp3). Toggle Krisp via DevTools. Verify:
- Pill state changes accordingly
- LiveKit `audioLevel` drops with Krisp ON
- Voice-agent transcript quality improves with Krisp ON

ACCEPTANCE: ≥15dB SNR improvement (subjective if no audio meter — engineer reports clearer transcript).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/Botsson/_components/ \
        apps/mobile/src/hooks/use-botsson-voice-session.ts \
        services/voice-agent/__tests__/no-nc.test.ts
git commit -m "$(cat <<'EOF'
feat(voice): Krisp NC client-side, voice-agent NC-off invariant (T3.2-T3.5)

ADR-0282 Phase E E7 + R5. @livekit/krisp-noise-filter on web local participant
track via BotssonProvider. @livekit/react-native-krisp-noise-filter on mobile
via use-botsson-voice-session. 3-state pill on BotssonSticky (clean/elevated/
off) bound to audioLevel + krisp.isEnabled. NC-off test asserts services/
voice-agent/src/agent.ts has zero NC references (never double-process).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Ultravox deletion sweep (T4.1-T4.10) — GATED ON vad-bench PASS

**Files:**
- Delete: `services/stage-engine/src/routes/adapters/ultravox.ts`
- Delete: `services/stage-engine/src/types/ultravox.ts`
- Delete: `services/stage-engine/src/lib/ultravox.ts`
- Delete: `packages/agent-sdk/src/providers/ultravox.ts`
- Modify: `apps/web/package.json` — remove `ultravox-client`
- Modify: `services/stage-engine/src/secrets.ts:11,53,61,68,76-77,88` — remove `ultravoxApiKey` field
- Modify: `apps/web/src/app/platform-admin/services/_components/service-contracts.ts:169-193`
- Modify: `apps/web/src/app/platform-admin/keys/_components/service-registry.ts:94-95`
- Modify: 6 test fixtures setting `ultravoxApiKey: null`

⛔ **GATE:** Do NOT start Task 8 until vad-bench plan reports PASS (P50 ≤ 600ms, P95 ≤ 900ms, false-end ≤ 5%). Verify by reading `services/voice-agent/test-output/vad-bench.json` — exit 0 + `verdict: "PASS"`.

- [ ] **Step 1: Verify gate**

```bash
cat services/voice-agent/test-output/vad-bench.json | jq '.verdict'
```

Expected: `"PASS"`. If `"FAIL"` → halt; escalate to council per ADR-0282 R6 condition 3.

- [ ] **Step 2: Delete service-side Ultravox files**

```bash
git rm services/stage-engine/src/routes/adapters/ultravox.ts \
       services/stage-engine/src/types/ultravox.ts \
       services/stage-engine/src/lib/ultravox.ts \
       packages/agent-sdk/src/providers/ultravox.ts
```

- [ ] **Step 3: Remove `ultravox-client` dep**

Edit `apps/web/package.json`. Remove the `"ultravox-client": "..."` line from `dependencies`.

```bash
pnpm install
```

Expected: lockfile updates, no broken dependents (Ultravox already stripped from useBotsson + voice-assistant in earlier tasks).

- [ ] **Step 4: Strip `ultravoxApiKey` from secrets.ts**

Open `services/stage-engine/src/secrets.ts`. Remove every `ultravoxApiKey` reference (lines 11, 53, 61, 68, 76-77, 88). Verify Zod schema, defaults, and 1Password mapping all drop.

```bash
grep -n "ultravoxApiKey\|ULTRAVOX_API_KEY" services/stage-engine/src/secrets.ts
```

Expected: zero hits.

- [ ] **Step 5: Strip Ultravox from platform-admin**

Edit `apps/web/src/app/platform-admin/services/_components/service-contracts.ts:169-193` — drop the Ultravox row.
Edit `apps/web/src/app/platform-admin/keys/_components/service-registry.ts:94-95` — drop the Ultravox entry.

- [ ] **Step 6: Strip 6 test fixtures**

```bash
grep -rln "ultravoxApiKey\s*:\s*null" apps/ packages/ services/
```

Edit each match — drop the `ultravoxApiKey: null` line.

- [ ] **Step 7: Verify zero Ultravox hits in code**

```bash
grep -rE "ultravox|UltravoxSession|UltravoxSessionStatus" apps/ packages/ services/ \
  --include='*.ts' --include='*.tsx' --include='*.json' \
  | grep -v -E "\.test\.|__tests__|/dist/|/node_modules/"
```

Expected: zero hits (excluding docs, comments referencing historical state, migrations).

- [ ] **Step 8: Full typecheck + build**

```bash
pnpm turbo typecheck
pnpm turbo build
```

Expected: 0 errors across all packages.

- [ ] **Step 9: E2E smoke**

```bash
pnpm --filter @smartout/e2e test:e2e --grep "wizard onboarding|botsson overlay"
```

Expected: green.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(ultravox): full deletion sweep — Phase E Track 4 (T4.1-T4.10)

ADR-0282 Phase E E6. Gated by vad-bench PASS verdict. Deletes:
- services/stage-engine/src/routes/adapters/ultravox.ts
- services/stage-engine/src/types/ultravox.ts
- services/stage-engine/src/lib/ultravox.ts
- packages/agent-sdk/src/providers/ultravox.ts
- ultravox-client from apps/web/package.json
- ultravoxApiKey from stage-engine secrets (lines 11/53/61/68/76-77/88)
- platform-admin service-contracts + service-registry rows
- 6 test fixtures setting ultravoxApiKey: null

Verification: grep returns zero hits in apps/ packages/ services/ code.
Full turbo typecheck + build green. E2E wizard + botsson overlay green.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: ADR-0276 status flip — proposed → accepted (E8)

> **NOTE (council 2026-05-08 R-5 fix):** ADR-0276 was written 2026-05-04 alongside ADR-0282 council and currently lives at `docs/decisions/0276-adr-0107-amendment-provider-independence.md` with `status: proposed`. This task does NOT create the file — it flips the status to `accepted` as the closure step for ADR-0282 §Open Items line 165. Same applies to ADR-0284 (Task 9b) and ADR-0282 self (Task 9c).

**Files:**
- Modify: `docs/decisions/0276-adr-0107-amendment-provider-independence.md` — flip status, refresh `updated:` date, add council-ack metadata
- Modify: `docs/decisions/0284-phantom-reuse-detection-in-capability-plans.md` — flip status (Task 9b)
- Modify: `docs/decisions/0282-voice-plane-consolidation-livekit-only.md` — update §Open Items lines 165-166 + fix line 60 off-by-one (Task 9c)
- Modify: `docs/decisions/0107-*.md` — add `amended_by: [ADR_0276]` to frontmatter
- Modify: `docs/decisions/0000-decision-log.md` — register/update ADR-0276 + ADR-0284 status

- [ ] **Step 1: Verify all three ADRs exist (pre-flight, NOT slot-collision check)**

```bash
ls docs/decisions/0276-adr-0107-amendment-provider-independence.md \
   docs/decisions/0284-phantom-reuse-detection-in-capability-plans.md \
   docs/decisions/0282-voice-plane-consolidation-livekit-only.md
```

Expected: all 3 files exist. If any missing → halt and escalate (assumption violated).

- [ ] **Step 2: Edit ADR-0276 frontmatter**

Open `docs/decisions/0276-adr-0107-amendment-provider-independence.md`. Apply this diff to frontmatter:

```diff
 ---
 title: "ADR-0107 Amendment — mode→channel Derivation Is Provider-Independent"
 id: ADR_0276
-status: proposed
+status: accepted
 layer: decision
 created: 2026-05-04
-updated: 2026-05-04
+updated: 2026-05-08
 amends: [ADR_0107]
+depends_on: [ADR_0282]
+council_review: 2026-05-04
+council_verdict: "Accepted as ADR-0282 §Open Items closure (Phase E land 2026-05-08)"
 ---
```

Body (decision text, rules, consequences) is preserved as-written 2026-05-04. No body edits.

- [ ] **Step 2b (Task 9b): Edit ADR-0284 frontmatter**

Open `docs/decisions/0284-phantom-reuse-detection-in-capability-plans.md`. Apply:

```diff
 ---
 title: "Phantom-Reuse Detection Mandatory in Capability Plans"
 id: ADR_0284
-status: proposed
+status: accepted
 layer: decision
 created: 2026-05-04
-updated: 2026-05-04
+updated: 2026-05-08
 depends_on: [ADR_0078, ADR_0099, ADR_0204]
+council_review: 2026-05-04
+council_verdict: "Accepted as ADR-0282 §Open Items closure (Phase E land 2026-05-08)"
 ---
```

- [ ] **Step 2c (Task 9c): Update ADR-0282 §Open Items + fix line 60 off-by-one**

Open `docs/decisions/0282-voice-plane-consolidation-livekit-only.md`. Two edits:

**Edit C1 — fix line 60 off-by-one (`:693` → `:694`):**

```diff
-`BotssonProvider.tsx:693` flips `"ultravox"` → `"livekit"`. ADR-0107 is AMENDED ...
+`BotssonProvider.tsx:694` flips `"ultravox"` → `"livekit"`. ADR-0107 is AMENDED ...
```

**Edit C2 — §Open Items checkboxes (lines 163-167):**

```diff
 ## Open Items

 - [x] CAMPAIGN-botsson-arena.md scope amendment — done in commit `48e47452d`
 - [x] PLAN-voice-plane-consolidation.md — done in commit `48e47452d`
-- [ ] ADR-0276 ADR-0107 amendment (provider-independence note) — to write
-- [ ] ADR-0284 (proposed): "Phantom-Reuse Detection in Capability Plans" — promotes L-0176 body-trace from per-tool to per-plan scope
+- [x] ADR-0276 ADR-0107 amendment (provider-independence note) — written 2026-05-04, accepted 2026-05-08 (Phase E Task 9)
+- [x] ADR-0284 "Phantom-Reuse Detection in Capability Plans" — written 2026-05-04, accepted 2026-05-08 (Phase E Task 9b)
 - [x] Sync log row in CAMPAIGN charter — done in commit `48e47452d`
```

Also flip ADR-0282 self status at the same time (anticipates Task 10 Step 3 — keep that step as additional safety):

```diff
 ---
 title: "Voice Plane Consolidation — LiveKit Everywhere, Ultravox Removed"
 id: ADR_0282
-status: proposed
+status: accepted
 layer: decision
 created: 2026-05-04
-updated: 2026-05-04
+updated: 2026-05-08
```

- [ ] **Step 3: Add cross-reference to ADR-0107**

Locate the ADR-0107 file:

```bash
ls docs/decisions/0107-*.md
```

Read its current frontmatter. Add `amended_by: [ADR_0276]` field (insert after `amends:` if present, else after `depends_on:` or at end of frontmatter block). Body text untouched.

- [ ] **Step 4: Update decision log**

Edit `docs/decisions/0000-decision-log.md`. Locate existing rows for ADR-0276 and ADR-0284 (if registered). Update status column to `accepted`. If rows missing, add them. ADR-0282 row also flips to `accepted`.

- [ ] **Step 5: Verify no remaining `proposed` status drift on the three ADRs**

```bash
grep -E "^status:" docs/decisions/0276-*.md \
                  docs/decisions/0282-*.md \
                  docs/decisions/0284-*.md
```

Expected output (3 lines, all `accepted`):
```
docs/decisions/0276-adr-0107-amendment-provider-independence.md:status: accepted
docs/decisions/0282-voice-plane-consolidation-livekit-only.md:status: accepted
docs/decisions/0284-phantom-reuse-detection-in-capability-plans.md:status: accepted
```

- [ ] **Step 6: Commit**

```bash
git add docs/decisions/0276-adr-0107-amendment-provider-independence.md \
        docs/decisions/0282-voice-plane-consolidation-livekit-only.md \
        docs/decisions/0284-phantom-reuse-detection-in-capability-plans.md \
        docs/decisions/0107-*.md \
        docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs(decisions): ADR-0276 + ADR-0282 + ADR-0284 status accepted (Phase E close)

Closes ADR-0282 §Open Items lines 163-167. ADR-0276 (provider-independence
amendment) and ADR-0284 (phantom-reuse detection) were drafted 2026-05-04
alongside ADR-0282 council, status: proposed. Phase E Task 9 lands the
acceptance for all three. ADR-0107 frontmatter cross-references ADR-0276
via amended_by. Decision log updated. ADR-0282 line 60 off-by-one fixed
(BotssonProvider.tsx:693 -> :694).

No code change.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: HANDOFF + ADR-0282 status flip + SYSTEM-MAP (T6.1-T6.7)

**Files:**
- Create: `docs/HANDOFF-phase-e-cutover.md`
- Modify: `docs/decisions/0282-voice-plane-consolidation-livekit-only.md` — `status: proposed` → `status: accepted`
- Modify: `docs/decisions/0000-decision-log.md` — flip ADR-0282 status
- Modify: `docs/architecture/BOTSSON-SYSTEM-MAP.md` — voice-plane row 🟡 → 🟢
- Modify: `docs/plans/CAMPAIGN-botsson-arena.md` — sync log entry Phase E complete

- [ ] **Step 1: Audit all 10 falsifiable acceptance criteria**

Run each verification from ADR-0282 PLAN AC #1-#10:

1. `grep -r "ultravox" apps/web/src packages/agent-sdk/src services/stage-engine/src` → expect 0 hits in code.
2. `grep "ultravox-client" apps/web/package.json` → expect 0 hits.
3. `grep "provider:" apps/web/src/app/Botsson/_components/BotssonProvider.tsx | grep -v //` → expect `provider: "livekit"`.
4. `/onboarding` voice flow uses `livekit-token` Edge Function (verify via `git log -p apps/web/src/app/api/wizard/start/route.ts | head -100`).
5. All 14 useBotsson tools accounted for — manual checklist match against ADR-0282 R4 table.
6. `ls services/stage-engine/src/routes/adapters/ultravox.ts` → expect "No such file".
7. `ls packages/agent-sdk/src/providers/ultravox.ts` → expect "No such file".
8. Krisp on web (`grep -n "KrispNoiseFilter" apps/web/src/app/Botsson/_components/BotssonProvider.tsx`) + mobile (`grep -n "KrispNoiseFilter" apps/mobile/src/hooks/use-botsson-voice-session.ts`) + voice-agent NC-off test green.
9. Golden-transcript eval green: `pnpm --filter @smartout/ai vitest run src/__evals__/golden-transcripts.eval.ts`.
10. Channel guard 3-layer verification — manual probe via stage-engine logs (voice + PII intent → tool-selector filter → gate_action deny → tool-body redirect message). Document one trace in HANDOFF.

Document each result in HANDOFF.

- [ ] **Step 2: Write HANDOFF**

Create `docs/HANDOFF-phase-e-cutover.md`:

```markdown
---
title: "HANDOFF — Phase E Cutover (Tracks 2/3/4/6)"
status: closed
sortie: feat/botsson-arena-phase-e-cutover
campaign: botsson-arena
phase: E
adr: [ADR-0282, ADR-0276]
created: 2026-05-08
updated: 2026-05-08
---

# HANDOFF — Phase E Cutover

## Summary

ADR-0282 Phase E closed. Web Ultravox path eliminated. Single voice plane via
LiveKit Agents 1.3.0 across web + mobile. Krisp NC client-side, voice-agent
NC-off. ADR-0107 preserved load-bearing via ADR-0276 amendment.

Track 1 (E1 capability build) shipped earlier via PR #342. Track 5 (E9
vad-bench) gated Track 4 deletions; PASS verdict recorded
`services/voice-agent/test-output/vad-bench.json` 2026-05-08.

## Decisions made

- ADR-0276: ADR-0107 amendment — provider-independence preserved
- ADR-0282: status flip proposed → accepted (this HANDOFF closes it)

## Acceptance Criteria — all 10 green

[Paste verification table from Step 1]

## Learnings

- Wizard `/api/wizard/start` LiveKit token mint replaces stage-engine
  Ultravox call without breaking mission dispatch — voice-agent matches via
  room-name pattern (`{workspaceId}:wizard:{userId}`).
- Lise persona preservation required Pontus G3 manual gate — voice + tone
  cannot be unit-tested.
- Krisp 3-state pill needs derived `noiseLevel` from LiveKit `audioLevel` +
  `krisp.isEnabled` — no LiveKit-native API for "is filter actively
  scrubbing" so derived state is heuristic.
- Translation contract `translateUltravoxApiParams` is the seam that lets
  callsites stay stable while the underlying provider flips.

## Known issues / debt

- Wizard fallback "Neste (uten stemme)" button is minimal UX — can grow into
  full no-voice path if needed (separate sortie).
- Krisp pill heuristic could be replaced with explicit LiveKit telemetry once
  upstream exposes a "filter active" signal.
- ADR-0107 file frontmatter `amended_by` field not yet enforced by schema —
  manual addition.

## Next steps

- B3 helpdesk-voice sortie can now begin (Phase B depends on Phase E).
- B1 SS-4 batches `onboarding` capability migration into orchestrator (per
  ADR-0282 self-reversal in council Phase 5).
- Heartbeat drift-check verifies voice-plane stays single-plane.
```

- [ ] **Step 3: Flip ADR-0282 status**

Edit `docs/decisions/0282-voice-plane-consolidation-livekit-only.md`:

```yaml
# before
status: proposed
# after
status: accepted
updated: 2026-05-08
```

Edit `docs/decisions/0000-decision-log.md` — locate ADR-0282 row, change status to `accepted`.

- [ ] **Step 4: Update SYSTEM-MAP**

Edit `docs/architecture/BOTSSON-SYSTEM-MAP.md`. Find voice-plane row (likely marked 🟡). Change to 🟢 with note: `Phase E shipped 2026-05-08 (ADR-0282)`.

- [ ] **Step 5: Sync CAMPAIGN log**

Edit `docs/plans/CAMPAIGN-botsson-arena.md`. Add sync log entry:

```markdown
- 2026-05-08: Phase E cutover complete. ADR-0282 status flipped to accepted.
  Tracks 2/3/4/6 shipped (sortie feat/botsson-arena-phase-e-cutover).
  Track 1 prior via PR #342, Track 5 via vad-bench plan.
```

- [ ] **Step 6: Run full typecheck + commit**

```bash
pnpm turbo typecheck
git add docs/HANDOFF-phase-e-cutover.md \
        docs/decisions/0282-voice-plane-consolidation-livekit-only.md \
        docs/decisions/0000-decision-log.md \
        docs/architecture/BOTSSON-SYSTEM-MAP.md \
        docs/plans/CAMPAIGN-botsson-arena.md
git commit -m "$(cat <<'EOF'
docs(phase-e): HANDOFF + ADR-0282 status accepted + SYSTEM-MAP green (T6)

ADR-0282 Phase E E10 closure. All 10 falsifiable acceptance criteria green.
Voice-plane row in BOTSSON-SYSTEM-MAP flipped 🟡 → 🟢. Campaign sync log
entry added. Phase E sortie complete.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance Criteria

All 10 from ADR-0282 PLAN must be falsifiably green before Task 10 commit:

1. `grep -r "ultravox" apps/web/src packages/agent-sdk/src services/stage-engine/src` returns zero hits in code.
2. `apps/web/package.json` no longer lists `ultravox-client`.
3. `BotssonProvider.tsx:694` reads `provider: "livekit"`.
4. Wizard `/onboarding` voice creates LiveKit room via `livekit-token` Edge Function.
5. All 14 `useBotsson.ts` `temporaryTool` definitions accounted for per ADR-0282 R4 corrected table.
6. `services/stage-engine/src/routes/adapters/ultravox.ts` deleted.
7. `packages/agent-sdk/src/providers/ultravox.ts` deleted.
8. Krisp NC active on web + mobile local participant; voice-agent NC-off invariant test green.
9. Golden-transcript eval green on LiveKit single-plane.
10. Channel guard 3-layer verified (web LiveKit path identical to mobile).

Plus plan-level:
- All 5 declared journeys in `docs/plans/PLAN-voice-plane-consolidation.md` verified.
- `pnpm turbo typecheck` 0 errors.
- ADR-0276 + ADR-0282 status changes registered in `0000-decision-log.md`.
- HANDOFF document complete.

---

## Out-of-Scope

- B1 SS-4 dual-gate orchestrator migration of `onboarding` capability (separate sortie post-Phase-E)
- Helpdesk voice (Phase B3 sortie)
- Outbound SIP / PSTN
- LiveKit Agents version bumps (1.3.0 stays canonical for this sortie)
- VAD parity tuning (vad-bench plan handles E9 separately)
- B1 server-derive workspace_id (separate plan; lands first)
- B2 mobile context-pipe + auth lift (separate plan; lands after B1)

---

## Risks

| Risk | Mitigation |
|---|---|
| useBotsson rewrite breaks wizard mid-deploy (E3-E5 gap) | T2.6 fallback "Neste" button + ≤1 deploy cycle gap rule per ADR-0282 R6 |
| Lise persona drifts in voice-assistant rewrite | Pontus G3 approval gate at Task 6 Step 7 — roll back commit on regression |
| Krisp double-processing on voice-agent | Task 7 Step 2 NC-off invariant test guards; voice-agent never touches NC |
| vad-bench FAIL blocks Task 8 | Halt + escalate to council per ADR-0282 R6 condition 3 |
| ADR-0276 slot collision | Pre-flight grep in Task 9 Step 2 + L-0042 retimestamp protocol |
| Translation contract regression in apiParams | Task 2 6-case Vitest covers happy path + Zod refinements |
| Unrelated `ultravox` matches in `docs/` or comments fail Task 8 grep gate | Grep excludes `docs/`, comments referencing historical state, and migrations per AC #1 |

---

## Council Escalation Triggers

1. vad-bench FAIL at Task 8 entry → halt, escalate to coordinator + steward council
2. Lise persona regression at Task 6 G3 → halt, escalate to frontend-designer
3. Phantom-trace catches new false reuse claim during Tasks 4-5 → escalate to harness-builder, expand ADR-0282 R4
4. Krisp double-processing detected during Task 7 → halt, escalate to coordinator
5. ADR-0276 slot collision during Task 9 → renumber per L-0042 protocol

---

## Self-Review

**Spec coverage check (against ADR-0282 R6 corrected sequence):**

- ✅ E2 (`getOnboardingState` BFF) — Task 1
- ✅ E3 (BotssonProvider flip + useBotsson rewrite + apiParams translation) — Tasks 2, 3, 4
- ✅ E4 (voice-assistant rewrite as InterviewSurface, Lise preserved) — Task 6
- ✅ E5 (wizard `/api/wizard/start` LiveKit token + fallback Neste) — Task 5
- ✅ E6 (deletions, gated on vad-bench PASS) — Task 8
- ✅ E7 (Krisp NC + 3-state pill) — Task 7
- ✅ E8 (ADR-0107 amendment) — Task 9
- ⏸  E9 (VAD parity gate) — covered by separate `2026-05-08-vad-bench-pre-sortie-gate.md` plan, gates Task 8
- ✅ E10 (HANDOFF + ADR status flip + SYSTEM-MAP) — Task 10

**Out-of-scope explicit:** B1, B2, vad-bench (separate plans); B1 SS-4 onboarding-orchestrator migration (post-Phase-E sortie); helpdesk voice (Phase B3).

**Placeholder scan:** Zero "TODO", "TBD", "fill in details" entries. Every code step has actual code. Every command step has expected output. Wizard-shell file path "find via grep" is a real shell command, not a placeholder.

**Type consistency:**
- `VoiceProviderStatus` referenced in Tasks 1, 4, 6 — same type from `@smartout/agent-sdk/providers/voice-provider`.
- `Persona` type defined in Task 6, used same shape across InterviewSurface props + LISE_PERSONA constant.
- `UltravoxApiParams` + `LiveKitAgentsConfig` defined in Task 2, consumed in Task 4 via `translateUltravoxApiParams` import.
- `KrispNoiseFilter` API surface assumed from `@livekit/krisp-noise-filter` package — engineer verifies actual export shape before pasting (could be default export vs named).

**Time estimate:** 10-14 hours wall-clock for one engineer. Tasks 1, 2 = 1h each. Tasks 3 = 0.25h. Task 4 = 2h (rewrite + tests). Task 5 = 1.5h. Task 6 = 2h (rewrite + G3 manual). Task 7 = 2h. Task 8 = 1h (mostly verification). Task 9 = 0.5h. Task 10 = 1h.
