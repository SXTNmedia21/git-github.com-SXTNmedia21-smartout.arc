"use client";

/**
 * Searchable employee combobox for selecting a workspace profile.
 * Used in SpokespersonEditor to assign a spokesperson.
 *
 * Fetches profiles from the workspace using the user-scoped Supabase client
 * (RLS restricts profiles to the caller's workspace automatically).
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectedProfile = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  job_title: string | null;
  role: string;
};

type Props = {
  workspaceId: string;
  selectedProfileId?: string;
  onSelect: (profileId: string, profile: SelectedProfile) => void;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Searchable combobox for picking an employee from the workspace.
 * Shows avatar, name, and job title for each profile.
 */
export default function EmployeePicker({ workspaceId, selectedProfileId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles", workspaceId],
    queryFn: async (): Promise<SelectedProfile[]> => {
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, job_title, role")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("display_name");

      if (error) throw new Error(error.message);
      return (data ?? []) as SelectedProfile[];
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });

  const selected = profiles.find((p) => p.profile_id === selectedProfileId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading}
        >
          {selected ? (
            <span className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selected.avatar_url ?? undefined} alt={selected.display_name} />
                <AvatarFallback className="text-xs">
                  {getInitials(selected.display_name)}
                </AvatarFallback>
              </Avatar>
              <span>{selected.display_name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Velg ansatt…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Søk etter ansatt…" />
          <CommandList>
            <CommandEmpty>Ingen ansatte funnet.</CommandEmpty>
            <CommandGroup heading="Ansatte">
              {profiles.map((profile) => (
                <CommandItem
                  key={profile.profile_id}
                  value={profile.display_name}
                  onSelect={() => {
                    onSelect(profile.profile_id, profile);
                    setOpen(false);
                  }}
                >
                  <Avatar className="mr-2 h-6 w-6">
                    <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
                    <AvatarFallback className="text-xs">
                      {getInitials(profile.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm">{profile.display_name}</span>
                    {profile.job_title && (
                      <span className="text-muted-foreground text-xs">{profile.job_title}</span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      selectedProfileId === profile.profile_id ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
