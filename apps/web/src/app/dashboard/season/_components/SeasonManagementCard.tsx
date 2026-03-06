"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useSeasons } from "../_hooks";

type Props = {
  isDark: boolean;
  onSeasonCreated: (seasonId: string) => void;
};

export function SeasonManagementCard({ isDark, onSeasonCreated }: Props) {
  const { createSeason } = useSeasons();
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
          onSeasonCreated(season.season_id);
        },
      },
    );
  };

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  const inputClass = isDark
    ? "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
    : "w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-blue-500";

  const labelClass = `mb-2 block text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`;

  return (
    <div className={cardClass}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Sesonghåndtering
          </h2>
          <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            Opprett en ny sesong for å starte budsjettering og faktoroppsett.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
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
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleCreateSeason}
          disabled={createSeason.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {createSeason.isPending ? "Oppretter..." : "Opprett sesong"}
        </button>
      </div>
    </div>
  );
}
