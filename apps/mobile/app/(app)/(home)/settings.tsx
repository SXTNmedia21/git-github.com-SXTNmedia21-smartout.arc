/**
 * Settings — Full settings page accessed via burger menu.
 *
 * Layout:
 * 1. Header — ← back | "Settings" (serif bold) | more
 * 2. Profile card — avatar + verified badge + name + role + ID
 * 3. Personlig — Profilinnstillinger, Kontaktinformasjon
 * 4. Workspace — Active workspace switcher, Språk
 * 5. Display Preferences — 2x2 bento toggles (Shifts, Tasks, Bookings, Holidays)
 * 6. System & Varsler — Notifications toggle, Dark mode toggle
 * 7. Hjelp & Support — Hjelpesenter, Personvern & Vilkår
 * 8. Logout + version
 */

import React, { useCallback, useState } from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  MoreVertical,
  User,
  Mail,
  ChevronRight,
  Layers,
  Globe,
  Calendar,
  CheckSquare,
  BookOpen,
  Palmtree,
  Bell,
  Moon,
  HelpCircle,
  Shield,
  LogOut,
  BadgeCheck,
  ExternalLink,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { supabase } from "@/lib/supabase";
import { cacheClearAll } from "@/lib/cache/mmkv";
import { getDb } from "@/lib/sync/db";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useThemeStore } from "@/hooks/stores/use-theme-store";
import { strings } from "@/constants/strings";

/* ── Toggle Card for Display Preferences ── */

function ToggleCard({
  icon: Icon,
  label,
  active,
  onToggle,
}: {
  icon: typeof Calendar;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  const s = useStyles();
  const theme = useTheme();

  return (
    <Pressable onPress={onToggle} style={s.toggleCard}>
      <View style={s.toggleCardTop}>
        <Icon
          size={22}
          color={active ? theme.colors.brandOrange : theme.colors.mutedForeground}
          strokeWidth={1.5}
        />
        <View style={[s.toggleTrack, active && s.toggleTrackActive]}>
          <View style={[s.toggleThumb, active && s.toggleThumbActive]} />
        </View>
      </View>
      <Text style={[s.toggleLabel, !active && s.toggleLabelInactive]}>{label}</Text>
    </Pressable>
  );
}

/* ── Main ── */

export default function SettingsScreen() {
  const s = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile, isLoading } = useMyProfile();
  const { theme: themeMode, setTheme } = useThemeStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [calShifts, setCalShifts] = useState(true);
  const [calTasks, setCalTasks] = useState(false);
  const [calBookings, setCalBookings] = useState(true);
  const [calHolidays, setCalHolidays] = useState(false);

  const displayName = profile?.display_name ?? "";
  const role = profile?.role ?? "employee";
  const jobTitle = profile?.job_title ?? role;
  const isDarkOn = themeMode === "dark";

  const handleLogout = useCallback(() => {
    Alert.alert(strings.me.logout, strings.me.logoutConfirm, [
      { text: strings.common.cancel, style: "cancel" },
      {
        text: strings.me.logout,
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            cacheClearAll();
            try {
              const db = await getDb();
              await db.runAsync("DELETE FROM pending_writes");
            } catch {}
            await supabase.auth.signOut();
          } catch {
            await supabase.auth.signOut().catch(() => {});
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, []);

  const handleDarkToggle = useCallback(() => {
    Haptics.selectionAsync();
    setTheme(isDarkOn ? "light" : "dark");
  }, [isDarkOn, setTheme]);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={s.headerBtn}
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={s.headerTitle}>Settings</Text>
        <Pressable style={s.headerBtn}>
          <MoreVertical size={22} color={theme.colors.mutedForeground} strokeWidth={1.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Animated.View entering={FadeIn.delay(50).duration(400)} style={s.profileCard}>
          <View style={s.avatarWrap}>
            <Avatar name={displayName || "?"} imageUrl={profile?.avatar_url} size="xl" />
            <View style={s.verifiedBadge}>
              <BadgeCheck size={12} color="#ffffff" strokeWidth={2.5} />
            </View>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{isLoading ? "..." : displayName || "—"}</Text>
            <Text style={s.profileRole}>{jobTitle}</Text>
            <View style={s.idBadge}>
              <Text style={s.idText}>ID: SM-88294</Text>
            </View>
          </View>
        </Animated.View>

        {/* Personlig */}
        <Text style={s.sectionTitle}>Personlig</Text>
        <View style={s.card}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(home)/edit-profile");
            }}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
          >
            <View style={s.rowLeft}>
              <User size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={s.rowLabel}>Profilinnstillinger</Text>
            </View>
            <ChevronRight
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.3)}
              strokeWidth={1.5}
            />
          </Pressable>
          <View style={s.divider} />
          <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
            <View style={s.rowLeft}>
              <Mail size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <View>
                <Text style={s.rowLabel}>Kontaktinformasjon</Text>
                <Text style={s.rowSub}>sofia.a@studionomad.no</Text>
              </View>
            </View>
            <ChevronRight
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.3)}
              strokeWidth={1.5}
            />
          </Pressable>
        </View>

        {/* Workspace */}
        <Text style={s.sectionTitle}>Workspace</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={s.wsIcon}>
                <Layers size={20} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              </View>
              <View>
                <Text style={s.rowSub}>Aktiv Workspace</Text>
                <Text style={s.rowLabelBold}>Studio Nomad</Text>
              </View>
            </View>
            <Pressable style={s.switchBtn} onPress={() => Haptics.selectionAsync()}>
              <Text style={s.switchBtnText}>Bytt</Text>
            </Pressable>
          </View>
          <View style={s.divider} />
          <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
            <View style={s.rowLeft}>
              <Globe size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={s.rowLabel}>Språk</Text>
            </View>
            <Text style={s.trailingText}>Norsk (Bokmål)</Text>
          </Pressable>
        </View>

        {/* Display Preferences */}
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Display Preferences</Text>
          <Text style={s.sectionMeta}>CALENDAR PRESETS</Text>
        </View>
        <View style={s.bentoGrid}>
          <ToggleCard
            icon={Calendar}
            label="Shifts"
            active={calShifts}
            onToggle={() => {
              Haptics.selectionAsync();
              setCalShifts(!calShifts);
            }}
          />
          <ToggleCard
            icon={CheckSquare}
            label="Tasks"
            active={calTasks}
            onToggle={() => {
              Haptics.selectionAsync();
              setCalTasks(!calTasks);
            }}
          />
          <ToggleCard
            icon={BookOpen}
            label="Bookings"
            active={calBookings}
            onToggle={() => {
              Haptics.selectionAsync();
              setCalBookings(!calBookings);
            }}
          />
          <ToggleCard
            icon={Palmtree}
            label="Holidays"
            active={calHolidays}
            onToggle={() => {
              Haptics.selectionAsync();
              setCalHolidays(!calHolidays);
            }}
          />
        </View>

        {/* System & Varsler */}
        <Text style={s.sectionTitle}>System & Varsler</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Bell size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={s.rowLabel}>Varsler</Text>
            </View>
            <View style={[s.toggleTrack, s.toggleTrackLg, notificationsOn && s.toggleTrackActive]}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setNotificationsOn(!notificationsOn);
                }}
              >
                <View
                  style={[
                    s.toggleThumb,
                    s.toggleThumbLg,
                    notificationsOn && s.toggleThumbActive,
                    notificationsOn && s.toggleThumbLgActive,
                  ]}
                />
              </Pressable>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Moon size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={s.rowLabel}>Mørkt Modus</Text>
            </View>
            <View style={[s.toggleTrack, s.toggleTrackLg, isDarkOn && s.toggleTrackActive]}>
              <Pressable onPress={handleDarkToggle}>
                <View
                  style={[
                    s.toggleThumb,
                    s.toggleThumbLg,
                    isDarkOn && s.toggleThumbActive,
                    isDarkOn && s.toggleThumbLgActive,
                  ]}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Hjelp & Support */}
        <Text style={s.sectionTitle}>Hjelp & Support</Text>
        <View style={s.card}>
          <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
            <View style={s.rowLeft}>
              <HelpCircle size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={s.rowLabel}>Hjelpesenter</Text>
            </View>
            <ExternalLink
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.3)}
              strokeWidth={1.5}
            />
          </Pressable>
          <View style={s.divider} />
          <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
            <View style={s.rowLeft}>
              <Shield size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
              <Text style={s.rowLabel}>Personvern & Vilkår</Text>
            </View>
            <ChevronRight
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.3)}
              strokeWidth={1.5}
            />
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleLogout();
          }}
          disabled={loggingOut}
          style={({ pressed }) => [s.logoutBtn, pressed && s.logoutPressed]}
        >
          <LogOut size={20} color={theme.colors.destructive} strokeWidth={1.8} />
          <Text style={s.logoutText}>Logg ut</Text>
        </Pressable>

        <Text style={s.versionText}>SMARTOUT V2.4.12 • STUDIO NOMAD</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },

  /* Header */
  headerBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: theme.spacing.section, paddingBottom: 160 },

  /* Profile Card */
  profileCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.section,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    marginBottom: theme.spacing.page,
  },
  avatarWrap: { position: "relative" as const },
  verifiedBadge: {
    position: "absolute" as const,
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 3,
    borderColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },
  profileRole: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
    letterSpacing: 0.5,
  },
  idBadge: {
    alignSelf: "flex-start" as const,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    borderRadius: theme.radius.full,
  },
  idText: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 1.5,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase" as const,
  },

  /* Section */
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    paddingHorizontal: 4,
    marginBottom: theme.spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: theme.spacing.md,
  },
  sectionMeta: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 1.5,
    color: theme.colors.mutedForeground,
  },

  /* Card */
  card: {
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    borderRadius: theme.radius.lg,
    overflow: "hidden" as const,
    marginBottom: theme.spacing.page,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: 18,
  },
  rowPressed: { backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" },
  rowLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    flex: 1,
  },
  rowLabel: { fontSize: 15, fontWeight: "500" as const, color: theme.colors.foreground },
  rowLabelBold: { fontSize: 15, fontWeight: "700" as const, color: theme.colors.foreground },
  rowSub: { fontSize: 12, color: theme.colors.mutedForeground, marginTop: 1 },
  divider: {
    height: 0.5,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
    marginHorizontal: theme.spacing.card,
  },
  trailingText: { fontSize: 13, color: theme.colors.mutedForeground },

  /* Workspace icon */
  wsIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  switchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
  },
  switchBtnText: { fontSize: 12, fontWeight: "600" as const, color: theme.colors.foreground },

  /* Bento Display Prefs */
  bentoGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.page,
  },
  toggleCard: {
    flexBasis: "47%" as unknown as number,
    flexGrow: 1,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    gap: theme.spacing.element,
  },
  toggleCardTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  toggleLabel: { fontSize: 14, fontWeight: "500" as const, color: theme.colors.foreground },
  toggleLabelInactive: { color: theme.colors.mutedForeground },

  /* Custom toggle */
  toggleTrack: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    justifyContent: "center" as const,
    paddingHorizontal: 2,
  },
  toggleTrackLg: { width: 48, height: 28 },
  toggleTrackActive: {
    backgroundColor: theme.colors.brandOrange,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  toggleThumbLg: { width: 22, height: 22 },
  toggleThumbActive: {
    alignSelf: "flex-end" as const,
  },
  toggleThumbLgActive: {
    alignSelf: "flex-end" as const,
  },

  /* Logout */
  logoutBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 10,
    height: 56,
    borderRadius: theme.radius.lg,
    borderWidth: 0.5,
    borderColor: withOpacity(theme.colors.destructive, 0.2),
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.element,
  },
  logoutPressed: {
    backgroundColor: withOpacity(theme.colors.destructive, 0.05),
    transform: [{ scale: 0.97 }],
  },
  logoutText: { fontSize: 16, fontWeight: "700" as const, color: theme.colors.destructive },

  versionText: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.4),
    textAlign: "center" as const,
    marginBottom: theme.spacing.page,
  },
}));
