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
 *
 * Fix 1: TemplatePreviewPane (Fix 1 — MalerTab read-only surface, PLAN §Fix 1):
 *  - Sticky header: template name, framework badge, read-only badge
 *  - Toolbar: "Copy HTML" (clipboard state machine) + "Open in admin" link
 *  - Editor: ContractPreviewEditor in deliberate read-only mode
 *  - Footer: explains why the surface is read-only
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  GitFork,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, withEntrance } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { EditorSkeleton } from "@/components/ui/editor-skeleton";
import { BulkSendDrawer } from "@/components/contracts/BulkSendDrawer";

// Lazy-loaded read-only preview. Tiptap is heavy; only mount when a workspace
// template is selected. `withEntrance` adds the Nordic Split spring fade-in.
const ContractPreviewEditor = dynamic(
  () =>
    import("./contract-preview-editor").then((m) => ({
      default: withEntrance(m.ContractPreviewEditor),
    })),
  { ssr: false, loading: () => <EditorSkeleton /> },
);
import {
  DriftDiffDrawer,
  type DriftTemplateInfo,
  type WorkspaceDriftTemplate,
} from "@/components/contracts/DriftDiffDrawer";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  // Fix 1 — TemplatePreviewPane needs content_html for clipboard copy.
  // The list endpoint may omit this for payload size; we fetch it lazily
  // from /api/contracts/templates/[id] when the pane mounts.
  content_html?: string | null;
  framework_name?: string | null;
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

  // Fix #2 follow-up (ADR-0191) — system template picker for "Ny fra systemmal".
  // Opens a dialog listing K1a templates (already loaded into `templates`
  // state); on select, calls /api/contract-templates/copy and patches local
  // state with the new workspace template so the left-zone list refreshes
  // without a full re-fetch.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [creatingBlank, setCreatingBlank] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Inline-rename: tracks which template is in edit mode and the draft value.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Toggle publish state for the selected template.
  const togglePublish = useCallback(
    async (tpl: TemplateRow) => {
      if (publishing) return;
      const willPublish = !tpl.published_at;
      setPublishing(true);
      try {
        const res = await fetch(`/api/contract-templates/${tpl.template_id}/publish`, {
          method: willPublish ? "POST" : "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? t("maler.publish_failed"));
        }
        const json = (await res.json()) as { published_at: string | null };
        setTemplates((prev) =>
          prev.map((row) =>
            row.template_id === tpl.template_id ? { ...row, published_at: json.published_at } : row,
          ),
        );
        toast.success(willPublish ? t("maler.published") : t("maler.unpublished"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("maler.publish_failed"));
      } finally {
        setPublishing(false);
      }
    },
    [publishing, t],
  );

  // Commit an inline-rename: POST /api/contract-templates/[id]/rename
  const commitRename = useCallback(
    async (templateId: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || renaming) return;
      const original = templates.find((r) => r.template_id === templateId)?.name ?? "";
      if (trimmed === original) {
        // No change — exit edit mode silently.
        setRenamingId(null);
        return;
      }
      setRenaming(true);
      try {
        const res = await fetch(`/api/contract-templates/${templateId}/rename`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? t("maler.rename_failed"));
        }
        const json = (await res.json()) as { name: string };
        // Optimistic update already applied in UI — confirm with server value.
        setTemplates((prev) =>
          prev.map((row) => (row.template_id === templateId ? { ...row, name: json.name } : row)),
        );
        toast.success(t("maler.renamed"));
      } catch (err) {
        // Revert local state to original on error.
        setTemplates((prev) =>
          prev.map((row) => (row.template_id === templateId ? { ...row, name: original } : row)),
        );
        toast.error(err instanceof Error ? err.message : t("maler.rename_failed"));
      } finally {
        setRenaming(false);
        setRenamingId(null);
      }
    },
    [renaming, templates, t],
  );

  const startRename = useCallback((tpl: TemplateRow) => {
    setRenamingId(tpl.template_id);
    setRenameDraft(tpl.name);
  }, []);

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

  // Ordered list of K1a templates for the picker. Same source data as the
  // index above, sorted by name for stable presentation.
  const systemTemplates = useMemo(
    () =>
      templates
        .filter((tpl) => tpl.workspace_id === null || tpl.workspace_id === undefined)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  );

  // Create blank workspace template — caller can edit + publish later.
  // Posts to /api/contract-templates/blank which inserts an empty content_html
  // row with no lineage. UX-flow: button → toast prompt for name → row appears
  // in the left list, auto-selected, draft state.
  const createBlankTemplate = useCallback(async () => {
    if (!workspaceId || creatingBlank) return;
    const name = window.prompt(t("maler.new_blank_name_prompt"), t("maler.new_blank_name_default"));
    if (!name || !name.trim()) return;
    setCreatingBlank(true);
    try {
      const res = await fetch("/api/contract-templates/blank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, name: name.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t("maler.new_blank_failed"));
      }
      const created = (await res.json()) as { template_id: string; name: string };
      const newRow: TemplateRow = {
        template_id: created.template_id,
        name: created.name,
        description: null,
        contract_type: "employee",
        language: "nb",
        workspace_id,
        source_template_id: null,
        source_template_version: null,
        forked_at: null,
        published_at: null,
        deprecated_at: null,
        version: 1,
      };
      setTemplates((prev) => [...prev, newRow]);
      setSelectedId(created.template_id);
      toast.success(t("maler.new_blank_created"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("maler.new_blank_failed"));
    } finally {
      setCreatingBlank(false);
    }
  }, [workspaceId, creatingBlank, t]);

  // Toggle publish state. Sets/clears `published_at` so the bulk-send button
  // and ContractDispatchDrawer template list pick the row up (or hide it).
  const togglePublish = useCallback(
    async (tpl: TemplateRow) => {
      if (publishing) return;
      const willPublish = !tpl.published_at;
      setPublishing(true);
      try {
        const res = await fetch(`/api/contract-templates/${tpl.template_id}/publish`, {
          method: willPublish ? "POST" : "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? t("maler.publish_failed"));
        }
        const json = (await res.json()) as { published_at: string | null };
        setTemplates((prev) =>
          prev.map((row) =>
            row.template_id === tpl.template_id
              ? { ...row, published_at: json.published_at }
              : row,
          ),
        );
        toast.success(willPublish ? t("maler.published") : t("maler.unpublished"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("maler.publish_failed"));
      } finally {
        setPublishing(false);
      }
    },
    [publishing, t],
  );

  // Fix #2 follow-up — clone a system template into the workspace via the
  // /api/contract-templates/copy route. Local state patch on success keeps
  // the left-zone list fresh without a full re-fetch (and matches the route
  // emit site as the canonical UI fork path — see Fix #3 / ADR-0191).
  const cloneSystemTemplate = useCallback(
    async (systemTpl: TemplateRow) => {
      if (!workspaceId) return;
      setCloningId(systemTpl.template_id);
      try {
        const res = await fetch("/api/contract-templates/copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            system_template_id: systemTpl.template_id,
            name: `${systemTpl.name} (kopi)`,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? t("maler.picker_clone_failed"));
        }
        const created = (await res.json()) as {
          template_id: string;
          name: string;
          source_template_id: string | null;
          source_template_version: string | null;
          forked_at: string | null;
        };
        // Patch local state — derive the new workspace template row from the
        // source so the lineage subtitle renders immediately. Lifecycle
        // columns are null on a fresh fork (route enforces this).
        const newRow: TemplateRow = {
          template_id: created.template_id,
          name: created.name,
          description: systemTpl.description,
          contract_type: systemTpl.contract_type,
          language: systemTpl.language,
          workspace_id: workspaceId,
          source_template_id: created.source_template_id,
          source_template_version: created.source_template_version,
          forked_at: created.forked_at,
          published_at: null,
          deprecated_at: null,
          version: 1,
        };
        setTemplates((prev) => [...prev, newRow]);
        setSelectedId(created.template_id);
        setPickerOpen(false);
        toast.success(t("maler.picker_cloned"));
        // Telemetry: clone success (guard against null actor before nonEmpty)
        if (actorProfileId)
          void emit({
            event: "contracts.template.cloned",
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(actorProfileId, "actor_id"),
            properties: {
              entity: {
                entity_type: "contract_template",
                entity_id: created.template_id,
                entity_label: created.name,
              },
              data: {
                source_template_id: systemTpl.template_id,
                new_template_id: created.template_id,
              },
            },
          });
      } catch (err) {
        const message = err instanceof Error ? err.message : t("maler.picker_clone_failed");
        toast.error(message);
      } finally {
        setCloningId(null);
      }
    },
    [workspaceId, actorProfileId, t],
  );

  const selected = workspaceTemplates.find((tpl) => tpl.template_id === selectedId) ?? null;

  // Workbench preview content — fetch content_html when a workspace template
  // is selected. List endpoint omits HTML for payload size; single-template
  // endpoint returns it under `data.content_html`. Falls through gracefully:
  // null content keeps the dashed placeholder visible (`workbench_hint`).
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId || !workspaceId) {
      setPreviewHtml(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/contracts/templates/${selectedId}?workspace_id=${workspaceId}`,
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as { data?: { content_html?: string | null } };
        if (cancelled) return;
        setPreviewHtml(json.data?.content_html ?? null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "fetch failed";
        setPreviewError(msg);
        setPreviewHtml(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, workspaceId]);

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
          <EmptyStateCatalog onOpenPicker={() => setPickerOpen(true)} />
        ) : (
          <ul className="flex flex-col">
            {workspaceTemplates.map((tpl) => (
              <TemplateListRow
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
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setPickerOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              {t("maler.new_from_system")}
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2"
              onClick={createBlankTemplate}
              disabled={creatingBlank}
            >
              {creatingBlank ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t("maler.new_from_scratch")}
            </Button>
          </div>
        )}
      </aside>

      {/* ── Right: workbench placeholder ──────────────────────────── */}
      <section className="flex min-h-[400px] flex-col">
        {selected ? (
          <TemplatePreviewPane
            tpl={selected}
            sourceName={
              selected.source_template_id
                ? (systemTemplatesById.get(selected.source_template_id)?.name ?? null)
                : null
            }
            drifted={computeDrift(selected, templates)}
            currentK1aVersion={getCurrentK1aVersion(templates, selected.source_template_id)}
            t={t}
            workspaceId={workspaceId}
            actorProfileId={actorProfileId}
            canBulkSend={Boolean(selected.published_at) && !selected.deprecated_at}
            onBulkSend={() => setBulkSendOpen(true)}
            onTogglePublish={() => void togglePublish(selected)}
            publishing={publishing}
            onOpenDrift={() => {
              void openDriftDrawer(selected);
            }}
            previewHtml={previewHtml}
            previewLoading={previewLoading}
            previewError={previewError}
            isRenaming={renamingId === selected.template_id}
            renameDraft={renameDraft}
            renaming={renaming}
            onStartRename={() => startRename(selected)}
            onRenameDraftChange={setRenameDraft}
            onCommitRename={() => void commitRename(selected.template_id, renameDraft)}
            onCancelRename={() => setRenamingId(null)}
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

      {/* Fix #2 follow-up — system template picker. Lists K1a templates
          already loaded into local state; clicking one fires a clone via
          /api/contract-templates/copy and patches local state on success. */}
      <SystemTemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        systemTemplates={systemTemplates}
        cloningId={cloningId}
        onClone={cloneSystemTemplate}
        t={t}
      />
    </div>
  );
}

function SystemTemplatePicker({
  open,
  onOpenChange,
  systemTemplates,
  cloningId,
  onClone,
  t,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  systemTemplates: TemplateRow[];
  cloningId: string | null;
  onClone: (tpl: TemplateRow) => void | Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("maler.picker_title")}</DialogTitle>
          <DialogDescription>{t("maler.picker_description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {systemTemplates.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {t("maler.picker_empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {systemTemplates.map((tpl) => {
                const isCloning = cloningId === tpl.template_id;
                const anyCloning = cloningId !== null;
                return (
                  <li key={tpl.template_id}>
                    <button
                      type="button"
                      disabled={anyCloning}
                      onClick={() => {
                        void onClone(tpl);
                      }}
                      className="border-border hover:bg-muted/60 focus-visible:ring-ring flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-3 text-left transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="font-heading text-foreground text-base leading-tight">
                        {tpl.name}
                      </span>
                      {tpl.description && (
                        <span className="text-muted-foreground text-xs">{tpl.description}</span>
                      )}
                      {isCloning && (
                        <span className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-xs">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("maler.picker_cloning")}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={cloningId !== null}>
            {t("maler.picker_cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TemplateListRow({
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
          // Fix 1 a11y: use <button type="button"> instead of <span role="button">
          // so keyboard focus, activation, and screen reader semantics are native.
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrift();
            }}
            className="absolute top-3 right-3 h-2 w-2 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
            style={{ background: "hsl(var(--warning))" }}
            aria-label={t("maler.drift_hint")}
          />
        )}
      </button>
    </li>
  );
}

// ── Fix 1: TemplatePreviewPane ─────────────────────────────────────────────
// Deliberate read-only pane. Replaces the placeholder WorkbenchPreview shell.
// The pane has three zones:
//   1. Sticky header — template identity + read-only badge
//   2. Toolbar — Copy HTML + Open in admin
//   3. Editor — ContractPreviewEditor in preview mode (editable=false)
//   4. Footer — explains the read-only posture
// Bulk-send entry point remains in the sticky header alongside the badge.

type CopyState = "idle" | "copying" | "done";

function TemplatePreviewPane({
  tpl,
  sourceName,
  drifted,
  currentK1aVersion,
  t,
  workspaceId,
  actorProfileId,
  canBulkSend,
  onBulkSend,
  onTogglePublish,
  publishing,
  onOpenDrift,
  previewHtml,
  previewLoading,
  previewError,
  isRenaming,
  renameDraft,
  renaming,
  onStartRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
}: {
  tpl: TemplateRow;
  sourceName: string | null;
  drifted: boolean;
  currentK1aVersion: number | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  workspaceId: string;
  actorProfileId: string | null;
  canBulkSend: boolean;
  onBulkSend: () => void;
  onTogglePublish: () => void;
  publishing: boolean;
  onOpenDrift: () => void;
  previewHtml: string | null;
  previewLoading: boolean;
  previewError: string | null;
  isRenaming: boolean;
  renameDraft: string;
  renaming: boolean;
  onStartRename: () => void;
  onRenameDraftChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
}) {
  // Fix 1 — lazy-load content_html for the editor + clipboard.
  // The list endpoint may omit it for payload size; if it's missing we fetch
  // from the single-template endpoint on mount. If the row already carries
  // content_html (from a prior fetch cached in local state), we skip the call.
  const [contentHtml, setContentHtml] = useState<string | null>(tpl.content_html ?? null);
  const [htmlLoading, setHtmlLoading] = useState(!tpl.content_html);

  // Clipboard copy state machine: idle → copying → done (2s) → idle
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Telemetry: emit once on pane mount (template viewed).
  // Use a ref to prevent double-emit on StrictMode.
  const viewedRef = useRef(false);

  const hasLineage = Boolean(tpl.source_template_id);
  const lineageLabel = hasLineage
    ? t("maler.based_on", {
        source: sourceName ?? tpl.source_template_id?.slice(0, 8) ?? "—",
        version: tpl.source_template_version ?? "?",
      })
    : t("maler.custom_template");

  // Fetch content_html once on mount if not already available.
  useEffect(() => {
    if (tpl.content_html) {
      setContentHtml(tpl.content_html);
      setHtmlLoading(false);
      return;
    }
    let cancelled = false;
    setHtmlLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/contracts/templates/${tpl.template_id}?workspace_id=${workspaceId}`,
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data?: { content_html?: string | null } };
        if (!cancelled) setContentHtml(json.data?.content_html ?? null);
      } finally {
        if (!cancelled) setHtmlLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tpl.template_id, tpl.content_html, workspaceId]);

  // Emit "template viewed" once per mount.
  useEffect(() => {
    if (viewedRef.current || !workspaceId || !actorProfileId) return;
    viewedRef.current = true;
    void emit({
      event: "contracts.template.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "contract_template",
          entity_id: tpl.template_id,
          entity_label: tpl.name,
        },
        data: {
          template_id: tpl.template_id,
          framework_id: tpl.source_template_id ?? null,
          version: tpl.version ?? null,
          has_drift: drifted,
        },
      },
    });
  }, [
    tpl.template_id,
    tpl.name,
    tpl.source_template_id,
    tpl.version,
    drifted,
    workspaceId,
    actorProfileId,
  ]);

  // Cleanup copy-reset timer on unmount.
  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const handleCopyHtml = useCallback(async () => {
    if (copyState !== "idle" || !contentHtml) return;
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(contentHtml);
      setCopyState("done");
      toast.success(t("maler.copySuccess"));
      if (workspaceId && actorProfileId)
        void emit({
          event: "contracts.template.html_copied",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(actorProfileId, "actor_id"),
          properties: {
            entity: {
              entity_type: "contract_template",
              entity_id: tpl.template_id,
              entity_label: tpl.name,
            },
            data: {
              template_id: tpl.template_id,
              source: "maler_tab",
            },
          },
        });
      copyResetRef.current = setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("idle");
      toast.error(t("maler.copyError"));
    }
  }, [copyState, contentHtml, t, workspaceId, actorProfileId, tpl.template_id, tpl.name]);

  const handleOpenInAdmin = useCallback(() => {
    if (!workspaceId || !actorProfileId) return;
    void emit({
      event: "contracts.template.opened_in_admin",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "contract_template",
          entity_id: tpl.template_id,
          entity_label: tpl.name,
        },
        data: {
          template_id: tpl.template_id,
        },
      },
    });
  }, [workspaceId, actorProfileId, tpl.template_id, tpl.name]);

  const CopyIcon = copyState === "done" ? Check : copyState === "copying" ? Loader2 : Copy;

  return (
    <div className="flex flex-col gap-0">
      {/* ── Sticky header ────────────────────────────────────────── */}
      <div className="bg-background/80 sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* Inline-rename: input swaps in when isRenaming, h3 otherwise */}
          {isRenaming ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={renameDraft}
                onChange={(e) => onRenameDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCommitRename();
                  if (e.key === "Escape") onCancelRename();
                }}
                onBlur={onCommitRename}
                disabled={renaming}
                placeholder={t("maler.rename_placeholder")}
                className="font-heading h-8 text-lg"
                aria-label={t("maler.rename_label")}
              />
              {renaming ? (
                <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={onCancelRename}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Avbryt"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="group flex items-center gap-1.5">
              <h3 className="font-heading text-foreground text-lg leading-tight">{tpl.name}</h3>
              {/* Pencil icon — visible on hover, triggers rename mode */}
              <button
                type="button"
                onClick={onStartRename}
                className="text-muted-foreground hover:text-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={t("maler.rename_label")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {(tpl.framework_name ?? sourceName) && (
            <p className="text-muted-foreground text-sm">
              {tpl.framework_name ?? sourceName}
              {tpl.source_template_version ? ` v${tpl.source_template_version}` : ""}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* Lineage badge */}
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
            {/* Drift chip — only when drift is detected */}
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
            {/* Read-only badge */}
            <Badge variant="outline" className="gap-1.5">
              <Lock className="size-3" />
              {t("maler.readOnly")}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Publish toggle — flips published_at so dispatch + bulk-send pick the row up. */}
          {!tpl.deprecated_at && (
            <Button
              size="sm"
              variant={tpl.published_at ? "outline" : "default"}
              onClick={onTogglePublish}
              disabled={publishing}
              className="gap-2"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tpl.published_at ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {tpl.published_at ? t("maler.unpublish_action") : t("maler.publish_action")}
            </Button>
          )}
          {/* Bulk-send action — Phase 3. Only rendered when published + not deprecated. */}
          {canBulkSend && (
            <Button size="sm" onClick={onBulkSend} className="gap-2">
              <Send className="h-4 w-4" />
              {t("maler.bulk_send_action")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="border-border flex items-center gap-1 border-b px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => void handleCopyHtml()}
          disabled={copyState === "copying" || !contentHtml}
          aria-label={t("maler.copyHtml")}
        >
          <CopyIcon className={`h-4 w-4 ${copyState === "copying" ? "animate-spin" : ""}`} />
          {t("maler.copyHtml")}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link
            href={`/platform-admin/templates/${tpl.template_id}`}
            target="_blank"
            onClick={handleOpenInAdmin}
          >
            <ExternalLink className="h-4 w-4" />
            {t("maler.openInAdmin")}
          </Link>
        </Button>
      </div>

      {/* ── Editor ───────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-3">
        {htmlLoading ? (
          <div className="border-border bg-muted/30 flex min-h-[320px] items-center justify-center rounded-lg border">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : contentHtml ? (
          // ContractPreviewEditor has mode hardcoded to "preview" internally
          // (editable=false). The onContentChange callback is a no-op — the
          // editor never calls it in preview mode.
          <ContractPreviewEditor
            contentHtml={contentHtml}
            onContentChange={() => {
              /* read-only — no-op. editor is editable=false in preview mode */
            }}
          />
        ) : (
          <div className="border-border bg-muted/30 flex min-h-[320px] items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">{t("maler.workbench_hint")}</p>
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <p className="text-muted-foreground px-4 pb-4 text-xs">{t("maler.readOnlyExplain")}</p>
    </div>
  );
}

function EmptyStateCatalog({ onOpenPicker }: { onOpenPicker: () => void }) {
  const { t } = useTranslation("contracts");
  return (
    <div className="border-border bg-muted/20 flex flex-col gap-4 rounded-2xl border border-dashed p-6">
      <div>
        <h3 className="font-heading text-foreground text-lg">{t("maler.empty_title")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("maler.empty_description")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="justify-start gap-2" onClick={onOpenPicker}>
          <Sparkles className="h-4 w-4" />
          {t("maler.new_from_system")}
        </Button>
        {/* TODO (P1): see workspaceTemplates-footer note above. */}
        <Button
          variant="ghost"
          className="justify-start gap-2"
          disabled
          title={t("maler.new_from_scratch_pending")}
        >
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
