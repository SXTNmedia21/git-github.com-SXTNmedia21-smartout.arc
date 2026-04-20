/**
 * OrphanBadge (React Native) — dashed-border empty-state treatment.
 *
 * Mirrors the web primitive. Accepts an optional Lucide icon via
 * `lucide-react-native` which consumers pass in — keeps packages/ui from
 * taking a hard dep on the native lucide variant.
 */

import * as React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { nativeTheme } from "@smartout/design-tokens/native";

export type OrphanBadgeIconRenderer = (props: {
  size: number;
  color: string;
}) => React.ReactElement;

export type OrphanBadgeNativeProps = {
  label: string;
  renderIcon?: OrphanBadgeIconRenderer;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  colorScheme?: "light" | "dark";
};

export function OrphanBadge({
  label,
  renderIcon,
  iconSize = 20,
  style,
  colorScheme = "dark",
}: OrphanBadgeNativeProps) {
  const theme = colorScheme === "light" ? nativeTheme.light : nativeTheme.dark;

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.border,
          backgroundColor: theme.muted,
        },
        style,
      ]}
      accessibilityRole="text"
    >
      {renderIcon ? renderIcon({ size: iconSize, color: theme.mutedForeground }) : null}
      <Text
        style={{
          fontFamily: "Geist-Regular",
          fontSize: 12,
          color: theme.mutedForeground,
          marginLeft: renderIcon ? 8 : 0,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    alignSelf: "flex-start",
  },
});
