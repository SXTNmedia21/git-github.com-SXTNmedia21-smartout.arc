/**
 * QuickPathCards — Tier 2 of /dashboard/help
 *
 * Four role-personalised navigation shortcuts for users who know what they're
 * hunting and want to skip the Botsson chat entirely. Clicks navigate to
 * anchor sections on the page (v1). Role visibility: employees see only the
 * Onboarding card; managers, admins, and owners see all four.
 *
 * Server Component — no client-side state needed.
 */

import { Calendar, Coins, Compass, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Database } from "@smartout/supabase";

type ProfileRole = Database["public"]["Enums"]["profile_role"];

interface QuickPathCard {
  id: string;
  label: string;
  description: string;
  href: string;
  Icon: LucideIcon;
  /** Roles that can see this card. Empty array = visible to all. */
  allowedRoles: ProfileRole[];
}

const QUICK_PATH_CARDS: QuickPathCard[] = [
  {
    id: "vakter",
    label: "Vakter & vaktbytte",
    description: "Finn vakten din, bytt med kollega, meld fravær.",
    href: "#vakter",
    Icon: Calendar,
    allowedRoles: ["manager", "admin", "owner"],
  },
  {
    id: "lonn",
    label: "Lønn & timer",
    description: "Sjekk timeoversikt, tillegg og lønnsslipp.",
    href: "#lonn",
    Icon: Coins,
    allowedRoles: ["manager", "admin", "owner"],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Kom i gang — prosedyrer, opplæring og klargjøring.",
    href: "#onboarding",
    Icon: Compass,
    allowedRoles: ["employee"], // employee-only: managers/admins/owners use Vakter+Lønn+HMS
  },
  {
    id: "avvik",
    label: "Avvik & HMS",
    description: "Meld avvik, les HMS-rutiner, finn beredskapsplan.",
    href: "#avvik",
    Icon: ShieldAlert,
    allowedRoles: ["manager", "admin", "owner"],
  },
];

function isCardVisible(card: QuickPathCard, role: ProfileRole | null): boolean {
  if (card.allowedRoles.length === 0) return true;
  if (!role) return false;
  return card.allowedRoles.includes(role);
}

export function QuickPathCards(props: { role: ProfileRole | null }) {
  const { role } = props;

  const visibleCards = QUICK_PATH_CARDS.filter((card) => isCardVisible(card, role));

  if (visibleCards.length === 0) return null;

  return (
    <section aria-labelledby="quick-path-heading">
      <h2
        id="quick-path-heading"
        className="text-muted-foreground mb-3 text-sm font-medium tracking-wide uppercase"
      >
        Finn det du leter etter
      </h2>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4" role="list">
        {visibleCards.map((card) => {
          const { id, label, description, href, Icon } = card;
          return (
            <li key={id}>
              <a
                href={href}
                className={[
                  "group border-border bg-card flex flex-col gap-2 rounded-lg border p-4",
                  "text-left transition-colors duration-150",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                ].join(" ")}
              >
                <Icon
                  className="text-muted-foreground group-hover:text-accent-foreground h-5 w-5 transition-colors duration-150"
                  aria-hidden="true"
                />
                <span className="text-foreground text-sm leading-snug font-medium">{label}</span>
                <span className="text-muted-foreground text-xs leading-relaxed">{description}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
