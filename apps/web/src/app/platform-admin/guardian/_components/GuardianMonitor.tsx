"use client";

// UI Events:
// - action: subscribe(sessionId) — select a session to monitor
// - action: whisper(sessionId, message) — send admin whisper to agent
// - action: setDetailsTab(tab) — toggle right pane between session info and turn replay
// - action: openDrawer() — open AdminActionDrawer for the selected session
// - visual: 3-panel layout (sessions | events | details) with tab switcher in details pane

import { useMemo, useState } from "react";
import { History, Info, Sliders } from "lucide-react";
import type { GuardianEvent, SessionInfo } from "../_hooks/useGuardianSocket";
import { SessionList } from "./SessionList";
import { EventFeed } from "./EventFeed";
import { SessionDetails } from "./SessionDetails";
import { WhisperInput } from "./WhisperInput";
import { TurnTimeline } from "./TurnTimeline";
import { AdminActionDrawer } from "./AdminActionDrawer";

type GuardianMonitorProps = {
  sessions: SessionInfo[];
  events: GuardianEvent[];
  subscribedSession: string | null;
  subscribe: (sessionId: string) => void;
  whisper: (sessionId: string, message: string) => void;
};

type DetailsTab = "info" | "replay";

export function GuardianMonitor({
  sessions,
  events,
  subscribedSession,
  subscribe,
  whisper,
}: GuardianMonitorProps) {
  const selectedSession = useMemo(
    () => sessions.find((s) => s.session_id === subscribedSession) ?? null,
    [sessions, subscribedSession],
  );

  // "info" = live SessionDetails stats; "replay" = recorded turns via TurnTimeline.
  // Defaults to info on each new selection so admins land on context before diving
  // into turn-level replay. Switching sessions resets the tab via the key prop on
  // the right pane wrapper.
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("info");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="border-border flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-lg border">
        {/* Three-panel layout */}
        <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_360px]">
          {/* Left: Session list */}
          <div className="border-border border-r">
            <div className="border-border border-b px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">
                Sessions ({sessions.length})
              </span>
            </div>
            <div className="h-[calc(100%-33px)]">
              <SessionList
                sessions={sessions}
                subscribedSession={subscribedSession}
                onSelect={(id) => {
                  subscribe(id);
                  setDetailsTab("info");
                }}
              />
            </div>
          </div>

          {/* Center: Event feed + whisper */}
          <div className="border-border flex flex-col border-r">
            <div className="border-border border-b px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">Event Feed</span>
            </div>
            <div className="min-h-0 flex-1">
              <EventFeed events={events} />
            </div>
            <WhisperInput sessionId={subscribedSession} onWhisper={whisper} />
          </div>

          {/* Right: Session details (info | replay) + admin actions launcher */}
          <div className="flex min-h-0 flex-col">
            <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-1.5">
              <div className="flex items-center gap-1">
                <TabButton
                  active={detailsTab === "info"}
                  onClick={() => setDetailsTab("info")}
                  icon={<Info className="h-3 w-3" />}
                  label="Info"
                />
                <TabButton
                  active={detailsTab === "replay"}
                  onClick={() => setDetailsTab("replay")}
                  icon={<History className="h-3 w-3" />}
                  label="Replay"
                  disabled={!subscribedSession}
                />
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                disabled={!subscribedSession}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/60 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Open admin actions drawer"
              >
                <Sliders className="h-3 w-3" />
                Actions
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden" key={subscribedSession ?? "none"}>
              {detailsTab === "info" ? (
                <SessionDetails session={selectedSession} events={events} />
              ) : subscribedSession ? (
                <div className="h-full overflow-y-auto p-3">
                  <TurnTimeline sessionId={subscribedSession} />
                </div>
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-sm">
                  Select a session
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Actions Drawer — rendered at monitor root so the backdrop covers the full panel */}
      {subscribedSession ? (
        <AdminActionDrawer
          sessionId={subscribedSession}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}
    </>
  );
}

type TabButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
};

function TabButton({ active, onClick, icon, label, disabled }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
