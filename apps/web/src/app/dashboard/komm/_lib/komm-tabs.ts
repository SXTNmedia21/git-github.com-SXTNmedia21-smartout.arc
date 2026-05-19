/**
 * komm-tabs.ts — Kommunikasjon tab definitions (SM-5).
 *
 * Single source of truth for the four tabs in /dashboard/komm.
 * Tab order follows spec §3: workflow frequency highest → lowest.
 *
 * Key convention (matches PageTabNav variant="route"):
 *   key: "" → href = KOMM_BASE_PATH (Kanaler = root, no sub-segment)
 *   key: "skranke" → href = /dashboard/komm/skranke
 *   key: "nyheter"  → href = /dashboard/komm/nyheter
 *   key: "varsler"  → href = /dashboard/komm/varsler
 *
 * Labels are i18n keys (resolved in KommLayout via useTranslation).
 * Icons are Lucide — provisional; align with Nordic Split icon review.
 */

import { MessageSquare, LifeBuoy, Newspaper, Bell } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

/** The four Kommunikasjon tab key values (empty string = root). */
export type KommTabKey = "" | "skranke" | "nyheter" | "varsler";

/**
 * The base path for all Kommunikasjon tabs.
 * PageTabNav variant="route" derives hrefs as: key === "" ? basePath : basePath + "/" + key.
 */
export const KOMM_BASE_PATH = "/dashboard/komm" as const;

/** Internal tab descriptor — keeps i18n key + icon separate from PageTab<K> shape. */
export type KommTabDef = {
  key: KommTabKey;
  /** i18n key relative to the "komm" namespace, e.g. "tab_kanaler". */
  labelKey: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

/** Ordered tab definitions. Translate labelKey via useTranslation("komm") in the layout. */
export const KOMM_TAB_DEFS: KommTabDef[] = [
  { key: "", labelKey: "tab_kanaler", icon: MessageSquare },
  { key: "skranke", labelKey: "tab_skranke", icon: LifeBuoy },
  { key: "nyheter", labelKey: "tab_nyheter", icon: Newspaper },
  { key: "varsler", labelKey: "tab_varsler", icon: Bell },
];
