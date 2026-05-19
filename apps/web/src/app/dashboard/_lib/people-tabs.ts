import { Users, ShieldUser, FileSignature, GraduationCap } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type PeopleTabDef = {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Ansatte hub tabs per docs/design/sitemap/web/00-CANONICAL.md §3.
 *
 * Tab keys are full pathnames so PageTabNav variant="route" can drive them
 * directly. Active state derived from pathname match.
 *
 * - Liste: master person table + status filters (Aktive/Trainee/Invitert/...)
 * - Roller: profile.role distribution per workspace (SM-2 phase A shipped)
 * - Kontrakter: /dashboard/people/contracts (SM-2-followup-contracts shipped 2026-05-19)
 * - Trening: workforce readiness placeholder (SM-2-followup-training wires content)
 *
 * Dropped per canonical spec:
 * - Policys: was cross-jump to /hms/governance — spec §3.3 forbids
 *   cross-group navigation tabs (one hub = one sidebar group).
 * - Innkalling: semantics moved to calendar event in Planlegging (spec §5.1).
 *   Workspace-invitation state surfaces as Invitert filter chip on Liste
 *   (spec §5.3 + §6).
 */
export const PEOPLE_TAB_DEFS: readonly PeopleTabDef[] = [
  { key: "/dashboard/people", label: "Liste", icon: Users },
  { key: "/dashboard/people/roles", label: "Roller", icon: ShieldUser },
  { key: "/dashboard/people/contracts", label: "Kontrakter", icon: FileSignature },
  { key: "/dashboard/people/training", label: "Trening", icon: GraduationCap },
] as const;
