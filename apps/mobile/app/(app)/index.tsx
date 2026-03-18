/**
 * App home — placeholder for the shift-phase-based home screen.
 * Full implementation in Phase 6.
 */
import { View, Text, StyleSheet } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hjem</Text>
      <Text style={styles.subtitle}>Ingen aktiv vakt</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 4,
  },
});
