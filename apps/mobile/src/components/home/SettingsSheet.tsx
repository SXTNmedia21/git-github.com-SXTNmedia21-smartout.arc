/**
 * SettingsSheet — Bottom sheet for quick settings and workspace info.
 *
 * Triggered by the hamburger menu icon in HomeHeader. Shows workspace
 * name, quick links to settings, and app version info.
 */

import React, { forwardRef, useMemo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import {
  Settings,
  User,
  Camera,
  Moon,
  HelpCircle,
  LogOut,
  Building2,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { createStyles } from "@/theme";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import type { LucideIcon } from "lucide-react-native";

type MenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  action: "edit-profile" | "navigate-profile" | "theme" | "help" | "logout";
};

const MENU_ITEMS: MenuItem[] = [
  { key: "edit", label: "Rediger profil", icon: Camera, color: "#e85c0d", action: "edit-profile" },
  { key: "profile", label: "Min profil", icon: User, color: "#3b82f6", action: "navigate-profile" },
  { key: "theme", label: "Utseende", icon: Moon, color: "#8b5cf6", action: "theme" },
  { key: "help", label: "Hjelp og support", icon: HelpCircle, color: "#06b6d4", action: "help" },
  { key: "logout", label: "Logg ut", icon: LogOut, color: "#ef4444", action: "logout" },
];

export const SettingsSheet = forwardRef<GorhomBottomSheet>(function SettingsSheet(_props, ref) {
  const styles = useStyles();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const snapPoints = useMemo(() => ["45%"], []);

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      Haptics.selectionAsync();
      if (ref && "current" in ref && ref.current) {
        ref.current.close();
      }

      switch (item.action) {
        case "edit-profile":
          router.push("/(app)/(me)/edit-profile");
          break;
        case "navigate-profile":
          router.push("/(app)/(me)");
          break;
        case "logout":
          router.push("/(app)/(me)");
          break;
        default:
          break;
      }
    },
    [router, ref],
  );

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

      {/* Menu items */}
      {MENU_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Pressable
            key={item.key}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
            onPress={() => handleMenuPress(item)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + "12" }]}>
              <Icon size={18} color={item.color} strokeWidth={2} />
            </View>
            <Text style={[styles.menuLabel, item.key === "logout" && styles.menuLabelDanger]}>
              {item.label}
            </Text>
            <ChevronRight size={16} color={styles.chevronColor.color} strokeWidth={2} />
          </Pressable>
        );
      })}

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
    backgroundColor: theme.isDark ? "rgba(232,92,13,0.1)" : "rgba(232,92,13,0.08)",
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
