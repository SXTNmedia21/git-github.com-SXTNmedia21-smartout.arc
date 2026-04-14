"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { useSeasons } from "../_hooks";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Props = {
  onSeasonCreated: (seasonId: string) => void;
};

export function SeasonCreateSheet({ onSeasonCreated }: Props) {
  const { t } = useTranslation("dashboard");
  const { createSeason } = useSeasons();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreateSeason = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t("yearWheel.season_name_required"));
      return;
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      toast.error(t("yearWheel.end_date_invalid"));
      return;
    }

    createSeason.mutate(
      {
        name: trimmedName,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      {
        onSuccess: (season) => {
          setName("");
          setStartDate("");
          setEndDate("");
          setOpen(false);
          onSeasonCreated(season.season_id);
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95">
          <Plus className="h-4 w-4" />
          {t("yearWheel.create_new_season")}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="border-border bg-card w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-card-foreground">{t("yearWheel.new_season")}</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            {t("yearWheel.new_season_description")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5">
          <div>
            <label className="text-muted-foreground mb-2 block text-xs font-bold tracking-wider uppercase">
              {t("yearWheel.season_name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("yearWheel.season_name_placeholder")}
              className="border-input bg-background text-foreground focus:border-primary w-full rounded-xl border px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-muted-foreground mb-2 block text-xs font-bold tracking-wider uppercase">
              {t("yearWheel.start_date_optional")}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="border-input bg-background text-foreground focus:border-primary w-full rounded-xl border px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-muted-foreground mb-2 block text-xs font-bold tracking-wider uppercase">
              {t("yearWheel.end_date_optional")}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="border-input bg-background text-foreground focus:border-primary w-full rounded-xl border px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCreateSeason}
              disabled={createSeason.isPending}
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {createSeason.isPending ? t("yearWheel.creating") : t("yearWheel.create_season")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
