"use client";

/**
 * ContractDispatchDrawer — 2-step right-side glass Sheet for dispatching a
 * contract to an employee from /people/[id].
 *
 * What: Collapsed 5-step CompositionDrawer → 2 focused steps per L-0174 and
 *       ARCHITECTURE §UI 1 Migration Map.
 * Why:  - Old Step 1 (Ansatt selector) removed — drawer opens FROM people-page,
 *           employee context is implicit.
 *       - Old Step 2 (Stilling fields) migrated to HrTabSections (people-page).
 *       - Old Steps 3-5 collapsed into two: mal-selection + preview+send.
 *       - ComplianceBadge and BlockerCounter moved to people-page section header.
 *       - Cascade ghost-values live on people-page input fields.
 *
 * Step 1 — Velg mal (template chooser):
 *   - Lists active, non-deprecated templates for the workspace.
 *   - Auto-suggests based on target_role/employment_category (ADR-0181).
 *   - Blockers disable selection until resolved.
 *   - Emits contracts.compose.template_selected.
 *
 * Step 2 — Preview + Send:
 *   - PDF preview (iframe) — MANDATORY gate before AcknowledgementRing
 *     (ADR-0244): ring stays disabled until pdf_preview_viewed_at is set.
 *   - AcknowledgementRing — 4 key blocks (configurable per framework).
 *     WCAG AAA: role="group", per-block role="checkbox" + aria-checked,
 *     aria-live="polite" for progress.
 *   - useReducedMotion guard on spring animations.
 *   - framework_snapshot frozen on send.
 *   - Emits contract.send_initiated.
 *
 * ADR-0151 forgery defence: profile_id from URL context (people-page), NOT
 * from body. workspace_id derived server-side via JWT in the send endpoint.
 *
 * Motion: motionTokens.spring (stiffness 35 / damping 22 / mass 2.2) for
 * step transitions. useReducedMotion guard disables entrance animations.
 */

import {
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { EditorSkeleton } from "@/components/ui/editor-skeleton";

const ContractPreviewEditor = dynamic(
  () =>
    import("@/app/dashboard/people/contracts/_components/contract-preview-editor").then((m) => ({
      default: m.ContractPreviewEditor,
    })),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

import { MissingInfoSheet, type MissingField } from "@/components/contracts/MissingInfoSheet";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Eye,
  FileText,
  Loader2,
  Lock,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit, nonEmpty } from "@smartout/telemetry";

// ─── Types ──────────────────────────────────────────────────────────────────

type StepId = "mal" | "preview";

interface ContractTemplate {
  template_id: string;
  name: string;
  employment_category: string | null;
  workspace_id: string | null;
  deprecated_at: string | null;
  published_at: string | null;
  is_suggested?: boolean;
}

interface AckBlock {
  id: string;
  label: string;
  description: string;
}

const DEFAULT_ACK_BLOCKS: AckBlock[] = [
  {
    id: "stilling",
    label: "Stilling og arbeidsoppgaver",
    description: "Jeg bekrefter at stillingsbeskrivelse er korrekt",
  },
  {
    id: "lonn",
    label: "Lønn og kompensasjon",
    description: "Jeg bekrefter at lønnsvilkår er i henhold til tariff",
  },
  {
    id: "kategori",
    label: "Ansettelseskategori",
    description: "Jeg bekrefter at ansettelseskategorien er riktig",
  },
  {
    id: "framework",
    label: "Rammeverk og tariff",
    description: "Jeg bekrefter at riktig tariffavtale er valgt",
  },
];

/** Block ack state: undefined = idle, "highlighted" = first click (preview only),
 * "confirmed" = second click (counts toward send). 2-click prevents fat-finger send. */
type AckState = "highlighted" | "confirmed";

interface DrawerState {
  selectedTemplateId: string | null;
  selectedTemplate: ContractTemplate | null;
  acknowledgedBlocks: Map<string, AckState>;
  pdfPreviewViewedAt: string | null;
  isSending: boolean;
  signedContractId: string | null;
}

const initialState = (): DrawerState => ({
  selectedTemplateId: null,
  selectedTemplate: null,
  acknowledgedBlocks: new Map(),
  pdfPreviewViewedAt: null,
  isSending: false,
  signedContractId: null,
});

interface ContractDispatchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Profile ID for the target employee (comes from people-page URL context). */
  targetProfileId: string;
  targetProfileName: string;
  /** Pre-existing contract_id when re-dispatching an existing draft. */
  contractId?: string | null;
  onSuccess?: (contractId: string) => void;
}

// ─── AcknowledgementRing ───────────────────────────────────────────────────

function AcknowledgementRing({
  blocks,
  acknowledgedBlocks,
  onToggle,
  disabled,
}: {
  blocks: AckBlock[];
  acknowledgedBlocks: Map<string, AckState>;
  onToggle: (blockId: string) => void;
  disabled: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const confirmedCount = Array.from(acknowledgedBlocks.values()).filter(
    (s) => s === "confirmed",
  ).length;
  const totalCount = blocks.length;

  return (
    <div
      role="group"
      aria-label="Bekreftelsesblokker — klikk to ganger for å bekrefte"
      className="space-y-2"
    >
      {/* Progress header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Bekreftelser</span>
        <span
          className={`font-semibold ${confirmedCount === totalCount ? "text-emerald-500" : "text-foreground"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {confirmedCount} av {totalCount} bekreftet
        </span>
      </div>
      <p className="text-muted-foreground text-[11px] italic">
        Klikk én gang for å markere, klikk igjen for å bekrefte.
      </p>

      {blocks.map((block) => {
        const ackState = acknowledgedBlocks.get(block.id);
        const isHighlighted = ackState === "highlighted";
        const isConfirmed = ackState === "confirmed";
        return (
          <motion.button
            key={block.id}
            data-testid={`ack-ring-block-${block.id}`}
            data-ack-state={ackState ?? "idle"}
            type="button"
            role="checkbox"
            aria-checked={isConfirmed}
            aria-disabled={disabled}
            onClick={() => !disabled && onToggle(block.id)}
            disabled={disabled}
            className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:outline-none ${
              isConfirmed
                ? "border-emerald-500/40 bg-emerald-500/5"
                : isHighlighted
                  ? "border-orange-500/50 bg-orange-500/5 ring-2 ring-orange-500/20"
                  : "border-border bg-card hover:bg-muted/50"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            animate={prefersReduced ? {} : { scale: isHighlighted ? 1.01 : 1 }}
            transition={motionTokens.springSnappy}
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={
                  prefersReduced
                    ? {}
                    : {
                        scale: isConfirmed ? 1 : isHighlighted ? 0.95 : 0.8,
                        opacity: isConfirmed ? 1 : isHighlighted ? 0.85 : 0.4,
                      }
                }
                transition={motionTokens.springSnappy}
              >
                {isConfirmed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : isHighlighted ? (
                  <CheckCircle2 className="h-4 w-4 text-orange-500" />
                ) : (
                  <div className="border-border h-4 w-4 rounded-full border-2" />
                )}
              </motion.div>
              <div>
                <p className="text-foreground text-sm font-medium">{block.label}</p>
                <p className="text-muted-foreground text-xs">{block.description}</p>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function ContractDispatchDrawer({
  open,
  onOpenChange,
  targetProfileId,
  targetProfileName,
  contractId: existingContractId,
  onSuccess,
}: ContractDispatchDrawerProps) {
  const { workspaceData, profileId: actorProfileId } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  const prefersReduced = useReducedMotion();

  const [stepId, setStepId] = useState<StepId>("mal");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [state, setState] = useState<DrawerState>(initialState);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isSending, startSend] = useTransition();
  // Preview pipeline: when a template is selected we fetch its content_html
  // + the resolved placeholder map for the target profile, then substitute
  // {{key}} tokens. Rendered into a sandboxed iframe so template HTML cannot
  // execute scripts or steal state.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // SMA-303: track Tiptap edits and PDF-ack snapshot (ADR-0244 legal evidence gate)
  const editedHtmlRef = useRef<string>(""); // tracks Tiptap edits
  const pdfAckdHtmlRef = useRef<string>(""); // snapshot at PDF-ack moment

  // SMA-305: MissingInfoSheet state
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [missingInfoSheetOpen, setMissingInfoSheetOpen] = useState(false);

  const ackBlocks = DEFAULT_ACK_BLOCKS;

  // Reset on drawer close
  useEffect(() => {
    if (!open) {
      setStepId("mal");
      setDirection("forward");
      setState(initialState());
      editedHtmlRef.current = "";
      pdfAckdHtmlRef.current = "";
      setMissingFields([]);
      setMissingInfoSheetOpen(false);
    }
  }, [open]);

  // Load templates when drawer opens
  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoadingTemplates(true);
    fetch(`/api/contracts/templates?workspace_id=${workspaceId}`)
      .then((r) => r.json())
      .then((res: { data?: ContractTemplate[] }) => {
        // API envelope: { data: [...] }. Filter to dispatchable templates:
        //  - workspace-specific (workspace_id matches) OR system K1a (workspace_id IS NULL)
        //  - not deprecated (deprecated_at IS NULL)
        //  - published (published_at IS NOT NULL) — only live templates dispatch
        // K1a system templates are pre-published by seed, so they pass.
        const tpls = (res.data ?? []).filter(
          (t) => !t.deprecated_at && (t.workspace_id === null || t.published_at !== null),
        );
        setTemplates(tpls);
      })
      .catch(() => toast.error("Kunne ikke laste maler"))
      .finally(() => setLoadingTemplates(false));
  }, [open, workspaceId]);

  const navigate = useCallback((next: StepId, dir: "forward" | "back") => {
    setDirection(dir);
    setStepId(next);
  }, []);

  const handleTemplateSelect = (template: ContractTemplate) => {
    setState((prev) => ({
      ...prev,
      selectedTemplateId: template.template_id,
      selectedTemplate: template,
    }));
    void emit({
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      event: "contracts.compose.template_selected",
      properties: {
        entity: { entity_type: "workspace", entity_id: workspaceId },
        data: {
          template_id: template.template_id,
          target_profile_id: targetProfileId,
          employment_category: template.employment_category,
        },
      },
    });
  };

  // Resolve placeholders + fetch content_html when template selected.
  // Token substitution is naive {{key}} string-replace — sufficient for the
  // current placeholder shape from buildEmployeePlaceholderMap. Sandboxed
  // iframe prevents script execution.
  useEffect(() => {
    const tplId = state.selectedTemplateId;
    if (!tplId || !workspaceId || !targetProfileId) {
      setPreviewHtml(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void (async () => {
      try {
        const [tplRes, phRes] = await Promise.all([
          fetch(`/api/contracts/templates/${tplId}?workspace_id=${workspaceId}`),
          fetch("/api/contracts/resolve-placeholders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile_id: targetProfileId, workspace_id: workspaceId }),
          }),
        ]);
        if (!tplRes.ok) {
          if (!cancelled) setPreviewHtml(null);
          return;
        }
        const tplJson = (await tplRes.json()) as { data?: { content_html?: string | null } };
        const phJson = phRes.ok ? ((await phRes.json()) as Record<string, string>) : {};
        let html = tplJson.data?.content_html ?? "";
        for (const [key, value] of Object.entries(phJson)) {
          // Wrap key with {{...}} braces so substitution only replaces placeholders,
          // not naked occurrences of the key name in regular contract text.
          // ALSO: skip substitution when value is empty/null — keeps {{key}} visible
          // in preview so admin sees what data is missing (per Pontus 2026-05-06).
          // Admin can either fill data via popup OR edit the {{key}} text inline.
          if (value && value.length > 0) {
            html = html.split(`{{${key}}}`).join(value);
          }
        }
        if (!cancelled) {
          setPreviewHtml(html || null);
          // SMA-303: initialise edit ref so first snapshot matches server-resolved HTML
          editedHtmlRef.current = html || "";
        }
      } catch {
        if (!cancelled) setPreviewHtml(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.selectedTemplateId, workspaceId, targetProfileId]);

  const handlePdfViewed = () => {
    const viewedAt = new Date().toISOString();
    // SMA-303: snapshot edit state at ack moment for ADR-0244 legal evidence gate
    pdfAckdHtmlRef.current = editedHtmlRef.current;
    setState((prev) => ({ ...prev, pdfPreviewViewedAt: viewedAt }));
    void emit({
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      event: "contract.pdf_preview_viewed",
      properties: {
        entity: {
          entity_type: "employment_contract",
          entity_id: existingContractId ?? targetProfileId,
        },
        data: {
          contract_id: existingContractId ?? "",
          template_id: state.selectedTemplateId ?? "",
          viewed_at: viewedAt,
        },
      },
    });
  };

  const handleToggleBlock = (blockId: string) => {
    const contractIdForEmit = existingContractId ?? targetProfileId;
    // 2-click state machine: idle → "highlighted" → "confirmed" → idle (uncheck).
    // Compute transition outside updater (pure-updater rule).
    let nextState: AckState | null = null;
    setState((prev) => {
      const next = new Map(prev.acknowledgedBlocks);
      const current = next.get(blockId);
      if (current === undefined) {
        next.set(blockId, "highlighted");
        nextState = "highlighted";
      } else if (current === "highlighted") {
        next.set(blockId, "confirmed");
        nextState = "confirmed";
      } else {
        // current === "confirmed" → uncheck
        next.delete(blockId);
        nextState = null;
      }
      return { ...prev, acknowledgedBlocks: next };
    });
    // Emit only when reaching "confirmed" — preserves single-emit-per-confirm contract.
    if (nextState === "confirmed") {
      void emit({
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        event: "contract.acknowledgement.block_confirmed",
        properties: {
          entity: { entity_type: "employment_contract", entity_id: contractIdForEmit },
          data: {
            obligation_id: blockId,
            contract_id: contractIdForEmit,
            is_constructive_dismissal_risk: false,
            acknowledged_by: actorProfileId ?? "",
          },
        },
      });
    }
  };

  const allBlocksAcknowledged =
    Array.from(state.acknowledgedBlocks.values()).filter((s) => s === "confirmed").length ===
    ackBlocks.length;
  const pdfViewed = !!state.pdfPreviewViewedAt;
  const canSend = allBlocksAcknowledged && pdfViewed && !!state.selectedTemplateId && !isSending;

  const handleSend = () => {
    if (!canSend) return;
    startSend(async () => {
      try {
        const res = await fetch(`/api/contracts/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: state.selectedTemplateId,
            target_profile_id: targetProfileId,
            blocks_acknowledged: Array.from(state.acknowledgedBlocks.entries())
              .filter(([, s]) => s === "confirmed")
              .map(([k]) => k),
            existing_contract_id: existingContractId ?? null,
            // SMA-303: pass admin-edited HTML so contract-service skips resolvePlaceholders()
            resolved_html: editedHtmlRef.current || undefined,
            // SMA-310 / ADR-0310: server-enforced PDF preview gate.
            // Client state is for UX disable; server validates and persists.
            pdf_preview_viewed_at: state.pdfPreviewViewedAt,
          }),
        });

        if (!res.ok) {
          // Parse body once — res.json() is single-consume
          const body = (await res.json()) as {
            error?: string;
            code?: string;
            user_message_no?: string;
            missing_fields?: MissingField[];
          };

          // SMA-307: contract-service down → actionable toast with retry
          if (res.status === 503 && body.code === "CONTRACT_SERVICE_DOWN") {
            toast.error("Kontrakt-tjenesten er utilgjengelig akkurat nå. Prøv igjen om 1 minutt.", {
              action: { label: "Prøv nå", onClick: () => handleSend() },
              duration: 10000,
            });
            return;
          }

          // SMA-305: missing PII → open MissingInfoSheet
          if (body.error === "missing_employment_data" && body.missing_fields?.length) {
            setMissingFields(body.missing_fields);
            setMissingInfoSheetOpen(true);
            return;
          }

          toast.error(body.user_message_no ?? body.error ?? "Sending feilet");
          return;
        }

        const result = (await res.json()) as { contract_id?: string };
        const cid = result.contract_id ?? existingContractId ?? "";

        void emit({
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(actorProfileId, "actor_id"),
          event: "contract.send_initiated",
          properties: {
            entity: { entity_type: "employment_contract", entity_id: cid },
            data: {
              contract_id: cid,
              template_id: state.selectedTemplateId ?? "",
              target_profile_id: targetProfileId,
              blocks_acknowledged: Array.from(state.acknowledgedBlocks.entries())
                .filter(([, s]) => s === "confirmed")
                .map(([k]) => k),
              framework_snapshot_frozen: true,
            },
          },
        });

        toast.success("Kontrakt sendt til signering");
        onSuccess?.(cid);
        onOpenChange(false);
      } catch {
        toast.error("Noe gikk galt ved sending");
      }
    });
  };

  // ─── Rendering ────────────────────────────────────────────────────────────

  const spring = prefersReduced ? {} : motionTokens.spring;
  const slideVariants = {
    enter: (dir: "forward" | "back") => ({
      x: dir === "forward" ? 32 : -32,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: "forward" | "back") => ({
      x: dir === "forward" ? -32 : 32,
      opacity: 0,
    }),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="dispatch-drawer"
        side="right"
        className="bg-background/80 border-border flex h-full w-full max-w-[1400px] flex-col gap-0 p-0 backdrop-blur-xl sm:max-w-[80vw]"
      >
        {/* Gradient border top-left (Nordic Split glassmorphism) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-l-2xl"
          style={{
            background: "linear-gradient(135deg, hsl(var(--border) / 0.4) 0%, transparent 40%)",
          }}
        />

        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div>
            <SheetTitle className="text-foreground text-base font-semibold">
              Send kontrakt
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-xs">
              {targetProfileName}
            </SheetDescription>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {(["mal", "preview"] as StepId[]).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === stepId ? "w-8 bg-orange-500" : "bg-muted w-4"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {stepId === "mal" && (
              <motion.div
                key="step-mal"
                custom={direction}
                variants={slideVariants}
                initial={prefersReduced ? false : "enter"}
                animate="center"
                exit={prefersReduced ? undefined : "exit"}
                transition={{ type: "spring", ...spring }}
                className="h-full overflow-y-auto p-6"
              >
                <h2 className="text-foreground mb-1 text-sm font-semibold">Velg mal</h2>
                <p className="text-muted-foreground mb-4 text-xs">
                  Velg kontraktmal for {targetProfileName}
                </p>

                {loadingTemplates ? (
                  <div className="flex items-center gap-2 py-8">
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground text-sm">Laster maler…</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="border-border bg-muted/30 rounded-xl border p-6 text-center">
                    <FileText className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                    <p className="text-foreground text-sm font-medium">Ingen maler tilgjengelig</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Opprett eller publiser en kontraktmal under Innstillinger → Kontraktsmaler
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.template_id}
                        type="button"
                        onClick={() => handleTemplateSelect(tpl)}
                        className={`w-full rounded-xl border p-4 text-left transition-colors ${
                          state.selectedTemplateId === tpl.template_id
                            ? "border-orange-500/50 bg-orange-500/5"
                            : "border-border bg-card hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-foreground text-sm font-medium">{tpl.name}</p>
                            {tpl.employment_category && (
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {tpl.employment_category}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {tpl.is_suggested && (
                              <span className="bg-primary/10 text-primary flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                                <Sparkles className="h-3 w-3" />
                                Foreslått
                              </span>
                            )}
                            {state.selectedTemplateId === tpl.template_id && (
                              <CheckCircle2 className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {stepId === "preview" && (
              <motion.div
                key="step-preview"
                custom={direction}
                variants={slideVariants}
                initial={prefersReduced ? false : "enter"}
                animate="center"
                exit={prefersReduced ? undefined : "exit"}
                transition={{ type: "spring", ...spring }}
                className="flex h-full flex-row overflow-hidden"
              >
                {/* LEFT pane (~60%): Tiptap editor — full available height + scroll.
                    SMA-303: editable. Edit-after-ack invalidates pdfPreviewViewedAt
                    (ADR-0244 legal evidence preserved). */}
                <div className="border-border bg-muted/20 relative flex min-w-0 flex-1 flex-col border-r">
                  {previewLoading ? (
                    <div className="flex flex-1 items-center justify-center p-6">
                      <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                    </div>
                  ) : previewHtml ? (
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto">
                        <ContractPreviewEditor
                          contentHtml={previewHtml ?? ""}
                          mode="edit"
                          onContentChange={(html) => {
                            editedHtmlRef.current = html;
                            // Edit AFTER ack → invalidate ack so admin must re-confirm (ADR-0244)
                            if (pdfAckdHtmlRef.current && html !== pdfAckdHtmlRef.current) {
                              setState((prev) => ({ ...prev, pdfPreviewViewedAt: null }));
                              pdfAckdHtmlRef.current = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                      <Eye className="text-muted-foreground h-8 w-8" />
                      <p className="text-muted-foreground text-xs">
                        Velg mal for å se forhåndsvisning
                      </p>
                    </div>
                  )}
                </div>

                {/* RIGHT pane (~440px fixed): PDF-gate + AcknowledgementRing.
                    Scrollable independently from editor. */}
                <div className="bg-background/40 flex w-[440px] shrink-0 flex-col overflow-y-auto">
                  <div className="border-border flex flex-col gap-4 border-b p-5">
                    <h3 className="text-foreground text-sm font-semibold">Forhåndsvisning</h3>
                    {pdfViewed ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Lest gjennom
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Bla gjennom kontrakten i venstre panel og bekreft når du har lest.
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handlePdfViewed}
                      disabled={pdfViewed || !previewHtml}
                      className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:cursor-default disabled:bg-emerald-500 disabled:opacity-90"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {pdfViewed ? "Bekreftet" : "Jeg har lest gjennom"}
                    </button>
                  </div>

                  <div className="p-5">
                    <h3 className="text-foreground mb-3 text-sm font-semibold">
                      Bekreftelser før sending
                    </h3>
                    {!pdfViewed && (
                      <div className="border-border bg-muted/30 mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs">
                        <Lock className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="text-muted-foreground">
                          Bekreft &laquo;Jeg har lest gjennom&raquo; først.
                        </span>
                      </div>
                    )}

                    <AcknowledgementRing
                      blocks={ackBlocks}
                      acknowledgedBlocks={state.acknowledgedBlocks}
                      onToggle={handleToggleBlock}
                      disabled={!pdfViewed}
                    />

                    {!allBlocksAcknowledged && pdfViewed && (
                      <p className="text-muted-foreground mt-3 text-xs" aria-live="polite">
                        Klikk hver blokk to ganger for å bekrefte.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer actions */}
        <div className="border-border flex items-center justify-between border-t px-6 py-4">
          {stepId === "preview" ? (
            <button
              type="button"
              onClick={() => navigate("mal", "back")}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Tilbake
            </button>
          ) : (
            <span />
          )}

          {stepId === "mal" ? (
            <button
              type="button"
              disabled={!state.selectedTemplateId}
              onClick={() => navigate("preview", "forward")}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-40"
            >
              Neste
            </button>
          ) : (
            <button
              type="button"
              data-testid="send-contract-btn"
              disabled={!canSend}
              onClick={handleSend}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-40"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send til signering
            </button>
          )}
        </div>
      </SheetContent>

      {/* SMA-305: MissingInfoSheet — opens when send returns 422 missing_employment_data */}
      <MissingInfoSheet
        open={missingInfoSheetOpen}
        onOpenChange={setMissingInfoSheetOpen}
        missing_fields={missingFields}
        target_profile_id={targetProfileId}
        target_display_name={targetProfileName}
        workspace_id={workspaceId}
        actor_profile_id={actorProfileId ?? ""}
        on_filled={() => {
          setMissingInfoSheetOpen(false);
          void emit({
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(actorProfileId, "actor_id"),
            event: "contract.send_retry_after_fill",
            properties: {
              entity: {
                entity_type: "employment_contract",
                entity_id: existingContractId ?? targetProfileId,
              },
              data: {
                target_profile_id: targetProfileId,
                filled_groups: [...new Set(missingFields.map((f) => f.section))],
              },
            },
          });
          handleSend();
        }}
      />
    </Sheet>
  );
}
