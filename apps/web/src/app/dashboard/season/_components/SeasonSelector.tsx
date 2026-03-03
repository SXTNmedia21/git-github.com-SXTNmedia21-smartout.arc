"use client";

import { useSeasons } from "../_hooks";

type Props = {
  selectedSeasonId: string | null;
  onSelect: (seasonId: string) => void;
  isDark: boolean;
};

export function SeasonSelector({ selectedSeasonId, onSelect, isDark }: Props) {
  const { seasons, isLoading } = useSeasons();

  if (isLoading) {
    return (
      <div
        className={`h-10 w-64 animate-pulse rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
      />
    );
  }

  if (seasons.length === 0) {
    return (
      <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Ingen sesonger opprettet enn&aring;.
      </p>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    archived: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  };

  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedSeasonId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors outline-none ${
          isDark
            ? "border-zinc-700 bg-zinc-900 text-white focus:border-blue-500"
            : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500"
        }`}
      >
        <option value="" disabled>
          Velg sesong...
        </option>
        {seasons.map((s) => (
          <option key={s.season_id} value={s.season_id}>
            {s.name} ({s.status})
          </option>
        ))}
      </select>

      {selectedSeasonId &&
        (() => {
          const selected = seasons.find((s) => s.season_id === selectedSeasonId);
          if (!selected) return null;
          return (
            <span
              className={`rounded border px-2 py-0.5 text-xs font-bold ${statusColors[selected.status] ?? statusColors.draft}`}
            >
              {selected.status.toUpperCase()}
            </span>
          );
        })()}
    </div>
  );
}
