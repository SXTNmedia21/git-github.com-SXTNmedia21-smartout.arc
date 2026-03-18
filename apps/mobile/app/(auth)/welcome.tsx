/**
 * Welcome screen — entry point for unauthenticated users.
 * Three paths: invitation link, workspace code, or search.
 * Placeholder — full implementation in Phase 5.
 */
import { View, Text, StyleSheet } from "react-native";

export default function Welcome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Velkommen til Smartout</Text>
      <Text style={styles.subtitle}>Logg inn for å komme i gang</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
  },
});
