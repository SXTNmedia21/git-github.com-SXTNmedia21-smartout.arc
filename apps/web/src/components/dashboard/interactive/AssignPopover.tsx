"use client";

// AssignPopover — profile selector popover for assigning tasks or shifts to employees.
// Queries active profiles in the current workspace and filters by search input.
// Used by TaskSwiperCard and PrepActionCards.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@smartout/i18n";

type AssignPopoverProps = {
  trigger: React.ReactNode;
  onAssign: (profileId: string, displayName: string) => void;
};

export function AssignPopover({ trigger, onAssign }: AssignPopoverProps) {
  const { t } = useTranslation("dashboard");
  const { workspace } = useWorkspace();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Only fetch when popover is open — avoids unnecessary requests
  const { data: profiles } = useQuery({
    queryKey: ["dashboard", "assignable-profiles", workspace.workspace_id],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("display_name")
        .limit(50);
      if (error) throw error;
      return data as { profile_id: string; display_name: string | null }[];
    },
  });

  const filtered = (profiles ?? []).filter((p) =>
    (p.display_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <Input
          placeholder={t("interactive.swiper_assign")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-xs"
          autoFocus
        />
        <div className="max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.profile_id}
              type="button"
              onClick={() => {
                onAssign(p.profile_id, p.display_name ?? "");
                setOpen(false);
              }}
              className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
            >
              {/* Avatar initials — display_name may be null for incomplete profiles */}
              <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
                {(p.display_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <span>{p.display_name ?? "—"}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
