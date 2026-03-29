/**
 * Team Member Detail Screen — View profile, contact info, readiness, and teams.
 *
 * - Profile header with avatar, name, role, department, status badge
 * - Contact section: email (mailto:) and phone (tel:)
 * - Readiness section: progress bar + percentage
 * - Teams section: list of team memberships as pills
 */

import React, { useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { ChevronLeft, Mail, Phone } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, statusColors } from "@/theme";
import { supabase } from "@/lib/supabase";

type ProfileStatus = "trainee" | "active" | "inactive" | "offboarding";

type MemberDetail = {
  profile_id: string;
  display_name: string | null;
  role: string | null;
  status: ProfileStatus | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  department: { name: string } | null;
};

type TeamMembership = {
  team: { team_id: string; name: string } | null;
};

type Assignment = {
  status: string | null;
};

const STATUS_LABELS: Record<ProfileStatus, string> = {
  trainee: "Trainee",
  active: "Aktiv",
  inactive: "Inaktiv",
  offboarding: "Slutter",
};

function useMemberDetail(profileId: string) {
  return useQuery({
    queryKey: ["team-member", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile")
        .select(
          "profile_id, display_name, role, status, avatar_url, user_identity:user_id(email, phone), department:department_id(name)",
        )
        .eq("profile_id", profileId)
        .single();

      if (error) throw error;

      const mapped = {
        ...data,
        email:
          (data as { user_identity?: { email?: string | null; phone?: string | null } | null })
            ?.user_identity?.email ?? null,
        phone:
          (data as { user_identity?: { email?: string | null; phone?: string | null } | null })
            ?.user_identity?.phone ?? null,
      };

      return mapped as MemberDetail;
    },
    enabled: !!profileId,
  });
}

function useMemberTeams(profileId: string) {
  return useQuery({
    queryKey: ["team-member-teams", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_member")
        .select("team:team_id(team_id, name)")
        .eq("profile_id", profileId);

      if (error) throw error;
      return (data ?? []) as TeamMembership[];
    },
    enabled: !!profileId,
  });
}

function useMemberReadiness(profileId: string) {
  return useQuery({
    queryKey: ["team-member-readiness", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocol_assignment")
        .select("status")
        .eq("profile_id", profileId);

      if (error) throw error;
      const assignments = (data ?? []) as Assignment[];
      if (assignments.length === 0) return { total: 0, completed: 0, percentage: 0 };

      const completed = assignments.filter((a) => a.status === "completed").length;
      return {
        total: assignments.length,
        completed,
        percentage: Math.round((completed / assignments.length) * 100),
      };
    },
    enabled: !!profileId,
  });
}

function getInitial(name: string | null): string {
  return (name ?? "?").charAt(0).toUpperCase();
}

function getStatusColor(status: ProfileStatus | null): string {
  if (!status || !(status in statusColors)) return statusColors.inactive;
  return statusColors[status];
}

export default function TeamMemberDetailScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = id ?? "";

  const { data: member, isLoading } = useMemberDetail(profileId);
  const { data: teams = [] } = useMemberTeams(profileId);
  const { data: readiness } = useMemberReadiness(profileId);

  const statusColor = getStatusColor(member?.status ?? null);

  const handleEmail = useCallback(() => {
    if (member?.email) {
      Haptics.selectionAsync();
      Linking.openURL(`mailto:${member.email}`);
    }
  }, [member?.email]);

  const handlePhone = useCallback(() => {
    if (member?.phone) {
      Haptics.selectionAsync();
      Linking.openURL(`tel:${member.phone}`);
    }
  }, [member?.phone]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={styles.brandColor.color} />
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <ChevronLeft size={28} color={styles.foregroundColor.color} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Fant ikke profil</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={28} color={styles.foregroundColor.color} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Profil</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400).springify()}
          style={styles.profileSection}
        >
          <View style={[styles.avatar, { backgroundColor: statusColor }]}>
            <Text style={styles.avatarText}>{getInitial(member.display_name)}</Text>
          </View>
          <Text style={styles.profileName}>{member.display_name ?? "Ukjent"}</Text>
          <Text style={styles.profileMeta}>
            {member.role ?? "—"} · {member.department?.name ?? "Ingen avdeling"}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "1A" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[member.status ?? "inactive"]}
            </Text>
          </View>
        </Animated.View>

        {/* Contact section */}
        {(member.email || member.phone) && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Kontakt</Text>
            {member.email && (
              <Pressable
                onPress={handleEmail}
                style={({ pressed }) => [styles.contactRow, pressed && styles.contactRowPressed]}
                accessibilityRole="link"
                accessibilityLabel={`Send e-post til ${member.email}`}
              >
                <Mail size={18} color={styles.brandColor.color} strokeWidth={2} />
                <Text style={styles.contactText} numberOfLines={1}>
                  {member.email}
                </Text>
              </Pressable>
            )}
            {member.phone && (
              <Pressable
                onPress={handlePhone}
                style={({ pressed }) => [styles.contactRow, pressed && styles.contactRowPressed]}
                accessibilityRole="link"
                accessibilityLabel={`Ring ${member.phone}`}
              >
                <Phone size={18} color={styles.brandColor.color} strokeWidth={2} />
                <Text style={styles.contactText} numberOfLines={1}>
                  {member.phone}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Readiness section */}
        {readiness && readiness.total > 0 && (
          <Animated.View
            entering={FadeInUp.delay(300).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Beredskap</Text>
            <View style={styles.readinessCard}>
              <View style={styles.readinessHeader}>
                <Text style={styles.readinessLabel}>
                  {readiness.completed} av {readiness.total} fullfort
                </Text>
                <Text style={[styles.readinessPercent, { color: statusColor }]}>
                  {readiness.percentage}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${readiness.percentage}%`,
                      backgroundColor: statusColor,
                    },
                  ]}
                />
              </View>
            </View>
          </Animated.View>
        )}

        {/* Teams section */}
        {teams.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(400).duration(400).springify()}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Team</Text>
            <View style={styles.pillContainer}>
              {teams.map((tm) =>
                tm.team ? (
                  <View key={tm.team.team_id} style={styles.pill}>
                    <Text style={styles.pillText}>{tm.team.name}</Text>
                  </View>
                ) : null,
              )}
            </View>
          </Animated.View>
        )}
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
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    flex: 1,
  },
  headerRight: {
    width: 44,
  },
  foregroundColor: {
    color: theme.colors.foreground,
  },
  brandColor: {
    color: theme.colors.brandOrange,
  },
  scroll: {
    paddingBottom: theme.spacing.xl,
  },

  /* Profile header */
  profileSection: {
    alignItems: "center",
    paddingVertical: theme.spacing.section,
    gap: theme.spacing.tight,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.tight,
  },
  avatarText: {
    color: theme.colors.primaryForeground,
    fontWeight: theme.fontWeights.bold,
    fontSize: 32,
  },
  profileName: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.bold,
  },
  profileMeta: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
  },

  /* Sections */
  section: {
    paddingHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.section,
  },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.element,
  },

  /* Contact */
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.element,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.tight,
  },
  contactRowPressed: {
    opacity: 0.7,
  },
  contactText: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    flex: 1,
  },

  /* Readiness */
  readinessCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.card,
    gap: theme.spacing.element,
  },
  readinessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  readinessLabel: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  readinessPercent: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.bold,
  },
  progressTrack: {
    height: 8,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    borderRadius: theme.radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: theme.radius.full,
  },

  /* Teams pills */
  pillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.tight,
  },
  pill: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
  },
  pillText: {
    ...theme.typography.caption,
    color: theme.colors.secondaryForeground,
    fontWeight: theme.fontWeights.medium,
  },

  /* States */
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
}));
