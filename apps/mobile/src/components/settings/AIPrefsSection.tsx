/**
 * AIPrefsSection — "Botsson AI" settings block for the Chat Settings screen.
 *
 * Three controls:
 *   - Voice enabled (Switch) — disabling FAB long-press still opens the sheet
 *     but starts in text mode (P3+ wires this to session startup logic).
 *   - Input mode (segmented: Push-to-talk / Alltid på) — default "always-on".
 *   - Language (segmented: Norsk / English) — default "nb".
 *
 * Persistence: via useAiPrefs() → BotssonProvider → useBotssonSettingsStore
 * (MMKV-backed). Each updatePref() call also emits `mobile.ai_prefs.changed`
 * per ADR-0134.
 *
 * Nordic Split / ADR-0366: zero hardcoded hex/rgb/rgba/oklch. All colours
 * via theme.colors.*, spacing via theme.spacing.*, radii via theme.radius.*.
 */

import React from "react";
import { View, Text, Switch } from "react-native";
import * as Haptics from "expo-haptics";
import { Mic, Languages, Hand, Zap } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import type { LucideIcon } from "lucide-react-native";
import { useAiPrefs } from "@/hooks/use-ai-prefs";
import type { BotssonLanguage, BotssonInteractionMode } from "@/lib/ai-prefs";

// ─── Sub-components ───────────────────────────────────────────────────────────

type ToggleRowProps = {
  icon: LucideIcon;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
};

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

// ─── Segmented picker ─────────────────────────────────────────────────────────

type SegmentOption<T extends string> = {
  key: T;
  label: string;
  icon: LucideIcon;
};

type SegmentedPickerProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  accessibilityLabel: string;
};

import { Pressable } from "react-native";

function SegmentedPicker<T extends string>({
  options,
  value,
  onSelect,
  accessibilityLabel,
}: SegmentedPickerProps<T>) {
  const styles = useSegmentedStyles();
  const theme = useTheme();

  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt, idx) => {
        const isActive = value === opt.key;
        const isFirst = idx === 0;
        const Icon = opt.icon;
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(opt.key);
            }}
            style={[
              styles.segment,
              isFirst && styles.segmentFirst,
              idx === options.length - 1 && styles.segmentLast,
              isActive && styles.segmentActive,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={opt.label}
          >
            <Icon
              size={15}
              color={
                isActive ? theme.colors.brandOrange : withOpacity(theme.colors.mutedForeground, 0.6)
              }
              strokeWidth={1.6}
            />
            <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useSegmentedStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.12),
    overflow: "hidden",
    backgroundColor: withOpacity(theme.colors.muted, 0.3),
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.tight,
  },
  segmentFirst: {
    borderRightWidth: 1,
    borderRightColor: withOpacity(theme.colors.border, 0.12),
  },
  segmentLast: {},
  segmentActive: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
  },
  segmentLabel: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
  },
  segmentLabelActive: {
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.semibold,
  },
}));

// ─── Picker row (label + segmented) ──────────────────────────────────────────

type PickerRowProps<T extends string> = {
  icon: LucideIcon;
  label: string;
  description?: string;
  options: SegmentOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  accessibilityLabel: string;
};

function PickerRow<T extends string>({
  icon: Icon,
  label,
  description,
  options,
  value,
  onSelect,
  accessibilityLabel,
}: PickerRowProps<T>) {
  const styles = usePickerRowStyles();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Icon size={20} color={withOpacity(theme.colors.mutedForeground, 0.5)} strokeWidth={1.6} />
        <View style={styles.rowHeaderText}>
          <Text style={styles.rowLabel}>{label}</Text>
          {description && <Text style={styles.rowDescription}>{description}</Text>}
        </View>
      </View>
      <SegmentedPicker
        options={options}
        value={value}
        onSelect={onSelect}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const usePickerRowStyles = createStyles((theme) => ({
  row: {
    gap: theme.spacing.tight,
    paddingVertical: 16,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  rowHeaderText: {
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

// ─── Option sets ──────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS: SegmentOption<BotssonLanguage>[] = [
  { key: "nb", label: "Norsk", icon: Languages },
  { key: "en", label: "English", icon: Languages },
];

const INTERACTION_MODE_OPTIONS: SegmentOption<BotssonInteractionMode>[] = [
  { key: "push-to-talk", label: "Hold inne", icon: Hand },
  { key: "always-on", label: "Alltid på", icon: Zap },
];

// ─── Main exported section ────────────────────────────────────────────────────

type AIPrefsSectionProps = {
  /** Style for the divider line between rows. Pass from parent to keep visual parity. */
  dividerStyle?: object;
};

export function AIPrefsSection({ dividerStyle }: AIPrefsSectionProps) {
  const styles = useStyles();
  const { prefs, updatePref } = useAiPrefs();

  return (
    <>
      <ToggleRow
        icon={Mic}
        // TODO(i18n): replace with t("settings.botsson_ai.voice_enabled") when key is added
        label="Stemme"
        description="Aktiver talesamtaler med Botsson"
        value={prefs.voiceEnabled}
        onValueChange={(v) => updatePref("voiceEnabled", v)}
      />
      <View style={[styles.divider, dividerStyle]} />
      <PickerRow
        icon={Languages}
        // TODO(i18n): replace with t("settings.botsson_ai.language") when key is added
        label="Språk"
        description="Språk AI-agenten svarer på"
        options={LANGUAGE_OPTIONS}
        value={prefs.language}
        onSelect={(v) => updatePref("language", v)}
        accessibilityLabel="Velg AI-språk"
      />
      <View style={[styles.divider, dividerStyle]} />
      <PickerRow
        icon={Hand}
        // TODO(i18n): replace with t("settings.botsson_ai.interaction_mode") when key is added
        label="Mikrofon-modus"
        description="Hold inne: hold for å snakke. Alltid på: kontinuerlig lytting."
        options={INTERACTION_MODE_OPTIONS}
        value={prefs.interactionMode}
        onSelect={(v) => updatePref("interactionMode", v)}
        accessibilityLabel="Velg mikrofon-modus"
      />
    </>
  );
}

const useStyles = createStyles((theme) => ({
  divider: {
    height: 1,
    backgroundColor: withOpacity(theme.colors.border, 0.1),
  },
}));
