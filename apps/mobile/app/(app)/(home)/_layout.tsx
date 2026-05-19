/**
 * Home tab stack layout.
 * All screens manage their own headers (ActionHeader or custom).
 */
import { Stack } from "expo-router";

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="punch-clock" />
      <Stack.Screen name="deviation" />
      <Stack.Screen name="haccp" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="spokesperson-approval" />
      <Stack.Screen name="team" />
      <Stack.Screen name="training" />
      <Stack.Screen name="course-detail" />
      <Stack.Screen name="hms" />
      <Stack.Screen name="safety-round" />
      <Stack.Screen name="temp-deviation" />
      <Stack.Screen name="flow-player" />
      <Stack.Screen name="operations" />
      <Stack.Screen name="clockout" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="availability" />
    </Stack>
  );
}
