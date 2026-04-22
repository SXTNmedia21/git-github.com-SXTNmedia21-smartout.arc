"use client";

/**
 * DriftDiffDrawer — Phase 4 read-only drift observability surface.
 *
 * Council 2026-04-22 Q7: passive layer only. This drawer shows admins that
 * their workspace template is behind the current K1a system template and
 * renders both HTML bodies side-by-side for visual comparison. No accept /
 * reject / per-clause remediation — those are Phase 5 behind ADR-0183
 * (industry_intelligence capability).
 *
 * Surface (Nordic Split glass recipe):
 *  - Right-side shadcn Sheet, 640px wide, full height
 *  - `bg-background/80 backdrop-blur-xl` with 1px warm gradient border
 *  - Spring entrance via framer-motion (stiffness 38, damping 22, mass 2.2)
 *  - ESC / backdrop click closes (Sheet handles focus trap + keyboard)
 *
 * Diff approach (Phase 4):
 *  - Side-by-side full-HTML render (left "Din versjon", right "Smartouts versjon")
 *  - Warm amber wash (hue 75 via `--warning` CSS var) signals "drift context"
 *    — never red, never emergency. This is ambient awareness, not an alert.
 *  - Phase 5 adds per-clause visual diff (requires a real diff algorithm +
 *    clause-aware parsing of the templates).
 *
 * Telemetry (G2-registered):
 *  - `contract_template.drift_viewed` on mount
 *  - `contract_template.drift_dismissed` on close (ESC, backdrop, X button)
 *  - Registry payload shape (frozen): `{ drift_event_id, drift_type }` +
 *    `view_duration_ms` on dismissed. We synthesize a `drift_event_id` from
 *    the workspace template id (stable per viewing session) and set
 *    `drift_type = "k1a_version_behind"` — the only drift type for Phase 4.
 */

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { emit } from "@smartout/telemetry";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@smartout/ui";

// ── Types ──────────────────────────────────────────────────────────────────

export type DriftTemplateInfo = {
  template_id: string;
  name: string;
  content_html: string | null;
  version: number | null;
};

export type WorkspaceDriftTemplate = DriftTemplateInfo & {
  source_template_id: string | null;
  source_template_version: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The workspace template that has drifted. */
  workspaceTemplate: WorkspaceDriftTemplate | null;
  /** The current K1a source template (post-drift "truth"). */
  sourceTemplate: DriftTemplateInfo | null;
  /** For telemetry — emitted on mount + close. */
  workspaceId: string;
  actorProfileId: string | null;
};

// Spring physics per Nordic Split drawer envelope (Phase 3 CompositionDrawer).
const DRAWER_SPRING = { type: "spring" as const, stiffness: 38, damping: 22, mass: 2.2 };

// ── Component ──────────────────────────────────────────────────────────────

export function DriftDiffDrawer({
  open,
  onOpenChange,
  workspaceTemplate,
  sourceTemplate,
  workspaceId,
  actorProfileId,
}: Props) {
  const { t } = useTranslation("contracts");

  // Record mount time so `drift_dismissed` can report view_duration_ms.
  const mountedAtRef = useRef<number | null>(null);
  // Guard so we only emit `drift_viewed` once per opening (Strict Mode safe).
  const viewedForIdRef = useRef<string | null>(null);

  // Emit drift_viewed on open — the admin intentionally looked at drift.
  useEffect(() => {
    if (!open || !workspaceTemplate) return;
    const id = workspaceTemplate.template_id;
    if (viewedForIdRef.current === id) return;

    viewedForIdRef.current = id;
    mountedAtRef.current = Date.now();

    void emit({
      event: "contract_template.drift_viewed",
      workspace_id: workspaceId,
      actor_id: actorProfileId ?? "",
      properties: {
        entity: {
          entity_type: "contract_template",
          entity_id: id,
          entity_label: workspaceTemplate.name,
        },
        data: {
          // Stable per opening — the workspace template id uniquely identifies
          // "this drift surface for this admin right now". Full drift-event
          // objects land in Phase 5 when we persist drift history server-side.
          drift_event_id: id,
          drift_type: "k1a_version_behind",
        },
      },
    });
  }, [open, workspaceTemplate, workspaceId, actorProfileId]);

  // Reset the viewed-id guard when the drawer fully closes so a re-open on the
  // same template re-emits (each viewing is a discrete observation).
  useEffect(() => {
    if (!open) {
      viewedForIdRef.current = null;
    }
  }, [open]);

  function handleOpenChange(next: boolean) {
    // Fire drift_dismissed before bubbling up so closing + teardown order is
    // deterministic. Only emit when we previously emitted drift_viewed for
    // this template id — otherwise dismiss without a matching view entry.
    if (!next && workspaceTemplate && viewedForIdRef.current === workspaceTemplate.template_id) {
      const duration = mountedAtRef.current ? Date.now() - mountedAtRef.current : 0;
      void emit({
        event: "contract_template.drift_dismissed",
        workspace_id: workspaceId,
        actor_id: actorProfileId ?? "",
        properties: {
          entity: {
            entity_type: "contract_template",
            entity_id: workspaceTemplate.template_id,
            entity_label: workspaceTemplate.name,
          },
          data: {
            drift_event_id: workspaceTemplate.template_id,
            drift_type: "k1a_version_behind",
            view_duration_ms: duration,
          },
        },
      });
    }
    onOpenChange(next);
  }

  // ── Empty guards ─────────────────────────────────────────────────────────
  // Drawer caller should ensure both objects are present when opening; we
  // still render the Sheet so the surface can animate in/out cleanly even if
  // the content is still loading upstream.

  const workspaceVersion = workspaceTemplate?.source_template_version ?? "?";
  const currentVersion = sourceTemplate?.version != null ? String(sourceTemplate.version) : "?";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="bg-background/80 border-border/60 relative flex w-full flex-col gap-0 p-0 backdrop-blur-xl sm:max-w-[640px]"
      >
        {/* 1px warm gradient border — Nordic Split glass recipe. The mask
            uses `black` as an opaque matte for CSS mask-composite chaining
            (not a visible color — it's the opacity map for the border). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.82 0.14 55 / 0.25) 0%, transparent 40%, transparent 60%, oklch(0.82 0.14 55 / 0.10) 100%)",
            mask: "linear-gradient(black 0 0) content-box, linear-gradient(black 0 0)",
            maskComposite: "exclude",
            padding: 1,
            borderRadius: "inherit",
          }}
        />

        {/* Header — entrance per Nordic Split spring envelope */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={DRAWER_SPRING}
          className="relative z-10 flex items-start justify-between px-6 pt-6 pb-4"
        >
          <div>
            <h2 className="font-heading text-foreground text-2xl leading-tight tracking-tight">
              {t("drift.drawer_title")}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
              {t("drift.drawer_subtitle", {
                source: sourceTemplate?.name ?? "—",
                workspace_version: workspaceVersion,
                current_version: currentVersion,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="text-muted-foreground hover:text-foreground -mr-2 rounded-md p-1.5 transition-colors"
            aria-label={t("drift.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </motion.header>

        {/* Diff body — side-by-side. Scrolls as one pane so admins compare at
            the same vertical position. Per Phase 4 scope: NO clause-level
            diff algorithm — we render both full HTMLs. Differences are
            visually observable; semantic diff is Phase 5. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...DRAWER_SPRING, delay: 0.05 }}
          className="relative z-10 flex-1 overflow-y-auto px-6 py-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <DiffPane
              labelKey="drift.your_version"
              version={workspaceVersion}
              html={workspaceTemplate?.content_html ?? null}
              tone="neutral"
              t={t}
            />
            <DiffPane
              labelKey="drift.smartout_version"
              version={currentVersion}
              html={sourceTemplate?.content_html ?? null}
              tone="warn"
              t={t}
            />
          </div>
        </motion.div>

        {/* Footer — only Lukk (close). No accept / reject per Phase 4 scope. */}
        <footer className="border-border/60 relative z-10 flex items-center justify-end border-t px-6 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            {t("drift.close")}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DiffPane({
  labelKey,
  version,
  html,
  tone,
  t,
}: {
  labelKey: string;
  version: string;
  html: string | null;
  tone: "neutral" | "warn";
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // Tone decides the ambient wash — warm amber on the "Smartouts versjon"
  // side to pull the eye toward what is new. We use the `--warning` CSS
  // variable directly; no hardcoded amber class.
  const warnStyle =
    tone === "warn"
      ? {
          background: "hsl(var(--warning) / 0.06)",
          borderColor: "hsl(var(--warning) / 0.25)",
        }
      : undefined;

  return (
    <section
      className="border-border/60 flex min-h-[320px] flex-col rounded-lg border"
      style={warnStyle}
    >
      <header className="border-border/60 flex items-center justify-between border-b px-3 py-2">
        <span className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
          {t(labelKey)}
        </span>
        <span className="text-muted-foreground font-mono text-[10px]">v{version}</span>
      </header>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {html ? (
          // NOTE: content_html is admin-authored and already stored in our DB —
          // this is the same content path used by ContractPreviewEditor in the
          // CompositionDrawer. We render as-is for faithful visual comparison.
          <div
            className="text-foreground prose prose-sm max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-muted-foreground text-xs italic">{t("drift.no_content")}</p>
        )}
      </div>
    </section>
  );
}
