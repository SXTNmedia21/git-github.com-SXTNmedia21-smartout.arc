/**
 * ActionHeader — Consistent header for all action screens.
 * ← back | title (serif italic, foreground) | spacer
 */

import React, { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";

type ActionHeaderProps = {
  title: string;
  fallbackRoute?: string;
};

export function ActionHeader({ title, fallbackRoute = "/(app)/(me)" }: ActionHeaderProps) {
  const s = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const handleBack = useCallback(() => {
    Haptics.selectionAsync();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate(fallbackRoute as Parameters<typeof router.navigate>[0]);
    }
  }, [router, fallbackRoute]);

  return (
    <View style={s.bar}>
      <Pressable onPress={handleBack} hitSlop={12} style={s.btn}>
        <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
      </Pressable>
      <Text style={s.title}>{title}</Text>
      <View style={s.spacer} />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  bar: {
    height: 56,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.md,
  },
  btn: {
    width: 44,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  title: {
    fontSize: 22,
    fontStyle: "italic" as const,
    fontWeight: "300" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },
  spacer: {
    width: 44,
  },
}));
