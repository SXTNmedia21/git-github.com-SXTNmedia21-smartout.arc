/**
 * onesignal (client) — OneSignal Web SDK wiring for the Expo-web PWA (ADR-0389).
 *
 * Web-only: native builds must not bundle react-onesignal, so every entry point
 * guards on Platform.OS === "web" and dynamically imports the SDK. On native this
 * file is a no-op (push there will use the native OneSignal SDK in a later phase).
 */
import { Platform } from "react-native";

let initialised = false;

export async function initOneSignal(): Promise<void> {
  if (Platform.OS !== "web" || initialised) return;
  const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) {
    console.warn("[onesignal] EXPO_PUBLIC_ONESIGNAL_APP_ID missing — push disabled");
    return;
  }
  const OneSignal = (await import("react-onesignal")).default;
  await OneSignal.init({
    appId,
    serviceWorkerPath: "OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: "/" },
    allowLocalhostAsSecureOrigin: true,
  });
  initialised = true;
}

export async function loginOneSignal(profileId: string): Promise<void> {
  if (Platform.OS !== "web" || !profileId) return;
  // Ensure SDK is initialised before calling login — init is idempotent (initialised flag).
  await initOneSignal();
  try {
    const OneSignal = (await import("react-onesignal")).default;
    // Only identify the user — do NOT call requestPermission() here.
    // On iOS PWAs Apple suppresses non-gesture permission prompts; the user
    // must tap "Aktiver varsler" in NotificationScreen to trigger the real prompt.
    await OneSignal.login(profileId);
  } catch (err) {
    console.warn("[onesignal] login failed:", err);
  }
}

/**
 * Request web-push permission from a user gesture (tap).
 * Must be called from a direct event handler — browsers and iOS PWAs block
 * Notification.requestPermission() unless the call stack originates from a
 * user gesture (click/touchend).
 *
 * Returns true if permission was granted, false otherwise (including native).
 */
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    await initOneSignal();
    const OneSignal = (await import("react-onesignal")).default;
    // requestPermission() → Promise<boolean>: true = granted (from .d.ts)
    const granted = await OneSignal.Notifications.requestPermission();
    return granted;
  } catch (err) {
    console.warn("[onesignal] requestPushPermission failed:", err);
    return false;
  }
}

/**
 * Returns whether the user has already granted push-notification permission.
 * Synchronous permission property from OneSignal.Notifications.permission (boolean).
 * Always returns false on native (push handled by native SDK in a later phase).
 */
export async function isPushEnabled(): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    await initOneSignal();
    const OneSignal = (await import("react-onesignal")).default;
    // .permission is a synchronous boolean property on IOneSignalNotifications
    return OneSignal.Notifications.permission;
  } catch (err) {
    console.warn("[onesignal] isPushEnabled failed:", err);
    return false;
  }
}

export async function logoutOneSignal(): Promise<void> {
  if (Platform.OS !== "web") return;
  try {
    const OneSignal = (await import("react-onesignal")).default;
    await OneSignal.logout();
  } catch (err) {
    console.warn("[onesignal] logout failed:", err);
  }
}
