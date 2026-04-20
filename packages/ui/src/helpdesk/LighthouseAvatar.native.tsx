/**
 * LighthouseAvatar (React Native) — avatar with ResponsibilityOrb halo.
 *
 * Mirrors the web primitive: the orb extends 40% beyond the avatar radius
 * and sits behind it. Fallback initials render when `avatarUrl` is missing
 * or `onError` fires.
 */

import * as React from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { nativeTheme } from "@smartout/design-tokens/native";
import { ResponsibilityOrb } from "./ResponsibilityOrb.native";
import type { OrbHaloState, TicketStatus } from "./types";

export type LighthouseAvatarNativeProps = {
  avatarUrl?: string | null;
  name: string;
  size: number;
  haloState?: OrbHaloState;
  style?: StyleProp<ViewStyle>;
  colorScheme?: "light" | "dark";
};

const HALO_TO_STATUS: Record<OrbHaloState, TicketStatus> = {
  idle: "complete",
  active: "active",
  waiting: "waiting",
};

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function LighthouseAvatar({
  avatarUrl,
  name,
  size,
  haloState = "idle",
  style,
  colorScheme = "dark",
}: LighthouseAvatarNativeProps) {
  const [imageErrored, setImageErrored] = React.useState(false);
  const theme = colorScheme === "light" ? nativeTheme.light : nativeTheme.dark;
  const orbSize = Math.round(size * 1.4);
  const orbOffset = Math.round((orbSize - size) / 2);
  const initials = computeInitials(name);
  const showImage = avatarUrl && !imageErrored;

  return (
    <View
      style={[
        { width: orbSize, height: orbSize, alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ResponsibilityOrb status={HALO_TO_STATUS[haloState]} size={orbSize} />
      </View>
      <View
        style={{
          position: "absolute",
          top: orbOffset,
          left: orbOffset,
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: theme.muted,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityLabel={name}
        accessibilityRole="image"
      >
        {showImage ? (
          <Image
            source={{ uri: avatarUrl! }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            onError={() => setImageErrored(true)}
          />
        ) : (
          <Text
            style={{
              fontFamily: "GeistMono-Regular",
              fontSize: Math.round(size * 0.38),
              color: theme.foreground,
              opacity: 0.8,
            }}
          >
            {initials}
          </Text>
        )}
      </View>
    </View>
  );
}
