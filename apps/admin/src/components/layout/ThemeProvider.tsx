"use client";

/**
 * ThemeProvider.tsx — next-themes wrapper
 *
 * Copy from apps/landing/src/components/theme-provider.tsx.
 */
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
