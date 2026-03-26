"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Settings2, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { useWorkspaceIntelligence } from "../_hooks/useWorkspaceIntelligence";
import { useTypewriterSequence } from "../_hooks/useTypewriter";
import { WizardLoadingOverlay } from "./WizardLoadingOverlay";

export function Step3About({ state, updateState }: WizardStepProps<JoinState>) {
  const { content, status, enrichAndGenerate, rewriteField } = useWorkspaceIntelligence(
    state,
    updateState,
  );

  const [aboutUs, setAboutUs] = useState(state.about.aboutUs ?? "");
  const [ourHistory, setOurHistory] = useState(state.about.ourHistory ?? "");
  const [ourConcept, setOurConcept] = useState(state.about.ourConcept ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});

  // Auto-trigger on mount (first time entering Step 3)
  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!hasTriggered.current && status === "idle") {
      hasTriggered.current = true;
      enrichAndGenerate();
    }
  }, [status, enrichAndGenerate]);

  // Build typewriter fields from content
  const hasApplied = useRef(false);
  const typewriterFields = useMemo(() => {
    if (!content || hasApplied.current) return [];
    const fields: Array<{ key: string; value: string }> = [];
    if (content.about_us) fields.push({ key: "aboutUs", value: content.about_us });
    if (content.our_history) fields.push({ key: "ourHistory", value: content.our_history });
    if (content.our_concept) fields.push({ key: "ourConcept", value: content.our_concept });
    return fields;
  }, [content]);

  const shouldType = typewriterFields.length > 0 && !hasApplied.current;
  const {
    values: typedValues,
    activeIndex,
    allDone,
  } = useTypewriterSequence(typewriterFields, shouldType, {
    initialDelay: 200,
    speed: 12,
    gap: 300,
  });

  // Sync typewriter output to state
  useEffect(() => {
    if (!shouldType) return;
    if (typedValues.aboutUs && !userEdited.aboutUs) setAboutUs(typedValues.aboutUs);
    if (typedValues.ourHistory && !userEdited.ourHistory) setOurHistory(typedValues.ourHistory);
    if (typedValues.ourConcept && !userEdited.ourConcept) setOurConcept(typedValues.ourConcept);
  }, [typedValues, shouldType, userEdited]);

  // Mark typewriter done
  useEffect(() => {
    if (allDone && shouldType) hasApplied.current = true;
  }, [allDone, shouldType]);

  // Sync content changes — for per-field rewrites, apply only the changed field
  const prevContentRef = useRef(content);
  useEffect(() => {
    if (!content) return;
    const prev = prevContentRef.current;
    prevContentRef.current = content;

    if (!prev) return;

    if (content.about_us !== prev.about_us && content.about_us) setAboutUs(content.about_us);
    if (content.our_history !== prev.our_history && content.our_history)
      setOurHistory(content.our_history);
    if (content.our_concept !== prev.our_concept && content.our_concept)
      setOurConcept(content.our_concept);
  }, [content]);

  const markEdited = (field: string) => {
    setUserEdited((prev) => ({ ...prev, [field]: true }));
  };

  const handleRewriteField = async (
    contentKey: "about_us" | "our_history" | "our_concept",
    stateKey: "aboutUs" | "ourHistory" | "ourConcept",
    mode: "rewrite" | "longer" | "shorter" = "rewrite",
  ) => {
    const currentText =
      stateKey === "aboutUs" ? aboutUs : stateKey === "ourHistory" ? ourHistory : ourConcept;
    await rewriteField(contentKey, currentText, mode);
  };

  /**
   * Sync local form fields to wizard state on every change.
   * WizardNavBar handles navigation — the step no longer has its own buttons.
   * WizardShell's validation runs against wizard state via the step's validationKey.
   */
  useEffect(() => {
    updateState({
      about: {
        ...state.about,
        aboutUs,
        ourHistory: ourHistory || undefined,
        ourConcept,
      },
    });
  }, [aboutUs, ourHistory, ourConcept]); // only sync when local fields change

  const typingField =
    activeIndex >= 0 && activeIndex < typewriterFields.length
      ? typewriterFields[activeIndex]!.key
      : null;

  const isLoading = status === "enriching" || status === "generating";

  // Show loading overlay when AI is enriching/generating and no content exists yet
  const isWaitingForContent = isLoading && !content && !allDone;

  if (isWaitingForContent) {
    return (
      <WizardLoadingOverlay
        messages={[
          "Analyserer bedriften din...",
          "Leser nettsiden og offentlig informasjon...",
          "Skriver utkast til tekster...",
          "Nesten ferdig...",
        ]}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Fortell om bedriften</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Dette brukes til opplaering og onboarding av ansatte.
        </p>
        {isLoading && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {status === "enriching" ? "Henter informasjon..." : "Skriver utkast..."}
          </p>
        )}
        {allDone && (
          <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            Utkast fylt ut — rediger fritt
          </p>
        )}
        {status === "failed" && (
          <p className="text-muted-foreground mt-2 text-xs">
            Kunne ikke generere utkast. Fyll inn manuelt.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <TypewriterTextarea
          label="Om oss"
          id="aboutUs"
          rows={3}
          placeholder="Beskriv bedriften din..."
          value={aboutUs}
          typing={typingField === "aboutUs"}
          autoFilled={allDone && !userEdited.aboutUs && !!content?.about_us}
          isLoading={isLoading}
          onChange={(val) => {
            setAboutUs(val);
            markEdited("aboutUs");
            setErrors((prev) => ({ ...prev, aboutUs: "" }));
          }}
          onRewrite={(mode) => handleRewriteField("about_us", "aboutUs", mode)}
          error={errors.aboutUs}
        />

        <TypewriterTextarea
          label="Var historie"
          labelSuffix="(valgfritt)"
          id="ourHistory"
          rows={2}
          placeholder="Fortell historien bak bedriften..."
          value={ourHistory}
          typing={typingField === "ourHistory"}
          autoFilled={allDone && !userEdited.ourHistory && !!content?.our_history}
          isLoading={isLoading}
          onChange={(val) => {
            setOurHistory(val);
            markEdited("ourHistory");
          }}
          onRewrite={(mode) => handleRewriteField("our_history", "ourHistory", mode)}
        />

        <TypewriterTextarea
          label="Vart konsept"
          id="ourConcept"
          rows={3}
          placeholder="Hva gjor dere unike?"
          value={ourConcept}
          typing={typingField === "ourConcept"}
          autoFilled={allDone && !userEdited.ourConcept && !!content?.our_concept}
          isLoading={isLoading}
          onChange={(val) => {
            setOurConcept(val);
            markEdited("ourConcept");
            setErrors((prev) => ({ ...prev, ourConcept: "" }));
          }}
          onRewrite={(mode) => handleRewriteField("our_concept", "ourConcept", mode)}
          error={errors.ourConcept}
        />
      </div>
    </div>
  );
}

/* -- Typewriter textarea with gear menu -- */

type AiAction = "rewrite" | "longer" | "shorter";

function TypewriterTextarea({
  label,
  labelSuffix,
  id,
  rows,
  placeholder,
  value,
  typing,
  autoFilled,
  isLoading,
  onChange,
  onRewrite,
  error,
}: {
  label: string;
  labelSuffix?: string;
  id: string;
  rows: number;
  placeholder: string;
  value: string;
  typing: boolean;
  autoFilled: boolean;
  isLoading: boolean;
  onChange: (val: string) => void;
  onRewrite: (mode: AiAction) => void;
  error?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleAction = (action: AiAction) => {
    setMenuOpen(false);
    onRewrite(action);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id}>
            {label}
            {labelSuffix && <span className="text-muted-foreground ml-1">{labelSuffix}</span>}
          </Label>
          {typing && (
            <span className="text-brand-orange flex animate-pulse items-center gap-0.5 text-[10px]">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          )}
          {autoFilled && !typing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
        </div>

        {/* Gear menu — visible when field has content and not typing */}
        {value && !typing && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={isLoading}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--brand-orange)] transition-colors hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange-dark)] disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Settings2 className="h-3.5 w-3.5" />
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-border bg-card py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => handleAction("rewrite")}
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs text-foreground hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                >
                  Skriv om
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("longer")}
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs text-foreground hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                >
                  Gjor lengre
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("shorter")}
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs text-foreground hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                >
                  Gjor kortere
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
