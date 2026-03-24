/**
 * Root layout — wraps the entire app with providers and handles auth-based routing.
 * QueryProvider must be outermost (AuthProvider uses router which needs React context).
 * registerGlobals() must be called before any LiveKit component usage.
 */
import "react-native-reanimated";
import "react-native-gesture-handler";
import { registerGlobals } from "@livekit/react-native";

registerGlobals();
import { Stack } from "expo-router";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryProvider>
  );
}
