/**
 * Welcome screen — entry point for unauthenticated users.
 * Three auth paths: invitation link, workspace search, or direct login.
 * Always light mode — this is a branding screen.
 */
import { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InviteEntry } from "@/components/auth/InviteEntry";
import { WorkspaceSearch } from "@/components/auth/WorkspaceSearch";
import { lightColors, withOpacity, spacing, typography, radius, shadows } from "@/theme";

type AuthPath = "none" | "invite" | "search";

const t = lightColors;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.background,
    paddingHorizontal: spacing.section,
  },
  header: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
  logo: {
    width: 200,
    height: 68,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    textAlign: "center",
    color: t.foreground,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.subheadline,
    textAlign: "center",
    color: t.mutedForeground,
    marginTop: spacing.tight,
  },
  buttons: {
    paddingBottom: spacing.md,
    gap: spacing.element,
  },
  pathButton: {
    backgroundColor: t.secondary,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.card,
    ...shadows.sm,
  },
  pathButtonText: {
    ...typography.bodyBold,
    color: t.foreground,
  },
  pathButtonHint: {
    ...typography.caption,
    color: t.mutedForeground,
    marginTop: 2,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: t.border,
  },
  dividerText: {
    ...typography.caption,
    color: t.mutedForeground,
    paddingHorizontal: spacing.element,
  },
  loginButton: {
    backgroundColor: t.brandOrange,
    borderRadius: radius.xl,
    paddingVertical: 18,
    alignItems: "center",
    ...shadows.md,
    shadowColor: t.brandOrange,
  },
  loginButtonText: {
    ...typography.bodyBold,
    color: t.primaryForeground,
  },
  footer: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.tight,
  },
  footerText: {
    ...typography.caption,
    color: withOpacity(t.mutedForeground, 0.5),
  },
});

export default function Welcome() {
  const [activePath, setActivePath] = useState<AuthPath>("none");
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (activePath === "invite") {
    return <InviteEntry onBack={() => setActivePath("none")} />;
  }
  if (activePath === "search") {
    return <WorkspaceSearch onBack={() => setActivePath("none")} />;
  }

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]}
    >
      <View style={styles.header}>
        <Image
          source={require("../../assets/smartout-icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
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
          onPress={() => router.push({ pathname: "/(auth)/verify", params: { flow: "login" } })}
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
