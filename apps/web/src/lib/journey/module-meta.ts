// ============================================
// module-meta.ts
// Display metadata for journey modules, priorities, actors, and platforms.
// Used by the journey list and detail pages to render badges,
// icons, and color-coded labels for each dimension.
// Connected to: packages/types/src/journey.ts (JourneyModule, ModuleMeta types)
// ============================================

import type { JourneyModule, ModuleMeta } from "@smartout/types";

/**
 * Display metadata for each of the 18 journey modules.
 * Icon names reference lucide-react icon components.
 * Colors are hex values for module badges.
 *
 * Why: Centralizes module display info so list pages, detail pages,
 * and filter dropdowns all use the same labels and colors.
 */
export const MODULE_META: Record<JourneyModule, Omit<ModuleMeta, "code">> = {
  core: { name: "Core", icon: "Key", color: "#6366f1" },
  onboarding: { name: "Onboarding", icon: "Rocket", color: "#14b8a6" },
  org: { name: "Org Structure", icon: "Building2", color: "#06b6d4" },
  scheduling: { name: "Scheduling", icon: "Calendar", color: "#0ea5e9" },
  operations: { name: "Operations", icon: "Zap", color: "#f59e0b" },
  haccp: { name: "HACCP", icon: "Thermometer", color: "#ef4444" },
  training: { name: "Training", icon: "GraduationCap", color: "#8b5cf6" },
  absence: { name: "Absence", icon: "Palmtree", color: "#a855f7" },
  payroll: { name: "Payroll", icon: "Banknote", color: "#f97316" },
  communication: {
    name: "Communication",
    icon: "MessageSquare",
    color: "#10b981",
  },
  reports: { name: "Reports", icon: "BarChart3", color: "#6366f1" },
  settings: { name: "Settings", icon: "Settings", color: "#64748b" },
  ai: { name: "AI (Botsson)", icon: "Bot", color: "#ec4899" },
  season: { name: "Season", icon: "Trophy", color: "#eab308" },
  governance: { name: "Governance", icon: "ScrollText", color: "#78716c" },
  contracts: { name: "Contracts", icon: "FileSignature", color: "#92400e" },
  certifications: {
    name: "Certifications",
    icon: "Award",
    color: "#0d9488",
  },
  meta: { name: "Journey Portal", icon: "Target", color: "#1e293b" },
};

/**
 * Display metadata for journey priority levels.
 * P0 = critical path, P3 = future/nice-to-have.
 * bg values use Tailwind classes for badge backgrounds.
 */
export const PRIORITY_META = {
  P0: {
    label: "P0 Critical",
    color: "#ef4444",
    bg: "bg-red-50 dark:bg-red-950/20",
  },
  P1: {
    label: "P1 Important",
    color: "#f59e0b",
    bg: "bg-amber-50 dark:bg-amber-950/20",
  },
  P2: {
    label: "P2 Nice to have",
    color: "#6b7280",
    bg: "bg-gray-50 dark:bg-gray-950/20",
  },
  P3: {
    label: "P3 Future",
    color: "#cbd5e1",
    bg: "bg-slate-50 dark:bg-slate-950/20",
  },
} as const;

/**
 * Display metadata for journey actor types.
 * Labels are in Norwegian since they appear in the UI.
 */
export const ACTOR_META = {
  employee: { label: "Ansatt", color: "#3b82f6" },
  trainee: { label: "Trainee", color: "#14b8a6" },
  manager: { label: "Leder", color: "#f59e0b" },
  admin: { label: "Admin", color: "#f97316" },
  owner: { label: "Eier", color: "#8b5cf6" },
  all: { label: "Alle", color: "#6b7280" },
} as const;

/**
 * Display metadata for target platforms.
 * Icon names reference lucide-react icon components.
 */
export const PLATFORM_META = {
  mobile: { label: "Mobile", icon: "Smartphone" },
  desktop: { label: "Desktop", icon: "Monitor" },
  both: { label: "Both", icon: "Laptop" },
} as const;
