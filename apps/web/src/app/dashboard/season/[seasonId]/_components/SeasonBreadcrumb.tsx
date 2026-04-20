import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Breadcrumb for a season detail page.
 * Links back to the year-wheel canvas for the year the season belongs to,
 * then names the season and its status.
 */
type Props = {
  year: number;
  seasonName: string;
  status: "draft" | "active" | "archived";
};

const STATUS_LABEL: Record<Props["status"], string> = {
  draft: "Utkast",
  active: "Aktiv",
  archived: "Arkivert",
};

export function SeasonBreadcrumb({ year, seasonName, status }: Props) {
  return (
    <nav
      className="text-muted-foreground mb-4 flex items-center gap-2 text-sm"
      aria-label="Breadcrumb"
    >
      <Link
        href={`/dashboard/year-wheel?year=${year}`}
        className="hover:text-foreground inline-flex items-center gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Årshjul {year}
      </Link>
      <span>/</span>
      <span className="text-foreground">{seasonName}</span>
      <span>·</span>
      <span>{STATUS_LABEL[status]}</span>
    </nav>
  );
}
