/**
 * Chat group layout — stack navigator for channel list and conversation screens.
 * Index: no header. Conversation detail: native back button.
 */
import { Stack } from "expo-router";
import { useTheme } from "@/theme";

export default function ChatLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: "Samtale" }} />
    </Stack>
  );
}
