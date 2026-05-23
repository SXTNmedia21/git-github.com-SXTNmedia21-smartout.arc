/**
 * usePushToken — React hook that registers the device for Expo push notifications
 * and syncs the resulting token to `profile.expo_push_token`.
 *
 * Delegates the heavy lifting to `registerPushToken` in `lib/push` (permission
 * request, Expo token fetch, Supabase upsert). The hook wraps that imperative
 * call with reactive state so callers can render based on registration status.
 *
 * Permission denial is surfaced as `{ status: "denied", token: null }` — the
 * promise never rejects for user choices, only for unexpected failures.
 *
 * @param profileId - The active profile ID in the current workspace. When null
 *   the hook stays idle (useful while auth/profile is still loading).
 */
import { useEffect, useState } from "react";
import {
  registerPushToken,
  type PushRegistrationResult,
  type PushRegistrationStatus,
} from "@/lib/push";
import { loginOneSignal } from "@/lib/onesignal";

type UsePushTokenState = {
  token: string | null;
  status: PushRegistrationStatus | "idle" | "registering";
  error: Error | null;
};

const INITIAL_STATE: UsePushTokenState = {
  token: null,
  status: "idle",
  error: null,
};

export function usePushToken(profileId: string | null | undefined): UsePushTokenState {
  const [state, setState] = useState<UsePushTokenState>(INITIAL_STATE);

  useEffect(() => {
    if (!profileId) {
      setState(INITIAL_STATE);
      return;
    }

    // Guard against setState after unmount when the async call resolves late
    let cancelled = false;
    setState({ token: null, status: "registering", error: null });

    registerPushToken(profileId)
      .then((result: PushRegistrationResult) => {
        if (cancelled) return;
        setState({ token: result.token, status: result.status, error: result.error });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          token: null,
          status: "error",
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
    void loginOneSignal(profileId);

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return state;
}
