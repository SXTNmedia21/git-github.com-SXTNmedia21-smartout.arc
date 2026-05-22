/**
 * Dropdown — single-select, tap-to-expand option list (Nordic Split, dark-aware).
 *
 * Optional "creatable": a "+ create" row at the bottom of the list switches the
 * trigger into an inline text input (one control — no separate field). Fully
 * token-based (light + dark). No native picker dependency.
 */
import React, { useState, useCallback } from "react";
import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { ChevronDown, Check, Plus, X } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";

export type DropdownOption = { value: string; label: string };

export function Dropdown(props: {
  label?: string;
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  // Creatable: inline "type a new value" mode.
  creatable?: boolean;
  creating?: boolean;
  createValue?: string;
  createOptionLabel?: string;
  createPlaceholder?: string;
  onStartCreate?: () => void;
  onCreateValueChange?: (text: string) => void;
  onCancelCreate?: () => void;
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

  // ── Creating mode: the trigger IS a text input ───────────────────────────
  if (props.creating) {
    return (
      <View style={styles.container}>
        {props.label ? <Text style={styles.label}>{props.label}</Text> : null}
        <View style={[styles.trigger, styles.triggerOpen]}>
          <TextInput
            style={styles.createInput}
            value={props.createValue ?? ""}
            onChangeText={props.onCreateValueChange}
            placeholder={props.createPlaceholder ?? "Navn på ny lokasjon"}
            placeholderTextColor={theme.colors.mutedForeground}
            autoFocus
            returnKeyType="done"
            accessibilityLabel={props.createPlaceholder ?? "Ny lokasjon"}
          />
          <Pressable
            onPress={props.onCancelCreate}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Avbryt ny lokasjon"
          >
            <X size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
    );
  }

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
          <ScrollView
            style={styles.listScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {props.options.map((opt) => {
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
            })}
          </ScrollView>
          {props.creatable ? (
            <Pressable
              onPress={() => {
                setOpen(false);
                props.onStartCreate?.();
              }}
              style={[styles.row, styles.createRow]}
              accessibilityRole="button"
              accessibilityLabel={props.createOptionLabel ?? "Ny lokasjon"}
            >
              <Plus size={16} color={theme.colors.primary} />
              <Text style={styles.createRowText}>{props.createOptionLabel ?? "+ Ny lokasjon"}</Text>
            </Pressable>
          ) : null}
          {props.options.length === 0 && !props.creatable ? (
            <Text style={styles.empty}>Ingen valg</Text>
          ) : null}
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
  createInput: { ...theme.typography.body, color: theme.colors.foreground, flex: 1, padding: 0 },
  list: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  listScroll: { maxHeight: 264 },
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
  createRow: {
    justifyContent: "flex-start",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  createRowText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: theme.fontWeights.medium,
  },
  empty: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    padding: theme.spacing.element,
  },
}));
