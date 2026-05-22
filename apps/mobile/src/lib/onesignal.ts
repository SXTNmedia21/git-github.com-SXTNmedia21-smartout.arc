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
    await OneSignal.login(profileId);
    // Prompt for permission (no-op if already granted/denied)
    await OneSignal.Notifications.requestPermission();
  } catch (err) {
    console.warn("[onesignal] login failed:", err);
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
