"use client";

import { useMemo, useState } from "react";
import type { BillingDispatchRule } from "@smartout/billing";
import { Building2, Globe2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { DispatchRuleSheet } from "./DispatchRuleSheet";
import { EditDispatchRuleDialog } from "./EditDispatchRuleDialog";

// DispatchRulesTable — client surface for the platform-admin settings
// page. Groups rules into "Platform-defaults" + per-workspace sections
// (spec §3.6). Search box filters by target email / channel /
// trigger_event. Filter chips toggle channel / trigger / is_enabled.
// Row click opens the edit dialog.
//
// ADR-0127: suppress rows are workspace-only. We show action=suppress
// as a muted "Ikke send" chip inline with the row so ops can scan the
// override semantics at a glance.

type Props = {
  rules: BillingDispatchRule[];
  workspaceNames: Map<string, string>;
};

type Chips = {
  channel: string | null;
  trigger_event: string | null;
  enabled: "on" | "off" | null;
};

const CHANNEL_LABELS: Record<string, string> = {
  email_customer: "Epost (kunde)",
  email_internal: "Epost (intern)",
  http_api: "HTTP API",
  peppol_ehf: "EHF / Peppol",
};

export function DispatchRulesTable({ rules, workspaceNames }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chips, setChips] = useState<Chips>({ channel: null, trigger_event: null, enabled: null });

  // Group rules into "platform" vs per-workspace buckets once. Grouping
  // is derived state, not server-driven, so the client can re-filter
  // without extra round-trips.
  const grouped = useMemo(() => {
    const platform: BillingDispatchRule[] = [];
    const byWorkspace = new Map<string, BillingDispatchRule[]>();
    for (const rule of rules) {
      if (!matchesFilters(rule, search, chips)) continue;
      if (!rule.workspace_id) {
        platform.push(rule);
      } else {
        const list = byWorkspace.get(rule.workspace_id) ?? [];
        list.push(rule);
        byWorkspace.set(rule.workspace_id, list);
      }
    }
    return { platform, byWorkspace };
  }, [rules, search, chips]);

  const editingRule = useMemo<BillingDispatchRule | null>(
    () => rules.find((r) => r.dispatch_rule_id === editingId) ?? null,
    [rules, editingId],
  );

  // Unique trigger_events + channels across the result set for filter chips.
  const triggerEvents = useMemo(() => {
    return Array.from(new Set(rules.map((r) => r.trigger_event))).sort();
  }, [rules]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl">Utsendelsesregler</h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            Hvem som får faktura-varsler per kanal (epost, HTTP API, Peppol/EHF). Platform-defaults
            gjelder alle workspaces; workspace-overrider og suppress-rader er listet per workspace.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1">Legg til regel</span>
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            placeholder="Søk mottaker, kanal eller event…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <FilterChip
          active={chips.channel === "email_customer"}
          onClick={() =>
            setChips((c) => ({
              ...c,
              channel: c.channel === "email_customer" ? null : "email_customer",
            }))
          }
        >
          Epost (kunde)
        </FilterChip>
        <FilterChip
          active={chips.channel === "http_api"}
          onClick={() =>
            setChips((c) => ({ ...c, channel: c.channel === "http_api" ? null : "http_api" }))
          }
        >
          HTTP API
        </FilterChip>
        <FilterChip
          active={chips.enabled === "on"}
          onClick={() => setChips((c) => ({ ...c, enabled: c.enabled === "on" ? null : "on" }))}
        >
          Aktive
        </FilterChip>
        <FilterChip
          active={chips.enabled === "off"}
          onClick={() => setChips((c) => ({ ...c, enabled: c.enabled === "off" ? null : "off" }))}
        >
          Inaktive
        </FilterChip>
        {triggerEvents.length > 0 && triggerEvents.length <= 6
          ? triggerEvents.map((ev) => (
              <FilterChip
                key={ev}
                active={chips.trigger_event === ev}
                onClick={() =>
                  setChips((c) => ({
                    ...c,
                    trigger_event: c.trigger_event === ev ? null : ev,
                  }))
                }
              >
                <code className="font-mono text-xs">{ev}</code>
              </FilterChip>
            ))
          : null}
      </div>

      {grouped.platform.length === 0 && grouped.byWorkspace.size === 0 ? (
        <EmptyState
          onCreate={() => setCreateOpen(true)}
          isFiltered={
            rules.length > 0 &&
            (!!search ||
              chips.channel !== null ||
              chips.enabled !== null ||
              chips.trigger_event !== null)
          }
        />
      ) : (
        <div className="space-y-8">
          <RulesSection
            title="Platform-defaults"
            subtitle="Gjelder alle workspaces om ikke de har egen override eller suppress-rad."
            icon={<Globe2 className="size-4" aria-hidden />}
            rules={grouped.platform}
            onOpenEdit={(id) => setEditingId(id)}
            workspaceNames={workspaceNames}
            showWorkspaceCol={false}
          />

          {Array.from(grouped.byWorkspace.entries()).map(([wsId, wsRules]) => (
            <RulesSection
              key={wsId}
              title={workspaceNames.get(wsId) ?? wsId.slice(0, 8)}
              subtitle={`Workspace-spesifikke regler (${wsRules.length}).`}
              icon={<Building2 className="size-4" aria-hidden />}
              rules={wsRules}
              onOpenEdit={(id) => setEditingId(id)}
              workspaceNames={workspaceNames}
              showWorkspaceCol={false}
            />
          ))}
        </div>
      )}

      <DispatchRuleSheet open={createOpen} onOpenChange={setCreateOpen} />
      <EditDispatchRuleDialog
        rule={editingRule}
        workspaceNames={workspaceNames}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      />
    </div>
  );
}

// ─── Inner section (one per workspace group) ─────────────────────
function RulesSection({
  title,
  subtitle,
  icon,
  rules,
  onOpenEdit,
  showWorkspaceCol: _showWorkspaceCol,
  workspaceNames: _workspaceNames,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rules: BillingDispatchRule[];
  onOpenEdit: (id: string) => void;
  showWorkspaceCol: boolean;
  workspaceNames: Map<string, string>;
}) {
  if (rules.length === 0) return null;

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        {icon}
        <h3 className="font-heading text-lg">{title}</h3>
      </header>
      <p className="text-muted-foreground text-xs">{subtitle}</p>
      <div className="border-border/60 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Kanal</TableHead>
              <TableHead>Mottaker</TableHead>
              <TableHead>Handling</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow
                key={rule.dispatch_rule_id}
                className="cursor-pointer"
                onClick={() => onOpenEdit(rule.dispatch_rule_id)}
              >
                <TableCell className="font-mono text-xs">{rule.trigger_event}</TableCell>
                <TableCell>{CHANNEL_LABELS[rule.channel] ?? rule.channel}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {describeTarget(rule.target as Record<string, unknown>)}
                </TableCell>
                <TableCell>
                  <ActionChip action={rule.action} />
                </TableCell>
                <TableCell className="text-right">
                  <EnabledChip enabled={rule.is_enabled} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

// ─── Chips ───────────────────────────────────────────────────────
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary border-primary/40 border"
          : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground border",
      )}
    >
      {children}
    </button>
  );
}

function ActionChip({ action }: { action: "send" | "suppress" }) {
  if (action === "suppress") {
    return (
      <span className="bg-warning/20 text-warning-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
        Ikke send
      </span>
    );
  }
  return (
    <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
      Send
    </span>
  );
}

function EnabledChip({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        enabled ? "bg-success/20 text-success-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {enabled ? "Aktiv" : "Pauset"}
    </span>
  );
}

function EmptyState({ onCreate, isFiltered }: { onCreate: () => void; isFiltered: boolean }) {
  return (
    <div className="border-border/60 bg-muted/10 flex flex-col items-start gap-3 rounded-xl border p-8">
      <h3 className="font-heading text-xl">
        {isFiltered ? "Ingen regler matcher filteret" : "Ingen utsendelsesregler"}
      </h3>
      <p className="text-muted-foreground max-w-prose text-sm">
        {isFiltered
          ? "Prøv å fjerne et filter eller søkeord. Platform-defaults finnes kanskje i en annen kanal."
          : "Opprett en platform-default (gjelder alle workspaces) eller en workspace-spesifikk regel."}
      </p>
      {!isFiltered ? (
        <Button type="button" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1">Legg til regel</span>
        </Button>
      ) : null}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────
function describeTarget(target: Record<string, unknown>): string {
  if (typeof target.email === "string") return target.email;
  if (typeof target.endpoint === "string") return String(target.endpoint);
  if (typeof target.peppol_participant_id === "string") return String(target.peppol_participant_id);
  try {
    return JSON.stringify(target);
  } catch {
    return "(ugyldig mottaker)";
  }
}

function matchesFilters(rule: BillingDispatchRule, search: string, chips: Chips): boolean {
  const lower = search.trim().toLowerCase();
  if (lower.length > 0) {
    const targetText = describeTarget(rule.target as Record<string, unknown>).toLowerCase();
    const hit =
      targetText.includes(lower) ||
      rule.channel.toLowerCase().includes(lower) ||
      rule.trigger_event.toLowerCase().includes(lower);
    if (!hit) return false;
  }
  if (chips.channel && rule.channel !== chips.channel) return false;
  if (chips.trigger_event && rule.trigger_event !== chips.trigger_event) return false;
  if (chips.enabled === "on" && !rule.is_enabled) return false;
  if (chips.enabled === "off" && rule.is_enabled) return false;
  return true;
}
