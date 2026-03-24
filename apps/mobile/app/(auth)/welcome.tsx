/**
 * Welcome screen — entry point for unauthenticated users.
 * Four auth paths: invitation link, workspace code, workspace search, or direct login.
 * Each path renders its own component inline; login navigates to verify directly.
 *
 * Uses Smartout design tokens via createStyles for theme-aware styling.
 * Typography follows the "Ren og Varm" design system: warm neutrals, brand orange accent.
 */
import { useState } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InviteEntry } from "@/components/auth/InviteEntry";
import { CodeEntry } from "@/components/auth/CodeEntry";
import { WorkspaceSearch } from "@/components/auth/WorkspaceSearch";
import { createStyles, withOpacity } from "@/theme";

type AuthPath = "none" | "invite" | "code" | "search";

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.section,
  },

  // Header area — centered branding
  header: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: theme.spacing.lg,
  },
  brandMark: {
    ...theme.typography.largeTitle,
    fontSize: 56,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.brandOrange,
    letterSpacing: -1,
  },
  title: {
    ...theme.typography.largeTitle,
    textAlign: "center",
    color: theme.colors.foreground,
    marginTop: theme.spacing.element,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...theme.typography.subheadline,
    textAlign: "center",
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.tight,
  },

  // Path buttons area
  buttons: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.element,
  },

  // Workspace path cards
  pathButton: {
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.card,
    ...theme.shadows.sm,
  },
  pathButtonText: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  pathButtonHint: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },

  // Divider
  divider: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginVertical: theme.spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    paddingHorizontal: theme.spacing.element,
  },

  // Primary CTA — brand orange login button
  loginButton: {
    backgroundColor: theme.colors.brandOrange,
    borderRadius: theme.radius.xl,
    paddingVertical: 18,
    alignItems: "center" as const,
    ...theme.shadows.md,
    shadowColor: theme.colors.brandOrange,
  },
  loginButtonText: {
    ...theme.typography.bodyBold,
    color: "#FFFFFF",
  },

  // Footer
  footer: {
    alignItems: "center" as const,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.tight,
  },
  footerText: {
    ...theme.typography.caption,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
}));

export default function Welcome() {
  const [activePath, setActivePath] = useState<AuthPath>("none");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useStyles();

  if (activePath === "invite") {
    return <InviteEntry onBack={() => setActivePath("none")} />;
  }
  if (activePath === "code") {
    return <CodeEntry onBack={() => setActivePath("none")} />;
  }
  if (activePath === "search") {
    return <WorkspaceSearch onBack={() => setActivePath("none")} />;
  }

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]}
    >
      <View style={styles.header}>
        <Text style={styles.brandMark}>S</Text>
        <Text style={styles.title}>Velkommen til Smartout</Text>
        <Text style={styles.subtitle}>Kom i gang med arbeidsplassen din</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.pathButton}
          activeOpacity={0.7}
          onPress={() => setActivePath("invite")}
        >
          <Text style={styles.pathButtonText}>Jeg har en invitasjon</Text>
          <Text style={styles.pathButtonHint}>Apne lenken du fikk fra din leder</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pathButton}
          activeOpacity={0.7}
          onPress={() => setActivePath("code")}
        >
          <Text style={styles.pathButtonText}>Jeg har en kode</Text>
          <Text style={styles.pathButtonHint}>6-tegns kode fra din leder</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pathButton}
          activeOpacity={0.7}
          onPress={() => setActivePath("search")}
        >
          <Text style={styles.pathButtonText}>Finn min arbeidsplass</Text>
          <Text style={styles.pathButtonHint}>Sok etter arbeidsplassen din</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>eller</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          activeOpacity={0.85}
          onPress={() => router.push("/(auth)/verify")}
        >
          <Text style={styles.loginButtonText}>Logg inn eller opprett konto</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>&copy; 2026 Smartout AS</Text>
      </View>
    </View>
  );
}
