/**
 * Catch-all for unmatched routes. Shows a simple "not found" message.
 */
import { View, Text, StyleSheet } from "react-native";
import { Link } from "expo-router";

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Siden finnes ikke</Text>
      <Link href="/" style={styles.link}>
        Gå til forsiden
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  link: {
    fontSize: 16,
    color: "#F97316",
  },
});
