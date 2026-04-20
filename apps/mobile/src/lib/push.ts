/**
 * Push notification registration and handling.
 *
 * Responsibilities:
 * 1. Request notification permissions (iOS requires explicit consent)
 * 2. Get Expo push token and sync to profile.expo_push_token
 * 3. Handle foreground notifications (in-app banner)
 * 4. Handle notification taps (deep link to correct screen)
 *
 * Called from AuthProvider after successful authentication.
 */
import { Platform } from "react-native";
import { router } from "expo-router";
import { emit } from "@smartout/telemetry";
import { resolveDeepLink } from "@smartout/notifications/deep-links";
import { supabase } from "./supabase";

// expo-notifications is native-only — guard all usage on web
const isNative = Platform.OS !== "web";

// Lazy-load to avoid crash on web
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: typeof import("expo-notifications") | null = null;
if (isNative) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications") as typeof import("expo-notifications");
}

/**
 * Configure how notifications appear when the app is in the foreground.
 * Shows alert + sound + badge so the user sees in-app banners.
 */
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Outcome of a push token registration attempt.
 * - `granted`   : permission granted and token obtained
 * - `denied`    : user declined notification permission
 * - `unsupported`: web, simulator, or missing native module
 * - `error`     : unexpected failure (network, supabase, etc.)
 */
export type PushRegistrationStatus = "granted" | "denied" | "unsupported" | "error";

export type PushRegistrationResult = {
  token: string | null;
  status: PushRegistrationStatus;
  error: Error | null;
};

/**
 * Register for push notifications and sync the token to the user's profile.
 *
 * Flow:
 * 1. Check we're on a physical device (push doesn't work in simulator)
 * 2. Request permission if not already granted
 * 3. Get the Expo push token
 * 4. Compare with profile.expo_push_token — update only if changed
 *
 * @param profileId - The current user's profile ID in the active workspace
 */
export async function registerPushToken(profileId: string): Promise<PushRegistrationResult> {
  if (!Notifications) {
    return { token: null, status: "unsupported", error: null };
  }

  // Push notifications only work on physical devices
  // expo-device is checked dynamically to avoid hard dependency issues
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require("expo-device") as { isDevice: boolean };
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device, skipping registration");
      return { token: null, status: "unsupported", error: null };
    }
  } catch {
    // expo-device not available — skip device check and attempt registration
  }

  // Check current permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted (iOS requires explicit consent)
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return { token: null, status: "denied", error: null };
  }

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Standard",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF6B35",
    });
  }

  try {
    // Get the Expo push token (requires projectId for EAS builds)
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    const token = tokenData.data;

    // Fetch current token from profile to avoid unnecessary writes
    const { data: profile } = await supabase
      .from("profile")
      .select("expo_push_token")
      .eq("profile_id", profileId)
      .single();

    // Only update if the token has changed
    if (profile?.expo_push_token !== token) {
      const { error } = await supabase
        .from("profile")
        .update({ expo_push_token: token })
        .eq("profile_id", profileId);

      if (error) {
        console.error("Failed to update push token:", error.message);
        return { token, status: "error", error: new Error(error.message) };
      }
      console.log("Push token updated successfully");
    }

    return { token, status: "granted", error: null };
  } catch (error) {
    console.error("Failed to register push token:", error);
    return {
      token: null,
      status: "error",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Clear the push token from the profile on logout.
 * Prevents stale tokens from receiving notifications after sign-out.
 */
export async function unregisterPushToken(profileId: string): Promise<void> {
  try {
    await supabase.from("profile").update({ expo_push_token: null }).eq("profile_id", profileId);
  } catch (error) {
    console.error("Failed to clear push token:", error);
  }
}

/**
 * Mark a notification as read in the database when the user taps the push banner.
 * Best-effort — failures are logged but do not block navigation.
 *
 * The notification_id is included in the push payload by the outbox consumer
 * Edge Function so we can close the loop without a round-trip query.
 */
async function markNotificationReadFromPush(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("notification")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId);
    if (error) {
      console.warn("Failed to mark push notification as read:", error.message);
    }
  } catch (err) {
    console.warn("Error marking push notification as read:", err);
  }
}

/**
 * Navigate to the correct screen based on push notification data.
 * Also marks the notification as read if notification_id is in the payload.
 * Emits telemetry when a deep link is followed.
 * Shared between tap handler and cold-start handler.
 *
 * For unmapped event types, falls back to the notification center screen
 * so users always land somewhere meaningful rather than the app root.
 */
function navigateFromNotificationData(data: Record<string, string> | undefined): void {
  if (!data) return;

  // Mark as read when the notification_id is present in the push payload
  if (data.notification_id) {
    void markNotificationReadFromPush(data.notification_id);
  }

  // Resolve the deep link path — fall back to notification center for unknown events
  if (!data.event) {
    const fallbackPath = "/(app)/(me)/notifications";
    // Emit telemetry for unknown notification type
    void emitDeepLinkFollowed("notification_tap", fallbackPath);
    setTimeout(() => {
      router.push(fallbackPath as never);
    }, 100);
    return;
  }

  const path = resolveDeepLink(data.event, data);
  // Emit telemetry for deep link follow
  void emitDeepLinkFollowed(data.event, path);
  // Small delay to ensure the app is fully mounted before navigating
  setTimeout(() => {
    router.push(path as never);
  }, 100);
}

/**
 * Emit telemetry when a deep link is followed from a push notification.
 * Best-effort — telemetry failures do not block navigation.
 */
async function emitDeepLinkFollowed(notificationType: string, targetRoute: string): Promise<void> {
  try {
    // Fetch current user context for telemetry
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // User not authenticated — skip telemetry
      return;
    }

    // Get workspace_id from current profile context
    // In the mobile app, the user has one active profile per device
    const { data: profile } = await supabase
      .from("profile")
      .select("profile_id, workspace_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!profile) {
      // Profile not found — skip telemetry
      return;
    }

    emit({
      event: "notification deep_link_followed",
      workspace_id: profile.workspace_id,
      actor_id: profile.profile_id,
      properties: {
        data: {
          notification_type: notificationType,
          target_route: targetRoute,
        },
      },
    });
  } catch (error) {
    // Non-critical — telemetry failures should not block the app flow
    console.warn("Failed to emit deep_link_followed telemetry:", error);
  }
}

/**
 * Set up listeners for incoming notifications and notification taps.
 * Returns a cleanup function to remove listeners on unmount.
 *
 * Handles three scenarios:
 * 1. Foreground: shows in-app banner (via setNotificationHandler above)
 * 2. Background tap: notification response listener navigates to screen
 * 3. Cold start: checks last notification response for app-killed-then-tapped
 */
export function setupNotificationListeners(): () => void {
  if (!Notifications) return () => {}; // Web — no push listeners

  // Handle notification taps while app is running (foreground or background)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, string> | undefined;
    navigateFromNotificationData(data);
  });

  // Handle notifications received while app is in foreground (logging only,
  // the actual display is handled by setNotificationHandler above)
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as Record<string, string> | undefined;
    console.log("Notification received in foreground:", data?.event ?? "unknown");
  });

  // Cold start: if the app was killed and opened via a notification tap,
  // the response listener above won't catch it. Check the last response.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      navigateFromNotificationData(data);
    }
  });

  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}

/**
 * Get the current badge count. Used by UI to show unread indicator.
 */
export async function getBadgeCount(): Promise<number> {
  if (!Notifications) return 0;
  return Notifications.getBadgeCountAsync();
}

/**
 * Clear the badge count (e.g., when user opens the app).
 */
export async function clearBadgeCount(): Promise<void> {
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(0);
}
