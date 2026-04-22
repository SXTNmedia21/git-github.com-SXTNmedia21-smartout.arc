"use client";

/**
 * MalerTab — workspace template management surface.
 *
 * Two-zone layout:
 *  - Left (~280px): workspace templates list, with lineage subtitle
 *    (`Basert på K1a: <source> v<version>` or `Egendefinert`) and a small
 *    amber dot when the workspace template lags behind the current K1a
 *    version (Phase 4 drift observability — JOURNEY-cascade-drift-observability).
 *  - Right (flex): workbench. Template header + lineage badge + drift chip
 *    + bulk-send entry.
 *
 * Empty state shows a light catalog preview pointing to the system library
 * (K1a curation) with two primary actions: "Ny fra systemmal" / "Ny fra bunnen".
 *
 * Data: `GET /api/contracts/templates?workspace_id=…` returns both system
 * (workspace_id IS NULL) and workspace-specific rows. We filter client-side
 * to only show workspace rows in the left zone; system rows surface as the
 * catalog in empty state / "new from system" flow and also back the lazy
 * JOIN used by the drift-utils helpers (current K1a version lookup).
 *
 * Drift flow (Phase 4, council Q7 passive-only):
 *  - `hasDrift(tpl, templates)` compares `source_template_version` against
 *    the current K1a `version` on render. No cron, no background job.
 *  - Drift → amber dot on the row + amber chip in the workbench. Both open
 *    the DriftDiffDrawer (read-only side-by-side diff, no accept/reject).
 */

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, GitFork, Plus, Send, Sparkles } from "lucide-react";
import { Button } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { BulkSendDrawer } from "@/components/contracts/BulkSendDrawer";
import {
  DriftDiffDrawer,
  type DriftTemplateInfo,
  type WorkspaceDriftTemplate,
} from "@/components/contracts/DriftDiffDrawer";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { hasDrift as computeDrift, getCurrentK1aVersion } from "./drift-utils";

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
  // Phase 4 — drift observability. `version` on a K1a system template
  // (workspace_id === null) is compared against a workspace template's
  // `source_template_version` to detect drift (see drift-utils.ts).
  version?: number | null;
};

type Props = {
  workspaceId: string;
};

// ── Component ──────────────────────────────────────────────────────────────

export function MalerTab({ workspaceId }: Props) {
  const { t } = useTranslation("contracts");
  const { profileId: actorProfileId } = useContext(DashboardContext);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);

  // Phase 4 — drift diff drawer state. We lazily fetch `content_html` for
  // both sides (workspace + K1a source) when the drawer opens, since the
  // list endpoint deliberately excludes HTML for payload size.
  const [driftOpen, setDriftOpen] = useState(false);
  const [workspaceDriftTemplate, setWorkspaceDriftTemplate] =
    useState<WorkspaceDriftTemplate | null>(null);
  const [sourceDriftTemplate, setSourceDriftTemplate] = useState<DriftTemplateInfo | null>(null);

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

  // Index K1a (system library) templates by id for fast lineage/drift lookup.
  // The endpoint returns them in the same result set (workspace_id IS NULL).
  const systemTemplatesById = useMemo(() => {
    const map = new Map<string, TemplateRow>();
    for (const tpl of templates) {
      if (tpl.workspace_id === null || tpl.workspace_id === undefined) {
        map.set(tpl.template_id, tpl);
      }
    }
    return map;
  }, [templates]);

  const selected = workspaceTemplates.find((tpl) => tpl.template_id === selectedId) ?? null;

  // Lazy-open the drift drawer. We fetch content_html on demand so the list
  // endpoint stays compact. `sourceTpl` is the K1a template the workspace
  // template forked from — if it's gone, we still open the drawer so the
  // admin sees "no content" rather than a silent no-op.
  const openDriftDrawer = useCallback(
    async (tpl: TemplateRow) => {
      if (!tpl.source_template_id) return;
      const systemTpl = systemTemplatesById.get(tpl.source_template_id);

      // Seed what we already know so the drawer can mount while the content
      // fetches resolve. Version + name come from the list; content_html is
      // filled in by the fetches below.
      setWorkspaceDriftTemplate({
        template_id: tpl.template_id,
        name: tpl.name,
        content_html: null,
        version: tpl.version ?? null,
        source_template_id: tpl.source_template_id,
        source_template_version: tpl.source_template_version ?? null,
      });
      setSourceDriftTemplate(
        systemTpl
          ? {
              template_id: systemTpl.template_id,
              name: systemTpl.name,
              content_html: null,
              version: systemTpl.version ?? null,
            }
          : null,
      );
      setDriftOpen(true);

      // Fetch both HTML payloads in parallel. Single-template endpoint
      // (/api/contracts/templates/[id]) gates on admin role — the only role
      // that reaches the Maler tab anyway, so this is a no-op check in
      // practice but keeps the endpoint's RLS posture honest.
      try {
        const [workspaceRes, sourceRes] = await Promise.all([
          fetch(`/api/contracts/templates/${tpl.template_id}?workspace_id=${workspaceId}`),
          systemTpl
            ? fetch(`/api/contracts/templates/${systemTpl.template_id}?workspace_id=${workspaceId}`)
            : Promise.resolve(null),
        ]);

        if (workspaceRes.ok) {
          const wJson = (await workspaceRes.json()) as { data?: { content_html?: string | null } };
          setWorkspaceDriftTemplate((prev) =>
            prev
              ? {
                  ...prev,
                  content_html: wJson.data?.content_html ?? null,
                }
              : prev,
          );
        }

        if (sourceRes && sourceRes.ok) {
          const sJson = (await sourceRes.json()) as { data?: { content_html?: string | null } };
          setSourceDriftTemplate((prev) =>
            prev
              ? {
                  ...prev,
                  content_html: sJson.data?.content_html ?? null,
                }
              : prev,
          );
        }
      } catch {
        // Non-fatal — the drawer already shows "no content" when html is null.
      }
    },
    [systemTemplatesById, workspaceId],
  );

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
                drifted={computeDrift(tpl, templates)}
                onSelect={() => setSelectedId(tpl.template_id)}
                onOpenDrift={() => {
                  void openDriftDrawer(tpl);
                }}
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
            sourceName={
              selected.source_template_id
                ? (systemTemplatesById.get(selected.source_template_id)?.name ?? null)
                : null
            }
            drifted={computeDrift(selected, templates)}
            currentK1aVersion={getCurrentK1aVersion(templates, selected.source_template_id)}
            t={t}
            canBulkSend={Boolean(selected.published_at) && !selected.deprecated_at}
            onBulkSend={() => setBulkSendOpen(true)}
            onOpenDrift={() => {
              void openDriftDrawer(selected);
            }}
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

      {/* Phase 4 — drift diff drawer. Opened from the amber dot on a row, the
          drift chip in the workbench, or the cascade lineage badge. Always
          mounted so the close animation runs cleanly; `workspaceDriftTemplate`
          being null during initial open is handled inside the component. */}
      <DriftDiffDrawer
        open={driftOpen}
        onOpenChange={setDriftOpen}
        workspaceTemplate={workspaceDriftTemplate}
        sourceTemplate={sourceDriftTemplate}
        workspaceId={workspaceId}
        actorProfileId={actorProfileId}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TemplateRow({
  tpl,
  active,
  drifted,
  onSelect,
  onOpenDrift,
  t,
}: {
  tpl: TemplateRow;
  active: boolean;
  drifted: boolean;
  onSelect: () => void;
  onOpenDrift: () => void;
  // Using `ReturnType<typeof useTranslation>["t"]` is noisy; accept loose fn shape
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const lineage = tpl.source_template_id
    ? t("maler.based_on", {
        source: tpl.description ?? tpl.source_template_id.slice(0, 8),
        version: tpl.source_template_version ?? "?",
      })
    : t("maler.custom_template");

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
        {drifted && (
          // Phase 4 — ambient amber dot. Clicking opens the drift diff drawer;
          // the outer button `onSelect` still fires via default bubbling, but
          // we stop propagation so the admin intent ("open drift") is honored
          // without also toggling selection unnecessarily. Warm amber via the
          // `--warning` CSS variable (hue 75) — NOT red, drift is ambient not
          // emergency.
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrift();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onOpenDrift();
              }
            }}
            className="absolute top-3 right-3 h-2 w-2 cursor-pointer rounded-full"
            style={{ background: "hsl(var(--warning))" }}
            aria-label={t("maler.drift_hint")}
          />
        )}
      </button>
    </li>
  );
}

function WorkbenchPreview({
  tpl,
  sourceName,
  drifted,
  currentK1aVersion,
  t,
  canBulkSend,
  onBulkSend,
  onOpenDrift,
}: {
  tpl: TemplateRow;
  sourceName: string | null;
  drifted: boolean;
  currentK1aVersion: number | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  canBulkSend: boolean;
  onBulkSend: () => void;
  onOpenDrift: () => void;
}) {
  // Phase 4 — lineage badge copy. Falls back to "Egendefinert" for wholly
  // custom templates; both variants are click-through to the drift drawer
  // but only the "Basert på K1a" variant has drift to show.
  const hasLineage = Boolean(tpl.source_template_id);
  const lineageLabel = hasLineage
    ? t("maler.based_on", {
        source: sourceName ?? tpl.source_template_id?.slice(0, 8) ?? "—",
        version: tpl.source_template_version ?? "?",
      })
    : t("maler.custom_template");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-foreground text-2xl">{tpl.name}</h3>
          {tpl.description && <p className="text-muted-foreground text-sm">{tpl.description}</p>}

          {/* Lineage badge + drift chip. Both on the same row so the eye
              resolves "where this came from" and "is it still current" in
              one fixation. */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={hasLineage ? onOpenDrift : undefined}
              disabled={!hasLineage}
              className="bg-muted text-muted-foreground hover:bg-muted/80 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-70"
              aria-label={lineageLabel}
            >
              <GitFork className="h-3 w-3" />
              <span className="font-mono">{lineageLabel}</span>
            </button>

            {/* Amber drift chip — only when drift is detected. Warm hue via
                `--warning` CSS variable, never red. Clickable → drift drawer. */}
            {drifted && (
              <button
                type="button"
                onClick={onOpenDrift}
                className="focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                style={{
                  background: "hsl(var(--warning) / 0.12)",
                  color: "hsl(var(--warning))",
                }}
                aria-label={t("maler.drift_chip_label", {
                  current: currentK1aVersion != null ? String(currentK1aVersion) : "?",
                  own: tpl.source_template_version ?? "?",
                })}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "hsl(var(--warning))" }}
                />
                <span className="font-mono">{t("maler.drift_chip")}</span>
              </button>
            )}
          </div>
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
