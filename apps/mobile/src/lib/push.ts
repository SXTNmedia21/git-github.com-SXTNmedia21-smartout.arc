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
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { router } from "expo-router";
import { supabase } from "./supabase";

/**
 * Deep link mapping — maps push event types to Expo Router paths.
 * Each event includes the screen the user should land on when tapping.
 */
const DEEP_LINK_MAP: Record<string, (data: Record<string, string>) => string> = {
  shift_published: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_updated: (data) => `/(app)/(shifts)/${data.shift_id}`,
  task_assigned: () => "/(app)/(home)",
  chat_message: (data) => `/(app)/(chat)/${data.conversation_id}`,
  deviation_reported: () => "/(app)/(home)",
  join_request: () => "/(app)/(home)",
};

/**
 * Configure how notifications appear when the app is in the foreground.
 * Shows alert + sound + badge so the user sees in-app banners.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
export async function registerPushToken(profileId: string): Promise<void> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device, skipping registration");
    return;
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
    return;
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
      .eq("id", profileId)
      .single();

    // Only update if the token has changed
    if (profile?.expo_push_token !== token) {
      const { error } = await supabase
        .from("profile")
        .update({ expo_push_token: token })
        .eq("id", profileId);

      if (error) {
        console.error("Failed to update push token:", error.message);
      } else {
        console.log("Push token updated for profile", profileId);
      }
    }
  } catch (error) {
    console.error("Failed to register push token:", error);
  }
}

/**
 * Clear the push token from the profile on logout.
 * Prevents stale tokens from receiving notifications after sign-out.
 */
export async function unregisterPushToken(profileId: string): Promise<void> {
  try {
    await supabase.from("profile").update({ expo_push_token: null }).eq("id", profileId);
  } catch (error) {
    console.error("Failed to clear push token:", error);
  }
}

/**
 * Set up listeners for incoming notifications and notification taps.
 * Returns a cleanup function to remove listeners on unmount.
 *
 * - Foreground: handled by setNotificationHandler above (shows in-app banner)
 * - Tap/response: extracts deep link data and navigates to the correct screen
 */
export function setupNotificationListeners(): () => void {
  // Handle notification taps — navigate to the relevant screen
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, string> | undefined;
    if (!data?.event) return;

    const getPath = DEEP_LINK_MAP[data.event];
    if (getPath) {
      const path = getPath(data);
      // Small delay to ensure the app is fully mounted before navigating
      setTimeout(() => {
        router.push(path as never);
      }, 100);
    }
  });

  // Handle notifications received while app is in foreground (logging only,
  // the actual display is handled by setNotificationHandler above)
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as Record<string, string> | undefined;
    console.log("Notification received in foreground:", data?.event ?? "unknown");
  });

  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}
