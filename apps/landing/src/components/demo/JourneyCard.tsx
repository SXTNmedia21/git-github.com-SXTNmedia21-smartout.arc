// ============================================
// JourneyCard.tsx
// Card component for the demo hub page (/demo).
// Each card shows a journey's icon, persona badge,
// title, subtitle, duration, and a Start button.
// Connected to: app/demo/page.tsx (hub page)
// ============================================

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Clock,
  CalendarDays,
  GraduationCap,
  AlertTriangle,
  Thermometer,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import type { JourneyPersona } from "./journeys/types";

/** Map icon names (from journey config) to Lucide components */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Clock,
  CalendarDays,
  GraduationCap,
  AlertTriangle,
  Thermometer,
  UserPlus,
};

/** Accent color → Tailwind class mapping for card borders and accents */
const ACCENT_STYLES: Record<
  string,
  { border: string; iconBg: string; iconText: string; ctaBg: string; ctaText: string }
> = {
  orange: {
    border: "border-orange-500/20 hover:border-orange-500/40",
    iconBg: "bg-orange-500/10",
    iconText: "text-orange-400",
    ctaBg: "bg-orange-500/10 hover:bg-orange-500/20",
    ctaText: "text-orange-300",
  },
  cyan: {
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-400",
    ctaBg: "bg-cyan-500/10 hover:bg-cyan-500/20",
    ctaText: "text-cyan-300",
  },
  purple: {
    border: "border-purple-500/20 hover:border-purple-500/40",
    iconBg: "bg-purple-500/10",
    iconText: "text-purple-400",
    ctaBg: "bg-purple-500/10 hover:bg-purple-500/20",
    ctaText: "text-purple-300",
  },
  amber: {
    border: "border-amber-500/20 hover:border-amber-500/40",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
    ctaBg: "bg-amber-500/10 hover:bg-amber-500/20",
    ctaText: "text-amber-300",
  },
  emerald: {
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
    ctaBg: "bg-emerald-500/10 hover:bg-emerald-500/20",
    ctaText: "text-emerald-300",
  },
  rose: {
    border: "border-rose-500/20 hover:border-rose-500/40",
    iconBg: "bg-rose-500/10",
    iconText: "text-rose-400",
    ctaBg: "bg-rose-500/10 hover:bg-rose-500/20",
    ctaText: "text-rose-300",
  },
};

/** Persona badge labels and colors */
const PERSONA_BADGE: Record<JourneyPersona, { label: string; className: string }> = {
  ansatt: { label: "Ansatt", className: "border-orange-500/30 bg-orange-500/10 text-orange-300" },
  leder: { label: "Leder", className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  "ny-ansatt": { label: "Ny ansatt", className: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
};

type JourneyCardProps = {
  id: string;
  title: string;
  subtitle: string;
  persona: JourneyPersona;
  duration: string;
  icon: string;
  accentColor: string;
  /** Whether this journey has steps (is playable) */
  hasSteps: boolean;
  /** Framer Motion stagger index for entrance animation */
  index: number;
};

/**
 * A single journey card for the demo hub page.
 *
 * Why Link instead of button + router.push: The /demo/[journey]
 * route is a real page, so a proper <a> tag gives better
 * accessibility and allows right-click → open in new tab.
 */
export function JourneyCard({
  id,
  title,
  subtitle,
  persona,
  duration,
  icon,
  accentColor,
  hasSteps,
  index,
}: JourneyCardProps) {
  const IconComponent = ICON_MAP[icon];
  const accent = ACCENT_STYLES[accentColor] ?? ACCENT_STYLES.orange!;
  const badge = PERSONA_BADGE[persona];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <Link
        href={hasSteps ? `/demo/${id}` : "#"}
        className={`group flex h-full flex-col rounded-2xl border bg-[#0a0a0c] p-5 transition-all ${accent.border} ${!hasSteps ? "pointer-events-none opacity-50" : ""}`}
        aria-disabled={!hasSteps}
      >
        {/* Top row — icon + persona badge */}
        <div className="flex items-start justify-between">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent.iconBg}`}>
            {IconComponent && <IconComponent className={`h-5 w-5 ${accent.iconText}`} />}
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        {/* Title + subtitle */}
        <h2 className="mt-4 text-base font-bold text-white">{title}</h2>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-400">{subtitle}</p>

        {/* Bottom — duration + CTA */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-zinc-500">{duration}</span>
          {hasSteps ? (
            <span
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${accent.ctaBg} ${accent.ctaText}`}
            >
              Start
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          ) : (
            <span className="text-xs text-zinc-600">Kommer snart</span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
