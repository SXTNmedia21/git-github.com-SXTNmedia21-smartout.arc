import * as React from "react";
import { View, Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import { Camera, Check, Shield } from "lucide-react-native";

import { nativeTheme } from "@smartout/design-tokens/native";
import type { DayTask } from "./types";

/**
 * TaskRow (React Native) — mirrors the web `.tsx` contract using RN
 * primitives and `nativeTheme` hex values. Honours the same DayTask states:
 * `done`, `active`, `overdue`, `compliance`, `evidence`, `note`.
 *
 * ADR-0158 dual-platform: paired with `TaskRow.tsx`. Props identical so
 * shared hooks / mapping logic (e.g. `use-session-hooks-with-tasks`) can
 * feed both surfaces without adapter layers.
 */
export function TaskRow({ task, onToggle }: { task: DayTask; onToggle?: () => void }) {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? nativeTheme.dark : nativeTheme.light;
  const { done, active, overdue } = task;

  const interactive = typeof onToggle === "function";

  const checkboxBg = done ? palette.success : "transparent";
  const checkboxBorder = done ? palette.success : active ? palette.brandOrange : palette.border;

  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: palette.border },
        overdue && {
          borderLeftWidth: 2,
          borderLeftColor: palette.destructive,
          paddingLeft: 8,
        },
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: !interactive }}
        accessibilityLabel={
          done ? `Marker ${task.title} som ikke-gjort` : `Marker ${task.title} som ferdig`
        }
        onPress={onToggle}
        disabled={!interactive}
        style={({ pressed }) => [
          styles.checkbox,
          {
            backgroundColor: checkboxBg,
            borderColor: checkboxBorder,
          },
          active &&
            !done && {
              // Focus-ring equivalent — subtle outline.
              shadowColor: palette.brandOrange,
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 0 },
              elevation: 2,
            },
          pressed && interactive && { opacity: 0.75 },
        ]}
      >
        {done ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}
      </Pressable>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              color: done ? palette.mutedForeground : palette.foreground,
              textDecorationLine: done ? "line-through" : "none",
            },
          ]}
        >
          {task.title}
        </Text>
        {task.note ? (
          <Text style={[styles.note, { color: palette.mutedForeground }]}>{task.note}</Text>
        ) : null}
      </View>

      {task.compliance ? (
        <Shield
          size={13}
          color={done ? palette.mutedForeground : palette.warning}
          accessibilityLabel="Compliance"
        />
      ) : null}

      {task.evidence ? (
        <View style={styles.evidence}>
          <Camera size={12} color={palette.mutedForeground} />
          <Text style={[styles.evidenceText, { color: palette.mutedForeground }]}>
            {task.evidence}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.owner, { color: palette.mutedForeground }]} numberOfLines={1}>
        {task.owner}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.75,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: "500",
  },
  note: {
    fontSize: 11,
  },
  evidence: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  evidenceText: {
    fontSize: 11,
    fontFamily: "GeistMono-Regular",
  },
  owner: {
    fontSize: 11,
    minWidth: 60,
    textAlign: "right",
  },
});
