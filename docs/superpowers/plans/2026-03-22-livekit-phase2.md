---
title: "Plan — LiveKit Phase 2: Voice Calls + Push-to-Talk"
status: draft
updated: 2026-03-22
created: 2026-03-22
module: webrtc
tags: [plan, livekit, voice, push-to-talk, calls]
---

# LiveKit Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time voice calling (1:1, group, push-to-talk) to Smartout's channel communications system on web and mobile.

**Architecture:** Edge Functions own all call orchestration (token minting, call commands, webhook reconciliation). Shared data layer in `packages/walkieTalkie/`. Web and mobile have platform-specific LiveKit adapters. Supabase Realtime Broadcast for ephemeral signaling. LiveKit webhooks are authoritative for call state.

**Tech Stack:** LiveKit Cloud (EU), LiveKit SDK v2, Supabase Edge Functions (Deno), TanStack Query, Supabase Realtime Broadcast, Krisp noise cancellation, React Native + Expo (dev builds)

**Spec:** `docs/superpowers/specs/2026-03-22-livekit-phase2-design.md`

---

## File Map

### New files

```
packages/walkieTalkie/
  package.json
  tsconfig.json
  src/
    index.ts
    call-types.ts
    call-keys.ts
    call-queries.ts
    call-mutations.ts
    call-signaling.ts
    ptt-logic.ts

supabase/functions/livekit-token/index.ts
supabase/functions/livekit-webhook/index.ts
supabase/functions/call-command/index.ts
supabase/migrations/YYYYMMDDHHMMSS_channel_voice.sql

apps/web/src/app/dashboard/komm/_hooks/use-livekit-call.ts
apps/web/src/app/dashboard/komm/_hooks/use-call-state.ts
apps/web/src/app/dashboard/komm/_hooks/use-call-history.ts
apps/web/src/app/dashboard/komm/_hooks/use-start-call.ts
apps/web/src/app/dashboard/komm/_hooks/use-call-invite.ts
apps/web/src/app/dashboard/komm/_hooks/use-call-signaling.ts
apps/web/src/app/dashboard/komm/_hooks/use-push-to-talk.ts
apps/web/src/app/dashboard/komm/_hooks/use-call-realtime.ts

apps/web/src/app/dashboard/komm/_components/CallBar.tsx
apps/web/src/app/dashboard/komm/_components/PTTButton.tsx
apps/web/src/app/dashboard/komm/_components/IncomingCallOverlay.tsx
apps/web/src/app/dashboard/komm/_components/GroupCallBanner.tsx
apps/web/src/app/dashboard/komm/_components/CallHistory.tsx
apps/web/src/app/dashboard/komm/_components/ActiveSpeakerIndicator.tsx

apps/web/src/app/api/channels/[id]/call/start/route.ts
apps/web/src/app/api/channels/[id]/call/token/route.ts
apps/web/src/app/api/channels/[id]/call/respond/route.ts
apps/web/src/app/api/channels/[id]/call/status/route.ts
apps/web/src/app/api/channels/[id]/call/history/route.ts

apps/mobile/src/hooks/use-livekit-call.ts
apps/mobile/src/hooks/use-call-signaling.ts
apps/mobile/src/hooks/use-push-to-talk.ts
apps/mobile/src/features/channels/components/CallBar.tsx
apps/mobile/src/features/channels/components/PTTButton.tsx
apps/mobile/src/features/channels/components/IncomingCallScreen.tsx
apps/mobile/src/features/channels/components/GroupCallBanner.tsx
apps/mobile/src/features/channels/components/CallHistoryList.tsx
```

### Modified files

```
packages/telemetry/src/registry.ts          -- add 11 channel.call.* events
packages/supabase/src/database.types.ts     -- regenerate after migration
supabase/config.toml                        -- add livekit-webhook verify_jwt=false
apps/web/src/env.ts                         -- add LiveKit env vars
.env.template                               -- add 4 LiveKit env vars
apps/mobile/app.json                        -- add LiveKit Expo plugins
apps/web/src/app/dashboard/komm/_components/ChannelHeader.tsx   -- add call button
apps/web/src/app/dashboard/komm/_components/KommShell.tsx       -- add IncomingCallOverlay + CallBar
apps/web/src/app/dashboard/komm/_components/MessageInput.tsx    -- add PTT mode
apps/web/src/app/dashboard/komm/_hooks/channel-keys.ts         -- add call keys
```

---

## Task 0: Infrastructure Setup

**Files:**

- Modify: `.env.template`
- Modify: `apps/web/src/env.ts`
- Modify: `supabase/config.toml`
- Modify: `apps/mobile/app.json`
- Modify: `packages/telemetry/src/registry.ts`
- Modify: `apps/web/src/app/dashboard/komm/_hooks/channel-keys.ts`
- Create: `packages/walkieTalkie/package.json`
- Create: `packages/walkieTalkie/tsconfig.json`
- Create: `packages/walkieTalkie/src/index.ts`
- Create: `packages/walkieTalkie/src/call-types.ts`
- Create: `packages/walkieTalkie/src/call-keys.ts`

### Steps

- [ ] **Step 0.1: Add LiveKit env vars to .env.template**

Add after the existing Ultravox section:

```bash
# LiveKit Cloud (Voice/Video)
LIVEKIT_API_KEY=                              # op://Smartout/livekit/api-key
LIVEKIT_API_SECRET=                           # op://Smartout/livekit/api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://walkie-talkie-6ejzctmi.livekit.cloud
LIVEKIT_WEBHOOK_SECRET=                       # op://Smartout/livekit/webhook-secret
```

- [ ] **Step 0.2: Add Zod validation to env.ts**

In `apps/web/src/env.ts`, add to the `server` section:

```typescript
LIVEKIT_API_KEY: z.string().min(1).optional(),
LIVEKIT_API_SECRET: z.string().min(1).optional(),
LIVEKIT_WEBHOOK_SECRET: z.string().min(1).optional(),
```

Add to the `client` section:

```typescript
NEXT_PUBLIC_LIVEKIT_URL: z.string().url().optional(),
```

Add to `experimental__runtimeEnv`:

```typescript
NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
```

- [ ] **Step 0.3: Register livekit-webhook in supabase config.toml**

Add at the end of the functions section:

```toml
[functions.livekit-token]
verify_jwt = true

[functions.livekit-webhook]
verify_jwt = false

[functions.call-command]
verify_jwt = true
```

- [ ] **Step 0.4: Add LiveKit Expo plugins to mobile app.json**

In `apps/mobile/app.json`, add to the `plugins` array:

```json
"@livekit/react-native-expo-plugin",
["@config-plugins/react-native-webrtc", {}]
```

- [ ] **Step 0.5: Register 11 telemetry events in registry.ts**

In `packages/telemetry/src/registry.ts`, add event interfaces:

```typescript
export interface ChannelCallStarted extends BaseEvent {
  event: "channel.call.started";
  properties: {
    channel_id: string;
    call_type: "direct" | "group" | "ptt";
    call_session_id: string;
  };
  entity: EntityRef;
}

export interface ChannelCallEnded extends BaseEvent {
  event: "channel.call.ended";
  properties: {
    channel_id: string;
    call_type: "direct" | "group" | "ptt";
    call_session_id: string;
    duration_seconds: number;
    max_participants: number;
  };
  entity: EntityRef;
}

export interface ChannelCallParticipantJoined extends BaseEvent {
  event: "channel.call.participant_joined";
  properties: { channel_id: string; call_session_id: string; device_type: string };
  entity: EntityRef;
}

export interface ChannelCallParticipantLeft extends BaseEvent {
  event: "channel.call.participant_left";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallInviteSent extends BaseEvent {
  event: "channel.call.invite_sent";
  properties: { channel_id: string; call_session_id: string; callee_profile_id: string };
  entity: EntityRef;
}

export interface ChannelCallInviteAccepted extends BaseEvent {
  event: "channel.call.invite_accepted";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallInviteRejected extends BaseEvent {
  event: "channel.call.invite_rejected";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallInviteMissed extends BaseEvent {
  event: "channel.call.invite_missed";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallGroupAnnounced extends BaseEvent {
  event: "channel.call.group_announced";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallPttActivated extends BaseEvent {
  event: "channel.call.ptt_activated";
  properties: { channel_id: string };
  entity: EntityRef;
}

export interface ChannelCallPttDeactivated extends BaseEvent {
  event: "channel.call.ptt_deactivated";
  properties: { channel_id: string };
  entity: EntityRef;
}
```

Add all 11 to the `SmartoutEvent` union type.

Add routing entries to `EVENT_ROUTING`:

```typescript
"channel.call.started": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "channels",
},
"channel.call.ended": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "channels",
},
"channel.call.participant_joined": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
"channel.call.participant_left": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
"channel.call.invite_sent": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
"channel.call.invite_accepted": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
"channel.call.invite_rejected": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
"channel.call.invite_missed": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
"channel.call.group_announced": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
"channel.call.ptt_activated": {
  destinations: ["posthog"],
  category: "channels",
},
"channel.call.ptt_deactivated": {
  destinations: ["posthog"],
  category: "channels",
},
```

- [ ] **Step 0.6: Scaffold packages/walkieTalkie**

Create `packages/walkieTalkie/package.json`:

```json
{
  "name": "@smartout/walkie-talkie",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist .turbo"
  },
  "dependencies": {
    "@smartout/supabase": "workspace:*",
    "@smartout/telemetry": "workspace:*",
    "@smartout/types": "workspace:*",
    "@supabase/supabase-js": "^2",
    "@tanstack/react-query": "^5"
  },
  "devDependencies": {
    "@smartout/eslint-config": "workspace:^",
    "@smartout/typescript-config": "workspace:*",
    "typescript": "^5"
  }
}
```

Create `packages/walkieTalkie/tsconfig.json`:

```json
{
  "extends": "@smartout/typescript-config/library.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Create `packages/walkieTalkie/src/call-types.ts`:

```typescript
export type CallType = "direct" | "group" | "ptt";
export type CallStatus = "active" | "ending" | "ended";
export type AudioPolicy = "disabled" | "ptt" | "open_mic" | "listen_only";

export type CallSession = {
  id: string;
  channelId: string;
  workspaceId: string;
  callType: CallType;
  livekitRoomName: string;
  status: CallStatus;
  audioPolicy: AudioPolicy;
  startedBy: string | null;
  maxParticipants: number;
  startedAt: string;
  endedAt: string | null;
};

export type CallParticipant = {
  id: string;
  callSessionId: string;
  profileId: string;
  isAi: boolean;
  joinedAt: string;
  leftAt: string | null;
  micEnabled: boolean;
  speakingSeconds: number;
  deviceType: string | null;
};

export type CallLogEntry = {
  id: string;
  channelId: string;
  callSessionId: string;
  livekitRoomName: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  maxParticipants: number;
  totalParticipants: number;
  participantSummary: Array<{
    profile_id: string;
    joined: string;
    left: string;
    spoke_seconds: number;
  }>;
  createdAt: string;
};

export type IncomingCall = {
  callSessionId: string;
  channelId: string;
  callerName: string;
  callerAvatar: string | null;
  roomName: string;
  workspaceId: string;
};

export type PTTState = "idle" | "connecting" | "connected_muted" | "talking";

export type CallSignalingEvent =
  | { type: "call_invite"; payload: IncomingCall }
  | { type: "call_accepted"; payload: { callSessionId: string } }
  | { type: "call_rejected"; payload: { callSessionId: string } }
  | { type: "call_cancelled"; payload: { callSessionId: string } }
  | { type: "call_ended"; payload: { callSessionId: string } }
  | {
      type: "group_call_started";
      payload: {
        callSessionId: string;
        initiatorName: string;
        roomName: string;
        participantCount: number;
      };
    };
```

Create `packages/walkieTalkie/src/call-keys.ts`:

```typescript
export const callKeys = {
  all: ["calls"] as const,
  status: (workspaceId: string, channelId: string) =>
    ["calls", "status", workspaceId, channelId] as const,
  history: (workspaceId: string, channelId: string) =>
    ["calls", "history", workspaceId, channelId] as const,
};
```

Create `packages/walkieTalkie/src/index.ts`:

```typescript
export * from "./call-types";
export * from "./call-keys";
```

- [ ] **Step 0.7: Run pnpm install to link new package**

```bash
pnpm install
```

- [ ] **Step 0.8: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/walkie-talkie
```

- [ ] **Step 0.9: Commit**

```bash
git add -A
git commit -m "feat(webrtc): infrastructure setup — env vars, telemetry, walkieTalkie package

- Add 4 LiveKit env vars to .env.template + Zod validation
- Register 11 channel.call.* telemetry events in registry
- Register 3 Edge Functions in config.toml
- Add LiveKit Expo plugins to mobile app.json
- Scaffold packages/walkieTalkie with types and query keys

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: Database Migration + Types

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_voice.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

### Steps

- [ ] **Step 1.1: Create migration file**

Create `supabase/migrations/20260322180000_channel_voice.sql`:

```sql
-- Channel Voice — Phase 2: call session, participants, presence, call log
-- Spec: docs/superpowers/specs/2026-03-22-livekit-phase2-design.md

--------------------------------------------------------------------------------
-- NEW ENUM
--------------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_call_type') THEN
    CREATE TYPE channel_call_type AS ENUM ('direct', 'group', 'ptt');
  END IF;
END $$;

--------------------------------------------------------------------------------
-- TABLES
--------------------------------------------------------------------------------

-- Coarse presence snapshot (NOT authoritative — Supabase Realtime Presence is)
CREATE TABLE IF NOT EXISTS channel_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  status channel_presence_status NOT NULL,
  device_type text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, profile_id)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_presence
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_channel_presence_workspace ON channel_presence(workspace_id);
CREATE INDEX idx_channel_presence_channel ON channel_presence(channel_id);

-- Active call session per channel
CREATE TABLE IF NOT EXISTS channel_call_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  call_type channel_call_type NOT NULL,
  livekit_room_name text NOT NULL,
  status channel_call_status NOT NULL DEFAULT 'active',
  audio_policy channel_audio_policy NOT NULL,
  video_policy channel_video_policy NOT NULL DEFAULT 'disabled',
  recording_policy channel_recording_policy NOT NULL DEFAULT 'off',
  started_by uuid REFERENCES profile(profile_id),
  max_participants int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_call_session
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_call_session_workspace ON channel_call_session(workspace_id);
CREATE INDEX idx_call_session_channel ON channel_call_session(channel_id);
CREATE INDEX idx_call_session_active ON channel_call_session(channel_id)
  WHERE status = 'active';

-- Per-participant state in a call
CREATE TABLE IF NOT EXISTS channel_call_participant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES channel_call_session(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  is_ai boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  mic_enabled boolean NOT NULL DEFAULT false,
  speaking_seconds int NOT NULL DEFAULT 0,
  device_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_call_participant
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX idx_call_participant_active
  ON channel_call_participant(call_session_id, profile_id)
  WHERE left_at IS NULL;

CREATE INDEX idx_call_participant_workspace ON channel_call_participant(workspace_id);
CREATE INDEX idx_call_participant_session ON channel_call_participant(call_session_id);
CREATE INDEX idx_call_participant_profile ON channel_call_participant(profile_id, created_at DESC);

-- Historical call log (immutable, created on call end)
CREATE TABLE IF NOT EXISTS call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  call_session_id uuid NOT NULL REFERENCES channel_call_session(id),
  livekit_room_name text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_seconds int NOT NULL,
  max_participants int NOT NULL,
  total_participants int NOT NULL,
  participant_summary jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_log_workspace ON call_log(workspace_id);
CREATE INDEX idx_call_log_channel ON call_log(channel_id, created_at DESC);

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------

ALTER TABLE channel_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_call_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_call_participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_log ENABLE ROW LEVEL SECURITY;

-- channel_presence
CREATE POLICY "presence_jwt_select" ON channel_presence FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "presence_jwt_upsert" ON channel_presence FOR INSERT WITH CHECK (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);
CREATE POLICY "presence_jwt_update" ON channel_presence FOR UPDATE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);
CREATE POLICY "presence_api_select" ON channel_presence FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- channel_call_session
CREATE POLICY "call_session_jwt_select" ON channel_call_session FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_session_jwt_insert" ON channel_call_session FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_session_jwt_update" ON channel_call_session FOR UPDATE USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_session_api_select" ON channel_call_session FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- channel_call_participant
CREATE POLICY "call_participant_jwt_select" ON channel_call_participant FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_participant_jwt_insert" ON channel_call_participant FOR INSERT WITH CHECK (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);
CREATE POLICY "call_participant_jwt_update" ON channel_call_participant FOR UPDATE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);
CREATE POLICY "call_participant_api_select" ON channel_call_participant FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- call_log
CREATE POLICY "call_log_jwt_select" ON call_log FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_log_api_select" ON call_log FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- REALTIME
--------------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE channel_call_session;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_call_participant;
```

- [ ] **Step 1.2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260322180000_channel_voice.sql
```

- [ ] **Step 1.3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 1.4: Typecheck**

```bash
pnpm turbo typecheck
```

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/20260322180000_channel_voice.sql packages/supabase/src/database.types.ts
git commit -m "feat(webrtc): database migration — 4 tables, 1 enum, RLS, realtime

Tables: channel_presence, channel_call_session, channel_call_participant, call_log
Enum: channel_call_type (direct|group|ptt)
RLS: JWT + API key policies on all tables
Realtime: channel_call_session + channel_call_participant

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Edge Functions

**Files:**

- Create: `supabase/functions/livekit-token/index.ts`
- Create: `supabase/functions/livekit-webhook/index.ts`
- Create: `supabase/functions/call-command/index.ts`

### Steps

- [ ] **Step 2.1: Create livekit-token Edge Function**

Create `supabase/functions/livekit-token/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { channelId, workspaceId } = await req.json();

    // Verify profile exists in workspace
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("profile_id, full_name, avatar_url")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "No active profile in workspace" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify channel membership
    const { data: membership } = await supabase
      .from("channel_member")
      .select("id, role")
      .eq("channel_id", channelId)
      .eq("profile_id", profile.profile_id)
      .is("left_at", null)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this channel" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read channel audio policy for grant decisions
    const { data: channel } = await supabase
      .from("channel")
      .select("audio_policy")
      .eq("id", channelId)
      .single();

    const audioPolicy = channel?.audio_policy ?? "disabled";
    if (audioPolicy === "disabled") {
      return new Response(JSON.stringify({ error: "Voice is disabled for this channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roomName = `${workspaceId}:${channelId}`;

    const at = new AccessToken(
      Deno.env.get("LIVEKIT_API_KEY")!,
      Deno.env.get("LIVEKIT_API_SECRET")!,
      {
        identity: profile.profile_id,
        name: profile.full_name ?? "Unknown",
        ttl: "6h",
        metadata: JSON.stringify({
          device_type: "web",
          display_name: profile.full_name,
          avatar_url: profile.avatar_url,
          is_ai: false,
        }),
      },
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: audioPolicy !== "listen_only",
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      canPublishSources: audioPolicy === "listen_only" ? [] : ["microphone"],
    });

    const token = await at.toJwt();

    return new Response(
      JSON.stringify({
        token,
        serverUrl: Deno.env.get("NEXT_PUBLIC_LIVEKIT_URL") ?? Deno.env.get("LIVEKIT_URL"),
        roomName,
        profileId: profile.profile_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2.2: Create livekit-webhook Edge Function**

Create `supabase/functions/livekit-webhook/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { WebhookReceiver } from "npm:livekit-server-sdk@2.15.0";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const receiver = new WebhookReceiver(
    Deno.env.get("LIVEKIT_API_KEY")!,
    Deno.env.get("LIVEKIT_API_SECRET")!,
  );

  const rawBody = await req.text();
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return new Response("Missing Authorization header", { status: 401 });
  }

  let event;
  try {
    event = await receiver.receive(rawBody, authHeader);
  } catch {
    return new Response("Invalid webhook signature", { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Room name format: {workspace_id}:{channel_id}
  const roomName = event.room?.name ?? "";
  const [workspaceId, channelId] = roomName.split(":");

  if (!workspaceId || !channelId) {
    console.error("[livekit-webhook] Invalid room name format:", roomName);
    return new Response("ok");
  }

  switch (event.event) {
    case "participant_joined": {
      const identity = event.participant?.identity;
      if (!identity) break;

      // Upsert participant
      await supabase.from("channel_call_participant").upsert(
        {
          call_session_id: await getActiveSessionId(supabase, channelId),
          workspace_id: workspaceId,
          profile_id: identity,
          is_ai: identity.startsWith("botsson:"),
          mic_enabled: false,
          device_type: getDeviceType(event.participant?.metadata),
        },
        { onConflict: "call_session_id,profile_id", ignoreDuplicates: false },
      );

      // Update max_participants
      const sessionId = await getActiveSessionId(supabase, channelId);
      if (sessionId) {
        const { count } = await supabase
          .from("channel_call_participant")
          .select("id", { count: "exact", head: true })
          .eq("call_session_id", sessionId)
          .is("left_at", null);

        await supabase
          .from("channel_call_session")
          .update({ max_participants: Math.max(count ?? 0, 0) })
          .eq("id", sessionId);
      }
      break;
    }

    case "participant_left": {
      const identity = event.participant?.identity;
      if (!identity) break;

      const sessionId = await getActiveSessionId(supabase, channelId);
      if (sessionId) {
        await supabase
          .from("channel_call_participant")
          .update({ left_at: new Date().toISOString() })
          .eq("call_session_id", sessionId)
          .eq("profile_id", identity)
          .is("left_at", null);
      }
      break;
    }

    case "room_finished": {
      // Finalize the call session
      const { data: session } = await supabase
        .from("channel_call_session")
        .select("id, call_type, max_participants, started_at")
        .eq("channel_id", channelId)
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (session) {
        const endedAt = new Date().toISOString();
        const durationSeconds = Math.round(
          (new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000,
        );

        // Update session
        await supabase
          .from("channel_call_session")
          .update({ status: "ended", ended_at: endedAt })
          .eq("id", session.id);

        // Mark all remaining participants as left
        await supabase
          .from("channel_call_participant")
          .update({ left_at: endedAt })
          .eq("call_session_id", session.id)
          .is("left_at", null);

        // Get participant summary
        const { data: participants } = await supabase
          .from("channel_call_participant")
          .select("profile_id, joined_at, left_at, speaking_seconds")
          .eq("call_session_id", session.id);

        const participantSummary = (participants ?? []).map((p) => ({
          profile_id: p.profile_id,
          joined: p.joined_at,
          left: p.left_at,
          spoke_seconds: p.speaking_seconds,
        }));

        // Create call_log
        await supabase.from("call_log").insert({
          channel_id: channelId,
          workspace_id: workspaceId,
          call_session_id: session.id,
          livekit_room_name: roomName,
          started_at: session.started_at,
          ended_at: endedAt,
          duration_seconds: durationSeconds,
          max_participants: session.max_participants,
          total_participants: new Set(participantSummary.map((p) => p.profile_id)).size,
          participant_summary: participantSummary,
        });

        // Detect missed 1:1 call
        if (session.call_type === "direct" && session.max_participants <= 1) {
          console.log("[livekit-webhook] Missed call detected:", session.id);
          // Telemetry: channel.call.invite_missed will be emitted here
        }
      }
      break;
    }
  }

  return new Response("ok");
});

async function getActiveSessionId(
  supabase: ReturnType<typeof createClient>,
  channelId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("channel_call_session")
    .select("id")
    .eq("channel_id", channelId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();
  return data?.id ?? null;
}

function getDeviceType(metadata?: string | null): string {
  if (!metadata) return "unknown";
  try {
    const parsed = JSON.parse(metadata);
    return parsed.device_type ?? "unknown";
  } catch {
    return "unknown";
  }
}
```

- [ ] **Step 2.3: Create call-command Edge Function**

Create `supabase/functions/call-command/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "start":
        return await handleStart(supabase, user.id, body);
      case "respond":
        return await handleRespond(supabase, user.id, body);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleStart(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: {
    channelId: string;
    workspaceId: string;
    callType: "direct" | "group" | "ptt";
    calleeProfileId?: string;
  },
) {
  const { channelId, workspaceId, callType, calleeProfileId } = body;

  // Get caller profile
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, full_name, avatar_url")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "No active profile" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify channel membership
  const { data: membership } = await supabase
    .from("channel_member")
    .select("id")
    .eq("channel_id", channelId)
    .eq("profile_id", profile.profile_id)
    .is("left_at", null)
    .single();

  if (!membership) {
    return new Response(JSON.stringify({ error: "Not a member of this channel" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check audio policy
  const { data: channel } = await supabase
    .from("channel")
    .select("audio_policy")
    .eq("id", channelId)
    .single();

  if (!channel || channel.audio_policy === "disabled") {
    return new Response(JSON.stringify({ error: "Voice is disabled for this channel" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const roomName = `${workspaceId}:${channelId}`;

  // Create call session (service role for insert reliability)
  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: session, error: sessionError } = await serviceSupabase
    .from("channel_call_session")
    .insert({
      channel_id: channelId,
      workspace_id: workspaceId,
      call_type: callType,
      livekit_room_name: roomName,
      status: "active",
      audio_policy: channel.audio_policy,
      video_policy: "disabled",
      recording_policy: "off",
      started_by: profile.profile_id,
    })
    .select("id")
    .single();

  if (sessionError) {
    return new Response(JSON.stringify({ error: sessionError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Broadcast signaling
  if (callType === "direct" && calleeProfileId) {
    // 1:1 call invite
    const broadcastChannel = supabase.channel(`profile:${workspaceId}:${calleeProfileId}:calls`);
    await broadcastChannel.send({
      type: "broadcast",
      event: "call_invite",
      payload: {
        callSessionId: session.id,
        channelId,
        callerName: profile.full_name,
        callerAvatar: profile.avatar_url,
        roomName,
        workspaceId,
      },
    });
    await broadcastChannel.unsubscribe();
  } else if (callType === "group") {
    // Group call announcement
    const broadcastChannel = supabase.channel(`channel:${workspaceId}:${channelId}:calls`);
    await broadcastChannel.send({
      type: "broadcast",
      event: "group_call_started",
      payload: {
        callSessionId: session.id,
        initiatorName: profile.full_name,
        roomName,
        participantCount: 1,
      },
    });
    await broadcastChannel.unsubscribe();
  }

  return new Response(
    JSON.stringify({
      callSessionId: session.id,
      roomName,
      callType,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function handleRespond(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: {
    callSessionId: string;
    workspaceId: string;
    channelId: string;
    responseAction: "accept" | "reject" | "cancel";
    targetProfileId?: string;
  },
) {
  const { callSessionId, workspaceId, channelId, responseAction, targetProfileId } = body;

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, full_name")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "No active profile" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Broadcast response to the other party
  if (targetProfileId) {
    const eventMap = {
      accept: "call_accepted",
      reject: "call_rejected",
      cancel: "call_cancelled",
    } as const;

    const broadcastChannel = supabase.channel(`profile:${workspaceId}:${targetProfileId}:calls`);
    await broadcastChannel.send({
      type: "broadcast",
      event: eventMap[responseAction],
      payload: { callSessionId },
    });
    await broadcastChannel.unsubscribe();
  }

  // On reject/cancel: check if call should be ended
  if (responseAction === "reject" || responseAction === "cancel") {
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { count } = await serviceSupabase
      .from("channel_call_participant")
      .select("id", { count: "exact", head: true })
      .eq("call_session_id", callSessionId)
      .is("left_at", null);

    if (!count || count === 0) {
      await serviceSupabase
        .from("channel_call_session")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", callSessionId);
    }
  }

  return new Response(JSON.stringify({ ok: true, action: responseAction }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2.4: Test with lk CLI**

```bash
# Generate a test token
lk token create --api-key APIgbStSRR5eY54 --api-secret <from-1password> \
  --join --room test-room --identity test-user --valid-for 1h

# Join test room to verify connectivity
lk room join --room test-room --identity test-user --publish-demo
```

- [ ] **Step 2.5: Commit**

```bash
git add supabase/functions/livekit-token/ supabase/functions/livekit-webhook/ supabase/functions/call-command/
git commit -m "feat(webrtc): Edge Functions — livekit-token, livekit-webhook, call-command

- livekit-token: JWT auth, channel membership check, policy-aware grants
- livekit-webhook: HMAC validation, participant/room lifecycle reconciliation
- call-command: start (1:1 + group + ptt) and respond (accept/reject/cancel)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Shared Package — Data Layer

**Files:**

- Create: `packages/walkieTalkie/src/call-queries.ts`
- Create: `packages/walkieTalkie/src/call-mutations.ts`
- Create: `packages/walkieTalkie/src/call-signaling.ts`
- Create: `packages/walkieTalkie/src/ptt-logic.ts`
- Modify: `packages/walkieTalkie/src/index.ts`

### Steps

- [ ] **Step 3.1: Create call-queries.ts**

Supabase client queries for call state and history. Used by both web and mobile hooks.

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallSession, CallLogEntry } from "./call-types";

export async function getActiveCallSession(
  supabase: SupabaseClient,
  channelId: string,
): Promise<CallSession | null> {
  const { data, error } = await supabase
    .from("channel_call_session")
    .select("*")
    .eq("channel_id", channelId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    channelId: data.channel_id,
    workspaceId: data.workspace_id,
    callType: data.call_type,
    livekitRoomName: data.livekit_room_name,
    status: data.status,
    audioPolicy: data.audio_policy,
    startedBy: data.started_by,
    maxParticipants: data.max_participants,
    startedAt: data.started_at,
    endedAt: data.ended_at,
  };
}

export async function getCallHistory(
  supabase: SupabaseClient,
  channelId: string,
  limit = 20,
  offset = 0,
): Promise<CallLogEntry[]> {
  const { data, error } = await supabase
    .from("call_log")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id,
    channelId: d.channel_id,
    callSessionId: d.call_session_id,
    livekitRoomName: d.livekit_room_name,
    startedAt: d.started_at,
    endedAt: d.ended_at,
    durationSeconds: d.duration_seconds,
    maxParticipants: d.max_participants,
    totalParticipants: d.total_participants,
    participantSummary: d.participant_summary as CallLogEntry["participantSummary"],
    createdAt: d.created_at,
  }));
}
```

- [ ] **Step 3.2: Create call-mutations.ts**

Edge Function invocations shared by both platforms.

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallType } from "./call-types";

type StartCallResult = {
  callSessionId: string;
  roomName: string;
  callType: CallType;
};

type TokenResult = {
  token: string;
  serverUrl: string;
  roomName: string;
  profileId: string;
};

export async function startCall(
  supabase: SupabaseClient,
  params: {
    channelId: string;
    workspaceId: string;
    callType: CallType;
    calleeProfileId?: string;
  },
): Promise<StartCallResult> {
  const { data, error } = await supabase.functions.invoke("call-command", {
    body: { action: "start", ...params },
  });
  if (error) throw new Error(error.message);
  return data as StartCallResult;
}

export async function getLiveKitToken(
  supabase: SupabaseClient,
  params: { channelId: string; workspaceId: string },
): Promise<TokenResult> {
  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: params,
  });
  if (error) throw new Error(error.message);
  return data as TokenResult;
}

export async function respondToInvite(
  supabase: SupabaseClient,
  params: {
    callSessionId: string;
    workspaceId: string;
    channelId: string;
    responseAction: "accept" | "reject" | "cancel";
    targetProfileId?: string;
  },
): Promise<void> {
  const { error } = await supabase.functions.invoke("call-command", {
    body: { action: "respond", ...params },
  });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3.3: Create call-signaling.ts**

Supabase Realtime Broadcast helpers for call signaling.

```typescript
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type { CallSignalingEvent, IncomingCall } from "./call-types";

type SignalingCallback = (event: CallSignalingEvent) => void;

/** Subscribe to personal call signaling channel (1:1 invites) */
export function subscribeToPersonalCalls(
  supabase: SupabaseClient,
  workspaceId: string,
  profileId: string,
  onEvent: SignalingCallback,
): RealtimeChannel {
  const channel = supabase.channel(`profile:${workspaceId}:${profileId}:calls`);

  channel.on("broadcast", { event: "call_invite" }, ({ payload }) => {
    onEvent({ type: "call_invite", payload: payload as IncomingCall });
  });

  channel.on("broadcast", { event: "call_accepted" }, ({ payload }) => {
    onEvent({ type: "call_accepted", payload: payload as { callSessionId: string } });
  });

  channel.on("broadcast", { event: "call_rejected" }, ({ payload }) => {
    onEvent({ type: "call_rejected", payload: payload as { callSessionId: string } });
  });

  channel.on("broadcast", { event: "call_cancelled" }, ({ payload }) => {
    onEvent({ type: "call_cancelled", payload: payload as { callSessionId: string } });
  });

  channel.on("broadcast", { event: "call_ended" }, ({ payload }) => {
    onEvent({ type: "call_ended", payload: payload as { callSessionId: string } });
  });

  channel.subscribe();
  return channel;
}

/** Subscribe to channel-level call announcements (group calls) */
export function subscribeToChannelCalls(
  supabase: SupabaseClient,
  workspaceId: string,
  channelId: string,
  onEvent: SignalingCallback,
): RealtimeChannel {
  const channel = supabase.channel(`channel:${workspaceId}:${channelId}:calls`);

  channel.on("broadcast", { event: "group_call_started" }, ({ payload }) => {
    onEvent({
      type: "group_call_started",
      payload: payload as {
        callSessionId: string;
        initiatorName: string;
        roomName: string;
        participantCount: number;
      },
    });
  });

  channel.subscribe();
  return channel;
}
```

- [ ] **Step 3.4: Create ptt-logic.ts**

Pure PTT state machine with debounced telemetry.

```typescript
import type { PTTState } from "./call-types";

type PTTAction = "connect" | "connected" | "press" | "release" | "disconnect" | "error";

export function pttReducer(state: PTTState, action: PTTAction): PTTState {
  switch (state) {
    case "idle":
      if (action === "connect") return "connecting";
      return state;
    case "connecting":
      if (action === "connected") return "connected_muted";
      if (action === "error" || action === "disconnect") return "idle";
      return state;
    case "connected_muted":
      if (action === "press") return "talking";
      if (action === "disconnect") return "idle";
      return state;
    case "talking":
      if (action === "release") return "connected_muted";
      if (action === "disconnect") return "idle";
      return state;
    default:
      return state;
  }
}

/** Creates a debounced telemetry emitter for PTT events. Max once per interval. */
export function createPTTTelemetryDebouncer(intervalMs = 5000) {
  let lastEmitTime = 0;

  return function shouldEmit(): boolean {
    const now = Date.now();
    if (now - lastEmitTime >= intervalMs) {
      lastEmitTime = now;
      return true;
    }
    return false;
  };
}
```

- [ ] **Step 3.5: Update index.ts exports**

```typescript
export * from "./call-types";
export * from "./call-keys";
export * from "./call-queries";
export * from "./call-mutations";
export * from "./call-signaling";
export * from "./ptt-logic";
```

- [ ] **Step 3.6: Typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/walkie-talkie
```

- [ ] **Step 3.7: Commit**

```bash
git add packages/walkieTalkie/
git commit -m "feat(webrtc): shared data layer — queries, mutations, signaling, PTT logic

- call-queries: getActiveCallSession, getCallHistory (Supabase client)
- call-mutations: startCall, getLiveKitToken, respondToInvite (Edge Function invocations)
- call-signaling: Realtime Broadcast subscribe helpers (personal + channel)
- ptt-logic: pure state machine + debounced telemetry helper

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Web Hooks + API Routes

**Files:**

- Create: 8 hook files in `apps/web/src/app/dashboard/komm/_hooks/`
- Create: 5 API route files in `apps/web/src/app/api/channels/[id]/call/`
- Modify: `apps/web/src/app/dashboard/komm/_hooks/channel-keys.ts`

This task creates all web-specific hooks and thin API routes. Each hook wraps the shared
`@smartout/walkie-talkie` functions with TanStack Query. The `use-livekit-call` hook is the
platform-specific LiveKit adapter using `@livekit/components-react` and Krisp noise filter.

Read the spec Section 9 (Hooks) for the full interface contracts. Read the existing hooks
in `_hooks/use-channels.ts` and `_hooks/use-send-message.ts` for patterns (workspace context,
mutation with optimistic updates, emit in onSuccess).

For API routes, each is a thin wrapper that either invokes an Edge Function or runs a direct
Supabase query. Follow the existing pattern in `apps/web/src/app/api/` for auth handling.

### Steps

- [ ] **Step 4.1: Add call keys to channel-keys.ts**
- [ ] **Step 4.2: Create use-call-state.ts** — `useQuery` wrapping `getActiveCallSession`
- [ ] **Step 4.3: Create use-call-history.ts** — `useQuery` wrapping `getCallHistory`
- [ ] **Step 4.4: Create use-start-call.ts** — `useMutation` wrapping `startCall` + `getLiveKitToken`
- [ ] **Step 4.5: Create use-call-invite.ts** — `useMutation` wrapping `respondToInvite`
- [ ] **Step 4.6: Create use-call-signaling.ts** — subscribes to `profile:{wid}:{pid}:calls`
- [ ] **Step 4.7: Create use-call-realtime.ts** — subscribes to `channel_call_session` + `channel_call_participant` Realtime changes
- [ ] **Step 4.8: Create use-livekit-call.ts** — LiveKit Room lifecycle with Krisp, mic toggle, speaker detection
- [ ] **Step 4.9: Create use-push-to-talk.ts** — wraps PTT state machine + web event handlers
- [ ] **Step 4.10: Create 5 API route files** (thin wrappers)
- [ ] **Step 4.11: Typecheck** — `pnpm turbo typecheck --filter=web`
- [ ] **Step 4.12: Commit**

---

## Task 5: Web Components + Integration

**Files:**

- Create: 6 component files in `apps/web/src/app/dashboard/komm/_components/`
- Modify: `ChannelHeader.tsx`, `KommShell.tsx`, `MessageInput.tsx`

Read the design system style guide at `docs/design/ren-og-varm-styleguide.html` before building
UI. Use the `frontend-designer` agent for component design. Follow existing component patterns
in the `_components/` directory (shadcn/ui, CSS variables, Tailwind v4).

### Steps

- [ ] **Step 5.1: Create ActiveSpeakerIndicator.tsx** — green pulsing ring around speaking avatar
- [ ] **Step 5.2: Create CallBar.tsx** — floating overlay with participants, mute/end buttons, active speakers
- [ ] **Step 5.3: Create IncomingCallOverlay.tsx** — full-screen modal with caller info, accept/reject
- [ ] **Step 5.4: Create GroupCallBanner.tsx** — "N in call — [Join]" banner
- [ ] **Step 5.5: Create CallHistory.tsx** — list of past calls with duration/participants
- [ ] **Step 5.6: Create PTTButton.tsx** — hold-to-talk with visual feedback, onPointerDown/Up
- [ ] **Step 5.7: Wire call button into ChannelHeader.tsx** — phone icon, disabled when audio_policy='disabled'
- [ ] **Step 5.8: Wire IncomingCallOverlay + CallBar into KommShell.tsx**
- [ ] **Step 5.9: Wire PTT mode into MessageInput.tsx** — swap send button for PTTButton when audio_policy='ptt'
- [ ] **Step 5.10: Visual review** — verify all components render correctly, check design system compliance
- [ ] **Step 5.11: Commit**

---

## Task 6: Mobile Hooks + Components

**Files:**

- Create: 3 hook files in `apps/mobile/src/hooks/`
- Create: 5 component files in `apps/mobile/src/features/channels/components/`

Mobile reuses the same shared query/mutation functions from `@smartout/walkie-talkie`. Only the
LiveKit connection hook and PTT hook need platform-specific implementations.

Critical: LiveKit React Native requires `registerGlobals()` at app entry point BEFORE any LiveKit
usage. Requires Expo dev builds (not Expo Go). Test on physical device.

### Steps

- [ ] **Step 6.1: Add registerGlobals() to mobile app entry point**

In the mobile app's root layout or entry file, add before any component:

```typescript
import { registerGlobals } from "@livekit/react-native";
registerGlobals();
```

- [ ] **Step 6.2: Create mobile use-livekit-call.ts** — RN adapter with AudioSession lifecycle
- [ ] **Step 6.3: Create mobile use-call-signaling.ts** — same as web (shared functions)
- [ ] **Step 6.4: Create mobile use-push-to-talk.ts** — Pressable onPressIn/Out + haptics
- [ ] **Step 6.5: Create CallBar.tsx** — fixed bottom bar, native styling
- [ ] **Step 6.6: Create IncomingCallScreen.tsx** — full-screen with AudioSession.startAudioSession()
- [ ] **Step 6.7: Create GroupCallBanner.tsx** — banner in channel header
- [ ] **Step 6.8: Create PTTButton.tsx** — Pressable, haptic feedback, large thumb target
- [ ] **Step 6.9: Create CallHistoryList.tsx** — FlatList of call_log entries
- [ ] **Step 6.10: Wire components into mobile channel screens**
- [ ] **Step 6.11: Run Expo prebuild** — `npx expo prebuild` (required for LiveKit native modules)
- [ ] **Step 6.12: Test on physical device**
- [ ] **Step 6.13: Commit**

---

## Task 7: Polish + Integration

**Files:**

- Modify: various (error handling, reconnection, navigation persistence)
- Create: ADR documents

### Steps

- [ ] **Step 7.1: Call state persistence across navigation** — CallBar stays visible when navigating between channels
- [ ] **Step 7.2: Reconnection handling** — auto-reconnect on network drop (LiveKit handles this, verify behavior)
- [ ] **Step 7.3: Error states** — room full, connection failed, permission denied (toast notifications)
- [ ] **Step 7.4: PTT room idempotency** — handle room_finished webhook for PTT rooms without false invite_missed
- [ ] **Step 7.5: Missed call notifications** — wire into existing notification pipeline (from webhook)
- [ ] **Step 7.6: Write ADR — LiveKit as WebRTC provider**
- [ ] **Step 7.7: Write ADR — Edge Functions own call orchestration**
- [ ] **Step 7.8: Update docs/reference/ENV_VARS.md** — add 4 LiveKit vars
- [ ] **Step 7.9: Update docs/reference/ROUTES.md** — add 5 call routes
- [ ] **Step 7.10: Update docs/reference/EDGE_FUNCTIONS_REFERENCE.md** — add 3 functions
- [ ] **Step 7.11: Update WORKLOG, decision log, learning log**
- [ ] **Step 7.12: Final typecheck** — `pnpm turbo typecheck`
- [ ] **Step 7.13: Commit**
