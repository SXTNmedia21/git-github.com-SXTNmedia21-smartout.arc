"use client";

// ============================================
// CockpitQuickActions.tsx
// Row of four quick-action buttons on cockpit:
// Chat, Announce, Daily note, Reservation.
// Chat navigates to the dedicated chat page.
// The others open Sheets without leaving cockpit.
// ============================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Megaphone, NotebookPen, CalendarPlus } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { AnnounceSheet } from "./sheets/AnnounceSheet";
import { DailyNoteSheet } from "./sheets/DailyNoteSheet";
import { ReservationSheet } from "./sheets/ReservationSheet";

type CockpitQuickActionsProps = {
  /** Anchor date this cockpit is focused on (YYYY-MM-DD). */
  anchorDate: string;
  /** Current user's profile id — needed for QuickBroadcast. */
  profileId: string | null;
};

/**
 * Renders the cockpit's quick-action row. Each action defaults to the
 * current anchor date so "Nytt dagsnotat" / "Ny reservasjon" always
 * lands on the day the operator is looking at.
 */
export function CockpitQuickActions({ anchorDate, profileId }: CockpitQuickActionsProps) {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const [openSheet, setOpenSheet] = useState<"announce" | "daily-note" | "reservation" | null>(
    null,
  );

  return (
    <>
      <div
        data-testid="cockpit-quick-actions"
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label={t("cockpit.actions_title")}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard/komm/chat")}
          className="h-9 gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          {t("cockpit.actions_chat")}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenSheet("announce")}
          disabled={!profileId}
          className="h-9 gap-2"
        >
          <Megaphone className="h-4 w-4" />
          {t("cockpit.actions_announce")}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenSheet("daily-note")}
          className="h-9 gap-2"
        >
          <NotebookPen className="h-4 w-4" />
          {t("cockpit.actions_daily_note")}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenSheet("reservation")}
          className="h-9 gap-2"
        >
          <CalendarPlus className="h-4 w-4" />
          {t("cockpit.actions_reservation")}
        </Button>
      </div>

      {profileId && (
        <AnnounceSheet
          open={openSheet === "announce"}
          onOpenChange={(open) => setOpenSheet(open ? "announce" : null)}
          profileId={profileId}
        />
      )}
      <DailyNoteSheet
        open={openSheet === "daily-note"}
        onOpenChange={(open) => setOpenSheet(open ? "daily-note" : null)}
        anchorDate={anchorDate}
      />
      <ReservationSheet
        open={openSheet === "reservation"}
        onOpenChange={(open) => setOpenSheet(open ? "reservation" : null)}
        anchorDate={anchorDate}
      />
    </>
  );
}
