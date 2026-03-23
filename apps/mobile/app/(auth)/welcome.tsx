/**
 * Welcome screen — entry point for unauthenticated users.
 * Presents three auth paths: invitation link, workspace code, or workspace search.
 * Each path renders its own component inline; no navigation needed until verify.
 */
import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InviteEntry } from "@/components/auth/InviteEntry";
import { CodeEntry } from "@/components/auth/CodeEntry";
import { WorkspaceSearch } from "@/components/auth/WorkspaceSearch";

type AuthPath = "none" | "invite" | "code" | "search";

export default function Welcome() {
  const [activePath, setActivePath] = useState<AuthPath>("none");
  const insets = useSafeAreaInsets();

  // Render the selected auth flow component
  if (activePath === "invite") {
    return <InviteEntry onBack={() => setActivePath("none")} />;
  }

  if (activePath === "code") {
    return <CodeEntry onBack={() => setActivePath("none")} />;
  }

  if (activePath === "search") {
    return <WorkspaceSearch onBack={() => setActivePath("none")} />;
  }

  // Default: three-button welcome
  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Text style={styles.brandMark}>S</Text>
        <Text style={styles.title}>Velkommen til Smartout</Text>
        <Text style={styles.subtitle}>Kom i gang med arbeidsplassen din</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.pathButton} onPress={() => setActivePath("invite")}>
          <Text style={styles.pathButtonText}>Jeg har en invitasjon</Text>
          <Text style={styles.pathButtonHint}>Apne lenken du fikk fra din leder</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pathButton} onPress={() => setActivePath("code")}>
          <Text style={styles.pathButtonText}>Jeg har en kode</Text>
          <Text style={styles.pathButtonHint}>6-tegns kode fra din leder</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pathButton} onPress={() => setActivePath("search")}>
          <Text style={styles.pathButtonText}>Finn min arbeidsplass</Text>
          <Text style={styles.pathButtonHint}>Sok etter arbeidsplassen din</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  header: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  brandMark: {
    fontSize: 48,
    fontWeight: "800",
    color: "#F97316",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  buttons: {
    gap: 12,
    paddingBottom: 16,
  },
  pathButton: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 18,
  },
  pathButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  pathButtonHint: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
});
