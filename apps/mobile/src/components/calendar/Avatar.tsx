/**
 * Avatar — Round initials avatar.
 *
 * Renders a circle with 2-char initials. Background is the staff color at 22%
 * opacity; text and border use the full color. When ring=true (Pontus' own row),
 * a 2px solid ring + outer gap shadow is applied to visually distinguish
 * the current user's avatar.
 *
 * Size defaults to 28px (CompactShiftRow standard); pass size prop to override.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { withOpacity } from "@/theme/colors";

type AvatarProps = {
  /** 2-char initials string. */
  initials: string;
  /** Staff color hex — used for bg tint, text, border. */
  color: string;
  /** When true, renders the ring indicator (own user). */
  ring?: boolean;
  /** Diameter in points. Default 28. */
  size?: number;
};

export function Avatar({ initials, color, ring = false, size = 28 }: AvatarProps) {
  const fontSize = Math.round(size * 0.36);

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withOpacity(color, 0.22),
          borderColor: ring ? color : withOpacity(color, 0.30),
          borderWidth: ring ? 2 : 1,
          // Outer gap shadow simulates the `box-shadow: 0 0 0 2px bg` from handoff
          shadowColor: ring ? color : "transparent",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: ring ? 0.35 : 0,
          shadowRadius: ring ? 3 : 0,
          elevation: ring ? 2 : 0,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize,
            color,
          },
        ]}
        numberOfLines={1}
      >
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  initials: {
    fontWeight: "700",
    letterSpacing: 0.3,
    lineHeight: undefined,
  },
});
