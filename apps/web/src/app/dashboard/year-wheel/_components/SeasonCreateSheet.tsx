"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
  isDark: boolean;
  onSeasonCreated: (seasonId: string) => void;
};

export function SeasonCreateSheet({ isDark, onSeasonCreated }: Props) {
  const { createSeason } = useSeasons();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreateSeason = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Sesongnavn er påkrevd");
      return;
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      toast.error("Sluttdato kan ikke være tidligere enn startdato");
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

  const inputClass = isDark
    ? "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
    : "w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-blue-500";

  const labelClass = `mb-2 block text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95">
          <Plus className="h-4 w-4" />
          Opprett ny sesong
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={`w-full sm:max-w-md ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "bg-white"}`}
      >
        <SheetHeader className="mb-6">
          <SheetTitle className={isDark ? "text-white" : "text-zinc-900"}>
            Opprett ny sesong
          </SheetTitle>
          <SheetDescription className={isDark ? "text-zinc-400" : "text-zinc-500"}>
            Opprett en ny sesong for å starte budsjettering og faktoroppsett.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5">
          <div>
            <label className={labelClass}>Sesongnavn</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="f.eks. Sommersesong 2026"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Startdato (valgfri)</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Sluttdato (valgfri)</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputClass}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCreateSeason}
              disabled={createSeason.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {createSeason.isPending ? "Oppretter..." : "Opprett sesong"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
