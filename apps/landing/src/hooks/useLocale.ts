"use client";

import { usePathname } from "next/navigation";

/**
 * Derives locale from the current URL pathname.
 * /en/* → "en", everything else → "nb"
 */
export function useLocale(): "nb" | "en" {
  const pathname = usePathname();
  if (!pathname) return "nb";
  return pathname.startsWith("/en/") || pathname === "/en" ? "en" : "nb";
}
