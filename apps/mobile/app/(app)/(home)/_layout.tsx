/**
 * Home tab stack layout.
 * Single screen for now — future deep links into shift detail, tasks, etc.
 */
import { Stack } from "expo-router";

export default function HomeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
