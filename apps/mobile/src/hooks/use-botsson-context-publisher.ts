/**
 * Mobile context-publisher — mirrors web BotssonOrbVoiceMount.tsx:331-346.
 *
 * Fetches /api/botsson/voice/session-context with Bearer auth, then publishes
 * the context_init payload over the LiveKit data channel topic="botsson-context".
 * The voice-agent worker (services/voice-agent/src/agent.ts:78-87) consumes
 * this and calls setSessionContext(), unblocking ctx.user / ctx.workspace
 * for every adapter.ask() call from voice tools.
 *
 * Failure mode is degraded — log + continue. Voice-agent treats missing ctx
 * as "brukerdata mangler" and returns a Norwegian fallback string from
 * adapter.ts:67-69. Without this hook, mobile capability calls always hit
 * that fallback.
 *
 * ADR-0132 (thin client, BFF auth boundary) + ADR-0151 (server-derived IDs).
 * Publisher is read-only — no emit() from this side (ADR-0134).
 */

import { useEffect, useRef } from "react";
import type { Room } from "livekit-client";
import { getWebApiUrl } from "@/lib/web-api";

// ── Payload types ────────────────────────────────────────────────────────────

export type UserContextPayload = {
  profile_id: string;
  role: "owner" | "admin" | "manager" | "employee";
  status: "trainee" | "active" | "inactive" | "offboarding";
  department_id: string | null;
  display_name: string;
  language: "no" | "en" | "sv" | "da" | "fi";
};

export type WorkspaceContextPayload = {
  workspace_id: string;
  name: string;
  niche: string | null;
  active_season_id: string | null;
  active_framework_id: string | null;
  planning_cycle_id: string | null;
};

export type SessionContextResponse = {
  user: UserContextPayload;
  workspace: WorkspaceContextPayload;
};

export type ContextInitMessage = {
  type: "context_init";
  user: UserContextPayload;
  workspace: WorkspaceContextPayload;
};

// ── Injectable seams for testing ─────────────────────────────────────────────

export type ContextFetcher = (args: {
  workspaceId: string;
  accessToken: string;
}) => Promise<SessionContextResponse | null>;

export type ContextPublisher = (msg: ContextInitMessage) => void;

// ── Pure orchestrator ─────────────────────────────────────────────────────────
//
// Factored out of the hook so jest-node can exercise it without a React
// renderer. No React, no LiveKit Room — just fetch + publish.

/**
 * Fetches session context once, then publishes as context_init.
 * Swallows fetcher errors (degraded mode — log + continue).
 */
export async function publishContextOnce(args: {
  workspaceId: string;
  accessToken: string;
  fetcher: ContextFetcher;
  publisher: ContextPublisher;
}): Promise<void> {
  let response: SessionContextResponse | null = null;
  try {
    response = await args.fetcher({
      workspaceId: args.workspaceId,
      accessToken: args.accessToken,
    });
  } catch (err) {
    console.warn("[botsson-context-publisher] fetch failed", err);
    return;
  }
  if (!response) return;
  args.publisher({
    type: "context_init",
    user: response.user,
    workspace: response.workspace,
  });
}

// ── Default implementations ──────────────────────────────────────────────────

/** Default fetcher — calls the BFF with Bearer auth per ADR-0132. */
export function defaultContextFetcher(): ContextFetcher {
  return async ({ workspaceId, accessToken }) => {
    let baseUrl: string;
    try {
      baseUrl = getWebApiUrl();
    } catch (err) {
      console.warn("[botsson-context-publisher] web API URL unavailable", err);
      return null;
    }
    const url = `${baseUrl}/api/botsson/voice/session-context?workspaceId=${encodeURIComponent(workspaceId)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.warn("[botsson-context-publisher] fetch error", err);
      return null;
    }
    if (!res.ok) {
      console.warn("[botsson-context-publisher] BFF rejected", res.status);
      return null;
    }
    return (await res.json()) as SessionContextResponse;
  };
}

/** Default publisher — encodes message + publishes to topic="botsson-context". */
export function makeRoomPublisher(room: Room): ContextPublisher {
  const encoder = new TextEncoder();
  return (msg) => {
    void room.localParticipant?.publishData(encoder.encode(JSON.stringify(msg)), {
      topic: "botsson-context",
      reliable: true,
    });
  };
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * Fires once per (room, workspaceId, accessToken) tuple — idempotent within a
 * session. Safe to call when room is null (no-op). Use inside a
 * connected-Room context (typically wired in use-botsson-voice-session.ts
 * after the `start()` flow resolves).
 */
export function useBotssonContextPublisher(args: {
  room: Room | null;
  workspaceId: string | null;
  accessToken: string | null;
  fetcher?: ContextFetcher;
}): void {
  // Track last published key to prevent duplicate publishes on re-render.
  const publishedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!args.room || !args.workspaceId || !args.accessToken) return;

    // Key includes first 8 chars of token to dedup per-session without
    // storing the full JWT in memory longer than needed.
    const key = `${args.workspaceId}:${args.accessToken.slice(0, 8)}`;
    if (publishedRef.current === key) return;
    publishedRef.current = key;

    void publishContextOnce({
      workspaceId: args.workspaceId,
      accessToken: args.accessToken,
      fetcher: args.fetcher ?? defaultContextFetcher(),
      publisher: makeRoomPublisher(args.room),
    });
  }, [args.room, args.workspaceId, args.accessToken, args.fetcher]);
}
