"use client";

/**
 * FerieplanPageClient — client island for the Ferieplan tab.
 *
 * Receives vacation absences pre-fetched on the server (RSC pattern per ADR-0021).
 * Read-only in SM-4. Mutations (approve/reject) are a follow-up sortie.
 *
 * View-mode toggle: Liste (active) | Tidslinjer (disabled until SM-6).
 * Spec: docs/design/sitemap/web/00-CANONICAL.md §3, §4.3, §6.
 */
import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

export type VacationAbsence = {
  schedule_absence_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  profile: { display_name: string } | null;
};

type ViewMode = "liste" | "tidslinjer";

function formatDate(dateStr: string): string {
  // ISO date string → readable date
  const d = new Date(dateStr);
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

export function FerieplanPageClient({ absences }: { absences: VacationAbsence[] }) {
  const t = useTranslations("schedule");
  const [viewMode, setViewMode] = useState<ViewMode>("liste");

  return (
    <div className="flex flex-col gap-4 p-4 pt-2 md:p-6 md:pt-3">
      {/* Page header: description + view-mode toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-foreground text-2xl leading-tight tracking-tight">
            {t("tabs.ferieplan")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {absences.length > 0 ? `${absences.length} ferieønsker` : t("ferieplan.empty")}
          </p>
        </div>

        {/* View-mode toggle — spec §4.3. Tidslinjer disabled until SM-6. */}
        <div
          className="flex items-center gap-1 self-start"
          role="group"
          aria-label={t("view_mode.aria_label")}
        >
          <button
            type="button"
            onClick={() => setViewMode("liste")}
            aria-pressed={viewMode === "liste"}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              viewMode === "liste"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("view_mode.liste")}
          </button>
          <button
            type="button"
            disabled
            title={t("view_mode.tidslinjer_tooltip")}
            aria-disabled="true"
            className="text-muted-foreground/40 cursor-not-allowed rounded-md px-2 py-1 text-xs font-medium"
          >
            {t("view_mode.tidslinjer")}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {absences.length === 0 && (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm">
          <span className="text-4xl">🏖️</span>
          <p>{t("ferieplan.empty")}</p>
        </div>
      )}

      {/* Absence list (Liste view) */}
      {viewMode === "liste" && absences.length > 0 && (
        <ul className="flex flex-col gap-2">
          {absences.map((absence) => (
            <li
              key={absence.schedule_absence_id}
              className="border-border bg-card flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
            >
              {/* Employee name + date range */}
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {absence.profile?.display_name ?? absence.employee_id}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                </p>
                {absence.reason && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs italic">
                    {absence.reason}
                  </p>
                )}
              </div>

              {/* Status chip */}
              <StatusChip status={absence.status} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusChip — inline status badge. All colors via CSS variables (ADR-0366).
// ---------------------------------------------------------------------------
function StatusChip({
  status,
  t,
}: {
  status: "pending" | "approved" | "rejected";
  t: ReturnType<typeof useTranslations<"schedule">>;
}) {
  if (status === "approved") {
    return (
      <span className="bg-muted text-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
        <Check className="h-3 w-3" aria-hidden />
        {t("ferieplan.status_approved")}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="bg-destructive/10 text-destructive inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
        {t("ferieplan.status_rejected")}
      </span>
    );
  }
  // pending
  return (
    <span className="bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
      {t("ferieplan.status_pending")}
    </span>
  );
}
