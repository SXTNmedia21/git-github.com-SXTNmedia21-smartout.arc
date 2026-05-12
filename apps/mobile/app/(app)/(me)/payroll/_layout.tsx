/**
 * Payroll group stack layout with error boundary.
 * Catches crashes from missing data/offline and shows fallback UI.
 */
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean };

class PayrollErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <PayrollFallback onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

function PayrollFallback({ onRetry }: { onRetry: () => void }) {
  const styles = useFallbackStyles();
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          router.back();
        }}
        style={styles.backButton}
        hitSlop={12}
      >
        <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
      </Pressable>
      <Text style={styles.title}>Ingen data tilgjengelig</Text>
      <Text style={styles.subtitle}>
        Lønnsdata er ikke tilgjengelig akkurat nå. Prøv igjen senere.
      </Text>
      <Pressable onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Prøv igjen</Text>
      </Pressable>
    </View>
  );
}

const useFallbackStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: theme.spacing.page,
    gap: theme.spacing.element,
  },
  backButton: {
    position: "absolute" as const,
    top: 60,
    left: theme.spacing.section,
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  title: {
    fontSize: 22,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center" as const,
    maxWidth: "80%" as unknown as number,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    marginTop: theme.spacing.element,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
}));

export default function PayrollLayout() {
  const _theme = useTheme();
  return (
    <PayrollErrorBoundary>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="payslip" />
        <Stack.Screen name="timebank" />
        <Stack.Screen name="absence-balance" />
        <Stack.Screen name="absence-request" />
        <Stack.Screen name="payroll-supplements" />
        <Stack.Screen name="payslip-detail" />
        <Stack.Screen name="lonnsgrunnlag-detail" />
      </Stack>
    </PayrollErrorBoundary>
  );
}
