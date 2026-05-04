"use client";

/**
 * ResponsibleRepCombobox — Phase 3 visual redesign (web-settings.jsx).
 *
 * Rescued from apps/web/src/app/dashboard/komm/desks/_components/ (deleted
 * with the legacy desks admin surface). Used by SkrankeTab to let admins
 * pick a responsible profile when upgrading a channel to helpdesk, or
 * reassigning an existing helpdesk to a new rep.
 *
 * Trigger surface mirrors the prototype Ansvarlig card:
 *  - LighthouseAvatar size=36 halo="idle"
 *  - Name (14px medium) + role + "Active now" sub
 *  - "Bytt" affordance + chevron-down on the right
 *
 * Empty-state keeps the dashed circle from Phase 2 — matches OrphanBadge.
 *
 * Canonical LighthouseAvatar comes from @/components/helpdesk-orb (ADR-0165
 * Phase 1 primitive). Eligibility is enforced by the server action —
 * the client filter is UX nicety, not a security boundary.
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
import { LighthouseAvatar } from "@/components/helpdesk-orb";
import { useTranslation } from "@smartout/i18n";
import { ChevronDown, Circle } from "lucide-react";
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
          data-testid="responsible-rep-combobox"
          aria-label={selected ? selected.display_name : t("desk_combobox.placeholder")}
          className={cn(
            "bg-muted border-border hover:border-foreground/20 focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            triggerClassName,
          )}
        >
          {selected ? (
            <>
              <LighthouseAvatar
                name={selected.display_name}
                src={selected.avatar_url ?? undefined}
                size={36}
                halo="idle"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{selected.display_name}</div>
                <div className="text-muted-foreground truncate text-xs capitalize">
                  {selected.role || t("skranke_tab.rep_role_fallback")} ·{" "}
                  {t("skranke_tab.responsible_active_now")}
                </div>
              </div>
              <span className="text-muted-foreground text-[13px]">
                {t("skranke_tab.responsible_change")}
              </span>
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="border-border flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-dashed"
              >
                <Circle size={16} className="text-muted-foreground" strokeDasharray="3 3" />
              </span>
              <span className="text-muted-foreground flex-1 truncate text-sm">
                {t("desk_combobox.placeholder")}
              </span>
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
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
                  data-testid={`responsible-rep-option-${rep.profile_id}`}
                  onSelect={() => {
                    onChange(rep.profile_id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 py-2"
                >
                  <LighthouseAvatar
                    name={rep.display_name}
                    src={rep.avatar_url ?? undefined}
                    size={28}
                    halo={rep.profile_id === value ? "active" : "idle"}
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="text-foreground text-sm">{rep.display_name}</span>
                    <span className="text-muted-foreground text-xs capitalize">
                      {rep.role || t("skranke_tab.rep_role_fallback")}
                    </span>
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
