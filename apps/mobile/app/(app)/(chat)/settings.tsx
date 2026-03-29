/**
 * Chat Settings screen — notification preferences + availability for voice/messages.
 *
 * Sections:
 * 1. Chat notifications — push for new messages, mention-only mode
 * 2. Availability — voice call availability, app message status (online/away/DND)
 * 3. Do Not Disturb — schedule-based muting
 *
 * Accessed from the settings icon in the Kanaler header.
 */

import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Bell,
  AtSign,
  Phone,
  PhoneOff,
  MessageCircle,
  Moon,
  Clock,
  Radio,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import type { LucideIcon } from "lucide-react-native";

/* ── Types ── */

type ToggleRowProps = {
  icon: LucideIcon;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
};

type StatusOption = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

/* ── Toggle Row ── */

function ToggleRow({ icon: Icon, label, description, value, onValueChange }: ToggleRowProps) {
  const styles = useToggleStyles();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Icon
        size={20}
        color={value ? theme.colors.brandOrange : withOpacity(theme.colors.mutedForeground, 0.5)}
        strokeWidth={1.6}
      />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description && <Text style={styles.rowDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync();
          onValueChange(v);
        }}
        trackColor={{
          false: withOpacity(theme.colors.muted, 0.8),
          true: withOpacity(theme.colors.brandOrange, 0.25),
        }}
        thumbColor={value ? theme.colors.brandOrange : theme.colors.mutedForeground}
        ios_backgroundColor={withOpacity(theme.colors.muted, 0.8)}
      />
    </View>
  );
}

const useToggleStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: 16,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  rowDescription: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));

/* ── Availability Status Selector ── */

const STATUS_OPTIONS: StatusOption[] = [
  {
    key: "online",
    label: "Tilgjengelig",
    description: "Kan motta samtaler og meldinger",
    icon: MessageCircle,
  },
  { key: "away", label: "Borte", description: "Vises som borte, men mottar varsler", icon: Clock },
  {
    key: "dnd",
    label: "Ikke forstyrr",
    description: "Ingen varsler unntatt direktemeldinger",
    icon: Moon,
  },
  {
    key: "offline",
    label: "Frakoblet",
    description: "Ingen varsler eller innkommende samtaler",
    icon: PhoneOff,
  },
];

function StatusSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (key: string) => void;
}) {
  const styles = useStatusStyles();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {STATUS_OPTIONS.map((opt) => {
        const isActive = selected === opt.key;
        const Icon = opt.icon;
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(opt.key);
            }}
            style={[styles.option, isActive && styles.optionActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
          >
            <Icon
              size={18}
              color={
                isActive ? theme.colors.brandOrange : withOpacity(theme.colors.mutedForeground, 0.5)
              }
              strokeWidth={1.6}
            />
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.optionDescription}>{opt.description}</Text>
            </View>
            {isActive && <View style={styles.activeDot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStatusStyles = createStyles((theme) => ({
  container: {
    gap: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionActive: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.04),
    borderColor: withOpacity(theme.colors.brandOrange, 0.15),
  },
  optionText: {
    flex: 1,
    gap: 1,
  },
  optionLabel: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  optionLabelActive: {
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.semibold,
  },
  optionDescription: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.brandOrange,
  },
}));

/* ── Main Screen ── */

export default function ChatSettingsScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const [pushMessages, setPushMessages] = useState(true);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [voiceCalls, setVoiceCalls] = useState(true);
  const [walkieMode, setWalkieMode] = useState(false);
  const [status, setStatus] = useState("online");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ArrowLeft size={22} color={theme.colors.brandOrange} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>Chatinnstillinger</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentOffset={{ x: 0, y: 0 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications section */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400).springify()}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Varsler</Text>
          <View style={styles.sectionCard}>
            <ToggleRow
              icon={Bell}
              label="Push-varsler for meldinger"
              description="Få varsel ved nye meldinger i kanaler og DM"
              value={pushMessages}
              onValueChange={setPushMessages}
            />
            <View style={styles.divider} />
            <ToggleRow
              icon={AtSign}
              label="Kun omtaler"
              description="Varsle bare når noen nevner deg med @"
              value={mentionsOnly}
              onValueChange={setMentionsOnly}
            />
          </View>
        </Animated.View>

        {/* Voice & Walkie section */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400).springify()}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Samtaler</Text>
          <View style={styles.sectionCard}>
            <ToggleRow
              icon={Phone}
              label="Talesamtaler"
              description="Tillat innkommende talesamtaler"
              value={voiceCalls}
              onValueChange={setVoiceCalls}
            />
            <View style={styles.divider} />
            <ToggleRow
              icon={Radio}
              label="Walkie-modus"
              description="Push-to-talk for rask kommunikasjon under vakt"
              value={walkieMode}
              onValueChange={setWalkieMode}
            />
          </View>
        </Animated.View>

        {/* Availability section */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(400).springify()}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Tilgjengelighet</Text>
          <View style={styles.sectionCard}>
            <StatusSelector selected={status} onSelect={setStatus} />
          </View>
        </Animated.View>
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
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(theme.colors.border, 0.08),
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "400",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.xl + 60,
  },
  section: {
    marginBottom: theme.spacing.page,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
    color: theme.colors.brandOrange,
    paddingHorizontal: 8,
    marginBottom: theme.spacing.element,
  },
  sectionCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.6) : theme.colors.background,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.08),
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.element,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: withOpacity(theme.colors.border, 0.1),
  },
}));
