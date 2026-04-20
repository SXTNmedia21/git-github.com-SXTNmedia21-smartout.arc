/**
 * SettingsSheet — Bottom sheet for quick settings and workspace info.
 *
 * Triggered by the hamburger menu icon in HomeHeader. Shows workspace
 * name, quick links to settings, and payroll/absence navigation.
 */

import React, { forwardRef, useMemo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import {
  User,
  Camera,
  Moon,
  HelpCircle,
  LogOut,
  Building2,
  ChevronRight,
  CalendarCheck,
  PieChart,
  Clock,
  Wallet,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { supabase } from "@/lib/supabase";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useThemeStore } from "@/hooks/stores/use-theme-store";
import type { LucideIcon } from "lucide-react-native";

type MenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  colorKey: keyof ReturnType<typeof useTheme>["colors"];
  action:
    | "edit-profile"
    | "navigate-profile"
    | "theme"
    | "help"
    | "logout"
    | "navigate-absence"
    | "navigate-absence-balance"
    | "navigate-timebank"
    | "navigate-pay";
};

const MENU_ITEMS: MenuItem[] = [
  {
    key: "edit",
    label: "Rediger profil",
    icon: Camera,
    colorKey: "brandOrange",
    action: "edit-profile",
  },
  { key: "profile", label: "Min profil", icon: User, colorKey: "info", action: "navigate-profile" },
  { key: "theme", label: "Utseende", icon: Moon, colorKey: "brandPurple", action: "theme" },
  {
    key: "help",
    label: "Hjelp og support",
    icon: HelpCircle,
    colorKey: "brandCyan",
    action: "help",
  },
  {
    key: "absence",
    label: "Fravær",
    icon: CalendarCheck,
    colorKey: "success",
    action: "navigate-absence",
  },
  {
    key: "absence-balance",
    label: "Fraværssaldo",
    icon: PieChart,
    colorKey: "success",
    action: "navigate-absence-balance",
  },
  {
    key: "timebank",
    label: "Timebank",
    icon: Clock,
    colorKey: "info",
    action: "navigate-timebank",
  },
  { key: "pay", label: "Min lønn", icon: Wallet, colorKey: "brandOrange", action: "navigate-pay" },
  { key: "logout", label: "Logg ut", icon: LogOut, colorKey: "destructive", action: "logout" },
];

// Keys for the "Lønn & fravær" section — used to split the menu list into groups
const PAYROLL_KEYS = ["absence", "absence-balance", "timebank", "pay"];

// Extracted to avoid repeating the Pressable/icon/label/chevron pattern for each item
type MenuRowProps = {
  item: MenuItem;
  onPress: (item: MenuItem) => void;
  styles: ReturnType<typeof useStyles>;
};

function MenuRow({ item, onPress, styles }: MenuRowProps) {
  const Icon = item.icon;
  const theme = useTheme();
  const color = theme.colors[item.colorKey];
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={[styles.menuIcon, { backgroundColor: color + "12" }]}>
        <Icon size={18} color={color} strokeWidth={2} />
      </View>
      <Text style={[styles.menuLabel, item.key === "logout" && styles.menuLabelDanger]}>
        {item.label}
      </Text>
      <ChevronRight size={16} color={styles.chevronColor.color} strokeWidth={2} />
    </Pressable>
  );
}

export const SettingsSheet = forwardRef<GorhomBottomSheet>(function SettingsSheet(_props, ref) {
  const styles = useStyles();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { theme, setTheme } = useThemeStore();
  const snapPoints = useMemo(() => ["70%"], []);

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      Haptics.selectionAsync();
      if (ref && "current" in ref && ref.current) {
        ref.current.close();
      }

      // Small delay to let the sheet close animation start before navigating
      const navigate = () => {
        switch (item.action) {
          case "theme":
            setTheme(theme === "dark" ? "light" : "dark");
            break;
          case "edit-profile":
            router.push("/(app)/(home)/edit-profile");
            break;
          case "navigate-profile":
            router.push("/(app)/(me)");
            break;
          case "navigate-absence":
            router.push("/(app)/(me)/payroll/absence-request");
            break;
          case "navigate-absence-balance":
            router.push("/(app)/(me)/payroll/absence-balance");
            break;
          case "navigate-timebank":
            router.push("/(app)/(me)/payroll/timebank");
            break;
          case "navigate-pay":
            router.push("/(app)/(me)/payroll/payslip");
            break;
          case "logout":
            supabase.auth.signOut();
            break;
          default:
            break;
        }
      };

      setTimeout(navigate, 200);
    },
    [router, ref],
  );

  const generalItems = MENU_ITEMS.filter(
    (item) => !PAYROLL_KEYS.includes(item.key) && item.key !== "logout",
  );
  const payrollItems = MENU_ITEMS.filter((item) => PAYROLL_KEYS.includes(item.key));
  const logoutItem = MENU_ITEMS.find((item) => item.key === "logout");

  return (
    <BottomSheet ref={ref} index={-1} snapPoints={snapPoints}>
      {/* Workspace info */}
      <View style={styles.workspaceRow}>
        <View style={styles.workspaceIcon}>
          <Building2 size={20} color={styles.brandColor.color} strokeWidth={2} />
        </View>
        <View style={styles.workspaceInfo}>
          <Text style={styles.workspaceName}>STRØM MAT & BAR AS</Text>
          <Text style={styles.workspaceRole}>{profile?.role ?? "Ansatt"}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* General settings items */}
      {generalItems.map((item) => (
        <MenuRow key={item.key} item={item} onPress={handleMenuPress} styles={styles} />
      ))}

      {/* Lønn & fravær section */}
      <Text style={styles.sectionHeader}>LØNN & FRAVÆR</Text>
      {payrollItems.map((item) => (
        <MenuRow key={item.key} item={item} onPress={handleMenuPress} styles={styles} />
      ))}

      {/* Divider before logout */}
      <View style={[styles.divider, styles.dividerTop]} />

      {/* Logout */}
      {logoutItem && <MenuRow item={logoutItem} onPress={handleMenuPress} styles={styles} />}

      {/* App version */}
      <Text style={styles.version}>Smartout v1.0.0</Text>
    </BottomSheet>
  );
});

const useStyles = createStyles((theme) => ({
  workspaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingBottom: theme.spacing.md,
  },
  workspaceIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(theme.colors.brandOrange, theme.isDark ? 0.15 : 0.08),
  },
  brandColor: {
    color: theme.colors.brandOrange,
  },
  workspaceInfo: {
    flex: 1,
    gap: 2,
  },
  workspaceName: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  workspaceRole: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.element,
  },
  dividerTop: {
    marginTop: theme.spacing.element,
  },
  sectionHeader: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginTop: theme.spacing.element,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    borderRadius: theme.radius.md,
  },
  pressed: {
    opacity: 0.7,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    flex: 1,
  },
  menuLabelDanger: {
    color: theme.colors.destructive,
  },
  chevronColor: {
    color: theme.colors.mutedForeground,
  },
  version: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginTop: theme.spacing.section,
  },
}));
