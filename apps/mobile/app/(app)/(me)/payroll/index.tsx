/**
 * Payroll hub — entry to Min lønn, fravær, timebank, tillegg (Mobile Payroll UI spec).
 */

import React, { useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft, ChevronRight, Wallet, Plane, Clock, Sparkles } from "lucide-react-native";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";
import { Card } from "@/components/ui/Card";

type RowProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon: React.ReactNode;
};

function HubRow({ title, subtitle, onPress, icon }: RowProps) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={20} color={styles.chevronColor.color} strokeWidth={2} />
    </Pressable>
  );
}

export default function PayrollHubScreen() {
  const styles = useStyles();
  const router = useRouter();

  const goBack = useCallback(() => {
    Haptics.selectionAsync();
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button">
          <ChevronLeft size={28} color={styles.iconColor.color} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>{strings.payroll.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{strings.payroll.hubIntro}</Text>

        <Card style={styles.card}>
          <HubRow
            title={strings.payroll.myPay}
            icon={<Wallet size={22} color={styles.brandColor.color} strokeWidth={2} />}
            onPress={() => router.push("/(app)/(me)/payslip")}
          />
          <View style={styles.separator} />
          <HubRow
            title={strings.payroll.absenceBalance}
            subtitle={strings.payroll.vacation}
            icon={<Plane size={22} color={styles.brandColor.color} strokeWidth={2} />}
            onPress={() => router.push("/(app)/(me)/absence-balance")}
          />
          <View style={styles.separator} />
          <HubRow
            title={strings.payroll.timebank}
            icon={<Clock size={22} color={styles.brandColor.color} strokeWidth={2} />}
            onPress={() => router.push("/(app)/(me)/timebank")}
          />
          <View style={styles.separator} />
          <HubRow
            title={strings.payroll.supplements}
            subtitle={strings.payroll.todaysSupplements}
            icon={<Sparkles size={22} color={styles.brandColor.color} strokeWidth={2} />}
            onPress={() => router.push("/(app)/(me)/payroll/supplements")}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
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
  chevronColor: {
    color: theme.colors.mutedForeground,
  },
  brandColor: {
    color: theme.colors.brandOrange,
  },
  intro: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.section,
  },
  scroll: {
    paddingBottom: theme.spacing.xl,
  },
  card: {
    marginHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.xs,
    gap: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.element,
    gap: theme.spacing.element,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  rowSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 56,
  },
}));
