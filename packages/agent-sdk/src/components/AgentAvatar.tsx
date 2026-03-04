"use client";

import type { AgentStatus } from "../types";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AgentAvatarProps = {
  status: AgentStatus;
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  currentText: string;
  onToggleMic: () => void;
  onStart: () => void;
  onEnd: () => void;
  onShowCard?: () => void;
  /** Custom icon rendered inside the avatar circle. Defaults to a simple bot icon. */
  icon?: ReactNode;
  /** Agent display name shown in tooltips/labels */
  agentName?: string;
};

/**
 * Voice visualizer — animated bars showing voice activity.
 *
 * Uses pure CSS animations to avoid framer-motion dependency.
 * Consumer apps can swap this out with their own motion-based visualizer.
 */
function VoiceVisualizer({
  isSpeaking,
  isConnected,
}: {
  isSpeaking: boolean;
  isConnected: boolean;
}) {
  const barCount = 5;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          style={{
            width: "3px",
            borderRadius: "9999px",
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            height: isSpeaking ? `${14 + i * 3}px` : isConnected ? "6px" : "3px",
            opacity: isSpeaking ? 0.9 : isConnected ? 0.4 : 0.15,
            transition: "height 0.3s ease, opacity 0.3s ease",
            animation: isSpeaking
              ? `agentSdkPulse ${0.6 + i * 0.08}s ease-in-out infinite ${i * 0.07}s`
              : isConnected
                ? `agentSdkIdle 2s ease-in-out infinite ${i * 0.07}s`
                : "none",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Reusable agent avatar component.
 *
 * Extracted from BotssonAvatar — provides the core avatar circle,
 * connection status indicator, mic toggle, and speech bubble.
 *
 * This is a headless-ish component using inline styles + CSS variable classes
 * for theming. Consumers can wrap it with their own animation library
 * (framer-motion, etc.) for enhanced motion.
 */
export function AgentAvatar({
  status,
  isConnected,
  isSpeaking,
  isMuted,
  currentText,
  onToggleMic,
  onStart,
  onEnd,
  onShowCard,
  icon,
  agentName = "Agent",
}: AgentAvatarProps) {
  const isConnecting = status === "connecting" || status === "disconnecting";

  return (
    <div
      style={{
        position: "fixed",
        right: "2rem",
        bottom: "2rem",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        gap: "0.75rem",
      }}
    >
      {/* Speech bubble / status text */}
      <div style={{ marginBottom: "0.5rem", maxWidth: "280px" }}>
        {status === "idle" && (
          <div
            className="border-border/5 bg-background/60 text-foreground/40"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "1rem",
              borderBottomRightRadius: "0.125rem",
              fontSize: "0.875rem",
              lineHeight: "1.5",
              backdropFilter: "blur(24px)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid",
            }}
          >
            {agentName} er klar
          </div>
        )}

        {isConnecting && (
          <div
            className="border-border/10 bg-background/80 text-foreground/60"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              borderRadius: "1rem",
              borderBottomRightRadius: "0.125rem",
              fontSize: "0.875rem",
              backdropFilter: "blur(24px)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid",
            }}
          >
            Kobler til...
          </div>
        )}

        {isConnected && currentText && (
          <div
            className="border-border/10 bg-background/80 text-foreground/80"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "1rem",
              borderBottomRightRadius: "0.125rem",
              fontSize: "0.875rem",
              lineHeight: "1.5",
              backdropFilter: "blur(24px)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid",
            }}
          >
            {currentText}
          </div>
        )}
      </div>

      {/* Avatar + controls column */}
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
      >
        {/* Info button */}
        {(isConnected || status === "idle") && onShowCard && (
          <button
            type="button"
            onClick={onShowCard}
            className="border-border/10 bg-background/40 text-foreground/60 hover:text-foreground/80"
            style={{
              display: "flex",
              width: "2rem",
              height: "2rem",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9999px",
              border: "1px solid",
              transition: "all 0.15s",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
            aria-label="Show info"
          >
            i
          </button>
        )}

        {/* Mic toggle */}
        {isConnected && (
          <button
            type="button"
            onClick={onToggleMic}
            style={{
              display: "flex",
              width: "2rem",
              height: "2rem",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9999px",
              border: "1px solid",
              transition: "all 0.15s",
              cursor: "pointer",
              fontSize: "0.75rem",
              backgroundColor: isMuted ? "rgba(239, 68, 68, 0.2)" : "rgba(0, 0, 0, 0.4)",
              borderColor: isMuted ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.1)",
              color: isMuted ? "rgb(248, 113, 113)" : "rgba(255, 255, 255, 0.6)",
            }}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? "M" : "U"}
          </button>
        )}

        {/* Main avatar circle */}
        <button
          type="button"
          onClick={status === "idle" ? onStart : isConnected ? onEnd : undefined}
          className="border-border/10 bg-background/60 hover:border-border/20 hover:bg-background/80"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "9999px",
            border: "1px solid",
            backdropFilter: "blur(24px)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            transition: "all 0.15s",
            cursor: "pointer",
            width: isConnected ? "4rem" : "3.5rem",
            height: isConnected ? "4rem" : "3.5rem",
          }}
          aria-label={status === "idle" ? `Start ${agentName}` : `Stop ${agentName}`}
        >
          {isConnecting ? (
            <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "1.5rem" }}>...</span>
          ) : isConnected ? (
            <VoiceVisualizer isSpeaking={isSpeaking} isConnected={isConnected} />
          ) : (
            (icon ?? (
              <span style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "1.5rem" }}>B</span>
            ))
          )}

          {/* Connection status dot */}
          <div
            style={{
              position: "absolute",
              top: "-0.25rem",
              right: "-0.25rem",
            }}
          >
            {isConnected ? (
              <span
                style={{
                  display: "inline-flex",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgb(52, 211, 153)",
                }}
              />
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  width: "0.625rem",
                  height: "0.625rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                }}
              />
            )}
          </div>
        </button>
      </div>

      {/* CSS animations for the voice visualizer */}
      <style>{`
        @keyframes agentSdkPulse {
          0%, 100% { height: 4px; opacity: 0.5; }
          25% { height: 18px; opacity: 0.9; }
          50% { height: 6px; opacity: 0.6; }
          75% { height: 14px; opacity: 1; }
        }
        @keyframes agentSdkIdle {
          0%, 100% { height: 3px; opacity: 0.2; }
          50% { height: 6px; opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
