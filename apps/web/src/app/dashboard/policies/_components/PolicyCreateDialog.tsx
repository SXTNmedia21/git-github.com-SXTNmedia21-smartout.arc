"use client";

/**
 * PolicyCreateDialog — glassmorphic modal for creating a new workspace policy.
 *
 * Fields: policy_type (select), name (text, required), description (textarea, required).
 * On submit: calls createPolicy server action → toast success + dialog close.
 *
 * Spring motion from motionTokens.spring (Nordic Split).
 * No hardcoded color values — CSS variables only.
 */

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion as motionTokens } from "@smartout/design-tokens";
import { DialogHeader } from "@/components/dashboard/DialogHeader";
import { DialogFooter } from "@/components/dashboard/DialogFooter";
import { createPolicy, type CreatePolicyInput } from "../_actions/policy-actions";

// ─── Shared input styles (mirror invite-member-dialog) ─────────
const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/20 focus:outline-none";

const selectClass =
  "w-full appearance-none rounded-xl border border-border bg-background px-3 py-2.5 pr-8 text-sm text-foreground transition-all focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/20 focus:outline-none";

const labelClass = "text-xs font-semibold tracking-wider uppercase text-muted-foreground";

// ─── Policy type options ────────────────────────────────────────

type PolicyTypeOption = {
  value: CreatePolicyInput["policy_type"];
  label: string;
};

const POLICY_TYPE_OPTIONS: PolicyTypeOption[] = [
  { value: "operational", label: "Drift" },
  { value: "haccp", label: "HACCP" },
  { value: "hr", label: "HR" },
  { value: "safety", label: "Sikkerhet" },
  { value: "access", label: "Tilgang" },
  { value: "payroll", label: "Lønn" },
  { value: "custom", label: "Egendefinert" },
];

// ─── Props ──────────────────────────────────────────────────────

type PolicyCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (policyId: string) => void;
};

// ─── Component ─────────────────────────────────────────────────

export function PolicyCreateDialog({ isOpen, onClose, onCreated }: PolicyCreateDialogProps) {
  const [policyType, setPolicyType] = useState<CreatePolicyInput["policy_type"]>("operational");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && description.trim().length > 0 && !isSubmitting;

  const reset = useCallback(() => {
    setPolicyType("operational");
    setName("");
    setDescription("");
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    const result = await createPolicy({
      name: name.trim(),
      description: description.trim(),
      policy_type: policyType,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error ?? "Kunne ikke lagre policy");
      return;
    }

    toast.success("Policy lagret");
    onCreated?.(result.policy_id);
    handleClose();
  }, [canSubmit, name, description, policyType, onCreated, handleClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="policy-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionTokens.exitMs / 1000 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
          style={{
            background:
              "radial-gradient(circle at 50% 30%, color-mix(in oklch, var(--panel) 55%, transparent), color-mix(in oklch, var(--panel-deep) 78%, transparent))",
            backdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            key="policy-shell"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", ...motionTokens.spring }}
            className="bg-background/80 ring-border/60 relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl shadow-[0_32px_120px_-24px_rgba(0,0,0,0.55)] ring-1 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glass gradient overlay */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, white / 10% 0%, white / 2% 35%, transparent 60%)",
              }}
            />
            {/* Ambient glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -right-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklch, var(--brand-glow-warm) 45%, transparent), transparent 70%)",
              }}
            />

            <div className="relative flex flex-col">
              <DialogHeader
                title="Ny policy"
                subtitle="Definer en arbeidsplasspolicy"
                icon={<BookOpen className="text-brand-orange h-5 w-5" />}
                onClose={handleClose}
              />

              {/* Form content */}
              <div className="max-h-[60vh] overflow-y-auto px-7 pb-2">
                <motion.div
                  className="space-y-5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    ...motionTokens.spring,
                  }}
                >
                  {/* Policy type */}
                  <div className="space-y-1.5">
                    <label className={labelClass}>Type</label>
                    <div className="relative">
                      <select
                        value={policyType}
                        onChange={(e) =>
                          setPolicyType(e.target.value as CreatePolicyInput["policy_type"])
                        }
                        className={selectClass}
                      >
                        {POLICY_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className={labelClass}>Tittel</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="F.eks. Fraværspolicy"
                      className={inputClass}
                      autoFocus
                      maxLength={200}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className={labelClass}>Beskrivelse</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Beskriv hva denne policyen dekker og hva som forventes..."
                      className={`${inputClass} resize-none`}
                      rows={4}
                      maxLength={2000}
                    />
                  </div>
                </motion.div>
              </div>

              <DialogFooter
                rightContent={
                  <>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className="bg-brand-orange hover:bg-brand-orange/90 ring-brand-orange/30 text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-[var(--shadow-cta-lg)] ring-1 transition-[transform,box-shadow] hover:scale-[1.02] hover:shadow-[var(--shadow-cta-lg-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {isSubmitting ? "Lagrer..." : "Lagre policy"}
                    </button>
                  </>
                }
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
