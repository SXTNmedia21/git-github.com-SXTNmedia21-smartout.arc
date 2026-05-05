/**
 * ScopeChips — Scope selector for the Vaktliste (ShiftList) screen.
 *
 * 4 chips: ✦ Mine vakter / Hele teamet / Avdeling ▾ / Ansatt ▾.
 * Active chip uses dept/person accent color. Dropdown chips show a ChevronDown
 * that rotates 180° over chevronMs (150ms) when the panel is open.
 *
 * When "Avdeling" is open, a panel below renders 4 department rows.
 * When "Ansatt" is open, a 4-column avatar grid renders.
 *
 * All animation via Reanimated withTiming using motionTokens.chevronMs.
 */

import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";
import { nativeTheme } from "@smartout/design-tokens/native";
import { useTheme } from "@/theme";
import { withOpacity } from "@/theme/colors";
import { Avatar } from "./Avatar";
import type { Staff, Department } from "./types";

const DEPT_COLORS = nativeTheme.department;
const { chevronMs } = nativeTheme.motion;

const DEPT_LABELS: Record<Department, string> = {
  kjokken: "Kjøkken",
  sal: "Sal",
  bar: "Bar",
  event: "Event",
};

const DEPTS: Department[] = ["kjokken", "sal", "bar", "event"];

export type ScopeKind = "me" | "all" | "dept" | "person";

export type Scope = {
  kind: ScopeKind;
  value?: string;
};

type ScopeChipsProps = {
  scope: Scope;
  onChange: (s: Scope) => void;
  departments?: { id: string; name: string }[];
  staff?: Staff[];
};

type AnimatedChevronProps = {
  open: boolean;
  color: string;
};

function AnimatedChevron({ open, color }: AnimatedChevronProps) {
  const rotation = useSharedValue(open ? 180 : 0);

  React.useEffect(() => {
    rotation.value = withTiming(open ? 180 : 0, { duration: chevronMs });
  }, [open, rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animStyle}>
      <ChevronDown size={11} color={color} strokeWidth={2.4} />
    </Animated.View>
  );
}

export function ScopeChips({ scope, onChange, staff = [] }: ScopeChipsProps) {
  const theme = useTheme();
  const [open, setOpen] = useState<"dept" | "person" | null>(null);

  const toggleOpen = (panel: "dept" | "person") => {
    setOpen((prev) => (prev === panel ? null : panel));
  };

  const isDeptActive = scope.kind === "dept";
  const isPersonActive = scope.kind === "person";
  const activePerson = isPersonActive ? staff.find((s) => s.id === scope.value) : undefined;
  const activeDept = isDeptActive ? (scope.value as Department | undefined) : undefined;

  const chipActiveStyle = (active: boolean, accent?: string) => ({
    backgroundColor: active ? (accent ?? theme.colors.brandOrange) : theme.colors.secondary,
    borderColor: active ? (accent ?? theme.colors.brandOrange) : theme.colors.border,
  });

  const chipTextColor = (active: boolean) =>
    active ? "#ffffff" : (theme.colors.mutedForeground as string);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {/* ✦ Mine vakter */}
        <Pressable
          onPress={() => {
            onChange({ kind: "me" });
            setOpen(null);
          }}
          style={[styles.chip, chipActiveStyle(scope.kind === "me")]}
          accessibilityRole="button"
          accessibilityState={{ selected: scope.kind === "me" }}
        >
          <Text style={[styles.chipLabel, { color: chipTextColor(scope.kind === "me") }]}>
            ✦ Mine vakter
          </Text>
        </Pressable>

        {/* Hele teamet */}
        <Pressable
          onPress={() => {
            onChange({ kind: "all" });
            setOpen(null);
          }}
          style={[styles.chip, chipActiveStyle(scope.kind === "all")]}
          accessibilityRole="button"
          accessibilityState={{ selected: scope.kind === "all" }}
        >
          <Text style={[styles.chipLabel, { color: chipTextColor(scope.kind === "all") }]}>
            Hele teamet
          </Text>
        </Pressable>

        {/* Avdeling ▾ */}
        <Pressable
          onPress={() => toggleOpen("dept")}
          style={[
            styles.chip,
            chipActiveStyle(isDeptActive, activeDept ? DEPT_COLORS[activeDept] : undefined),
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: isDeptActive }}
        >
          <Text style={[styles.chipLabel, { color: chipTextColor(isDeptActive) }]}>
            {isDeptActive && activeDept ? DEPT_LABELS[activeDept] : "Avdeling"}
          </Text>
          <AnimatedChevron open={open === "dept"} color={chipTextColor(isDeptActive)} />
        </Pressable>

        {/* Ansatt ▾ */}
        <Pressable
          onPress={() => toggleOpen("person")}
          style={[styles.chip, chipActiveStyle(isPersonActive)]}
          accessibilityRole="button"
          accessibilityState={{ selected: isPersonActive }}
        >
          <Text style={[styles.chipLabel, { color: chipTextColor(isPersonActive) }]}>
            {isPersonActive && activePerson ? activePerson.name.split(" ")[0] : "Ansatt"}
          </Text>
          <AnimatedChevron open={open === "person"} color={chipTextColor(isPersonActive)} />
        </Pressable>
      </ScrollView>

      {/* Avdeling dropdown panel */}
      {open === "dept" && (
        <View
          style={[
            styles.dropdownPanel,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {DEPTS.map((dept) => {
            const isActive = scope.kind === "dept" && scope.value === dept;
            const deptColor = DEPT_COLORS[dept];
            return (
              <Pressable
                key={dept}
                onPress={() => {
                  onChange({ kind: "dept", value: dept });
                  setOpen(null);
                }}
                style={[
                  styles.dropdownRow,
                  isActive && { backgroundColor: withOpacity(deptColor, 0.18) },
                ]}
                accessibilityRole="menuitem"
              >
                <View style={styles.deptRowLeft}>
                  <View style={[styles.deptDot, { backgroundColor: deptColor }]} />
                  <Text
                    style={[
                      styles.deptLabel,
                      {
                        color: theme.colors.foreground,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {DEPT_LABELS[dept]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Ansatt dropdown panel */}
      {open === "person" && staff.length > 0 && (
        <View
          style={[
            styles.dropdownPanel,
            styles.personGrid,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {staff.map((s) => {
            const isActive = scope.kind === "person" && scope.value === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  onChange({ kind: "person", value: s.id });
                  setOpen(null);
                }}
                style={[
                  styles.personCell,
                  isActive && {
                    backgroundColor: withOpacity(s.color, 0.18),
                    borderColor: s.color,
                  },
                ]}
                accessibilityRole="menuitem"
              >
                <Avatar initials={s.initials} color={s.color} size={32} />
                <Text
                  style={[styles.personName, { color: theme.colors.foreground }]}
                  numberOfLines={1}
                >
                  {s.name.split(" ")[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  dropdownPanel: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "column",
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  deptRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deptDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  deptLabel: {
    fontSize: 13.5,
  },
  personGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
  },
  personCell: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 4,
  },
  personName: {
    fontSize: 10.5,
    fontWeight: "600",
    textAlign: "center",
  },
});
