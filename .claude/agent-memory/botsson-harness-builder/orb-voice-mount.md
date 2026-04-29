---
name: Botsson Orb voice mount — LiveKit integration pattern
description: How BotssonVoiceCall is wired, why livekit-token Edge Function was bypassed, and the token BFF route pattern
type: project
---

## What landed (feat/botsson-orb-voice-mount, commit e5e5adaa / bf2c5ffc)

Three new files + two modified files enable voice calls from the Orb:

1. `apps/web/src/app/api/botsson/voice/token/route.ts` — BFF token route
2. `apps/web/src/app/Botsson/_components/BotssonVoiceCall.tsx` — LiveKit session component
3. `apps/web/src/app/Botsson/_components/BotssonShell.tsx` — mic button wired (Option A)
4. `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` — `workspaceId` exposed on context

**Why:** livekit-token Edge Function validates channel membership. Personal Botsson rooms (`botsson-orb:<profileId>`) are NOT channels. Cannot reuse the Edge Function without modifying it.

**Token route pattern:** mints token directly using `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` server-side env vars (already in env.ts). Uses `livekit-server-sdk@2.15.2` (added to apps/web package.json).

**Room name:** `botsson-orb:<profileId>` — the voice-agent worker is auto-dispatch, so it joins any new room.

**ADR-0151 compliance:** profileId derived from `supabase.from("profile").select()` server-side, not from request body.

**Why:** The voice-agent automatic-dispatch worker (services/voice-agent) autojoins any new LiveKit room. This room format gives each user a dedicated Botsson voice session without needing /komm/ channel infrastructure.

## package.json change

Added `livekit-server-sdk: 2.15.2` to `apps/web/package.json`. Was already in pnpm store (used by voice-agent service). Had to update both the worktree's package.json AND the main repo's `apps/web/package.json` + run `pnpm install` to link the physical package into `node_modules`.

## BotssonProvider context change

Added `workspaceId: string | null` to `BotssonContextValue` type and the useMemo value object. Previously only accessible via `viewActionsRef.current.getWorkspaceId()` (internal). Now callable from any `useBotsson()` consumer.

## Orb mic button

Small 28px button floats 8px below the Orb (`-bottom-8`). Uses `opacity-0 hover:opacity-100` pattern — invisible until hover, stays visible when `voiceActive=true`. `onPointerDown: e.stopPropagation()` prevents the drag handler from intercepting button clicks.

Voice status (idle/connecting/listening/thinking/speaking) drives `setOrbStatus()` via `voiceStatusToOrb()` converter exported from `BotssonVoiceCall.tsx`.
