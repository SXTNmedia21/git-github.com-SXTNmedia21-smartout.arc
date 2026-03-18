/**
 * Chat list — placeholder for Phase 8.
 */
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";

export default function ChatScreen() {
  const styles = useStyles();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>{strings.tabs.chat}</Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Chat kommer i Phase 8.</Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.element,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
}));
