/**
 * Dropdown — single-select, tap-to-expand option list (Nordic Split, dark-aware).
 *
 * No native picker dependency. Trigger mirrors the Input primitive (secondary
 * surface, border, radius.md, 44px min). Tapping toggles an inline option list;
 * the selected row shows a check. Fully token-based (works in light + dark).
 */
import React, { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";

export type DropdownOption = { value: string; label: string };

export function Dropdown(props: {
  label?: string;
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selected = props.options.find((o) => o.value === props.value) ?? null;

  const choose = useCallback(
    (value: string) => {
      props.onChange(value);
      setOpen(false);
    },
    [props],
  );

  return (
    <View style={styles.container}>
      {props.label ? <Text style={styles.label}>{props.label}</Text> : null}
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={[styles.trigger, open && styles.triggerOpen]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={props.label ?? "Velg"}
      >
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? props.placeholder ?? "Velg…"}
        </Text>
        <ChevronDown
          size={18}
          color={theme.colors.mutedForeground}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>

      {open ? (
        <View style={styles.list}>
          {props.options.length === 0 ? (
            <Text style={styles.empty}>Ingen valg</Text>
          ) : (
            props.options.map((opt) => {
              const isSel = opt.value === props.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => choose(opt.value)}
                  style={[styles.row, isSel && styles.rowSelected]}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={opt.label}
                >
                  <Text style={[styles.rowText, isSel && styles.rowTextSelected]} numberOfLines={1}>
                    {opt.label}
                  </Text>
                  {isSel ? <Check size={16} color={theme.colors.primary} /> : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: { gap: theme.spacing.xs },
  label: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.tight,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    minHeight: 44,
  },
  triggerOpen: { borderColor: theme.colors.primary },
  value: { ...theme.typography.body, color: theme.colors.foreground, flex: 1 },
  placeholder: { color: theme.colors.mutedForeground },
  list: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    minHeight: 44,
  },
  rowSelected: { backgroundColor: theme.colors.muted },
  rowText: { ...theme.typography.body, color: theme.colors.foreground, flex: 1 },
  rowTextSelected: { color: theme.colors.primary, fontWeight: theme.fontWeights.medium },
  empty: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    padding: theme.spacing.element,
  },
}));
