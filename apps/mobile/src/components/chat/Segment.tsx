/**
 * Segment — Tabbed selector with optional count pills.
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:7-28
 *
 * Active tab gets brand-orange underline + foreground label. Inactive tabs use
 * muted foreground at 0.7. Count renders in parentheses, brand-orange on the
 * active tab and muted on inactive.
 *
 * Ships without haptics — consumers own the press handler semantics.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

export type SegmentTab = {
  id: string;
  label: string;
  /** Optional count pill rendered in parentheses after the label. */
  count?: number;
};

export type SegmentProps = {
  value: string;
  tabs: SegmentTab[];
  onChange: (id: string) => void;
};

export function Segment({ value, tabs, onChange }: SegmentProps) {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={[styles.tab, active && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
          >
            <View style={styles.labelRow}>
              <Text style={[styles.label, active && styles.labelActive]}>{t.label}</Text>
              {t.count != null && t.count > 0 && (
                <Text
                  style={[
                    styles.count,
                    {
                      color: active
                        ? theme.colors.brandOrange
                        : withOpacity(theme.colors.mutedForeground, 0.85),
                    },
                  ]}
                >
                  ({t.count})
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    paddingTop: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: theme.colors.brandOrange,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: withOpacity(theme.colors.mutedForeground, 0.7),
  },
  labelActive: {
    color: theme.colors.foreground,
  },
  count: {
    fontSize: 14,
    fontWeight: "500",
  },
}));
