// token.ts — Mint a LiveKit token for a Botsson voice session.
//
// The voice-agent worker joins rooms named "<workspaceId>:<channelId>".
// For Botsson direct sessions (not bound to a komm channel) we use the
// synthetic channelId "botsson-direct".
//
// ADR-0135 note: the livekit-token Edge Function is the authority — this
// module is a typed fetch wrapper for the BFF route that proxies it.

import type { LiveKitTokenResponse } from "../types";

export type TokenRequestParams = {
  workspaceId: string;
  /** Optional channel ID — defaults to "botsson-direct" */
  channelId?: string;
  /** BFF endpoint. Default: "/api/botsson/voice/token" */
  tokenEndpoint: string;
};

/**
 * Mint a LiveKit token via the BFF.
 *
 * Sends purpose="ai_voice" so the Edge Function applies the
 * channel_ai_policy gate (ADR-0135) rather than the human_call gate.
 *
 * Throws on any non-2xx response.
 */
export async function mintLiveKitToken(params: TokenRequestParams): Promise<LiveKitTokenResponse> {
  const channelId = params.channelId ?? "botsson-direct";

  const res = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      channelId,
      purpose: "ai_voice",
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Token request failed: ${res.status}`);
  }

  const data = (await res.json()) as LiveKitTokenResponse;

  if (!data.token || !data.serverUrl) {
    throw new Error("Token response missing token or serverUrl");
  }

  return data;
}
