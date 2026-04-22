"use client";

/**
 * BulkSendDrawer — right-side glass Sheet for sending a single template to
 * multiple employees at once (Phase 3, council 2026-04-22 Q4).
 *
 * 3 steps:
 *   1. Velg ansatte — virtualized multi-select with "Velg alle kvalifiserte"
 *   2. Gjennomgang  — summary card (X selected · Y missing PII · Z already active)
 *   3. Resultat     — per-profile outcomes from POST /api/employment-contracts/bulk
 *
 * Scope gates:
 *   - Caller (MalerTab) only opens this drawer when the selected template has
 *     `published_at IS NOT NULL AND deprecated_at IS NULL`.
 *   - Server enforces the same gate.
 *   - 100-profile cap is enforced server-side; the UI prevents going over.
 *
 * Phase 3 notes:
 *   - Serial iteration — no progress polling. Step 3 renders results after the
 *     sync batch returns. For large batches the admin sees the spinner on
 *     "Send" and then the results list.
 *   - batch_id is returned by the server but the UI does not yet filter the
 *     Kontrakter tab by it (that requires a DB column — follow-up).
 */

import { useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@smartout/ui";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  SelectEmployeeStep,
  type EmployeeProfile,
  type EmployeeStatusChip,
} from "./SelectEmployeeStep";

type StepId = "select" | "review" | "result";

const STEP_ORDER: StepId[] = ["select", "review", "result"];

const MAX_PROFILES = 100;

type BulkResult = {
  batch_id: string;
  template_id: string;
  counts: { sent: number; pending: number; failed: number };
  results: Array<{
    profile_id: string;
    status: "created_and_sent" | "created_pending_data" | "failed";
    contract_id?: string;
    signing_contract_id?: string;
    error?: string;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  onSuccess?: (result: BulkResult) => void;
};

const STEP_ENTRANCE = { type: "spring" as const, stiffness: 45, damping: 22, mass: 2.0 };
const STEP_EXIT = { type: "spring" as const, stiffness: 40, damping: 24, mass: 2.0 };
const UNDERLINE_SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

export function BulkSendDrawer({ open, onOpenChange, templateId, templateName, onSuccess }: Props) {
  const { t } = useTranslation("contracts");
  const { workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  const [stepId, setStepId] = useState<StepId>("select");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const currentIndex = STEP_ORDER.indexOf(stepId);

  function resetAndClose() {
    setStepId("select");
    setSelectedIds(new Set());
    setResult(null);
    setIsSending(false);
    onOpenChange(false);
  }

  function goNext() {
    const next = STEP_ORDER[currentIndex + 1];
    if (!next) return;
    setDirection("forward");
    setStepId(next);
  }

  function goBack() {
    const prev = STEP_ORDER[currentIndex - 1];
    if (!prev) return;
    setDirection("back");
    setStepId(prev);
  }

  const canProceed = useMemo(() => {
    if (stepId === "select") return selectedIds.size > 0 && selectedIds.size <= MAX_PROFILES;
    if (stepId === "review") return !isSending;
    return false;
  }, [stepId, selectedIds.size, isSending]);

  async function handleSend() {
    if (!workspaceId || selectedIds.size === 0) return;
    setIsSending(true);

    try {
      const res = await fetch("/api/employment-contracts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          template_id: templateId,
          profile_ids: Array.from(selectedIds),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? t("bulk_send.error_generic"));
      }

      const json = (await res.json()) as BulkResult;
      setResult(json);
      onSuccess?.(json);
      setDirection("forward");
      setStepId("result");
      toast.success(
        t("bulk_send.toast_result", {
          sent: String(json.counts.sent),
          pending: String(json.counts.pending),
          failed: String(json.counts.failed),
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("bulk_send.error_generic");
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? resetAndClose() : onOpenChange(next))}>
      <SheetContent
        side="right"
        className="bg-background/80 border-border/60 relative flex w-full flex-col gap-0 p-0 backdrop-blur-xl sm:max-w-[640px]"
      >
        {/* Header */}
        <header className="relative z-10 flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="font-heading text-foreground text-2xl leading-tight tracking-tight">
              {t("bulk_send.drawer_title")}
            </h2>
            <p className="text-muted-foreground mt-1 font-mono text-xs">{templateName}</p>
          </div>
        </header>

        {/* Step indicator */}
        <nav
          aria-label={t("bulk_send.step_nav_label")}
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
                    {String(i + 1).padStart(2, "0")} · {t(`bulk_send.step_${id}`)}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="bulk-send-drawer-active"
                      className="bg-primary absolute -bottom-1 left-0 h-[2px] w-full"
                      transition={UNDERLINE_SPRING}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step body */}
        <div className="relative z-10 flex flex-1 flex-col overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={stepId}
              custom={direction}
              initial={{ opacity: 0, x: direction === "forward" ? 24 : -24 }}
              animate={{ opacity: 1, x: 0, transition: STEP_ENTRANCE }}
              exit={{
                opacity: 0,
                x: direction === "forward" ? -16 : 16,
                transition: STEP_EXIT,
              }}
              className="flex flex-1 flex-col"
            >
              {stepId === "select" && (
                <SelectStep
                  workspaceId={workspaceId}
                  selectedIds={selectedIds}
                  onChange={setSelectedIds}
                />
              )}
              {stepId === "review" && (
                <ReviewStep selectedCount={selectedIds.size} templateName={templateName} />
              )}
              {stepId === "result" && result && <ResultStep result={result} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="border-border/60 relative z-10 flex items-center justify-between border-t px-6 py-4">
          {stepId !== "result" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={currentIndex === 0 || isSending}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("bulk_send.back")}
            </Button>
          ) : (
            <span aria-hidden />
          )}

          {stepId === "select" && (
            <Button type="button" size="sm" onClick={goNext} disabled={!canProceed}>
              {t("bulk_send.next_review")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {stepId === "review" && (
            <Button type="button" size="sm" onClick={() => void handleSend()} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("bulk_send.sending")}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("bulk_send.send_batch", { count: String(selectedIds.size) })}
                </>
              )}
            </Button>
          )}
          {stepId === "result" && (
            <Button type="button" size="sm" onClick={resetAndClose}>
              {t("bulk_send.close")}
            </Button>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

// ── Step 1: Select ─────────────────────────────────────────────────────────

function SelectStep({
  workspaceId,
  selectedIds,
  onChange,
}: {
  workspaceId: string;
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const { t } = useTranslation("contracts");
  // Phase 3 does not yet compute per-profile chips server-side (would need a
  // join against employment_contract for active-contract + profile PII).
  // The chip hook is wired for Phase 3b.
  const getChip = (_p: EmployeeProfile): EmployeeStatusChip => null;

  function handleSelectAll(filtered: EmployeeProfile[]) {
    const next = new Set(selectedIds);
    for (const p of filtered.slice(0, MAX_PROFILES)) next.add(p.profile_id);
    onChange(next);
    if (filtered.length > MAX_PROFILES) {
      toast.warning(t("bulk_send.cap_warning", { cap: String(MAX_PROFILES) }));
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {t("bulk_send.select_description", { cap: String(MAX_PROFILES) })}
      </p>
      <SelectEmployeeStep
        mode="multi"
        workspaceId={workspaceId}
        selectedIds={selectedIds}
        onChange={onChange}
        onSelectAll={handleSelectAll}
        getStatusChip={getChip}
      />
    </div>
  );
}

// ── Step 2: Review ─────────────────────────────────────────────────────────

function ReviewStep({
  selectedCount,
  templateName,
}: {
  selectedCount: number;
  templateName: string;
}) {
  const { t } = useTranslation("contracts");
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading text-foreground text-lg">{t("bulk_send.review_title")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("bulk_send.review_description")}</p>
      </div>

      <div className="border-border/60 bg-muted/20 grid grid-cols-2 gap-3 rounded-xl border p-5">
        <div>
          <p className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
            {t("bulk_send.review_template")}
          </p>
          <p className="font-heading mt-1 text-sm">{templateName}</p>
        </div>
        <div>
          <p className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
            {t("bulk_send.review_count")}
          </p>
          <p className="font-heading mt-1 text-sm">
            {t("bulk_send.review_count_value", { count: String(selectedCount) })}
          </p>
        </div>
      </div>

      <div
        className="text-warning-foreground rounded-lg border p-4 text-sm"
        style={{
          background: "hsl(var(--warning) / 0.05)",
          borderColor: "hsl(var(--warning) / 0.3)",
        }}
      >
        <p className="font-medium">{t("bulk_send.review_caveat_title")}</p>
        <p className="mt-1 text-xs leading-relaxed">{t("bulk_send.review_caveat_body")}</p>
      </div>
    </div>
  );
}

// ── Step 3: Result ─────────────────────────────────────────────────────────

function ResultStep({ result }: { result: BulkResult }) {
  const { t } = useTranslation("contracts");
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-foreground text-lg">{t("bulk_send.result_title")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("bulk_send.result_description", {
            sent: String(result.counts.sent),
            pending: String(result.counts.pending),
            failed: String(result.counts.failed),
          })}
        </p>
      </div>

      <ul className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-xl border">
        {result.results.map((row) => (
          <li key={row.profile_id} className="flex items-center gap-3 px-4 py-3 text-sm">
            {row.status === "failed" ? (
              <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  row.status === "created_and_sent" ? "text-primary" : "text-warning"
                }`}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs">{row.profile_id.slice(0, 8)}</p>
              {row.error && <p className="text-destructive mt-0.5 truncate text-xs">{row.error}</p>}
            </div>
            <span className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
              {row.status === "created_and_sent"
                ? t("bulk_send.result_sent")
                : row.status === "created_pending_data"
                  ? t("bulk_send.result_pending")
                  : t("bulk_send.result_failed")}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground font-mono text-[10px]">
        batch_id: <span className="text-foreground">{result.batch_id}</span>
      </p>
    </div>
  );
}
