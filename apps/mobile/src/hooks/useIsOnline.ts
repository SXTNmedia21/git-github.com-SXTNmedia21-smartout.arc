/**
 * useIsOnline — Subscribe to NetInfo reachability so the shift timeline
 * can freeze its orb and disable deviation actions when the device is
 * offline. We treat `null` (unknown) as online to avoid a flash of
 * frozen UI on startup; NetInfo resolves quickly enough that the first
 * real update arrives before the user can interact.
 */

import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    NetInfo.fetch().then((state) => {
      if (!cancelled) setIsOnline(resolveIsOnline(state));
    });
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(resolveIsOnline(state));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return isOnline;
}

function resolveIsOnline(state: NetInfoState): boolean {
  // Prefer internet-reachability when available. Fall back to connected
  // flag — some Android stacks never set reachability.
  if (state.isInternetReachable === false) return false;
  if (state.isConnected === false) return false;
  return true;
}
