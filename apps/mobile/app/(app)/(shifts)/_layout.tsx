/**
 * Shifts tab stack layout.
 * Index: no header. Detail: native header with back button.
 */
import { Stack } from "expo-router";
import { useTheme } from "@/theme";

export default function ShiftsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="roster" options={{ headerShown: false }} />
    </Stack>
  );
}
