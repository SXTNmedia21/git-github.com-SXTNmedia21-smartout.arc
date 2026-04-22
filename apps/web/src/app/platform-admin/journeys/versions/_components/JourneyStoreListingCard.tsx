// ============================================
// JourneyStoreListingCard.tsx — ADR-0177 store-listing card schema
//
// The card schema is the contract that close-feature.sh gates on. The TS
// interface below is the SINGLE TypeScript mirror of that schema — any
// consumer (CI gate, future store page, list row summary) reads through
// this file, never re-declares the shape.
//
// M4 renders a lightweight card surface suitable for the list view and
// a future store listing. M5 will extend with Fjernkontroll state — NOT
// M4's concern.
// ============================================

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { FileCode2, ScrollText, Clapperboard, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { JourneyVersionStatus } from "../_lib/version-status";

// ─── Capability list (mirrors ADR-0173 / CapabilityName "journey.*") ─
export type JourneyCapabilityName =
  | "journey.run_dev"
  | "journey.publish_mission"
  | "journey.publish_guide"
  | "journey.run_guided";

// ─── Artefact manifest (5 artefacts from "one IR → five artefacts") ─
// M4 surfaces the four listed in ADR-0177 §JourneyStoreListingCard; the
// fifth ("Fjernkontroll card") is the surface reading the rest.
export interface JourneyArtefactManifest {
  mission: boolean;
  guide: boolean;
  playwright: boolean;
  inference_pattern: boolean;
}

/**
 * Canonical store-listing card schema (ADR-0177 §Store-listing card schema).
 * close-feature.sh validates `status === 'ready_publish'` + all four
 * artefacts present before allowing merge.
 *
 * The `name` + `summary` fields carry i18n KEYS (not resolved strings) so
 * a future I18nProvider can swap locales without re-rendering the server tree.
 */
export interface JourneyStoreListingCard {
  journey_version_id: string;
  name: string; // i18n key, e.g. "journey.onboarding-employee.name"
  summary: string; // i18n key, e.g. "journey.onboarding-employee.summary"
  status: JourneyVersionStatus;
  ready_publish_at: string | null;
  last_dev_run: {
    run_id: string;
    completed_at: string | null;
    success: boolean;
  } | null;
  capability_names: ReadonlyArray<JourneyCapabilityName>;
  artefacts: JourneyArtefactManifest;
}

// ─── Presentation ────────────────────────────────────────────────────

const ARTEFACT_META: Record<
  keyof JourneyArtefactManifest,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  mission: { label: "Mission", Icon: Clapperboard },
  guide: { label: "Guide", Icon: ScrollText },
  playwright: { label: "Playwright", Icon: FileCode2 },
  inference_pattern: { label: "Inference", Icon: Activity },
};

/**
 * Small presentational card. Safe in list grids and in the future store
 * view alike. Respects Nordic Split motion guard (useReducedMotion()) and
 * uses CSS-token classes only.
 */
export function JourneyStoreListingCardView({
  card,
  href,
  className,
}: {
  card: JourneyStoreListingCard;
  /** Optional link target — when provided the whole card is wrapped in <Link>. */
  href?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();

  const body = (
    <Card
      className={cn("border-border bg-background hover:bg-muted/40 transition-colors", className)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="font-heading text-foreground truncate text-lg">
            {card.name}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">{card.summary}</p>
        </div>
        <StatusBadge status={card.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Capability chips — token-only, no per-capability hue */}
        <div className="flex flex-wrap gap-1.5">
          {card.capability_names.map((name) => (
            <span
              key={name}
              className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs"
            >
              {name}
            </span>
          ))}
        </div>

        {/* Artefact manifest row */}
        <div className="flex flex-wrap gap-3">
          {(
            Object.entries(ARTEFACT_META) as ReadonlyArray<
              [keyof JourneyArtefactManifest, (typeof ARTEFACT_META)[keyof JourneyArtefactManifest]]
            >
          ).map(([key, meta]) => {
            const present = card.artefacts[key];
            return (
              <div
                key={key}
                className={cn(
                  "inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                  // Emphasis from token intensity, not hue. Present = solid
                  // muted surface; absent = transparent outline.
                  present
                    ? "border-border bg-muted text-foreground"
                    : "border-border/60 text-muted-foreground",
                )}
                aria-label={`${meta.label}: ${present ? "present" : "missing"}`}
              >
                <meta.Icon className="h-3.5 w-3.5" />
                <span>{meta.label}</span>
              </div>
            );
          })}
        </div>

        {/* Last dev run + ready-publish timestamp row */}
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
          {card.last_dev_run ? (
            <span className="font-mono">
              last run:&nbsp;
              {card.last_dev_run.completed_at
                ? new Date(card.last_dev_run.completed_at).toISOString().slice(0, 19) + "Z"
                : "in progress"}
              &nbsp;·&nbsp;{card.last_dev_run.success ? "pass" : "fail"}
            </span>
          ) : (
            <span className="italic">no dev runs yet</span>
          )}
          {card.ready_publish_at && (
            <span className="font-mono">
              ready since {new Date(card.ready_publish_at).toISOString().slice(0, 10)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return body;

  // Framer-motion wrap for subtle hover lift — respects reduced motion.
  return (
    <Link href={href} className="block" aria-label={card.name}>
      <motion.div
        whileHover={reduce ? undefined : { y: -2 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 35, damping: 22, mass: 2.2 }
        }
      >
        {body}
      </motion.div>
    </Link>
  );
}
