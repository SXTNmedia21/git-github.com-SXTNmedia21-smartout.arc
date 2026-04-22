"use client";

/**
 * MalerTab — workspace template management surface.
 *
 * Two-zone layout:
 *  - Left (~280px): workspace templates list, with lineage subtitle
 *    (`Basert på K1a: <source> v<version>` or `Egendefinert`) and drift hint
 *    (amber dot — stubbed to false in Phase 2, real detection lands in Phase 4
 *    alongside JOURNEY-cascade-drift-observability).
 *  - Right (flex): workbench placeholder. Template editor + bulk-send entry
 *    wire in here in Phase 3/4.
 *
 * Empty state shows a light catalog preview pointing to the system library
 * (K1a curation) with two primary actions: "Ny fra systemmal" / "Ny fra bunnen".
 *
 * Data: `GET /api/contracts/templates?workspace_id=…` returns both system
 * (workspace_id IS NULL) and workspace-specific rows. We filter client-side
 * to only show workspace rows in the left zone; system rows surface as the
 * catalog in empty state / "new from system" flow.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Send, Sparkles } from "lucide-react";
import { Button } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { BulkSendDrawer } from "@/components/contracts/BulkSendDrawer";

// ── Types ──────────────────────────────────────────────────────────────────

type TemplateRow = {
  template_id: string;
  name: string;
  description: string | null;
  contract_type: string;
  language: string;
  // Lineage + lifecycle columns — Phase 3: the `/api/contracts/templates`
  // endpoint now selects these explicitly. `published_at` / `deprecated_at`
  // gate the "Send til ansatte…" action (only live templates can bulk-send).
  source_template_id?: string | null;
  source_template_version?: string | null;
  forked_at?: string | null;
  published_at?: string | null;
  deprecated_at?: string | null;
  workspace_id?: string | null;
};

type Props = {
  workspaceId: string;
};

// ── Component ──────────────────────────────────────────────────────────────

export function MalerTab({ workspaceId }: Props) {
  const { t } = useTranslation("contracts");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/contracts/templates?workspace_id=${workspaceId}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: TemplateRow[] };
        if (cancelled) return;
        setTemplates(json.data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Workspace-scoped templates only (K1a system library shows via catalog CTA,
  // never mixed into the left zone — see JOURNEY-contract-hub-redesign §Journey 3).
  const workspaceTemplates = useMemo(
    () => templates.filter((tpl) => tpl.workspace_id !== null && tpl.workspace_id !== undefined),
    [templates],
  );

  const selected = workspaceTemplates.find((tpl) => tpl.template_id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
      {/* ── Left: workspace template list ─────────────────────────── */}
      <aside className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-foreground text-xl">{t("maler.heading")}</h2>
        </div>
        <p className="text-muted-foreground text-sm">{t("maler.subtitle")}</p>

        {loading ? (
          <TemplateListSkeleton />
        ) : workspaceTemplates.length === 0 ? (
          <EmptyStateCatalog />
        ) : (
          <ul className="flex flex-col">
            {workspaceTemplates.map((tpl) => (
              <TemplateRow
                key={tpl.template_id}
                tpl={tpl}
                active={tpl.template_id === selectedId}
                onSelect={() => setSelectedId(tpl.template_id)}
                t={t}
              />
            ))}
          </ul>
        )}

        {workspaceTemplates.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" className="justify-start gap-2" disabled>
              <Sparkles className="h-4 w-4" />
              {t("maler.new_from_system")}
            </Button>
            <Button variant="ghost" className="justify-start gap-2" disabled>
              <Plus className="h-4 w-4" />
              {t("maler.new_from_scratch")}
            </Button>
          </div>
        )}
      </aside>

      {/* ── Right: workbench placeholder ──────────────────────────── */}
      <section className="flex min-h-[400px] flex-col">
        {selected ? (
          <WorkbenchPreview
            tpl={selected}
            t={t}
            canBulkSend={Boolean(selected.published_at) && !selected.deprecated_at}
            onBulkSend={() => setBulkSendOpen(true)}
          />
        ) : (
          <div className="border-border bg-muted/30 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center">
            <div className="bg-muted text-muted-foreground mb-4 flex h-12 w-12 items-center justify-center rounded-full">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-foreground mb-1 text-lg">
              {t("maler.workbench_placeholder")}
            </h3>
            <p className="text-muted-foreground max-w-sm text-sm">{t("maler.workbench_hint")}</p>
          </div>
        )}
      </section>

      {/* Phase 3: bulk-send drawer. Only mounted when a template is actually
          selected so the drawer inherits the right template id + name. */}
      {selected && (
        <BulkSendDrawer
          open={bulkSendOpen}
          onOpenChange={setBulkSendOpen}
          templateId={selected.template_id}
          templateName={selected.name}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TemplateRow({
  tpl,
  active,
  onSelect,
  t,
}: {
  tpl: TemplateRow;
  active: boolean;
  onSelect: () => void;
  // Using `ReturnType<typeof useTranslation>["t"]` is noisy; accept loose fn shape
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const lineage = tpl.source_template_id
    ? t("maler.based_on", {
        source: tpl.description ?? tpl.source_template_id.slice(0, 8),
        version: tpl.source_template_version ?? "?",
      })
    : t("maler.custom_template");

  // Drift detection is stubbed in Phase 2 — real diff vs system template lands
  // alongside JOURNEY-cascade-drift-observability in Phase 4.
  const hasDrift = false;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`border-border relative flex w-full flex-col items-start gap-0.5 border-b px-3 py-3 text-left transition-colors duration-250 ease-out last:border-b-0 ${
          active ? "bg-muted" : "hover:bg-muted/60"
        }`}
      >
        {active && (
          <motion.span
            layoutId="maler-tab-indicator"
            className="bg-primary absolute top-0 bottom-0 left-0 w-0.5"
            transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
          />
        )}
        <span className="font-heading text-foreground text-base leading-tight">{tpl.name}</span>
        <span className="text-muted-foreground font-mono text-xs">{lineage}</span>
        {hasDrift && (
          <span
            className="absolute top-3 right-3 h-2 w-2 rounded-full"
            style={{ backgroundColor: "oklch(0.78 0.14 65)" }}
            aria-label="drift indicator"
          />
        )}
      </button>
    </li>
  );
}

function WorkbenchPreview({
  tpl,
  t,
  canBulkSend,
  onBulkSend,
}: {
  tpl: TemplateRow;
  t: (key: string, vars?: Record<string, string | number>) => string;
  canBulkSend: boolean;
  onBulkSend: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-foreground text-2xl">{tpl.name}</h3>
          {tpl.description && (
            <p className="text-muted-foreground mt-1 text-sm">{tpl.description}</p>
          )}
        </div>
        {/* Bulk-send action — Phase 3. Only rendered when the template is
            published + not deprecated; server enforces the same gate. */}
        {canBulkSend && (
          <Button size="sm" onClick={onBulkSend} className="gap-2">
            <Send className="h-4 w-4" />
            {t("maler.bulk_send_action")}
          </Button>
        )}
      </div>
      <div className="border-border bg-muted/30 flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-dashed p-8 text-center">
        <p className="text-muted-foreground max-w-md text-sm">{t("maler.workbench_hint")}</p>
      </div>
    </div>
  );
}

function EmptyStateCatalog() {
  const { t } = useTranslation("contracts");
  return (
    <div className="border-border bg-muted/20 flex flex-col gap-4 rounded-2xl border border-dashed p-6">
      <div>
        <h3 className="font-heading text-foreground text-lg">{t("maler.empty_title")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("maler.empty_description")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="justify-start gap-2" disabled>
          <Sparkles className="h-4 w-4" />
          {t("maler.new_from_system")}
        </Button>
        <Button variant="ghost" className="justify-start gap-2" disabled>
          <Plus className="h-4 w-4" />
          {t("maler.new_from_scratch")}
        </Button>
      </div>
    </div>
  );
}

function TemplateListSkeleton() {
  return (
    <ul className="flex flex-col">
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="border-border bg-muted/30 border-b px-3 py-4 last:border-b-0"
          aria-hidden
        >
          <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
          <div className="bg-muted mt-2 h-3 w-1/2 animate-pulse rounded" />
        </li>
      ))}
    </ul>
  );
}
