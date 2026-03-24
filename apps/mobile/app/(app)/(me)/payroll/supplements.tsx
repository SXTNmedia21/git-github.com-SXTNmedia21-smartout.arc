/**
 * Route: supplement rates / badges detail (Mobile Payroll UI).
 */

import React, { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";
import { SupplementsDetailScreen } from "@/components/payroll/SupplementsDetailScreen";

export default function SupplementsRoute() {
  const styles = useStyles();
  const router = useRouter();

  const goBack = useCallback(() => {
    Haptics.selectionAsync();
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button">
          <ChevronLeft size={28} color={styles.iconColor.color} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>{strings.payroll.supplements}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <SupplementsDetailScreen />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  wrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.tight,
    gap: theme.spacing.tight,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    flex: 1,
  },
  headerSpacer: {
    width: 44,
  },
  iconColor: {
    color: theme.colors.foreground,
  },
}));
