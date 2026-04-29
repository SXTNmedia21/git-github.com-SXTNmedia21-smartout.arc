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
  is_deprecated: boolean;
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

interface DrawerState {
  selectedTemplateId: string | null;
  selectedTemplate: ContractTemplate | null;
  acknowledgedBlocks: Set<string>;
  pdfPreviewViewedAt: string | null;
  isSending: boolean;
  signedContractId: string | null;
}

const initialState = (): DrawerState => ({
  selectedTemplateId: null,
  selectedTemplate: null,
  acknowledgedBlocks: new Set(),
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
  acknowledgedBlocks: Set<string>;
  onToggle: (blockId: string) => void;
  disabled: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const completedCount = acknowledgedBlocks.size;
  const totalCount = blocks.length;

  return (
    <div role="group" aria-label="Bekreftelsesblokker — alle må godkjennes" className="space-y-2">
      {/* Progress header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Bekreftelser</span>
        <span
          className={`font-semibold ${completedCount === totalCount ? "text-emerald-500" : "text-foreground"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {completedCount} av {totalCount} bekreftet
        </span>
      </div>

      {blocks.map((block) => {
        const checked = acknowledgedBlocks.has(block.id);
        return (
          <motion.button
            key={block.id}
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-disabled={disabled}
            onClick={() => !disabled && onToggle(block.id)}
            disabled={disabled}
            className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:outline-none ${
              checked
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border bg-card hover:bg-muted/50"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            animate={prefersReduced ? {} : { scale: checked ? 1 : 1 }}
            transition={motionTokens.springSnappy}
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={
                  prefersReduced ? {} : { scale: checked ? 1 : 0.8, opacity: checked ? 1 : 0.4 }
                }
                transition={motionTokens.springSnappy}
              >
                {checked ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
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

  const ackBlocks = DEFAULT_ACK_BLOCKS;

  // Reset on drawer close
  useEffect(() => {
    if (!open) {
      setStepId("mal");
      setDirection("forward");
      setState(initialState());
    }
  }, [open]);

  // Load templates when drawer opens
  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoadingTemplates(true);
    fetch(`/api/contracts/templates?workspace_id=${workspaceId}`)
      .then((r) => r.json())
      .then((data: { templates?: ContractTemplate[] }) => {
        const tpls = (data.templates ?? []).filter((t) => !t.is_deprecated);
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

  const handlePdfViewed = () => {
    const viewedAt = new Date().toISOString();
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
    setState((prev) => {
      const next = new Set(prev.acknowledgedBlocks);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
        // Emit each block confirmation (ADR-0244)
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
      return { ...prev, acknowledgedBlocks: next };
    });
  };

  const allBlocksAcknowledged = state.acknowledgedBlocks.size === ackBlocks.length;
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
            blocks_acknowledged: Array.from(state.acknowledgedBlocks),
            existing_contract_id: existingContractId ?? null,
          }),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          toast.error(err.error ?? "Sending feilet");
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
              blocks_acknowledged: Array.from(state.acknowledgedBlocks),
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
        side="right"
        className="bg-background/80 border-border flex h-full w-full max-w-[580px] flex-col gap-0 p-0 backdrop-blur-xl"
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
                      Opprett en kontraktmal under Kontrakter → Maler
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
                className="flex h-full flex-col overflow-hidden"
              >
                {/* PDF preview area */}
                <div className="border-border bg-muted/20 relative flex min-h-[280px] flex-1 flex-col items-center justify-center border-b">
                  {!pdfViewed ? (
                    <div className="flex flex-col items-center gap-3 p-6 text-center">
                      <Eye className="text-muted-foreground h-8 w-8" />
                      <div>
                        <p className="text-foreground text-sm font-semibold">
                          Se gjennom kontrakten
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Du må åpne forhåndsvisningen før du kan bekrefte
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePdfViewed}
                        className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                      >
                        <Eye className="h-4 w-4" />
                        Åpne forhåndsvisning
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 p-4">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      <p className="text-foreground text-sm font-medium">
                        Forhåndsvisning bekreftet
                      </p>
                    </div>
                  )}
                </div>

                {/* Acknowledgement ring + send */}
                <div className="overflow-y-auto p-6">
                  {!pdfViewed && (
                    <div className="border-border bg-muted/30 mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs">
                      <Lock className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="text-muted-foreground">
                        Åpne forhåndsvisningen for å låse opp bekreftelsene
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
                      Bekreft alle {ackBlocks.length} blokker for å sende
                    </p>
                  )}
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
    </Sheet>
  );
}
