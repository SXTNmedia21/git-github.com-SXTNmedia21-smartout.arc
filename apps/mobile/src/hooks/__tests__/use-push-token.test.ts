/**
 * Tests for the push token registration flow that backs `usePushToken`.
 *
 * `usePushToken` is a thin React wrapper that calls `registerPushToken` inside
 * a `useEffect` and mirrors the result into state. Because the hook adds no
 * business logic beyond that wiring, the observable behaviour — permission
 * handling, token fetch, Supabase sync — is tested directly against
 * `registerPushToken`. If that contract holds, the hook's `{token, status,
 * error}` output is a pure function of it.
 *
 * Three canonical paths are covered:
 *   1. Permission granted + new token → status: "granted", token persisted
 *   2. Permission denied              → status: "denied", token: null
 *   3. Token fetch throws             → status: "error", error populated
 */

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("expo-device", () => ({ isDevice: true }));

const notificationsMock = {
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  getBadgeCountAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
};
jest.mock("expo-notifications", () => notificationsMock);

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }), { virtual: true });

jest.mock("@smartout/telemetry", () => ({ emit: jest.fn() }), { virtual: true });

jest.mock("@smartout/notifications/deep-links", () => ({ resolveDeepLink: jest.fn(() => "/") }), {
  virtual: true,
});

// Minimal Supabase stub — the push module only uses select/update on the
// `profile` table with .eq filters, so we record calls and replay configured
// responses without pulling the real client.
const supabaseState: {
  selectResult: { data: { expo_push_token: string | null } | null };
  updateError: { message: string } | null;
  lastUpdate: Record<string, unknown> | null;
} = {
  selectResult: { data: { expo_push_token: null } },
  updateError: null,
  lastUpdate: null,
};

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(supabaseState.selectResult),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        supabaseState.lastUpdate = payload;
        return {
          eq: () => Promise.resolve({ error: supabaseState.updateError }),
        };
      },
    }),
  },
}));

// Silence expected console noise from error/denied paths
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

import { registerPushToken } from "@/lib/push";

beforeEach(() => {
  notificationsMock.getPermissionsAsync.mockReset();
  notificationsMock.requestPermissionsAsync.mockReset();
  notificationsMock.getExpoPushTokenAsync.mockReset();
  supabaseState.selectResult = { data: { expo_push_token: null } };
  supabaseState.updateError = null;
  supabaseState.lastUpdate = null;
});

describe("registerPushToken (usePushToken data source)", () => {
  it("returns granted + token and persists it when permission is granted", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    notificationsMock.getExpoPushTokenAsync.mockResolvedValue({
      data: "ExponentPushToken[abc123]",
    });

    const result = await registerPushToken("profile-1");

    expect(result).toEqual({
      token: "ExponentPushToken[abc123]",
      status: "granted",
      error: null,
    });
    expect(supabaseState.lastUpdate).toEqual({
      expo_push_token: "ExponentPushToken[abc123]",
    });
  });

  it("returns denied and does not write the token when permission is refused", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    notificationsMock.requestPermissionsAsync.mockResolvedValue({ status: "denied" });

    const result = await registerPushToken("profile-1");

    expect(result).toEqual({ token: null, status: "denied", error: null });
    expect(notificationsMock.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(supabaseState.lastUpdate).toBeNull();
  });

  it("returns error when the Expo token fetch throws", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    notificationsMock.getExpoPushTokenAsync.mockRejectedValue(new Error("network down"));

    const result = await registerPushToken("profile-1");

    expect(result.status).toBe("error");
    expect(result.token).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("network down");
  });
});
