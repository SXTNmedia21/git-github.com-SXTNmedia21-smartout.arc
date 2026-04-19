"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CallRoom } from "@/app/dashboard/komm/_components/CallRoom";
import { useWorkspaceCallAlerts } from "@/app/dashboard/komm/_hooks/use-workspace-call-alerts";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { endCall } from "@smartout/walkie-talkie";

/**
 * Fire a best-effort end-call request that survives page unload. Plain fetch
 * gets cancelled when the tab closes; keepalive keeps it alive long enough
 * to reach the edge function. Used by the pagehide handler below.
 */
async function endCallKeepalive(channelId: string, workspaceId: string, accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return;
  try {
    await fetch(`${supabaseUrl}/functions/v1/call-command`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ action: "end", channelId, workspaceId }),
    });
  } catch {
    // Fire-and-forget — the browser is unloading, nothing we can do
  }
}

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
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  // pagehide handler reads these refs synchronously — accessing the
  // JWT via an await inside the handler races the browser's unload.
  const activeCallRef = useRef<ActiveCallInfo | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Keep a fresh JWT in the ref so pagehide can fire a keepalive request
  // without an async session lookup during unload.
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) accessTokenRef.current = session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Close the call session when the tab hides or unloads — without this,
  // tab-close leaves the session "active" forever (dev has no webhook to
  // rescue it; prod gets it via room_finished eventually, but beacons
  // tighten that window from minutes to zero).
  useEffect(() => {
    const handleExit = () => {
      const call = activeCallRef.current;
      const token = accessTokenRef.current;
      if (!call || !workspaceId || !token) return;
      void endCallKeepalive(call.channelId, workspaceId, token);
    };
    window.addEventListener("pagehide", handleExit);
    return () => window.removeEventListener("pagehide", handleExit);
  }, [workspaceId]);

  const joinCall = useCallback((info: ActiveCallInfo) => {
    setActiveCall(info);
  }, []);

  const leaveCall = useCallback(() => {
    const leaving = activeCall;
    setActiveCall(null);
    // Fire-and-forget so leave feels instant. Primary cleanup path in dev
    // (no LiveKit webhook reaches localhost); redundant safety in prod.
    if (leaving && workspaceId) {
      const supabase = createClient();
      void endCall(supabase, {
        channelId: leaving.channelId,
        workspaceId,
      });
    }
  }, [activeCall, workspaceId]);

  const value = useMemo<ActiveCallContextValue>(
    () => ({ activeCall, joinCall, leaveCall }),
    [activeCall, joinCall, leaveCall],
  );

  return (
    <ActiveCallContext.Provider value={value}>
      {profileId && <WorkspaceCallWatcher profileId={profileId} />}
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

/**
 * Renders nothing — just subscribes to workspace-wide call inserts and fires
 * the toast + browser notification from the shell so alerts reach the user
 * on any dashboard route.
 */
function WorkspaceCallWatcher({ profileId }: { profileId: string }) {
  useWorkspaceCallAlerts(profileId);
  return null;
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
