/**
 * Me tab stack layout.
 * Single screen (index) with no header — the screen manages its own SafeAreaView.
 */
import { Stack } from "expo-router";

export default function MeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
