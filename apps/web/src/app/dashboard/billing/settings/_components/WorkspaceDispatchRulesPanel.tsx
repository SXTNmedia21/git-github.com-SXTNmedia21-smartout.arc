"use client";

import { useMemo, useState } from "react";
import type { BillingDispatchRule } from "@smartout/billing";
import { useTranslation } from "@smartout/i18n";
import { Info, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { WorkspaceDispatchRuleSheet } from "./WorkspaceDispatchRuleSheet";
import { WorkspaceEditDispatchRuleDialog } from "./WorkspaceEditDispatchRuleDialog";

// WorkspaceDispatchRulesPanel — two-section panel per spec §3.6.
//
// Section 1 "Fra Smartout": platform baseline rules rendered read-only
// with an info tooltip pointing operators at the suppress workflow.
// Muted background keeps them visually distinct from the editable set.
//
// Section 2 "Dine regler": full CRUD on the caller's workspace rules.
// action='suppress' with matching (channel, trigger_event, target)
// dedup-key undertrykker en platform-default per ADR-0127.
//
// All strings go through @smartout/i18n (nb-NO) per spec §9 — workspace
// UI MUST be translated.

type Props = {
  platformRules: BillingDispatchRule[];
  workspaceRules: BillingDispatchRule[];
  workspaceIds: string[];
  workspaceNames: Map<string, string>;
};

export function WorkspaceDispatchRulesPanel({
  platformRules,
  workspaceRules,
  workspaceIds,
  workspaceNames,
}: Props) {
  const { t } = useTranslation("billing");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingRule = useMemo<BillingDispatchRule | null>(
    () => workspaceRules.find((r) => r.dispatch_rule_id === editingId) ?? null,
    [workspaceRules, editingId],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8">
        <header className="space-y-1">
          <h1 className="font-heading text-2xl">{t("dispatch_settings.page_title")}</h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("dispatch_settings.page_description")}
          </p>
        </header>

        <FromSmartoutSection rules={platformRules} />

        <YourRulesSection
          rules={workspaceRules}
          onCreate={() => setCreateOpen(true)}
          onEdit={(id) => setEditingId(id)}
        />

        <WorkspaceDispatchRuleSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceIds={workspaceIds}
          workspaceNames={workspaceNames}
        />
        <WorkspaceEditDispatchRuleDialog
          rule={editingRule}
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
}

// ─── Section 1 — "Fra Smartout" (platform defaults, read-only) ─────
function FromSmartoutSection({ rules }: { rules: BillingDispatchRule[] }) {
  const { t } = useTranslation("billing");

  return (
    <section className="bg-muted/50 border-border/60 space-y-3 rounded-xl border p-4">
      <header className="space-y-1">
        <h2 className="font-heading flex items-center gap-2 text-lg">
          {t("dispatch_settings.from_smartout_section")}
        </h2>
        <p className="text-muted-foreground text-xs">
          {t("dispatch_settings.from_smartout_description")}
        </p>
      </header>

      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("dispatch_settings.no_platform_rules")}</p>
      ) : (
        <div className="border-border/40 bg-background/40 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dispatch_settings.rule_row.event_column")}</TableHead>
                <TableHead>{t("dispatch_settings.rule_row.channel_column")}</TableHead>
                <TableHead>{t("dispatch_settings.rule_row.recipient_column")}</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.dispatch_rule_id}>
                  <TableCell className="font-mono text-xs">{rule.trigger_event}</TableCell>
                  <TableCell>{getChannelLabel(t, rule.channel)}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {describeTarget(rule.target as Record<string, unknown>)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground inline-flex size-7 items-center justify-center rounded-full">
                          <Info className="size-4" aria-hidden />
                          <span className="sr-only">Info</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72 text-xs">
                        {t("dispatch_settings.from_smartout_info_tooltip")}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

// ─── Section 2 — "Dine regler" (workspace-admin CRUD) ──────────────
function YourRulesSection({
  rules,
  onCreate,
  onEdit,
}: {
  rules: BillingDispatchRule[];
  onCreate: () => void;
  onEdit: (id: string) => void;
}) {
  const { t } = useTranslation("billing");

  return (
    <section className="space-y-3">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-heading text-lg">{t("dispatch_settings.your_rules_section")}</h2>
          <p className="text-muted-foreground max-w-prose text-xs">
            {t("dispatch_settings.your_rules_description")}
          </p>
        </div>
        <Button type="button" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1">{t("dispatch_settings.add_rule")}</span>
        </Button>
      </header>

      {rules.length === 0 ? (
        <div className="border-border/60 bg-card/40 flex flex-col items-start gap-3 rounded-xl border p-6">
          <h3 className="font-heading text-base">
            {t("dispatch_settings.empty_your_rules_title")}
          </h3>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("dispatch_settings.empty_your_rules_description")}
          </p>
        </div>
      ) : (
        <div className="border-border/60 overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dispatch_settings.rule_row.event_column")}</TableHead>
                <TableHead>{t("dispatch_settings.rule_row.channel_column")}</TableHead>
                <TableHead>{t("dispatch_settings.rule_row.recipient_column")}</TableHead>
                <TableHead>{t("dispatch_settings.rule_row.action_column")}</TableHead>
                <TableHead className="text-right">
                  {t("dispatch_settings.rule_row.status_column")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow
                  key={rule.dispatch_rule_id}
                  className="cursor-pointer"
                  onClick={() => onEdit(rule.dispatch_rule_id)}
                >
                  <TableCell className="font-mono text-xs">{rule.trigger_event}</TableCell>
                  <TableCell>{getChannelLabel(t, rule.channel)}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {describeTarget(rule.target as Record<string, unknown>)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        rule.action === "suppress"
                          ? "bg-warning/20 text-warning-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {rule.action === "suppress"
                        ? t("dispatch_settings.rule_row.action_suppress_chip")
                        : t("dispatch_settings.rule_row.action_send_chip")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        rule.is_enabled
                          ? "bg-success/20 text-success-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {rule.is_enabled
                        ? t("dispatch_settings.rule_row.status_enabled")
                        : t("dispatch_settings.rule_row.status_paused")}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────
function getChannelLabel(t: (key: string) => string, channel: string): string {
  const key = `dispatch_settings.rule_sheet.channel_${channel}`;
  const label = t(key);
  // If translation is missing we fall back to the raw enum — avoids
  // rendering the key path literal in the UI.
  return label === key ? channel : label;
}

function describeTarget(target: Record<string, unknown>): string {
  if (typeof target.email === "string") return target.email;
  if (typeof target.endpoint === "string") return String(target.endpoint);
  if (typeof target.peppol_participant_id === "string") return String(target.peppol_participant_id);
  try {
    return JSON.stringify(target);
  } catch {
    return "—";
  }
}
