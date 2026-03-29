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
