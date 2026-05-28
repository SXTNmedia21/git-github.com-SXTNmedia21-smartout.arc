"use client";

/**
 * LocationSwitcherPill — filters the Gantt chart by Område (location/area)
 * within the current workspace.
 *
 * URL state: ?location=<location_id> | ?location=all (default: "all").
 * The parent (ManagerTimelineShell) reads this param to filter Band rows.
 *
 * Composes shadcn Popover + Command + Button primitives.
 * Locations loaded via useLocationsForWorkspace (packages/data) — L-0177
 * fail-fast pattern, never silent workspace fallback.
 *
 * Accessibility:
 *   - Trigger: aria-haspopup="listbox", aria-expanded, aria-label describing
 *     the current selection.
 *   - Options: role="option", aria-selected on active item.
 *
 * Telemetry:
 *   oppgaver.location_filter_changed — emitted on every selection change.
 *   L-0176: emit() call-site is in the same file as the handler (same commit).
 *
 * Design: Nordic Split tokens only. No OKLCH literals (ADR-0366).
 * No zinc/gray/slate hardcoded classes (ADR-0361).
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useLocationsForWorkspace } from "@smartout/data";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { cn } from "@/lib/utils";

type Props = {
  workspaceId: string;
  /** Current actor profile_id — required for emit() (L-0177). */
  profileId: string;
};

const ALL = "all";

export function LocationSwitcherPill({ workspaceId, profileId }: Props) {
  const { t } = useTranslation("oppgaver");
  const { t: tOrg } = useTranslation("org");

  const router = useRouter();
  const searchParams = useSearchParams();
  const activeLocationId = searchParams.get("location") ?? ALL;

  const [open, setOpen] = useState(false);

  const locationsQ = useLocationsForWorkspace(workspaceId);
  const locations = useMemo(() => locationsQ.data ?? [], [locationsQ.data]);

  const activeName = useMemo(() => {
    if (activeLocationId === ALL || !locations.length) {
      return `${t("location_switcher.all_label")} · ${locations.length}`;
    }
    const found = locations.find((l) => l.location_id === activeLocationId);
    return found?.name ?? t("location_switcher.all_label");
  }, [activeLocationId, locations, t]);

  const handleSelect = useCallback(
    (locationId: string) => {
      const prev = activeLocationId;
      const next = locationId;

      // Update URL searchParam
      const params = new URLSearchParams(searchParams.toString());
      if (next === ALL) {
        params.delete("location");
      } else {
        params.set("location", next);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
      setOpen(false);

      // L-0177 + L-0176: emit only when IDs are non-empty
      if (!workspaceId || !profileId) return;
      void emit({
        event: "oppgaver.location_filter_changed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            from_location: prev,
            to_location: next,
          },
        },
      });
    },
    [activeLocationId, searchParams, router, workspaceId, profileId],
  );

  const triggerAriaLabel = `${tOrg("omrade.label")}: ${activeName}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={triggerAriaLabel}
          data-testid="location-switcher-pill"
          className={cn(
            "bg-popover border-border text-foreground h-8 gap-1.5 rounded-full px-3 text-sm",
            "hover:bg-muted transition-colors",
          )}
        >
          {/* Dot indicator — shown in brand-orange when a specific location is active */}
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              activeLocationId !== ALL ? "bg-warning" : "bg-muted-foreground/40",
            )}
            aria-hidden="true"
          />
          <MapPin className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
          <span className="max-w-[140px] truncate">{activeName}</span>
          <ChevronDown
            className={cn(
              "text-muted-foreground h-3.5 w-3.5 transition-transform duration-150",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="start" sideOffset={6}>
        <Command>
          <CommandInput placeholder={t("location_switcher.search_placeholder")} className="h-9" />
          <CommandList>
            <CommandEmpty>{t("location_switcher.no_results")}</CommandEmpty>
            <CommandGroup>
              {/* "Alle områder" reset option */}
              <CommandItem
                value={ALL}
                onSelect={() => handleSelect(ALL)}
                aria-selected={activeLocationId === ALL}
                data-testid="location-switcher-option-all"
              >
                <span
                  className={cn("bg-muted-foreground/40 mr-2 inline-block size-2 rounded-full")}
                  aria-hidden="true"
                />
                {t("location_switcher.all_option")}
                <span className="text-muted-foreground ml-auto font-mono text-xs">
                  · {locations.length}
                </span>
              </CommandItem>

              {locations.map((loc) => (
                <CommandItem
                  key={loc.location_id}
                  value={loc.name}
                  onSelect={() => handleSelect(loc.location_id)}
                  aria-selected={activeLocationId === loc.location_id}
                  data-testid={`location-switcher-option-${loc.slug}`}
                >
                  <span
                    className={cn(
                      "mr-2 inline-block size-2 rounded-full",
                      activeLocationId === loc.location_id
                        ? "bg-warning"
                        : "bg-muted-foreground/40",
                    )}
                    aria-hidden="true"
                  />
                  {loc.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
