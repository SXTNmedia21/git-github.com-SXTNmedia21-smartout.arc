"use client";

/**
 * CompositionDrawer — right-side glass Sheet that replaces the retired full-page
 * CompositionWizard. Lands as Phase 3 per council 2026-04-22 (Q4/Q5/Q8) and
 * JOURNEY-contract-composition-engine (amended: drawer flow).
 *
 * 5 steps:
 *   1. Ansatt       — virtualized employee picker (SelectEmployeeStep)
 *   2. Stilling     — position title + employment category + percentage
 *   3. Gjennomgang  — cascade derivation (ghost value cards, validations)
 *   4. Bekreft      — acknowledgement ring + inline ContractPreviewEditor
 *   5. Send         — two-path submit (PII complete → send; missing → collect)
 *
 * Reverse flow:
 *  - `initialProfileId` (set when opened from /people/[id]) pre-selects the
 *    profile and starts the drawer on step 2 (Stilling).
 *
 * Glass surface per Nordic Split:
 *  - `bg-background/80 backdrop-blur-xl`
 *  - 1px gradient border top-left (pseudo via an absolute child)
 *  - 640px wide, right side, full height
 *
 * Spring physics (Nordic Split / council Q8 render-stall fix):
 *  - Drawer entrance/exit handled by shadcn Sheet (CSS animations) to keep the
 *    overlay backdrop behaviour. Intra-drawer step transitions use framer
 *    springs stiffness 45 / damping 22 / mass 2.0 for snappy intra-drawer feel.
 *  - Brand-panel delay trap in AnimatedWizardShell does not apply here — this
 *    drawer has no brand panel.
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useTranslation } from "@smartout/i18n";
import { withEntrance, Button, Input, Label } from "@smartout/ui";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { ContractDraftProposal, EmploymentCategory, PlaceholderDef } from "@smartout/utils";
import { resolvePlaceholders } from "@smartout/utils";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { EditorSkeleton } from "@/components/ui/editor-skeleton";
import {
  useComposeContract,
  useSendContract,
} from "@/app/dashboard/people/contracts/_hooks/use-employment-contracts";
import { GhostValueCard } from "@/app/dashboard/people/contracts/_components/GhostValueCard";
import { ComplianceBadge } from "@/app/dashboard/people/contracts/_components/ComplianceBadge";
import { BlockerCounter } from "@/app/dashboard/people/contracts/_components/BlockerCounter";
import { AcknowledgementRing } from "@/app/dashboard/people/contracts/_components/AcknowledgementRing";
import { ReasoningDrawer } from "@/app/dashboard/people/contracts/_components/ReasoningDrawer";
import { SelectEmployeeStep, type EmployeeProfile } from "./SelectEmployeeStep";
import { emit, nonEmpty } from "@smartout/telemetry";
import { UnsavedChangesGuard } from "@/components/UnsavedChangesGuard";

const ContractPreviewEditor = dynamic(
  () =>
    import("@/app/dashboard/people/contracts/_components/contract-preview-editor").then((m) => ({
      default: withEntrance(m.ContractPreviewEditor),
    })),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

// ── Types ──────────────────────────────────────────────────────────────────

type StepId = "ansatt" | "stilling" | "gjennomgang" | "bekreft" | "send";

const STEP_ORDER: StepId[] = ["ansatt", "stilling", "gjennomgang", "bekreft", "send"];

type DrawerState = {
  profileId: string;
  profileName: string;
  positionTitle: string;
  employmentCategory: EmploymentCategory;
  employmentPercentage: number;
  proposal: (ContractDraftProposal & { contract_id?: string }) | null;
  acknowledgedBlocks: Set<string>;
  isLoading: boolean;
  isSending: boolean;
  previewHtml: string | null;
  editedHtml: string | null;
};

type CompositionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, skips step 1 and starts on step 2 with profile preselected. */
  initialProfileId?: string;
  onSuccess?: (contractId: string) => void;
};

// Spring physics — intra-drawer step transitions (snappier than the brand panel
// since the user is already inside the drawer surface). Exit is deliberately
// a touch faster than entrance to avoid perceived "hang".
const STEP_ENTRANCE = { type: "spring" as const, stiffness: 45, damping: 22, mass: 2.0 };
const STEP_EXIT = { type: "spring" as const, stiffness: 40, damping: 24, mass: 2.0 };

// Step-indicator underline — matches the 2px active underline in the Phase 2
// hub tabs so the typography-led rhythm carries into the drawer.
const UNDERLINE_SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

// ── Exported component ─────────────────────────────────────────────────────

export function CompositionDrawer({
  open,
  onOpenChange,
  initialProfileId,
  onSuccess,
}: CompositionDrawerProps) {
  const { t } = useTranslation("contracts");
  const { workspaceData, profileId: actorProfileId } = useContext(DashboardContext);

  // The drawer always starts at `ansatt`. If a reverse-flow `initialProfileId`
  // is provided, we jump to `stilling` once the drawer mounts and the profile
  // is seeded into state.
  const [stepId, setStepId] = useState<StepId>("ansatt");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [state, setStateRaw] = useState<DrawerState>(() => initialState());

  const composeMutation = useComposeContract();
  const sendMutation = useSendContract();

  // Unsaved-changes guard
  const [guardOpen, setGuardOpen] = useState(false);
  const workspaceId = workspaceData?.workspace_id ?? "";

  // hasUserEdited tracks intentional input — set true only on deliberate user
  // action (not on drawer open with a pre-seeded profileId). This prevents
  // the false-positive where isDirty fires immediately when `initialProfileId`
  // seeds state.profileId before the user has touched anything.
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const isDirty = hasUserEdited;

  // Stable updater — merges partial state.
  const updateState = useCallback((patch: Partial<DrawerState>) => {
    setStateRaw((prev) => ({ ...prev, ...patch }));
  }, []);

  // Reverse-flow seeding: apply `initialProfileId` once when the drawer opens
  // (not on every parent rerender). We also reset to a fresh state on open so
  // a previous session's draft does not leak.
  const seededFromInitialRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      // On close, reset for next time. Keep the drawer idle between sessions.
      seededFromInitialRef.current = null;
      setStepId("ansatt");
      setStateRaw(initialState());
      setGuardOpen(false);
      setHasUserEdited(false);
      return;
    }

    if (initialProfileId && seededFromInitialRef.current !== initialProfileId) {
      seededFromInitialRef.current = initialProfileId;
      setStateRaw((prev) => ({ ...prev, profileId: initialProfileId, profileName: "" }));
      setStepId("stilling");
      setDirection("forward");
    }
  }, [open, initialProfileId]);

  // Close-interception — guard fires when isDirty
  function handleOpenChange(next: boolean) {
    if (!next && isDirty) {
      setGuardOpen(true);
      void emit({
        event: "forms.unsaved_guard.shown",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        properties: {
          entity: { entity_type: "workspace", entity_id: workspaceId },
          data: { form: "composition_drawer" },
        },
      });
      return;
    }
    onOpenChange(next);
  }

  // Preview hydration — once the proposal lands with a resolved_template,
  // fetch the template body + resolve placeholders so the Bekreft step can
  // render an inline preview (mirrors the canonical pattern in
  // contract-send-drawer.tsx::goToPreview). Without this the `previewHtml`
  // field stays null and the preview block in BekreftStep is gated off.
  const resolvedTemplateId = state.proposal?.resolved_template?.template_id ?? null;
  const previewHydratedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      previewHydratedForRef.current = null;
      return;
    }
    if (!workspaceId || !state.profileId || !resolvedTemplateId) {
      console.log("[preview-hydrate] skip", {
        workspaceId,
        profileId: state.profileId,
        resolvedTemplateId,
      });
      return;
    }
    const cacheKey = `${resolvedTemplateId}:${state.profileId}`;
    if (previewHydratedForRef.current === cacheKey) return;
    previewHydratedForRef.current = cacheKey;

    let cancelled = false;
    (async () => {
      try {
        console.log("[preview-hydrate] start", { resolvedTemplateId });
        const [tplRes, mapRes] = await Promise.all([
          fetch(`/api/contracts/templates/${resolvedTemplateId}?workspace_id=${workspaceId}`),
          fetch("/api/contracts/resolve-placeholders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspace_id: workspaceId,
              profile_id: state.profileId,
            }),
          }),
        ]);
        console.log("[preview-hydrate] responses", {
          tplStatus: tplRes.status,
          mapStatus: mapRes.status,
        });
        if (!tplRes.ok || !mapRes.ok) return;
        const tplJson = (await tplRes.json()) as {
          data: { content_html: string; placeholders: PlaceholderDef[] };
        };
        const resolvedMap = (await mapRes.json()) as Record<string, string>;
        const contentHtml = tplJson.data?.content_html ?? "";
        const placeholders = tplJson.data?.placeholders ?? [];
        console.log("[preview-hydrate] data", {
          contentHtmlLen: contentHtml.length,
          placeholderCount: placeholders.length,
          mapKeys: Object.keys(resolvedMap).length,
        });
        const { resolved_html } = resolvePlaceholders(contentHtml, placeholders, resolvedMap, {});
        if (!cancelled) {
          console.log("[preview-hydrate] set", { resolvedHtmlLen: resolved_html.length });
          updateState({ previewHtml: resolved_html, editedHtml: resolved_html });
        }
      } catch (err) {
        console.error("[preview-hydrate] error", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, state.profileId, resolvedTemplateId, updateState]);

  // Navigation ───────────────────────────────────────────────────────────────

  const currentIndex = STEP_ORDER.indexOf(stepId);
  const canGoBack = currentIndex > 0;

  const goNext = useCallback(() => {
    const next = STEP_ORDER[currentIndex + 1];
    if (!next) return;
    setDirection("forward");
    setStepId(next);
  }, [currentIndex]);

  const goBack = useCallback(() => {
    const prev = STEP_ORDER[currentIndex - 1];
    if (!prev) return;
    setDirection("back");
    setStepId(prev);
  }, [currentIndex]);

  // Step-gating — what `Neste` requires for each step.
  const canProceed = useMemo(() => {
    switch (stepId) {
      case "ansatt":
        return Boolean(state.profileId);
      case "stilling":
        return state.positionTitle.trim().length > 0;
      case "gjennomgang":
        return state.proposal !== null && !state.isLoading;
      case "bekreft":
        return state.acknowledgedBlocks.size >= 4; // four ghost values minimum
      case "send":
        return false; // send step has its own action button
      default:
        return false;
    }
  }, [stepId, state]);

  // Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <UnsavedChangesGuard
        isDirty={isDirty}
        open={guardOpen}
        onOpenChange={(open) => {
          if (!open) {
            // User clicked "Fortsett å redigere"
            void emit({
              event: "forms.unsaved_guard.kept",
              workspace_id: nonEmpty(workspaceId, "workspace_id"),
              actor_id: nonEmpty(actorProfileId, "actor_id"),
              properties: {
                entity: { entity_type: "workspace", entity_id: workspaceId },
                data: { form: "composition_drawer" },
              },
            });
          }
          setGuardOpen(open);
        }}
        onConfirmDiscard={() => {
          void emit({
            event: "forms.unsaved_guard.discarded",
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(actorProfileId, "actor_id"),
            properties: {
              entity: { entity_type: "workspace", entity_id: workspaceId },
              data: { form: "composition_drawer" },
            },
          });
          setGuardOpen(false);
          setStepId("ansatt");
          setStateRaw(initialState());
          onOpenChange(false);
        }}
      />
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          data-testid="composition-drawer"
          side="right"
          className="bg-background/80 border-border/60 relative flex w-full flex-col gap-0 p-0 backdrop-blur-xl sm:max-w-[640px]"
        >
          {/* 1px gradient border — top-left accent per Nordic Split glass recipe */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklch, var(--brand-glow-warm) 25%, transparent) 0%, transparent 40%, transparent 60%, color-mix(in oklch, var(--brand-glow-warm) 10%, transparent) 100%)",
              mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              maskComposite: "exclude",
              padding: 1,
              borderRadius: "inherit",
            }}
          />

          {/* Header */}
          <header className="relative z-10 flex items-start justify-between px-6 pt-6 pb-4">
            <div>
              <SheetTitle className="font-heading text-foreground text-2xl leading-tight tracking-tight">
                {t("composition.drawer_title")}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground mt-1 text-sm">
                {t("composition.drawer_subtitle")}
              </SheetDescription>
            </div>
          </header>

          {/* Step indicator — typography-led with 2px active underline */}
          <nav
            aria-label={t("composition.step_nav_label")}
            className="border-border/60 relative z-10 border-b px-6 pb-1"
          >
            <ol className="flex gap-5">
              {STEP_ORDER.map((id, i) => {
                const isActive = id === stepId;
                const isDone = i < currentIndex;
                return (
                  <li key={id} className="relative">
                    <span
                      className={`font-mono text-[11px] tracking-wide uppercase transition-colors ${
                        isActive
                          ? "text-foreground"
                          : isDone
                            ? "text-muted-foreground"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")} · {t(`composition.step_${id}`)}
                    </span>
                    {isActive && (
                      <motion.span
                        layoutId="composition-drawer-active"
                        className="bg-primary absolute -bottom-1 left-0 h-[2px] w-full"
                        transition={UNDERLINE_SPRING}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Step body — animated between steps */}
          <div className="relative z-10 flex-1 overflow-y-auto px-6 py-5">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={stepId}
                custom={direction}
                initial={{
                  opacity: 0,
                  x: direction === "forward" ? 24 : -24,
                }}
                animate={{ opacity: 1, x: 0, transition: STEP_ENTRANCE }}
                exit={{
                  opacity: 0,
                  x: direction === "forward" ? -16 : 16,
                  transition: STEP_EXIT,
                }}
                className="flex h-full flex-col"
              >
                {stepId === "ansatt" && (
                  <div data-testid="composition-drawer-step-1">
                    <AnsattStep
                      workspaceId={workspaceData?.workspace_id ?? ""}
                      selectedId={state.profileId}
                      initialProfileId={initialProfileId}
                      onChange={(p) => {
                        setHasUserEdited(true);
                        updateState({
                          profileId: p.profile_id,
                          profileName: p.display_name,
                          proposal: null,
                        });
                      }}
                    />
                  </div>
                )}

                {stepId === "stilling" && (
                  <div data-testid="composition-drawer-step-2">
                    <StillingStep
                      state={state}
                      updateState={updateState}
                      onUserEdit={() => setHasUserEdited(true)}
                    />
                  </div>
                )}

                {stepId === "gjennomgang" && (
                  <GjennomgangStep
                    state={state}
                    updateState={updateState}
                    workspaceId={workspaceData?.workspace_id ?? ""}
                    actorProfileId={actorProfileId}
                    onUserEdit={() => setHasUserEdited(true)}
                  />
                )}

                {stepId === "bekreft" && (
                  <BekreftStep
                    state={state}
                    updateState={updateState}
                    onUserEdit={() => setHasUserEdited(true)}
                  />
                )}

                {stepId === "send" && (
                  <SendStep
                    state={state}
                    updateState={updateState}
                    workspaceId={workspaceData?.workspace_id ?? ""}
                    actorProfileId={actorProfileId}
                    composeMutation={composeMutation}
                    sendMutation={sendMutation}
                    onSuccess={(contractId) => {
                      onSuccess?.(contractId);
                      onOpenChange(false);
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer — navigation */}
          <footer className="border-border/60 relative z-10 flex items-center justify-between border-t px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={!canGoBack || state.isSending}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("composition.back")}
            </Button>

            {stepId !== "send" ? (
              <Button
                type="button"
                size="sm"
                onClick={goNext}
                disabled={!canProceed || state.isLoading}
              >
                {t("composition.next")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              // Step 5 carries its own submit button; footer right is empty here.
              <span aria-hidden />
            )}
          </footer>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── initialState factory ───────────────────────────────────────────────────

function initialState(): DrawerState {
  return {
    profileId: "",
    profileName: "",
    positionTitle: "",
    employmentCategory: "fast",
    employmentPercentage: 100,
    proposal: null,
    acknowledgedBlocks: new Set<string>(),
    isLoading: false,
    isSending: false,
    previewHtml: null,
    editedHtml: null,
  };
}

// ── Step 1: Ansatt ─────────────────────────────────────────────────────────

function AnsattStep({
  workspaceId,
  selectedId,
  initialProfileId,
  onChange,
}: {
  workspaceId: string;
  selectedId: string;
  initialProfileId?: string;
  onChange: (p: EmployeeProfile) => void;
}) {
  return (
    <SelectEmployeeStep
      mode="single"
      workspaceId={workspaceId}
      selectedId={selectedId || null}
      initialProfileId={initialProfileId}
      onChange={onChange}
    />
  );
}

// ── Step 2: Stilling ───────────────────────────────────────────────────────

const CATEGORY_KEYS: { value: EmploymentCategory; labelKey: string }[] = [
  { value: "fast", labelKey: "composition.category_full_time" },
  { value: "deltid", labelKey: "composition.category_part_time" },
  { value: "tilkalling", labelKey: "composition.category_on_call" },
];

function StillingStep({
  state,
  updateState,
  onUserEdit,
}: {
  state: DrawerState;
  updateState: (patch: Partial<DrawerState>) => void;
  onUserEdit: () => void;
}) {
  const { t } = useTranslation("contracts");

  function handleCategoryChange(category: EmploymentCategory) {
    onUserEdit();
    if (category === "fast") {
      updateState({ employmentCategory: category, employmentPercentage: 100, proposal: null });
    } else if (category === "tilkalling") {
      updateState({ employmentCategory: category, employmentPercentage: 0, proposal: null });
    } else {
      const cur = state.employmentPercentage;
      const pct = cur > 0 && cur < 100 ? cur : 50;
      updateState({ employmentCategory: category, employmentPercentage: pct, proposal: null });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-foreground text-lg">{t("composition.position_title")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("composition.position_description")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="drawer-position-title">{t("composition.position_label")}</Label>
        <Input
          id="drawer-position-title"
          placeholder={t("composition.position_placeholder")}
          value={state.positionTitle}
          onChange={(e) => {
            onUserEdit();
            updateState({ positionTitle: e.target.value, proposal: null });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("composition.employment_form")}</Label>
        <div className="border-border/60 flex gap-1 rounded-lg border p-1">
          {CATEGORY_KEYS.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleCategoryChange(cat.value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                state.employmentCategory === cat.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {state.employmentCategory === "deltid" && (
        <div className="space-y-2">
          <Label htmlFor="drawer-pct">
            {t("composition.employment_percentage_label", {
              percentage: String(state.employmentPercentage),
            })}
          </Label>
          <input
            id="drawer-pct"
            type="range"
            min={10}
            max={99}
            step={5}
            value={state.employmentPercentage}
            onChange={(e) => {
              onUserEdit();
              updateState({ employmentPercentage: Number(e.target.value), proposal: null });
            }}
            className="accent-primary w-full"
          />
          <div className="text-muted-foreground flex justify-between font-mono text-xs">
            <span>10%</span>
            <span>99%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Gjennomgang ────────────────────────────────────────────────────

function GjennomgangStep({
  state,
  updateState,
  workspaceId,
  actorProfileId,
  onUserEdit,
}: {
  state: DrawerState;
  updateState: (patch: Partial<DrawerState>) => void;
  workspaceId: string;
  actorProfileId: string | null;
  onUserEdit: () => void;
}) {
  const { t } = useTranslation("contracts");
  const composeMutation = useComposeContract();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerField, setDrawerField] = useState("");

  // Phase 4 — deprecated-template banner. `ComposeResult.resolved_template`
  // only carries `{ template_id, template_name, source }` — NOT `deprecated_at`.
  // We fetch the resolved template lightly once we have its id so the banner
  // can surface a non-blocking advisory above the cascade review.
  // Drift between the composed proposal and the template metadata here is
  // acceptable: the proposal + derivation still succeed, we just nudge the
  // admin that a newer template exists.
  const resolvedTemplateId = state.proposal?.resolved_template?.template_id ?? null;
  const [deprecatedAt, setDeprecatedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!resolvedTemplateId || !workspaceId) {
      setDeprecatedAt(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/contracts/templates/${resolvedTemplateId}?workspace_id=${workspaceId}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { deprecated_at?: string | null } };
        if (cancelled) return;
        setDeprecatedAt(json.data?.deprecated_at ?? null);
      } catch {
        // Non-fatal — banner simply stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedTemplateId, workspaceId]);

  // Trigger derivation on mount when we don't have a proposal yet.
  const triggeredRef = useRef(false);
  useEffect(() => {
    if (triggeredRef.current) return;
    if (!workspaceId || !state.profileId || state.proposal) return;
    triggeredRef.current = true;

    updateState({ isLoading: true });
    composeMutation.mutate(
      {
        workspace_id: workspaceId,
        profile_id: state.profileId,
        actor_profile_id: actorProfileId ?? "",
        position_title: state.positionTitle,
        employment_category: state.employmentCategory,
        employment_percentage: state.employmentPercentage,
        persist: false,
      },
      {
        onSuccess: (proposal) => updateState({ proposal, isLoading: false }),
        onError: (err: Error) => {
          updateState({ isLoading: false });
          toast.error(err.message);
        },
      },
    );
  }, [
    workspaceId,
    state.profileId,
    state.positionTitle,
    state.employmentCategory,
    state.employmentPercentage,
    state.proposal,
    composeMutation,
    updateState,
  ]);

  if (state.isLoading || (!state.proposal && !composeMutation.isError)) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="text-primary mb-4 h-10 w-10 animate-spin" />
        <p className="text-muted-foreground text-sm">{t("composition.loading_cascade")}</p>
      </div>
    );
  }

  if (composeMutation.isError || !state.proposal) {
    const msg =
      composeMutation.error instanceof Error
        ? composeMutation.error.message
        : t("composition.error_fetch_proposal");
    // Guard: when resolveComposition fails on a missing K1b binding we want
    // to point admin to the Bindinger tab explicitly. The message heuristic
    // matches the validation error string surface in resolve-composition.ts.
    const isBindingError = /binding|mapping|employment_category/i.test(msg);
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertTriangle className="text-destructive h-10 w-10" />
        <p className="text-destructive text-sm font-medium">{msg}</p>
        {isBindingError && (
          <p className="text-muted-foreground text-xs">{t("composition.binding_missing_hint")}</p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            triggeredRef.current = false;
            updateState({ proposal: null });
          }}
        >
          {t("composition.try_again")}
        </Button>
      </div>
    );
  }

  const proposal = state.proposal;
  const terms = proposal.employment_terms;
  const allValidations = [
    ...proposal.validations.ok,
    ...proposal.validations.warning,
    ...proposal.validations.blocker,
  ];

  const ghostValues = [
    {
      key: "timelonn",
      label: t("composition.ghost_hourly_rate"),
      value: terms.hourly_rate !== null ? `${terms.hourly_rate} kr/t` : t("composition.not_set"),
      source: t("composition.ghost_source_tariff", {
        framework: proposal.framework_snapshot.framework_name,
      }),
    },
    {
      key: "stillingsprosent",
      label: t("composition.ghost_percentage"),
      value: `${terms.employment_percentage}%`,
      source: t("composition.ghost_source_step2"),
    },
    {
      key: "kategori",
      label: t("composition.ghost_category"),
      value: terms.employment_category,
      source: t("composition.ghost_source_step2"),
    },
    {
      key: "rammeverk",
      label: t("composition.ghost_framework"),
      value: proposal.framework_snapshot.framework_name,
      source: t("composition.ghost_source_snapshot", {
        date: proposal.framework_snapshot.snapshot_date.split("T")[0] ?? "",
      }),
    },
  ];

  function handleAcknowledge(key: string) {
    onUserEdit();
    const next = new Set(state.acknowledgedBlocks);
    next.add(key);
    updateState({ acknowledgedBlocks: next });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading text-foreground text-lg">{t("composition.review_title")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("composition.review_description")}</p>
      </div>

      {/* Phase 4 — deprecated-template banner. Non-blocking: send stays
          enabled (the gate is `validations.blocker`, not deprecation).
          Warm amber via `--warning` CSS variable — never red. Existing
          contracts derived from this template are unaffected; the banner
          is a forward-looking nudge to pick a live template next time. */}
      {deprecatedAt && (
        <aside
          className="flex items-start gap-3 rounded-lg border-l-2 px-4 py-3"
          style={{
            background: "hsl(var(--warning) / 0.08)",
            borderLeftColor: "hsl(var(--warning))",
          }}
        >
          <div className="flex-1 space-y-1">
            <p className="font-heading text-foreground text-sm">
              {t("composition.deprecated_title")}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("composition.deprecated_description")}{" "}
              <a
                href="/dashboard/contracts?tab=maler"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:no-underline"
              >
                {t("composition.deprecated_link")}
              </a>
            </p>
          </div>
        </aside>
      )}

      <BlockerCounter
        blockerCount={proposal.validations.blocker.length}
        warningCount={proposal.validations.warning.length}
      />

      <div className="space-y-3">
        {ghostValues.map((gv) => (
          <GhostValueCard
            key={gv.key}
            label={gv.label}
            value={gv.value}
            source={gv.source}
            acknowledged={state.acknowledgedBlocks.has(gv.key)}
            onAcknowledge={() => handleAcknowledge(gv.key)}
            onClickExplain={() => {
              setDrawerField(gv.key);
              setDrawerOpen(true);
            }}
          />
        ))}
      </div>

      {allValidations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
            {t("composition.compliance_label")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {allValidations.map((v) => (
              <ComplianceBadge key={v.rule_id} level={v.level} message={v.message} />
            ))}
          </div>
        </div>
      )}

      {proposal.mandatory_clauses.length > 0 && (
        <details className="border-border/60 rounded-lg border">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium select-none">
            <Lock className="text-muted-foreground h-4 w-4" />
            {t("composition.mandatory_clauses", {
              count: String(proposal.mandatory_clauses.length),
            })}
          </summary>
          <div className="border-border/60 space-y-3 border-t px-4 py-3">
            {proposal.mandatory_clauses.map((clause) => (
              <div key={clause.rule_id}>
                <p className="text-sm font-medium">{clause.title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{clause.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      <ReasoningDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerField}
        source={proposal.framework_snapshot.framework_name}
        explanation={t("composition.reasoning_explanation", {
          framework: proposal.framework_snapshot.framework_name,
          date: proposal.framework_snapshot.snapshot_date.split("T")[0] ?? "",
        })}
      />
    </div>
  );
}

// ── Step 4: Bekreft — summary + inline preview ─────────────────────────────

function BekreftStep({
  state,
  updateState,
  onUserEdit,
}: {
  state: DrawerState;
  updateState: (patch: Partial<DrawerState>) => void;
  onUserEdit: () => void;
}) {
  const { t } = useTranslation("contracts");
  const proposal = state.proposal;

  if (!proposal) {
    return <p className="text-muted-foreground text-sm">{t("composition.no_proposal")}</p>;
  }

  const terms = proposal.employment_terms;

  const summaryItems = [
    {
      key: "stilling",
      label: t("composition.summary_position"),
      value: terms.position_title || "—",
    },
    { key: "kategori", label: t("composition.summary_category"), value: terms.employment_category },
    {
      key: "prosent",
      label: t("composition.summary_percentage"),
      value: `${terms.employment_percentage}%`,
    },
    {
      key: "timelonn",
      label: t("composition.summary_hourly_rate"),
      value: terms.hourly_rate !== null ? `${terms.hourly_rate} kr/t` : t("composition.not_set"),
    },
  ];

  function handleAcknowledge(key: string) {
    onUserEdit();
    const next = new Set(state.acknowledgedBlocks);
    next.add(key);
    updateState({ acknowledgedBlocks: next });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading text-foreground text-lg">{t("composition.confirm_title")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("composition.confirm_description")}</p>
      </div>

      <AcknowledgementRing
        totalBlocks={summaryItems.length}
        acknowledgedBlocks={
          summaryItems.filter((item) => state.acknowledgedBlocks.has(item.key)).length
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {summaryItems.map((item, idx) => {
            const acked = state.acknowledgedBlocks.has(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleAcknowledge(item.key)}
                data-testid={`acknowledgement-ring-block-${idx}`}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  acked
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 hover:border-muted-foreground/40"
                }`}
              >
                <p className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-medium">{item.value}</p>
                {acked && <CheckCircle className="text-primary mt-2 h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </AcknowledgementRing>

      {/* Inline preview — uses withEntrance wrapper inside ContractPreviewEditor.
          When proposal.resolved_template is null we skip the editor to keep the
          step usable; the send step also works without preview. */}
      {(() => {
        console.log("[bekreft-render] HMR-MARKER-v2", {
          previewHtmlLen: state.previewHtml?.length ?? 0,
          hasResolvedTpl: !!proposal?.resolved_template,
          tplId: proposal?.resolved_template?.template_id ?? null,
        });
        return null;
      })()}
      {state.previewHtml && (
        <div>
          <h4 className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
            {t("composition.preview_label")}
          </h4>
          <ContractPreviewEditor
            contentHtml={state.previewHtml}
            onContentChange={(html) => {
              onUserEdit();
              updateState({ editedHtml: html });
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Step 5: Send ───────────────────────────────────────────────────────────

function SendStep({
  state,
  updateState,
  workspaceId,
  actorProfileId,
  composeMutation,
  sendMutation,
  onSuccess,
}: {
  state: DrawerState;
  updateState: (patch: Partial<DrawerState>) => void;
  workspaceId: string;
  actorProfileId: string | null;
  composeMutation: ReturnType<typeof useComposeContract>;
  sendMutation: ReturnType<typeof useSendContract>;
  onSuccess: (contractId: string) => void;
}) {
  const { t } = useTranslation("contracts");
  const blockerCount = state.proposal?.validations.blocker.length ?? 0;
  const missingPii = state.proposal?.placeholder_status.missing ?? [];
  const hasBlockers = blockerCount > 0;
  const piiComplete = missingPii.length === 0;
  const isSubmitting = state.isSending;

  async function handleSubmit() {
    if (!workspaceId || !state.profileId) return;
    updateState({ isSending: true });

    try {
      const composed = await composeMutation.mutateAsync({
        workspace_id: workspaceId,
        profile_id: state.profileId,
        actor_profile_id: actorProfileId ?? "",
        position_title: state.positionTitle,
        employment_category: state.employmentCategory,
        employment_percentage: state.employmentPercentage,
        persist: true,
      });

      const contractId = composed.contract_id;
      if (!contractId) throw new Error(t("composition.contract_not_saved"));

      updateState({ proposal: composed });

      if (piiComplete) {
        await sendMutation.mutateAsync({ contract_id: contractId });
        toast.success(t("composition.contract_sent_for_signing"));
      } else {
        toast.success(t("composition.contract_created_collecting"));
      }

      onSuccess(contractId);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("toast.something_went_wrong");
      toast.error(message);
    } finally {
      updateState({ isSending: false });
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
      {hasBlockers ? (
        <>
          <AlertTriangle className="text-destructive h-10 w-10" />
          <div>
            <p className="text-destructive text-sm font-medium">
              {t("composition.cannot_send", {
                count: String(blockerCount),
                blockerWord:
                  blockerCount === 1
                    ? t("composition.blocker_singular")
                    : t("composition.blocker_plural"),
              })}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("composition.resolve_blockers")}
            </p>
          </div>
        </>
      ) : (
        <>
          <Sparkles className="text-primary h-10 w-10" />
          <div>
            <p className="text-sm font-medium">{t("composition.ready_to_send")}</p>
            {!piiComplete && (
              <p className="text-muted-foreground mt-1 text-xs">
                {t("composition.missing_pii_notice")}
              </p>
            )}
          </div>
        </>
      )}

      {missingPii.length > 0 && (
        <div
          className="text-warning-foreground max-w-sm rounded-lg border p-4 text-left text-sm"
          style={{
            background: "hsl(var(--warning) / 0.05)",
            borderColor: "hsl(var(--warning) / 0.3)",
          }}
        >
          <p className="mb-1 font-medium">{t("composition.missing_pii_title")}</p>
          <ul className="list-inside list-disc text-xs">
            {missingPii.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">{t("composition.missing_pii_footer")}</p>
        </div>
      )}

      <Button
        onClick={() => void handleSubmit()}
        disabled={hasBlockers || isSubmitting}
        size="lg"
        className="min-w-48"
        data-testid="send-contract-button"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("composition.sending")}
          </>
        ) : piiComplete ? (
          <>
            <Send className="mr-2 h-4 w-4" />
            {t("composition.send_contract")}
          </>
        ) : (
          t("composition.create_and_collect")
        )}
      </Button>
    </div>
  );
}
