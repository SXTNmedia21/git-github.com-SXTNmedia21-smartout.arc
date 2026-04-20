/**
 * Root layout — wraps the entire app with providers and handles auth-based routing.
 * QueryProvider must be outermost (AuthProvider uses router which needs React context).
 * registerGlobals() must be called before any LiveKit component usage.
 */
import "react-native-reanimated";
import "react-native-gesture-handler";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

// Some browser extensions (React DevTools, Grammarly, etc.) monkey-patch
// History.pushState and dispatch a custom event on a captured DOM ref that
// can be null, which throws on every expo-router transition. The error is
// cosmetic — navigation still works — but it spams the console in dev.
// Wrap pushState/replaceState in a try/catch so the wrappers can't poison
// expo-router's memory history.
if (Platform.OS === "web" && typeof window !== "undefined" && window.history) {
  const origPush = window.history.pushState.bind(window.history);
  const origReplace = window.history.replaceState.bind(window.history);
  window.history.pushState = function (...args: Parameters<typeof origPush>) {
    try {
      return origPush(...args);
    } catch {}
  };
  window.history.replaceState = function (...args: Parameters<typeof origReplace>) {
    try {
      return origReplace(...args);
    } catch {}
  };
}

// LiveKit native WebRTC globals — only available on iOS/Android
if (Platform.OS !== "web") {
  const { registerGlobals } = require("@livekit/react-native");
  registerGlobals();
}
import { Stack } from "expo-router";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <AuthProvider>
          <BottomSheetModalProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </BottomSheetModalProvider>
        </AuthProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
