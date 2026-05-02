"use client";

// BotssonSdkPlayground — Smoke-test surface for @smartout/botsson-sdk.
//
// NOT wired to any route. Dev imports manually:
//   import { BotssonSdkPlayground } from
//     "@/app/Botsson/_components/__playground__/BotssonSdkPlayground";
//
// Exercises the full useBotsson() hook end-to-end:
//   - Voice: start/end, mic toggle, status display, activity stream
//   - Chat: input + transcript
//
// Design: Nordic Split tokens (no hardcoded colors).
// Icons: Lucide only.

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Activity,
  MessageSquare,
  Radio,
} from "lucide-react";
import { useBotsson } from "@smartout/botsson-sdk";
import type { BotssonActivityEvent } from "@smartout/botsson-sdk";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatActivityTs(ts: number): string {
  return new Date(ts).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function activityLabel(event: BotssonActivityEvent): string {
  switch (event.type) {
    case "connected":
      return `Tilkoblet — ${event.agent} (${event.provider})`;
    case "tool_call":
      return `Verktoy: ${event.tool} — "${event.query.slice(0, 60)}${event.query.length > 60 ? "..." : ""}"`;
    case "tool_response":
      return `Svar (${event.durationMs}ms): ${event.response.slice(0, 80)}${event.response.length > 80 ? "..." : ""}`;
    case "intent":
      return `Intent: ${event.capability} (${Math.round(event.confidence * 100)}%)`;
    default: {
      const _exhaustive: never = event;
      return JSON.stringify(_exhaustive).slice(0, 100);
    }
  }
}

function activityColor(type: BotssonActivityEvent["type"]): string {
  switch (type) {
    case "connected":
      return "text-green-600 dark:text-green-400";
    case "tool_call":
      return "text-blue-600 dark:text-blue-400";
    case "tool_response":
      return "text-foreground";
    case "intent":
      return "text-orange-600 dark:text-orange-400";
  }
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    idle: "bg-muted text-muted-foreground",
    connecting: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    listening: "bg-green-500/10 text-green-600 dark:text-green-400",
    thinking: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    speaking: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    disconnecting: "bg-muted text-muted-foreground",
    disconnected: "bg-muted text-muted-foreground",
    voice: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    chat: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  return (
    <span
      className={[
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorMap[status] ?? "bg-muted text-muted-foreground",
      ].join(" ")}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** Props required to exercise the SDK against real infra */
export type BotssonSdkPlaygroundProps = {
  /** Workspace ID — from the current user session */
  workspaceId: string;
  /**
   * BFF endpoint that proxies the livekit-token Edge Function.
   * Defaults to "/api/botsson/voice/token".
   * NOTE: Voice will return 403 until a "botsson-direct" channel row exists
   * in the workspace with channel_ai_policy.voice_participation enabled.
   */
  tokenEndpoint?: string;
};

export function BotssonSdkPlayground({
  workspaceId,
  tokenEndpoint = "/api/botsson/voice/token",
}: BotssonSdkPlaygroundProps) {
  const [chatInput, setChatInput] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const activityEndRef = useRef<HTMLDivElement>(null);

  const botsson = useBotsson({
    workspaceId,
    tokenEndpoint,
    pageContext: "/botsson/sdk-playground",
  });

  // Scroll transcript + activity to bottom on new entries
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [botsson.transcript]);

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [botsson.activity]);

  async function handleSendChat() {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput("");
    await botsson.sendChat(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendChat();
    }
  }

  const isVoiceActive = botsson.mode === "voice";
  const isStartingVoice = botsson.status === "connecting" && !isVoiceActive;

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Radio className="text-muted-foreground h-5 w-5" />
        <h1 className="font-heading text-xl font-semibold">Botsson SDK Playground</h1>
        <span className="text-muted-foreground text-xs">@smartout/botsson-sdk smoke test</span>
      </div>

      {/* Status bar */}
      <div className="border-border mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
        <span className="text-muted-foreground text-sm">Status:</span>
        <StatusPill status={botsson.status} />
        <span className="text-muted-foreground text-sm">Mode:</span>
        <StatusPill status={botsson.mode} />
        <span className="text-muted-foreground ml-auto text-xs">
          workspace: <code className="font-mono">{workspaceId.slice(0, 8)}&hellip;</code>
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Voice panel */}
        <div className="border-border flex flex-col gap-4 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <PhoneCall className="text-muted-foreground h-4 w-4" />
            <h2 className="font-medium">Voice (LiveKit)</h2>
          </div>

          {/* Voice controls */}
          <div className="flex gap-2">
            {!isVoiceActive ? (
              <button
                onClick={() => void botsson.startVoice()}
                disabled={isStartingVoice}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <PhoneCall className="h-4 w-4" />
                {isStartingVoice ? "Kobler til..." : "Start voice"}
              </button>
            ) : (
              <button
                onClick={botsson.endVoice}
                className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
              >
                <PhoneOff className="h-4 w-4" />
                End voice
              </button>
            )}

            <button
              onClick={botsson.toggleMic}
              disabled={!isVoiceActive}
              className="border-border disabled:text-muted-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed"
            >
              {botsson.isMicMuted ? (
                <MicOff className="h-4 w-4 text-red-500" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {botsson.isMicMuted ? "Unmute" : "Mute"}
            </button>
          </div>

          {/* Activity stream */}
          <div className="flex items-center gap-2">
            <Activity className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Activity ({botsson.activity.length})
            </span>
          </div>
          <div
            className="border-border bg-muted/30 flex-1 overflow-y-auto rounded-lg border p-3"
            style={{ minHeight: 180, maxHeight: 300 }}
          >
            {botsson.activity.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-xs">
                No activity yet — start a voice session
              </p>
            ) : (
              <ul className="space-y-1.5">
                {botsson.activity.map((event, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0 font-mono">
                      {formatActivityTs(event.ts)}
                    </span>
                    <span className={["font-medium", activityColor(event.type)].join(" ")}>
                      {activityLabel(event)}
                    </span>
                  </li>
                ))}
                <div ref={activityEndRef} />
              </ul>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="border-border flex flex-col gap-4 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-muted-foreground h-4 w-4" />
            <h2 className="font-medium">Chat</h2>
          </div>

          {/* Transcript */}
          <div
            className="border-border bg-muted/30 flex-1 overflow-y-auto rounded-lg border p-3"
            style={{ minHeight: 240, maxHeight: 380 }}
          >
            {botsson.transcript.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-xs">
                No messages yet — type something below
              </p>
            ) : (
              <ul className="space-y-3">
                {botsson.transcript.map((turn, i) => (
                  <li
                    key={i}
                    className={[
                      "flex flex-col gap-0.5",
                      turn.role === "user" ? "items-end" : "items-start",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        turn.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "border-border bg-card border",
                      ].join(" ")}
                    >
                      {turn.text}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {formatTs(turn.timestamp)}
                    </span>
                  </li>
                ))}
                <div ref={transcriptEndRef} />
              </ul>
            )}
          </div>

          {/* Input */}
          <div className="border-border flex gap-2 rounded-lg border px-3 py-2">
            <textarea
              className="bg-background text-foreground placeholder:text-muted-foreground flex-1 resize-none text-sm outline-none"
              placeholder="Skriv en melding... (Enter sender, Shift+Enter for ny linje)"
              rows={2}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={botsson.isChatLoading}
            />
            <button
              onClick={() => void handleSendChat()}
              disabled={!chatInput.trim() || botsson.isChatLoading}
              className="text-primary hover:text-primary/80 disabled:text-muted-foreground self-end transition-colors disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {botsson.isChatLoading && <p className="text-muted-foreground text-xs">Tenker...</p>}
        </div>
      </div>

      {/* Debug footer */}
      <div className="border-border mt-6 rounded-lg border px-4 py-3">
        <p className="text-muted-foreground text-xs">
          <strong className="text-foreground">SDK:</strong> @smartout/botsson-sdk v0.1.0 &mdash;{" "}
          <strong className="text-foreground">Voice:</strong> LiveKit (livekit-client 2.17.x){" "}
          &mdash; <strong className="text-foreground">Chat:</strong> /api/emma/chat &rarr;
          stage-engine &mdash; <strong className="text-foreground">Gap A3:</strong> engine_memory
          writer not yet live
        </p>
      </div>
    </div>
  );
}
