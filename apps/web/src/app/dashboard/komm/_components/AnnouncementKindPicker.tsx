"use client";

/**
 * AnnouncementKindPicker — 9-value kind selector for announcement V2 composer.
 *
 * Groups options semantically (General / People / Operations / Documents / External).
 * Controlled: value + onChange. i18n keys in komm.nyheter.kind.*.
 * Emits announcement.kind_changed telemetry on each change.
 *
 * CHECK-paring: caller (NyheterClient) reads allowedLinkTypes() from this module
 * to filter EntityLinkPicker options when kind changes.
 */

import { emit, nonEmpty } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AnnouncementKind =
  | "general"
  | "new_menu"
  | "new_hire"
  | "staff_event"
  | "schedule_change"
  | "policy_update"
  | "external"
  | "celebration"
  | "system_message";

export type AnnouncementTier = "social" | "work" | "external";

/**
 * Default tier per kind — derived from spec §11 and CHECK constraints.
 * Used by AnnouncementTierPicker to auto-select when kind changes.
 */
export const DEFAULT_TIER_FOR_KIND: Record<AnnouncementKind, AnnouncementTier> = {
  general: "work",
  new_menu: "work",
  new_hire: "social",
  staff_event: "social",
  schedule_change: "work",
  policy_update: "external",
  external: "work",
  celebration: "social",
  system_message: "external",
};

/**
 * Allowed linked_entity_type values per kind — derived from DB CHECK constraint
 * in 20260620140200_announcement_meta_table.sql (meta_kind_link_consistent).
 *
 * null entry = no link allowed for this kind (ELSE false in CHECK).
 */
export type AnnouncementLinkedEntityType =
  | "staff_event"
  | "schedule_shift"
  | "policy"
  | "protocol"
  | "profile"
  | "menu_document"
  | "external_url";

export const ALLOWED_LINK_TYPES: Record<AnnouncementKind, AnnouncementLinkedEntityType[] | null> = {
  general: null, // CHECK: NULL only
  staff_event: ["staff_event"],
  new_hire: ["profile"],
  policy_update: ["policy"], // CHECK: REQUIRED (must be policy)
  schedule_change: ["schedule_shift"],
  new_menu: ["menu_document", "external_url"],
  external: ["external_url"],
  celebration: null, // CHECK: ELSE false — no link
  system_message: null, // CHECK: ELSE false — no link
};

// NOTE: celebration and system_message are intentionally excluded from GROUPS.
// Both kinds are service-role only: celebration is cron-auto-published (ADR-0372),
// system_message is reserved for platform ops. JWT callers (managers) receive
// CELEBRATION_SERVICE_ROLE_ONLY / PERMISSION_DENIED from the RPC — removing them
// from the picker prevents the UX trap. Both remain in AnnouncementKind type union
// so mobile can render them as read-only badges on incoming auto-published messages.
const GROUPS = [
  {
    labelKey: "nyheter.kind.group_general" as const,
    kinds: ["general"] as AnnouncementKind[],
  },
  {
    labelKey: "nyheter.kind.group_people" as const,
    kinds: ["new_hire"] as AnnouncementKind[],
  },
  {
    labelKey: "nyheter.kind.group_operations" as const,
    kinds: ["staff_event", "schedule_change"] as AnnouncementKind[],
  },
  {
    labelKey: "nyheter.kind.group_documents" as const,
    kinds: ["new_menu", "policy_update"] as AnnouncementKind[],
  },
  {
    labelKey: "nyheter.kind.group_external" as const,
    kinds: ["external"] as AnnouncementKind[],
  },
] as const;

type AnnouncementKindPickerProps = {
  value: AnnouncementKind;
  onChange: (next: AnnouncementKind, autoTier: AnnouncementTier) => void;
  profileId: string;
};

export function AnnouncementKindPicker({
  value,
  onChange,
  profileId,
}: AnnouncementKindPickerProps) {
  const { t } = useTranslation("komm");
  const { workspace } = useWorkspace();

  function handleChange(next: string) {
    const nextKind = next as AnnouncementKind;
    const autoTier = DEFAULT_TIER_FOR_KIND[nextKind];
    const tierAutoUpdated = autoTier !== DEFAULT_TIER_FOR_KIND[value];

    // Telemetry: announcement.kind_changed — posthog only (registry §12.3)
    void emit({
      event: "announcement.kind_changed",
      workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        from_kind: value,
        to_kind: nextKind,
        tier_auto_updated: tierAutoUpdated,
      },
    });

    onChange(nextKind, autoTier);
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-full" data-testid="announcement-kind-picker">
        <SelectValue placeholder={t("nyheter.kind.placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {GROUPS.map((group) => (
          <SelectGroup key={group.labelKey}>
            <SelectLabel className="text-muted-foreground text-xs">{t(group.labelKey)}</SelectLabel>
            {group.kinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                <span className="flex flex-col gap-0.5">
                  <span>{t(`nyheter.kind.${kind}`)}</span>
                  <span className="text-muted-foreground text-xs">
                    {t(`nyheter.kind.helper.${kind}`)}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
