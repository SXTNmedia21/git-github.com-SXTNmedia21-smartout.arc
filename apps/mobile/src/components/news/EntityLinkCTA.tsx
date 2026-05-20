/**
 * EntityLinkCTA — pressable row that deep-links to the entity referenced by
 * an announcement link. Mobile read-only surface per ADR-0133.
 *
 * DB enum announcement_link_type has exactly 7 values (A0 council canonical):
 *   staff_event, schedule_shift, policy, protocol, profile, menu_document, external_url
 * NOTE: `channel` is NOT a valid link_type — an announcement already lives in a channel.
 *
 * Route audit (2026-05-18):
 *   ENABLED:
 *     schedule_shift  → /(app)/(shifts)/[id]           ROUTE EXISTS
 *     profile         → /(app)/(home)/team/[id]        ROUTE EXISTS
 *     external_url    → Linking.openURL(linkId)
 *   DISABLED V1 (web-only toast):
 *     staff_event     → no /schedule/event/[id] route on mobile → toast
 *     policy          → no route → toast
 *     protocol        → no route → toast
 *     menu_document   → no route → toast
 *
 * Telemetry: announcement.link_followed per ADR-0134.
 * getProfileContext() throws on missing auth — fail-fast, never empty-string emit.
 */

import React, { useCallback } from "react";
import { Alert, Linking, TouchableOpacity, View, Text } from "react-native";
import { Calendar, Clock, User, FileText, ExternalLink } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "@smartout/i18n";
import { emit } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";
import { createStyles, useTheme } from "@/theme";
import type { Database } from "@smartout/supabase/database.types";

export type AnnouncementLinkType = Database["public"]["Enums"]["announcement_link_type"];

type Props = {
  messageId: string;
  announcementKind: string;
  linkType: AnnouncementLinkType;
  linkId: string;
};

/**
 * V1: only external_url, schedule_shift, and profile are routable on mobile.
 * All others show a "Åpne på web" disabled state.
 */
function isRoutableOnMobile(linkType: AnnouncementLinkType): boolean {
  return linkType === "external_url" || linkType === "schedule_shift" || linkType === "profile";
}

function getIcon(linkType: AnnouncementLinkType, color: string, size = 16): React.ReactElement {
  switch (linkType) {
    case "staff_event":
      return <Calendar size={size} color={color} />;
    case "schedule_shift":
      return <Clock size={size} color={color} />;
    case "profile":
      return <User size={size} color={color} />;
    case "external_url":
      return <ExternalLink size={size} color={color} />;
    case "policy":
    case "protocol":
    case "menu_document":
    default:
      return <FileText size={size} color={color} />;
  }
}

/** Extract a human-readable host from a URL string for external links. */
function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function EntityLinkCTA({ messageId, announcementKind, linkType, linkId }: Props) {
  const { t } = useTranslation("komm");
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();

  const disabled = !isRoutableOnMobile(linkType);

  const label = linkType === "external_url" ? extractHost(linkId) : t(`link.cta.${linkType}`);

  const handlePress = useCallback(async () => {
    // Telemetry — fail-fast on missing context per ADR-0134 / L-0177.
    try {
      const { profileId, workspaceId } = await getProfileContext();
      void emit({
        event: "announcement.link_followed",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          message_id: messageId,
          kind: announcementKind,
          link_type: linkType,
          link_id: linkId,
        },
        entity: { entity_type: "channel_message", entity_id: messageId },
      });
    } catch {
      // Telemetry failure must not block navigation — warn and continue.
      console.warn("[EntityLinkCTA] telemetry emit failed — skipping");
    }

    if (disabled) {
      Alert.alert(t("link.disabled.web_only"));
      return;
    }

    switch (linkType) {
      case "external_url":
        await Linking.openURL(linkId);
        break;
      case "schedule_shift":
        router.push(`/(app)/(shifts)/${linkId}`);
        break;
      case "profile":
        router.push(`/(app)/(home)/team/${linkId}`);
        break;
      default:
        // Exhaustive fallback — all remaining types are web-only in V1.
        Alert.alert(t("link.disabled.web_only"));
    }
  }, [disabled, linkType, linkId, messageId, announcementKind, t, router]);

  const iconColor = disabled ? theme.colors.mutedForeground : theme.colors.primary;
  const textColor = disabled ? theme.colors.mutedForeground : theme.colors.primary;

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.container, disabled && styles.containerDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      activeOpacity={disabled ? 0.6 : 0.75}
    >
      <View style={styles.iconWrapper}>{getIcon(linkType, iconColor)}</View>
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      {!disabled && (
        <ExternalLink size={12} color={theme.colors.mutedForeground} style={styles.chevron} />
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    marginTop: 6,
    alignSelf: "stretch",
  },
  containerDisabled: {
    opacity: 0.55,
  },
  iconWrapper: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  chevron: {
    marginLeft: 2,
  },
}));
