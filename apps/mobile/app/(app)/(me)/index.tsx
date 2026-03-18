/**
 * Me / Profile screen — profile info, notification preferences, call leader,
 * logout, and a locked V2 training section.
 *
 * "Ring leder" is only visible during_shift. Logout clears auth, MMKV cache,
 * and SQLite write queue. Notification preferences are stored locally in MMKV.
 */

import React, { useCallback, useState } from "react";
import { View, Text, Switch, Pressable, Alert, Linking, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { createStyles, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/common/Avatar";
import { SectionHeader } from "@/components/common/SectionHeader";
import { supabase } from "@/lib/supabase";
import { cacheClearAll } from "@/lib/cache/mmkv";
import { getDb } from "@/lib/sync/db";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { storage } from "@/lib/cache/mmkv";

/** MMKV key for push notification preference */
const PUSH_PREF_KEY = "pref:push-notifications";

/** Reads the push notification preference from MMKV. Defaults to true. */
function getPushPref(): boolean {
  const raw = storage.getString(PUSH_PREF_KEY);
  if (raw === undefined) return true;
  return raw === "true";
}

/** Persists the push notification preference to MMKV. */
function setPushPref(enabled: boolean): void {
  storage.set(PUSH_PREF_KEY, enabled ? "true" : "false");
}

export default function MeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { data: profile, isLoading } = useMyProfile();
  const { phase } = useShiftPhase();
  const [pushEnabled, setPushEnabled] = useState(getPushPref);
  const [loggingOut, setLoggingOut] = useState(false);

  const isDuringShift = phase === "during_shift";

  /** Full display name from profile, or empty fallback */
  const displayName = profile
    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
    : "";

  const handleTogglePush = useCallback((value: boolean) => {
    Haptics.selectionAsync();
    setPushEnabled(value);
    setPushPref(value);
  }, []);

  const handleCallLeader = useCallback(() => {
    // Leader phone would come from the profile's team leader query.
    // For now, this button is only rendered when leaderPhone exists.
    // Placeholder: the actual phone should come from a query on the team leader.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Wire to actual leader phone from shift context
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(strings.me.logout, strings.me.logoutConfirm, [
      { text: strings.common.cancel, style: "cancel" },
      {
        text: strings.me.logout,
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            // Clear MMKV cache
            cacheClearAll();

            // Clear SQLite write queue
            try {
              const db = await getDb();
              await db.runAsync("DELETE FROM pending_writes");
            } catch {
              // DB might not be initialized — safe to ignore
            }

            // Sign out from Supabase (clears SecureStore tokens)
            await supabase.auth.signOut();
          } catch {
            // Even if cleanup fails, ensure we sign out
            await supabase.auth.signOut().catch(() => {});
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{strings.tabs.me}</Text>

        {/* Profile info card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar
              name={displayName || "?"}
              imageUrl={profile?.avatar_url}
              size="lg"
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {isLoading ? strings.common.loading : displayName || "—"}
              </Text>
              {profile?.role && (
                <Text style={styles.profileDetail}>{profile.role}</Text>
              )}
              {profile?.department_id && (
                <Text style={styles.profileDetail}>
                  {/* Department name would come from a join — showing role for now */}
                  {strings.me.role}: {profile.role ?? "—"}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Notification preferences */}
        <Card style={styles.section}>
          <SectionHeader title={strings.me.notifications} />
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{strings.me.pushNotifications}</Text>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ false: "#767577", true: "#e85c0d" }}
              thumbColor="#ffffff"
            />
          </View>
        </Card>

        {/* Ring leder — only visible during_shift */}
        {isDuringShift && (
          <Pressable
            style={({ pressed }) => [styles.callLeaderRow, pressed && styles.pressed]}
            onPress={handleCallLeader}
            accessibilityRole="button"
            accessibilityLabel={strings.me.callLeader}
          >
            <Text style={styles.callLeaderIcon}>📞</Text>
            <Text style={styles.callLeaderText}>{strings.me.callLeader}</Text>
          </Pressable>
        )}

        {/* Locked V2 section: Training & certificates */}
        <View style={styles.lockedSection}>
          <Card>
            <EmptyState
              icon={<Text style={styles.lockIcon}>🔒</Text>}
              title={strings.me.trainingLocked}
              subtitle={strings.me.comingSoon}
            />
          </Card>
        </View>

        {/* Logout button */}
        <View style={styles.logoutSection}>
          <Button
            title={strings.me.logout}
            variant="destructive"
            size="md"
            fullWidth
            onPress={handleLogout}
            loading={loggingOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.element,
  },
  profileCard: {
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.section,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  profileInfo: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  profileName: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  profileDetail: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  section: {
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.section,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.tight,
  },
  settingLabel: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  callLeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.section,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  callLeaderIcon: {
    fontSize: 22,
  },
  callLeaderText: {
    ...theme.typography.bodyBold,
    color: theme.colors.brandOrange,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  lockedSection: {
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.section,
    opacity: 0.6,
  },
  lockIcon: {
    fontSize: 28,
  },
  logoutSection: {
    marginHorizontal: theme.spacing.card,
    marginTop: theme.spacing.element,
  },
}));
