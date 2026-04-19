"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CallRoom } from "@/app/dashboard/komm/_components/CallRoom";

type ActiveCallInfo = {
  channelId: string;
  channelName: string;
  serverUrl: string;
  token: string;
  audioPolicy: string;
  startWithVideo: boolean;
};

type ActiveCallContextValue = {
  activeCall: ActiveCallInfo | null;
  joinCall: (info: ActiveCallInfo) => void;
  leaveCall: () => void;
};

const ActiveCallContext = createContext<ActiveCallContextValue | null>(null);

/**
 * ActiveCallProvider — owns the live LiveKit call at the dashboard-shell
 * level so the floating overlay survives route changes. Komm page components
 * call `joinCall(...)` instead of keeping their own livekit state; the
 * provider renders `<CallRoom>` as a global overlay while the call is active.
 */
export function ActiveCallProvider({
  profileId,
  children,
}: {
  profileId: string | null;
  children: React.ReactNode;
}) {
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);

  const joinCall = useCallback((info: ActiveCallInfo) => {
    setActiveCall(info);
  }, []);

  const leaveCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  const value = useMemo<ActiveCallContextValue>(
    () => ({ activeCall, joinCall, leaveCall }),
    [activeCall, joinCall, leaveCall],
  );

  return (
    <ActiveCallContext.Provider value={value}>
      {children}
      {activeCall && profileId && (
        <CallRoom
          serverUrl={activeCall.serverUrl}
          token={activeCall.token}
          channelId={activeCall.channelId}
          channelName={activeCall.channelName}
          profileId={profileId}
          audioPolicy={activeCall.audioPolicy}
          onDisconnect={leaveCall}
          startWithVideo={activeCall.startWithVideo}
        />
      )}
    </ActiveCallContext.Provider>
  );
}

export function useActiveCall() {
  const ctx = useContext(ActiveCallContext);
  if (!ctx) {
    throw new Error("useActiveCall must be used within ActiveCallProvider");
  }
  return ctx;
}

/**
 * Optional variant — returns null when outside the provider. Use for callers
 * that may render on routes without a dashboard shell.
 */
export function useActiveCallOptional() {
  return useContext(ActiveCallContext);
}
