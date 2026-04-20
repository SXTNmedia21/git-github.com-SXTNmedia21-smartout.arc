"use client";

/**
 * ResponsibleRepCombobox — Spec §1.3.
 *
 * shadcn Command inside Popover. Trigger uses the LighthouseAvatar pattern
 * for selected state; empty state shows the dashed ring matching
 * OrphanBadge language.
 *
 * Eligibility is enforced by the server action — the client filter here
 * is a UX niceness, not a security boundary.
 */

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LighthouseAvatar } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ResponsibleRep = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
};

export type ResponsibleRepComboboxProps = {
  reps: ResponsibleRep[];
  value: string | null;
  onChange: (profileId: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
};

export function ResponsibleRepCombobox({
  reps,
  value,
  onChange,
  disabled,
  triggerClassName,
}: ResponsibleRepComboboxProps) {
  const { t } = useTranslation("helpdesk");
  const [open, setOpen] = React.useState(false);
  const selected = reps.find((r) => r.profile_id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={selected ? selected.display_name : t("desk_combobox.placeholder")}
          className={cn(
            "group border-border/60 hover:border-border flex w-full items-center gap-3 rounded-xl border bg-transparent px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            triggerClassName,
          )}
        >
          {selected ? (
            <>
              <LighthouseAvatar
                avatarUrl={selected.avatar_url}
                name={selected.display_name}
                size={32}
                haloState="active"
              />
              <span className="text-foreground flex-1 truncate text-sm">
                {selected.display_name}
              </span>
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="border-border/60 flex h-10 w-10 items-center justify-center rounded-full border border-dashed"
              >
                <Circle size={16} className="text-muted-foreground" strokeDasharray="3 3" />
              </span>
              <span className="text-muted-foreground flex-1 truncate text-sm">
                {t("desk_combobox.placeholder")}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("desk_combobox.placeholder")} />
          <CommandList>
            <CommandEmpty>{t("desk_combobox.empty")}</CommandEmpty>
            <CommandGroup>
              {reps.map((rep) => (
                <CommandItem
                  key={rep.profile_id}
                  value={rep.display_name}
                  onSelect={() => {
                    onChange(rep.profile_id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 py-2"
                >
                  <LighthouseAvatar
                    avatarUrl={rep.avatar_url}
                    name={rep.display_name}
                    size={28}
                    haloState={rep.profile_id === value ? "active" : "idle"}
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="text-foreground text-sm">{rep.display_name}</span>
                    <span className="text-muted-foreground text-xs capitalize">{rep.role}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
