/**
 * Me tab stack layout.
 * Index screen: no header (manages its own SafeAreaView).
 * Sub-screens: native header with back button for navigation.
 */
import { Stack } from "expo-router";
import { useTheme } from "@/theme";

export default function MeLayout() {
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
      <Stack.Screen name="notifications" options={{ headerShown: false, title: "Varsler" }} />
    </Stack>
  );
}
