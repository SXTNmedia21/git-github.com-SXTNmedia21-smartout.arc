import { Users, FileSignature, BookOpen, Send } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type PeopleTabDef = {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

// Tab keys MUST point to real routes. "Policys" routes to HMS governance —
// the canonical home for policy authoring. "Innkalling" gets a dedicated
// admin-only invitations view so the tab has a real destination (and active
// state matches via pathname).
export const PEOPLE_TAB_DEFS: readonly PeopleTabDef[] = [
  { key: "/dashboard/people", label: "Ansatte", icon: Users },
  { key: "/dashboard/contracts", label: "Kontrakter", icon: FileSignature },
  { key: "/dashboard/hms/governance", label: "Policys", icon: BookOpen },
  { key: "/dashboard/people/invitations", label: "Innkalling", icon: Send },
] as const;
