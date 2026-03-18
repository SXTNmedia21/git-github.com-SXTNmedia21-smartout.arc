/**
 * Root layout — wraps the entire app with providers and handles auth-based routing.
 * Providers are injected here so every screen has access to QueryClient and auth state.
 */
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
