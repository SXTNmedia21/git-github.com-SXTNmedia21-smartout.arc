/**
 * Home tab stack layout.
 * Index: no header (manages its own SafeAreaView + HomeHeader).
 * Sub-screens: native header with back button.
 */
import { Stack } from "expo-router";
import { useTheme } from "@/theme";

export default function HomeLayout() {
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
      <Stack.Screen name="punch-clock" options={{ headerShown: true, title: "Stempling" }} />
      <Stack.Screen name="deviation" options={{ headerShown: true, title: "Rapporter avvik" }} />
      <Stack.Screen name="haccp" options={{ headerShown: true, title: "HACCP-kontroll" }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: "Rediger profil" }} />
      <Stack.Screen
        name="spokesperson-approval"
        options={{ headerShown: true, title: "Godkjenning" }}
      />
      <Stack.Screen name="team" options={{ headerShown: true, title: "Team" }} />
    </Stack>
  );
}
