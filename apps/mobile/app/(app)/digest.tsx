/**
 * Daily Digest — Feed screen (Nordic Split).
 *
 * Layout:
 * 1. Header — avatar + workspace brand + search
 * 2. Title — "Daily Digest" in serif display
 * 3. Bento grid — featured policy card, shift updates, workplace news
 * 4. Contextual card — community shoutouts
 * 5. Archive list — older digest items
 *
 * The Feed tab replaces the old Home tab. Action bar provides
 * quick access to tasks, training, safety, and payroll.
 */

import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Menu,
  ShieldAlert,
  Clock,
  Coffee,
  PartyPopper,
  ArrowRight,
  Bell,
  FileText,
  CheckSquare,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { ActionBar } from "@/components/navigation/ActionBar";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useDigestFeed, type DigestFeedItem } from "@/hooks/queries/use-digest-feed";
import type { LucideIcon } from "lucide-react-native";

/* ── Icon mapping ──
 * Backend stores icon_type as text on `notification.icon_type`. Map the
 * common types to the lucide-react-native icons used by this screen. Default
 * falls back to Bell so an unknown type still renders.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  alert: ShieldAlert,
  shift: Clock,
  community: Coffee,
  policy: FileText,
  task: CheckSquare,
  contract: FileText,
  info: Bell,
};

function resolveIcon(iconType: string): LucideIcon {
  return ICON_MAP[iconType] ?? Bell;
}

/* ── Main Screen ── */

export default function FeedScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { items, archive, isLoading, isError } = useDigestFeed();

  const featured: DigestFeedItem | undefined = items.find((d) => d.featured);
  const regular: DigestFeedItem[] = items.filter((d) => !d.featured);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SyncIndicator />

      {/* Header */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(me)");
          }}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Meny"
        >
          <Menu size={22} color={withOpacity(theme.colors.foreground, 0.45)} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.brandName}>Daily Digest</Text>
        <NotificationBell profileId={profile?.profile_id} />
      </Animated.View>

      <ActionBar />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Subtitle */}
        <Animated.View entering={FadeInDown.delay(100).duration(500).springify()}>
          <Text style={styles.pageSubtitle}>
            {isError ? "Kunne ikke laste oppdateringer." : "Hold deg oppdatert med det siste."}
          </Text>
        </Animated.View>

        {/* Empty state — clean message, no synthetic placeholder cards. */}
        {!isLoading && items.length === 0 && (
          <View style={styles.featuredCard}>
            <View style={styles.featuredIcon}>
              <Bell size={22} color={theme.colors.brandOrange} strokeWidth={1.6} />
            </View>
            <Text style={styles.featuredTitle}>Ingen nyheter ennå</Text>
            <Text style={styles.featuredBody}>
              Når noe nytt skjer på arbeidsplassen din, dukker det opp her.
            </Text>
          </View>
        )}

        {/* Featured Card */}
        {featured && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(500).springify()}
            style={styles.featuredCard}
          >
            <View style={styles.featuredTop}>
              <View style={styles.featuredIcon}>
                {React.createElement(resolveIcon(featured.iconType), {
                  size: 22,
                  color: theme.colors.brandOrange,
                  strokeWidth: 1.6,
                })}
              </View>
              {featured.tag && (
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{featured.tag}</Text>
                </View>
              )}
            </View>
            <Text style={styles.featuredTitle}>{featured.title}</Text>
            <Text style={styles.featuredBody}>{featured.body}</Text>
            <View style={styles.featuredFooter}>
              <Text style={styles.cardTime}>{featured.time}</Text>
              {featured.actionUrl && (
                <Pressable
                  style={styles.readMore}
                  accessibilityRole="link"
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (featured.actionUrl) router.push(featured.actionUrl as never);
                  }}
                >
                  <Text style={styles.readMoreText}>Les mer</Text>
                  <ArrowRight size={14} color={theme.colors.brandOrange} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* Regular Cards — 2-column */}
        {regular.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(300).duration(400).springify()}
            style={styles.cardRow}
          >
            {regular.slice(0, 2).map((item) => {
              const IconComponent = resolveIcon(item.iconType);
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  accessibilityRole="button"
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (item.actionUrl) router.push(item.actionUrl as never);
                  }}
                >
                  <View style={styles.cardIconBox}>
                    <IconComponent
                      size={20}
                      color={theme.colors.mutedForeground}
                      strokeWidth={1.6}
                    />
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {item.body}
                  </Text>
                  <Text style={styles.cardTime}>{item.time}</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        {/* Community shoutout — kept as a static placeholder until a community
         * feed source exists; do NOT pretend it's live data. */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(400).springify()}
          style={styles.shoutoutCard}
        >
          <View style={styles.shoutoutIcon}>
            <PartyPopper size={22} color={theme.colors.brandOrange} strokeWidth={1.6} />
          </View>
          <View style={styles.shoutoutContent}>
            <Text style={styles.shoutoutLabel}>Fellesskap</Text>
            <Text style={styles.shoutoutTitle}>Snart kommer milepæler og hilsninger her.</Text>
          </View>
        </Animated.View>

        {/* Archive */}
        {archive.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(500).duration(400).springify()}
            style={styles.archiveSection}
          >
            <Text style={styles.archiveHeader}>Arkiv</Text>
            {archive.map((item) => (
              <View key={item.id} style={styles.archiveRow}>
                <Text style={styles.archiveDate}>{item.date}</Text>
                <View style={styles.archiveContent}>
                  <Text style={styles.archiveTitle}>{item.title}</Text>
                  <Text style={styles.archiveBody} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
              </View>
            ))}
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
  topBar: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  brandName: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 160,
  },

  /* Title */
  pageTitle: {
    fontSize: 40,
    fontWeight: "400",
    color: theme.colors.foreground,
    letterSpacing: -1,
    marginBottom: 4,
  },
  pageSubtitle: {
    ...theme.typography.subheadline,
    color: withOpacity(theme.colors.mutedForeground, 0.7),
    marginBottom: theme.spacing.page,
  },

  /* Featured Card */
  featuredCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.8) : theme.colors.muted,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.page,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  featuredTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  featuredIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  tagPill: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.06),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.brandOrange, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: theme.colors.brandOrange,
  },
  featuredTitle: {
    fontSize: 26,
    fontWeight: "400",
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  featuredBody: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    lineHeight: 22,
  },
  featuredFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.spacing.element,
  },
  readMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  readMoreText: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.brandOrange,
  },

  /* Card Row */
  cardRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.secondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.section,
    gap: theme.spacing.md,
    minHeight: 200,
    justifyContent: "space-between",
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.muted, 0.5)
      : withOpacity(theme.colors.muted, 0.8),
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "400",
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },
  cardBody: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    lineHeight: 20,
  },
  cardTime: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  /* Shoutout */
  shoutoutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.card, 0.4)
      : withOpacity(theme.colors.muted, 0.5),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.08),
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.page,
  },
  shoutoutIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  shoutoutContent: {
    flex: 1,
    gap: 2,
  },
  shoutoutLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },
  shoutoutTitle: {
    fontSize: 18,
    fontWeight: "400",
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },

  /* Archive */
  archiveSection: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.page,
  },
  archiveHeader: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 3,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    paddingLeft: 4,
    marginBottom: theme.spacing.element,
  },
  archiveRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "flex-start",
  },
  archiveDate: {
    fontSize: 12,
    fontWeight: "500",
    color: withOpacity(theme.colors.mutedForeground, 0.4),
    paddingTop: 2,
    width: 40,
  },
  archiveContent: {
    flex: 1,
    gap: 2,
  },
  archiveTitle: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  archiveBody: {
    ...theme.typography.subheadline,
    color: withOpacity(theme.colors.mutedForeground, 0.7),
  },
}));
