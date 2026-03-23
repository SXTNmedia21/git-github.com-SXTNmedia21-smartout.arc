/**
 * Auth group layout — unauthenticated screens (welcome, verify, workspace-select).
 * No tab bar, no bottom navigation. Simple stack.
 */
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
