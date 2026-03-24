/**
 * Catch-all for unmatched routes. Shows a simple "not found" message.
 */
import { View, Text } from "react-native";
import { Link } from "expo-router";
import { createStyles } from "@/theme";

export default function NotFound() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Siden finnes ikke</Text>
      <Link href="/" style={styles.link}>
        Gå til forsiden
      </Link>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600" as const,
    marginBottom: 12,
    color: theme.colors.foreground,
  },
  link: {
    fontSize: 16,
    color: theme.colors.brandOrange,
  },
}));
