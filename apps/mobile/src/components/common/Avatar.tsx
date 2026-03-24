/**
 * Avatar — Profile image with initials fallback.
 * Shows first letter of first + last name when no image is available.
 */
import React, { useState } from "react";
import { View, Text, Image, type ViewStyle } from "react-native";
import { createStyles } from "@/theme";

type AvatarSize = "sm" | "md" | "lg" | "xl";

type AvatarProps = {
  /** Full name — used to extract initials */
  name: string;
  /** Profile image URL */
  imageUrl?: string | null;
  /** Size preset */
  size?: AvatarSize;
  /** Custom style override */
  style?: ViewStyle;
};

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: 12,
  md: 15,
  lg: 22,
  xl: 30,
};

/**
 * Extracts up to 2 initials from a name string.
 * "Anna Larsen" → "AL", "Kristian" → "K"
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]![0]?.toUpperCase() ?? "?";
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Generates a deterministic background color from a name.
 * Ensures consistent color for the same person across renders.
 */
function getColorFromName(name: string): string {
  const palette = [
    "#e85c0d",
    "#14b8a6",
    "#8b5cf6",
    "#d97706",
    "#3b82f6",
    "#22c55e",
    "#ef4444",
    "#ec4899",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length]!;
}

export function Avatar({ name, imageUrl, size = "md", style }: AvatarProps) {
  const styles = useStyles();
  const [imageError, setImageError] = useState(false);
  const dimension = sizeMap[size];
  const fontSize = fontSizeMap[size];
  const showImage = imageUrl && !imageError;

  const containerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
    backgroundColor: showImage ? undefined : getColorFromName(name),
  };

  return (
    <View style={[styles.container, containerStyle, style]}>
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            { width: dimension, height: dimension, borderRadius: dimension / 2 },
          ]}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    resizeMode: "cover",
  },
  initials: {
    color: theme.colors.primaryForeground,
    fontWeight: theme.fontWeights.semibold,
  },
}));
