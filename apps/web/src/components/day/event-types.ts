// apps/web/src/components/day/event-types.ts
//
// Single source of truth for Dagslinjen event-type metadata.
//
// WHY: DayTimelineStrip and DayEventList both defined their own local TYPE_META
// blocks — this caused drift when adding new event types. This module consolidates
// them so both surfaces always agree on icons, shapes, and colors.
//
// Migration: DayTimelineStrip uses stripFill/stripRing/stripIconColor.
//            DayEventList uses listIconColor/listBg/listBorder.
//            ClusterMarker uses the shared meta for dominant-type rendering.

import type { DayEventType } from "@/app/dashboard/_hooks/use-day-timeline-events";
import { Calendar, CheckCircle2, AlertTriangle, StickyNote, LogIn, LogOut } from "lucide-react";

export type ShapeKind = "dot" | "flag" | "diamond" | "arrow-down" | "arrow-up" | "ring";

export type EventTypeMeta = {
  label: string;
  /** Filter pill label — plural/Norwegian form used in DayEventList. */
  filterLabel: string;
  icon: typeof Calendar;
  shape: ShapeKind;
  /** Tailwind class for strip fill color (use /80 for soft). */
  stripFill: string;
  /** Ring color for strip halo. */
  stripRing: string;
  /** Icon color on strip markers (white for solid shapes, inherits when ring-only). */
  stripIconColor: string;
  /** Icon color class used in the event list rows. */
  listIconColor: string;
  /** Background class for list row cards. */
  listBg: string;
  /** Border class for list row cards. */
  listBorder: string;
};

export const EVENT_TYPE_ORDER: DayEventType[] = [
  "booking",
  "note",
  "task",
  "deviation",
  "checkin",
  "checkout",
];

export const EVENT_TYPE_META: Record<DayEventType, EventTypeMeta> = {
  booking: {
    label: "Booking",
    filterLabel: "Bookinger",
    icon: Calendar,
    shape: "dot",
    stripFill: "bg-blue-400/90 dark:bg-blue-500/80",
    stripRing: "ring-blue-300/40 dark:ring-blue-500/25",
    stripIconColor: "text-white",
    listIconColor: "text-blue-600 dark:text-blue-400",
    listBg: "bg-blue-50 dark:bg-blue-500/10",
    listBorder: "border-blue-200 dark:border-blue-500/20",
  },
  note: {
    label: "Notat",
    filterLabel: "Notater",
    icon: StickyNote,
    shape: "flag",
    stripFill: "bg-purple-400/90 dark:bg-purple-500/80",
    stripRing: "ring-purple-300/40 dark:ring-purple-500/25",
    stripIconColor: "text-white",
    listIconColor: "text-purple-600 dark:text-purple-400",
    listBg: "bg-purple-50 dark:bg-purple-500/10",
    listBorder: "border-purple-200 dark:border-purple-500/20",
  },
  task: {
    label: "Oppgave",
    filterLabel: "Oppgaver",
    icon: CheckCircle2,
    shape: "ring",
    stripFill: "bg-emerald-400/85 dark:bg-emerald-500/75",
    stripRing: "ring-emerald-300/40 dark:ring-emerald-500/25",
    stripIconColor: "text-white",
    listIconColor: "text-emerald-600 dark:text-emerald-400",
    listBg: "bg-emerald-50 dark:bg-emerald-500/10",
    listBorder: "border-emerald-200 dark:border-emerald-500/20",
  },
  deviation: {
    label: "Avvik",
    filterLabel: "Avvik",
    icon: AlertTriangle,
    shape: "diamond",
    stripFill: "bg-rose-400/90 dark:bg-rose-500/80",
    stripRing: "ring-rose-300/40 dark:ring-rose-500/25",
    stripIconColor: "text-white",
    listIconColor: "text-rose-600 dark:text-rose-400",
    listBg: "bg-rose-50 dark:bg-rose-500/10",
    listBorder: "border-rose-200 dark:border-rose-500/20",
  },
  checkin: {
    label: "Innsjekk",
    filterLabel: "Innsjekk",
    icon: LogIn,
    shape: "arrow-down",
    stripFill: "bg-amber-400/90 dark:bg-amber-500/80",
    stripRing: "ring-amber-300/40 dark:ring-amber-500/25",
    stripIconColor: "text-white",
    listIconColor: "text-amber-600 dark:text-amber-400",
    listBg: "bg-amber-50 dark:bg-amber-500/10",
    listBorder: "border-amber-200 dark:border-amber-500/20",
  },
  checkout: {
    label: "Utsjekk",
    filterLabel: "Utsjekk",
    icon: LogOut,
    shape: "arrow-up",
    stripFill: "bg-muted-foreground/60",
    stripRing: "ring-muted-foreground/20",
    stripIconColor: "text-background",
    listIconColor: "text-muted-foreground",
    listBg: "bg-muted",
    listBorder: "border-border",
  },
};

export const EVENT_FILTER_KEYS: (DayEventType | "all")[] = [
  "all",
  "booking",
  "note",
  "task",
  "deviation",
  "checkin",
  "checkout",
];
