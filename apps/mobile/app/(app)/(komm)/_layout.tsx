import { Stack } from "expo-router";

/**
 * Komm stack — unified inbox (helpdesk queue + channels) + ticket detail.
 *
 * Replaces the former (queue) stack per Phase 1A.2 (Spec §Mobile,
 * ADR-0165). Headers are screen-owned.
 */
export default function KommStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
