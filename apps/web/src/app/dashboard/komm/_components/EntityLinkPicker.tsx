"use client";

/**
 * EntityLinkPicker — two-step entity link selector for announcement V2 composer.
 *
 * Step 1: pick entity type from a grouped dropdown (Events / Documents / People / External).
 * Step 2: pick entity id via Combobox search (DB query per type) or text input for external_url.
 *
 * CHECK-paring: accepts allowedTypes prop from parent. When kind='policy_update' the parent
 * passes allowedTypes=['policy'] and forcedType='policy', which locks step 1 and goes
 * straight to step 2. Derived from meta_kind_link_consistent constraint in migration 140200.
 *
 * i18n: komm.nyheter.link.*
 */

import { useState, useCallback } from "react";
import { X, Search, ChevronDown } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnnouncementKind, AnnouncementLinkedEntityType } from "./AnnouncementKindPicker";
import { ALLOWED_LINK_TYPES } from "./AnnouncementKindPicker";

export type EntityLinkValue = {
  type: AnnouncementLinkedEntityType;
  id: string;
} | null;

type EntityLinkPickerProps = {
  value: EntityLinkValue;
  onChange: (next: EntityLinkValue) => void;
  kind: AnnouncementKind;
};

// Grouped display for step-1 type picker
const TYPE_GROUPS = [
  {
    labelKey: "nyheter.link.group_events" as const,
    types: ["staff_event", "schedule_shift"] as AnnouncementLinkedEntityType[],
  },
  {
    labelKey: "nyheter.link.group_documents" as const,
    types: ["policy", "protocol", "menu_document"] as AnnouncementLinkedEntityType[],
  },
  {
    labelKey: "nyheter.link.group_people" as const,
    types: ["profile"] as AnnouncementLinkedEntityType[],
  },
  {
    labelKey: "nyheter.link.group_external" as const,
    types: ["external_url"] as AnnouncementLinkedEntityType[],
  },
] as const;

type SearchResult = { id: string; label: string };

/** Typed switch for entity searches — avoids dynamic table name TS errors. */
async function queryEntities(
  supabase: ReturnType<typeof createClient>,
  type: Exclude<AnnouncementLinkedEntityType, "external_url">,
  workspaceId: string,
  query: string,
): Promise<SearchResult[]> {
  const ilike = query.trim() ? `%${query.trim()}%` : "%";
  switch (type) {
    case "staff_event": {
      const { data, error } = await supabase
        .from("staff_event")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .ilike("name", ilike)
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, label: r.name ?? r.id }));
    }
    case "schedule_shift": {
      const { data, error } = await supabase
        .from("schedule_shift")
        .select("id, start_time, position")
        .eq("workspace_id", workspaceId)
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        label: r.position
          ? `${r.position} — ${new Date(r.start_time).toLocaleDateString("nb-NO")}`
          : r.id,
      }));
    }
    case "policy": {
      const { data, error } = await supabase
        .from("policy")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .ilike("name", ilike)
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, label: r.name ?? r.id }));
    }
    case "protocol": {
      const { data, error } = await supabase
        .from("protocol")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .ilike("name", ilike)
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, label: r.name ?? r.id }));
    }
    case "profile": {
      const { data, error } = await supabase
        .from("profile")
        .select("id, display_name")
        .eq("workspace_id", workspaceId)
        .ilike("display_name", ilike)
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, label: r.display_name ?? r.id }));
    }
    case "menu_document": {
      const { data, error } = await supabase
        .from("menu_document")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .ilike("name", ilike)
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, label: r.name ?? r.id }));
    }
  }
}

function useEntitySearch(type: AnnouncementLinkedEntityType | null, query: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery<SearchResult[]>({
    queryKey: ["entity-link-search", workspaceId, type, query],
    enabled: !!type && type !== "external_url",
    queryFn: async (): Promise<SearchResult[]> => {
      if (!type || type === "external_url") return [];
      const supabase = createClient();
      return queryEntities(supabase, type, workspaceId, query);
    },
    staleTime: 30_000,
  });
}

export function EntityLinkPicker({ value, onChange, kind }: EntityLinkPickerProps) {
  const { t } = useTranslation("komm");
  const allowedTypes = ALLOWED_LINK_TYPES[kind];

  // null allowedTypes = this kind doesn't support links → render nothing
  if (allowedTypes === null) return null;

  // Single allowed type means type picker is locked (e.g. policy_update → policy)
  const forcedType = allowedTypes.length === 1 ? allowedTypes[0] : null;

  return (
    <EntityLinkPickerInner
      value={value}
      onChange={onChange}
      allowedTypes={allowedTypes}
      forcedType={forcedType ?? null}
    />
  );
}

// Inner component separated so hooks don't run when allowedTypes===null
function EntityLinkPickerInner({
  value,
  onChange,
  allowedTypes,
  forcedType,
}: {
  value: EntityLinkValue;
  onChange: (next: EntityLinkValue) => void;
  allowedTypes: readonly AnnouncementLinkedEntityType[];
  forcedType: AnnouncementLinkedEntityType | null;
}) {
  const { t } = useTranslation("komm");
  const [selectedType, setSelectedType] = useState<AnnouncementLinkedEntityType | null>(
    forcedType ?? value?.type ?? null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [externalUrl, setExternalUrl] = useState(value?.type === "external_url" ? value.id : "");

  const searchResults = useEntitySearch(selectedType, searchQuery);

  const handleTypeChange = useCallback(
    (next: string) => {
      const type = next as AnnouncementLinkedEntityType;
      setSelectedType(type);
      setSearchQuery("");
      onChange(null); // reset id when type changes
    },
    [onChange],
  );

  const handleEntitySelect = useCallback(
    (id: string) => {
      if (!selectedType) return;
      onChange({ type: selectedType, id });
      setComboOpen(false);
    },
    [selectedType, onChange],
  );

  const handleExternalUrlBlur = useCallback(() => {
    const url = externalUrl.trim();
    if (url) {
      onChange({ type: "external_url", id: url });
    } else {
      onChange(null);
    }
  }, [externalUrl, onChange]);

  const handleClear = useCallback(() => {
    setSelectedType(forcedType ?? null);
    setSearchQuery("");
    setExternalUrl("");
    setComboOpen(false);
    onChange(null);
  }, [forcedType, onChange]);

  // Filtered groups: only show groups with at least one allowed type
  const visibleGroups = TYPE_GROUPS.map((g) => ({
    ...g,
    types: g.types.filter((t) => allowedTypes.includes(t)),
  })).filter((g) => g.types.length > 0);

  const selectedEntityLabel =
    value && value.type !== "external_url"
      ? (searchResults.data?.find((r) => r.id === value.id)?.label ?? value.id)
      : (value?.id ?? "");

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{t("nyheter.link.label")}</Label>

      <div className="flex items-center gap-2">
        {/* Step 1: type picker (hidden if forced) */}
        {!forcedType && (
          <Select value={selectedType ?? ""} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue placeholder={t("nyheter.link.choose_type")} />
            </SelectTrigger>
            <SelectContent>
              {visibleGroups.map((group) => (
                <SelectGroup key={group.labelKey}>
                  <SelectLabel className="text-muted-foreground text-xs">
                    {t(group.labelKey)}
                  </SelectLabel>
                  {group.types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`nyheter.link.type.${type}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Step 2a: external_url text input */}
        {selectedType === "external_url" && (
          <Input
            className="flex-1"
            placeholder={t("nyheter.link.external_url_placeholder")}
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            onBlur={handleExternalUrlBlur}
          />
        )}

        {/* Step 2b: DB entity combobox */}
        {selectedType && selectedType !== "external_url" && (
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className={cn("flex-1 justify-between truncate", !value && "text-muted-foreground")}
              >
                <span className="truncate">
                  {value ? selectedEntityLabel : t("nyheter.link.choose_entity")}
                </span>
                <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={t("nyheter.link.search_placeholder")}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  {searchResults.isLoading && (
                    <CommandEmpty>{t("nyheter.link.loading")}</CommandEmpty>
                  )}
                  {!searchResults.isLoading && (
                    <CommandEmpty>{t("nyheter.link.no_results")}</CommandEmpty>
                  )}
                  <CommandGroup>
                    {searchResults.data?.map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.id}
                        onSelect={() => handleEntitySelect(result.id)}
                      >
                        {result.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear button */}
        {(value || selectedType) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleClear}
            aria-label={t("nyheter.link.clear")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
