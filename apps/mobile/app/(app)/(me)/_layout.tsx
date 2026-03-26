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
      <Stack.Screen name="notifications" options={{ headerShown: true, title: "Varsler" }} />
      <Stack.Screen name="payroll" options={{ headerShown: true, title: "Lonn" }} />
      <Stack.Screen name="payslip" options={{ headerShown: true, title: "Lonnsslipper" }} />
      <Stack.Screen name="timebank" options={{ headerShown: true, title: "Timebank" }} />
      <Stack.Screen name="absence-balance" options={{ headerShown: true, title: "Fravaer" }} />
      <Stack.Screen name="absence-request" options={{ headerShown: true, title: "Sok fravaer" }} />
      <Stack.Screen name="payroll-supplements" options={{ headerShown: true, title: "Tillegg" }} />
    </Stack>
  );
}
