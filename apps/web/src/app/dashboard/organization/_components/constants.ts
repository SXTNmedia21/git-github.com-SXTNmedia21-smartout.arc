import type { ElementType } from "react";
import {
  UtensilsCrossed,
  Wine,
  Coffee,
  ConciergeBell,
  Users,
  Truck,
  ShieldCheck,
  Wrench,
  BookOpen,
  Music,
  Sparkles,
  HeartPulse,
  Building2,
  Sun,
  Calendar,
  Archive,
  MapPin,
} from "lucide-react";

export const ICON_COMPONENTS: Record<string, ElementType> = {
  "utensils-crossed": UtensilsCrossed,
  wine: Wine,
  coffee: Coffee,
  "concierge-bell": ConciergeBell,
  users: Users,
  truck: Truck,
  "shield-check": ShieldCheck,
  wrench: Wrench,
  "book-open": BookOpen,
  music: Music,
  sparkles: Sparkles,
  "heart-pulse": HeartPulse,
};

export const LOCATION_TYPE_CONFIG: Record<
  string,
  { label: string; icon: ElementType; color: string; bg: string }
> = {
  main: {
    label: "Main",
    icon: Building2,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  outdoor: {
    label: "Outdoor",
    icon: Sun,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  kitchen: {
    label: "Kitchen",
    icon: UtensilsCrossed,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  event: {
    label: "Event",
    icon: Calendar,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  storage: {
    label: "Storage",
    icon: Archive,
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
  },
  other: {
    label: "Other",
    icon: MapPin,
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
  },
};

export const TEAM_TYPE_CONFIG: Record<
  string,
  { label: string; border: string; bg: string; text: string }
> = {
  operational: {
    label: "Operational",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  access: {
    label: "Access",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  cross_department: {
    label: "Cross-dept",
    border: "border-violet-500/30",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
  },
  seasonal: {
    label: "Seasonal",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  custom: {
    label: "Custom",
    border: "border-border",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
};

export const ASSET_TYPE_OPTIONS = [
  { value: "equipment", label: "Equipment" },
  { value: "safety", label: "Safety" },
  { value: "storage", label: "Storage" },
  { value: "station", label: "Station" },
  { value: "other", label: "Other" },
] as const;

export const ROLE_OPTIONS = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
] as const;
