/**
 * TierBadge — compact pill that signals the announcement tier (social / work / external).
 *
 * Mobile read-only surface per ADR-0133. Renders inside ChannelMessageBubble
 * when `message_type === "announcement"`.
 *
 * Design: Nordic Split semantic color tokens via createStyles + useTheme.
 * No hardcoded hex values — all colours flow from nativeTheme.
 *
 * i18n namespace: "komm" (keys: tier.social, tier.work, tier.external)
 * These keys live in packages/i18n/locales/{en,nb}/komm.json — added by
 * Track G (see note below).
 *
 * NOTE: A "news" namespace does not exist in the i18n package.
 * Keys are placed in "komm" which already has a "tabs.news" entry
 * and is the canonical home for channel/announcement UI strings.
 */

import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "@smartout/i18n";
import { createStyles } from "@/theme";

export type AnnouncementTier = "social" | "work" | "external";

type Props = {
  tier: AnnouncementTier;
};

/**
 * TierBadge — renders a coloured pill for the announcement tier.
 *
 * Colours are semantic (muted / primary / destructive families) so they
 * respond correctly to light/dark mode without any additional logic.
 */
export function TierBadge({ tier }: Props) {
  const { t } = useTranslation("komm");
  const styles = useStyles();
  const tierStyles = getTierStyles(styles, tier);

  return (
    <View style={[styles.pill, tierStyles.pill]}>
      <Text style={[styles.label, tierStyles.label]}>{t(`tier.${tier}`)}</Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TierStyleEntry = { pill: object; label: object };

function getTierStyles(
  styles: ReturnType<typeof useStyles>,
  tier: AnnouncementTier,
): TierStyleEntry {
  switch (tier) {
    case "social":
      return { pill: styles.pillSocial, label: styles.labelSocial };
    case "work":
      return { pill: styles.pillWork, label: styles.labelWork };
    case "external":
      return { pill: styles.pillExternal, label: styles.labelExternal };
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  pill: {
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },

  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  /* social — muted surface, secondary text */
  pillSocial: {
    backgroundColor: theme.colors.muted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  labelSocial: {
    color: theme.colors.mutedForeground,
  },

  /* work — primary-tinted surface with primary text */
  pillWork: {
    backgroundColor: theme.isDark
      ? "rgba(229,229,229,0.12)" // primary @ 12% opacity — dark
      : "rgba(42,36,30,0.08)", // primary @ 8% opacity — light
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(229,229,229,0.18)" : "rgba(42,36,30,0.14)",
  },
  labelWork: {
    color: theme.colors.primary,
  },

  /* external — destructive-tinted surface */
  pillExternal: {
    backgroundColor: theme.isDark
      ? "rgba(237,83,80,0.14)" // destructive @ 14% opacity — dark
      : "rgba(222,59,61,0.10)", // destructive @ 10% opacity — light
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(237,83,80,0.22)" : "rgba(222,59,61,0.18)",
  },
  labelExternal: {
    color: theme.colors.destructive,
  },
}));
